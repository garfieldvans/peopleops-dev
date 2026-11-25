# PeopleOps — System Overview

Status: updated after Phase 6. Phases 1–6 are implemented; later modules remain design targets.

## 1. Purpose

PeopleOps is an internal HRIS for **one company**. It replaces scattered spreadsheets with a single
system of record for people data and HR operations.

It is explicitly **not** a SaaS product: no tenants, no workspaces, no subscription billing, no
tenant onboarding. The single company has branches, departments, positions and employees.

## 2. Actors

| Actor                | Primary needs                                                          |
| -------------------- | ---------------------------------------------------------------------- |
| System administrator | Accounts, roles, permissions, audit review, system configuration       |
| HR administrator     | Employee records, organization structure, attendance, leave, documents |
| Manager              | Team roster, attendance/leave/overtime approvals, team reports         |
| Employee             | Own profile, clock in/out, leave and overtime requests, own payslips   |
| Payroll officer      | Salary components, payroll periods, payroll runs, payslips             |

Employee and User are **separate entities** (see `docs/database/erd.md`). A person may be an
employee without an account; an account may exist without being an employee.

## 3. Runtime topology

Phase 1 establishes three deployable applications and one datastore:

```
Browser
  │
  ├── apps/web        React 19 + Vite SPA (static build, served by Nginx in production)
  │       │  HTTPS JSON  /api/v1/*
  │       ▼
  ├── apps/api        NestJS modular monolith (REST + Swagger)
  │       │  Prisma
  │       ▼
  ├── PostgreSQL 16  ◄──── apps/worker   NestJS standalone process (scheduled/async jobs)
  │
  └── apps/worker     no HTTP surface; shares packages/database
```

The worker currently runs leave accrual/carry-over/expiry at 01:00 and read-only overtime
housekeeping at 02:00 in the company timezone read from the database. It shares the database
package and has no HTTP surface.

Deferred infrastructure (intentionally not in Phase 1):

- **Redis** — added together with the first real background job (BullMQ) or cache need.
- **Kafka** — only if an actual cross-process event stream requirement appears. The modular
  monolith communicates in-process today.
- **Socket.IO** — only when a realtime feature is specified (e.g. live approval inbox).
- **Nginx / Jenkins / AWS** — deployment concerns; addressed when a deployment phase is requested.

## 4. Architectural style

Modular monolith. One API process, internally split into modules with explicit boundaries.

```
apps/api/src/modules/<module>/
  <module>.module.ts      Nest wiring, exports the module's public service
  <module>.controller.ts  HTTP only: parse, authorize, delegate
  <module>.service.ts     business rules, transactions (public API of the module)
  <module>.repository.ts  Prisma access for this module's own tables
  dto/                    class-validator request/response DTOs
  policies/               authorization rules owned by the module
  index.ts                the ONLY public surface of the module
```

Rules that keep the boundaries real:

1. A module may import another module's **public service** (via its `index.ts`) or react to domain
   events. It may never import another module's repository, internal helpers or DTOs.
2. Cross-module data reads go through the owning module's service. Direct Prisma queries against
   another module's tables are a boundary violation.
3. Controllers stay thin — no business rules, no Prisma.
4. Operations with multi-table invariants run in a Prisma `$transaction` (leave balance, payroll,
   approval transitions).
5. Side effects that are not required for the request to succeed are emitted as domain events and
   handled asynchronously (in-process now, worker later).
6. No circular module imports. If two modules need each other, the shared rule moves into one owning
   module or a domain event is used.

## 5. Module map and ownership

