# PeopleOps — Development Roadmap

Status: Phases 1–7 are complete, including attendance, leave, overtime, and payroll management.
Nothing beyond Phase 7 is authorized until the next phase is explicitly approved.

## Definition of done (applies to every phase)

1. Feature complete for the phase scope — no placeholder screens or fake data paths.
2. `pnpm -r typecheck`, `pnpm -r lint` and `pnpm -r build` pass.
3. Prisma migrations apply cleanly to an empty database.
4. Tests for rules involving money, balances, state machines or authorization.
5. Docs updated (structure, commands, env vars, API surface).
6. Manual smoke check of every screen added in the phase.

## Phase dependency graph

```
0 Discovery (done)
└── 1 Foundation
    └── 2 Auth + Users/RBAC
        └── 3 Organization + Employees (done)
            ├── 4 Attendance (done)
            └── 5 Leave (done)
                └── 6 Overtime (done, uses attendance + leave)
                    └── 7 Payroll (done, needs 4, 5, 6)
                        ├── 8 Performance / Learning
                        └── 9 Notifications + Reports
                            └── 10 Hardening & deployment
```

## Phases

### Phase 1 — Foundation — ✅ completed

Scope: pnpm workspace, `apps/{web,api,worker}`, `packages/{database,shared-types,validators,config}`,
Vite + React 19 + Tailwind 4 + Nemo UI smoke page, Nest 12 with versioning/Swagger/validation
pipe/exception filter, Prisma 7.10.1 + Docker Compose PostgreSQL 16, health endpoint
`GET /api/v1/health` (with DB readiness), worker bootstrap, `.env.example`, README, lint/typecheck/build.

Exit criteria: `docker compose up -d` → migrations run → `GET /api/v1/health` returns 200 with DB
status; web loads Nemo components with tokens applied; worker starts and exits cleanly.

Result: met. Postgres 16 healthy, `0_init` migration applied, health returned
`{"status":"ok","checks":{"database":{"status":"up","latencyMs":1}}}`, worker logged
`Database reachable` and exited 0, `pnpm typecheck`/`lint`/`build` passed for all 7 projects. Details in
`getting-started.md`.

Depends on: ADR-001..016. Blocks: everything.

### Phase 2 — Authentication and Access Management — ✅ completed

Scope: users, roles, permissions, Argon2id credentials, JWT access + rotating refresh cookie,
reuse detection, login/logout/refresh/me, password change, guard + `@RequirePermissions`, seed roles
(`SYSTEM_ADMIN`, `HR_ADMIN`, `PAYROLL_OFFICER`, `MANAGER`, `EMPLOYEE`), audit log base, rate limiting
on auth routes, web login page, session bootstrap, protected routing, permission-aware navigation.

Exit criteria: unauthenticated users cannot reach app routes; refresh rotation works and a replayed
token revokes the family; permission matrix enforced server-side; login failures throttled.

Result: met. Argon2id login, 15-minute JWT access token kept in memory, rotating refresh cookie with
reuse detection (a replayed token revokes the session family), `GET /auth/me` session bootstrap,
global `JwtAuthGuard` + `PermissionsGuard`, `OriginGuard`, login throttling, audit log and an
idempotent seed (5 system roles, permission catalogue, bootstrap administrator). Web: login page,
protected routing, permission-aware navigation, Users and Roles screens. `pnpm test` covers the API
unit suites and 11 web tests; `pnpm --filter @peopleops/api test:e2e` passes 7/7. Limitations: e2e
stubs the throttler and Figma references were unavailable; the later Phase 6 optimization removed the
bundle warning.

Blocks: all data modules.

### Phase 3 — Organization & Employee Management — ✅ completed

Company profile, branches, departments (hierarchy), positions and job levels with CRUD screens.
Employee directory with server-side search/filter/sort/pagination, tabbed profile, emergency contacts,
employment history with effective dates, private document storage behind an adapter, optional
user-account linking, and manager/self access scoping.

Exit criteria: an employee can exist without an account and get one later; sensitive personal fields
are hidden from managers without permission (verified via API); no history rows are overwritten.

Result: met. `apps/api/test/employees.e2e-spec.ts` passes 7/7 alongside the auth suite (14/14 total);
web tests pass 19/19, including employee directory and profile suites; `pnpm build` passes for all
workspaces. Docs: `docs/modules/organization.md`,
`docs/modules/employees.md`, `docs/security/permission-matrix.md`, `docs/database/phase-3-erd.md`.
Limitations: local disk document storage is development-only; employee photo upload and salary data
are out of scope for this phase.

### Phase 4 — Attendance — ✅ completed

Work schedules and shifts (including overnight), effective-dated assignments, clock-in/out with
breaks, centralized late/early/worked calculations in the company timezone, history and calendar,
manual corrections, correction requests, holidays, HR/self dashboards, CSV export and permissions.

Exit criteria: duplicate clock-in on the same work date cannot create two records; a correction
preserves the original values and the actor.

Result: met. The `(employee_id, work_date)` unique constraint plus partial unique indexes for open
sessions/breaks/pending corrections make concurrency safe; clock-out claims the row atomically.
`attendance.e2e-spec.ts` passes 8/8 (concurrent actions, overnight shift, manager scope, correction
recalculation, holiday calendar, bulk assignment, export), unit suites cover the arithmetic and
timezone edges, and web tests pass 21/21. Docs: `docs/modules/attendance.md`,
`docs/database/phase-4-erd.md`, `docs/security/permission-matrix.md`. Limitations: no automatic
attendance generation/rollup worker, no correction attachments or notifications, and FIFO cleanup is
not required because no absence rows are pre-generated.

### Phase 5 — Leave — ✅ completed

Leave types, versioned policies, effective-dated assignments, entitlement periods, accrual, ledger
with pending reservations, carry-over and expiration, request submission, manager/HR approval,
cancellation and reversal, attachments, calendar, reports, and attendance integration.

Exit criteria: balance always equals the sum of ledger deltas; concurrent submissions cannot
overspend a balance (tested).

Result: met. `leave.e2e-spec.ts` passes 13/13 within the 35/35 API e2e suite, covering entitlement,
duration, reservations, approval, cancellation/reversal, withdrawal, overdraw prevention, attendance
visibility, reports, idempotent accrual, and policy snapshots. The web suite passes 31/31, including
leave dashboard, balances, form validation, preview/submit, approval actions, permission-aware
detail, calendar, and history filters. Docs: `docs/modules/leave.md`,
`docs/database/phase-5-erd.md`, `docs/security/permission-matrix.md`,
`docs/modules/attendance.md`. Limitations: hourly leave is not implemented; half-day attendance
currently exposes leave but does not recalculate the remaining half against late/early or absence
rules; approval is leave-specific; statutory Indonesian leave rules are not implemented; wide tables
still scroll horizontally on mobile.

### Phase 6 — Overtime — ✅ completed

Overtime policies with effective dates and rounding, employee/department/branch assignments, planned
requests, manager then HR approval, actual recording from manual input or attendance, HR
verification, immutable corrections, attachments, dashboard, team lists, reports, CSV export, and a
read-only worker housekeeping job.

Exit criteria: policy configuration and assignment work; employees can submit; configured approval
sequences work; actual and verified minutes remain separate and traceable; attendance and leave are
never overwritten; backend authorization is enforced.

Result: met. `overtime.e2e-spec.ts` passes 6/6, the calculation unit suite passes 14/14, and the web
suite passes 34/34 including overtime form, approval, and permission-aware detail flows. API, web,
and worker typechecks pass. Docs: `docs/overtime/domain-analysis.md`, `business-rules.md`,
`workflow.md`, `permission-matrix.md`, `api.md`, `testing.md`. Follow-up optimization: list rows now
omit approval/correction/attachment collections, summary totals are aggregated in PostgreSQL,
approval/verification queues are paginated, route pages are lazy-loaded with shared vendor chunks,
and an overlap index was added. The production build no longer emits a chunk above Vite's 500 kB
warning threshold. Limitations: verification is manual; no statutory multipliers or payroll
calculation; no notification job; the worker only reports stale requests; attachments are private
but not browser-tested.

### Phase 7 — Payroll — ✅ completed