| Module          | Owns (tables)                                                                                                                     | Depends on                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `auth`          | user_credentials, sessions, refresh_tokens                                                                                        | users                                                     |
| `users`         | users, roles, permissions, role_permissions, user_roles                                                                           | —                                                         |
| `organization`  | branches, departments, positions                                                                                                  | —                                                         |
| `employees`     | employees, employment_contracts, employee_salary, employee_documents                                                              | organization, users (account link)                        |
| `attendance`    | attendance_records, attendance_corrections                                                                                        | employees, organization                                   |
| `leave`         | leave_types, leave_policies, leave_assignments, leave_balances, leave_transactions, leave_requests                                | employees, attendance                                     |
| `overtime`      | overtime_policies, overtime_policy_assignments, overtime_requests, overtime_approvals, overtime_corrections, overtime_attachments | employees, attendance, leave                              |
| `payroll`       | payroll_periods, payroll_runs, payslips, payslip_lines, salary_components                                                         | employees, attendance, leave, overtime                    |
| `performance`   | review_cycles, reviews, goals                                                                                                     | employees                                                 |
| `learning`      | courses, course_sessions, enrollments                                                                                             | employees                                                 |
| `notifications` | notifications                                                                                                                     | users                                                     |
| `reports`       | (no tables; read models)                                                                                                          | query services exposed by other modules                   |
| `audit`         | audit_logs                                                                                                                        | — (written by all modules through an interceptor/service) |

Dependency direction is acyclic; `employees` and `organization` are the foundation, `reports` is a
leaf. Phase 6 deliberately keeps overtime approval rows inside the overtime module
(`overtime_approvals` with a `MANAGER`/`HR` stage) rather than introducing a generic workflow engine.
Leave still uses its own approval rows. A shared approval module remains a future option, not a
current dependency.

## 6. Cross-cutting concerns

- **Authentication**: JWT access token (short-lived, held in memory) + rotating refresh token in an
  httpOnly cookie. Argon2id password hashing.
- **Authorization**: RBAC at the route level (`@RequirePermissions(...)`) plus data-level checks in
  services (own record, direct reports, branch scope). Frontend permission checks are UX only.
- **Audit**: every state-changing business operation emits an audit entry (actor, action, entity,
  before/after, IP, user agent) through a shared `AuditService`.
- **Time**: all timestamps stored as UTC `timestamptz`. The company timezone (default
  `Asia/Jakarta`) is configuration, used to derive "work date" and to render dates. Date-only
  business fields (hire date, leave start/end) are `date` columns, not timestamps.
- **Money**: `Decimal(14,2)` in PostgreSQL, `Prisma.Decimal` in code, serialized to string over
  HTTP. Never `number`/float for money.
- **Validation**: class-validator DTOs on the API boundary (global `ValidationPipe`, whitelist,
  forbid unknown properties); Zod schemas on the web for forms. See ADR-005.
- **Errors**: RFC-style problem payload with a stable machine-readable `code` (see ADR-010).
- **Files**: employee documents and attachments go through a `StorageService` abstraction. Local
  disk in development, S3-compatible object storage in production. Never served by public URL;
  access is authorized and streamed/proxied.
- **Overtime evidence**: requested, actual, and verified minutes are separate fields. Approval sets
  `approvedMinutes`; completion records actual evidence; only verification sets `verifiedMinutes`.
  Overtime never mutates attendance or leave. Approved leave on the same work date blocks a new
  request, and attendance clock-out may supply the actual window without overwriting the record.
- **Effective-dated policy**: overtime stores a JSON policy snapshot on each request so later policy
  edits cannot rewrite history. Assignment precedence is employee, then department, then branch.

## 7. Frontend shape

`apps/web` is a single SPA organized by domain feature:

```
src/
  app/          router, providers, app shell
  features/     auth, employees, organization, attendance, leave, payroll, ...
  components/   shared app-level components (shell, page header, data table wrapper)
  lib/          api client, query client, formatting, permission helpers
  styles/       tailwind entry, token bridge
```

Server state lives in TanStack Query; Zustand is reserved for genuine client-only state (sidebar
state, unsaved form wizards). Forms use React Hook Form + Zod. UI is built on `@nemo-ui/ui`, with
project-specific components only where the library has no equivalent
(see `docs/design/ui-library-inventory.md`). Route pages are lazy-loaded behind `Suspense`, so the
app shell stays mounted while a page chunk loads.

## 8. Quality gates

Every phase must end with: TypeScript strict typecheck passing for every package, lint passing,
build passing for web/api/worker, and Prisma migrations applicable from an empty database. Business
rules with money, balances, or state machines get tests.

## 9. Non-goals (for now)

- Multi-tenancy, SaaS billing, tenant self-registration.
- Microservices, Kafka event bus, CQRS read databases.
- Mobile applications.
- Full statutory payroll calculation for a specific country (tax/BPJS rules) unless a later phase
  specifies the jurisdiction.