Compensation history, configurable earning/deduction/employer/informational components,
effective-dated assignments, periods, single active run per period, deterministic Decimal
calculation, attendance/unpaid-leave/verified-overtime sources, reviewed adjustments, approval and
publication workflow, immutable payslip snapshots, on-demand PDF payslips, reports with a paginated
register, and 15 functional payroll screens (some screens are combined in one route with tabs/dialogs).

Exit criteria: payroll is reproducible from stored snapshots; published payslips cannot be rewritten;
recalculation increments the version; only approved adjustments apply; source integration reads
attendance, approved unpaid leave, and `VERIFIED` overtime; unauthorized users cannot read salary
data or another employee's payslip.

Result: met. API unit 41/41 (5 payroll utility tests), web 38/38 (4 payroll screen tests), API e2e
49/49 including 8 payroll tests (duplicate run, fixed earnings, approved-only adjustments and
versioning, review/approve/publish, snapshot stability, attendance/leave/overtime sources, paginated
register with range-wide totals, and self-only payslip/PDF access). Typecheck, lint, build, 10
migrations, seed, and worker smoke all pass. Docs: `docs/payroll/domain-analysis.md`, `business-rules.md`, `payroll-workflow.md`,
`calculation-rules.md`, `permission-matrix.md`, `api.md`, `testing.md`.

Limitations: calculation is synchronous (the worker performs read-only housekeeping); PDFs are
generated on demand; statutory tax/BPJS/THR, loans, reimbursements, bank transfer, and accounting
journals remain explicitly out of scope; source-based components are global configuration rather
than per-employee assignments.

### Phase 8 — Performance and Learning

Review cycles, goals, reviews; courses, sessions, enrollments with capacity checks.

### Phase 9 — Notifications and Reports

In-app notifications (badge, list, read state), email channel behind an interface, worker-driven
dispatch, report screens (headcount, attendance, leave, payroll cost) using module read services.

### Phase 10 — Hardening and deployment

Audit log viewer, security review (CSRF, uploads, throttling), performance pass with measurements,
accessibility audit, Nginx/Docker production images, Jenkins pipeline, AWS target if requested.

## Risks and open questions

| Risk                                                                     | Impact                                | Mitigation                                                                                         |
| ------------------------------------------------------------------------ | ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Figma reference inaccessible                                             | Visual fidelity to SmartHR unverified | Build on verified Nemo tokens (§2 of the design analysis); restyle once screenshots/exports arrive |
| Nest 12 ecosystem lag (e.g. `nestjs-zod` supports only up to Swagger 11) | Would force a downgrade               | ADR-005: class-validator DTOs; no incompatible bridge                                              |
| Prisma `latest` = 8.0.0-rc                                               | Accidental prerelease install         | Exact pin 7.10.1 for CLI and client; no `@latest` in scripts                                       |
| Very new Node (26) and TS 7 line                                         | Tooling incompatibility               | Pin TS 5.9.3; Prisma supports Node ≥24; CI on Node 24 LTS                                          |
| Tailwind 4 + Nemo CSS variables overlap                                  | Inconsistent styling                  | Tailwind for layout only; tokens for visuals (ADR-003)                                             |
| Attendance/timezone correctness                                          | Wrong work dates, payroll errors      | UTC storage + company timezone config; explicit tests around midnight                              |
| Payroll statutory rules unspecified                                      | Rework risk                           | Keep calculation components configurable; confirm jurisdiction before any statutory scope           |
| No Figma/inventory access to charts                                      | Dashboard gaps                        | Defer charts to a dedicated decision in Phase 10                                                   |
| Two validation sources (DTO + Zod)                                       | Drift                                 | Shared types package + contract tests in the API e2e suite                                         |

## Recommended next step

**Phase 8 — Performance and Learning** is the next logical scope, but it is not authorized until the
user explicitly starts it. Before Phase 8, confirm whether payroll needs per-employee source-based
component assignments, asynchronous calculation/PDF jobs, or a jurisdiction-specific statutory
scope. Statutory multipliers, PPh 21, BPJS, THR, loans, reimbursements, bank transfer, and salary
disbursement remain explicitly out of scope. Known limitations (manual overtime verification, no
notification worker, stubbed e2e throttling, unavailable Figma references, development-only document
storage, and half-day attendance recalculation) remain documented in `technical-decisions.md` and
the module docs.
