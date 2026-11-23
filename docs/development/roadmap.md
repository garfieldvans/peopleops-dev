# PeopleOps — Development Roadmap

Status: Phases 1–3 are complete, including organization and employee management (the instruction set
calls this whole slice Phase 3). Nothing beyond it is authorized until the next phase is explicitly
approved.

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
            ├── 5 Attendance
            │   └── 8 Overtime
            └── 6 Leave
                └── 7 Approval workflow ──► 8 Overtime
                    └── 9 Payroll (needs 5, 6, 8)
                        ├── 10 Performance / Learning
                        └── 11 Notifications + Reports
                            └── 12 Hardening & deployment
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
stubs the throttler, Figma references were unavailable, and the bundle exceeds Vite's 500 kB warning.

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

### Phase 5 — Attendance

Clock-in/clock-out (idempotent, company-timezone work date), attendance list + admin view, manual
corrections with audit, daily/monthly summary, first scheduled worker job (daily rollup) — introduces
`@nestjs/schedule`, Redis/BullMQ only if retries are required.

Exit criteria: duplicate clock-in on the same work date cannot create two records; a correction
preserves the original values and the actor.

### Phase 6 — Leave

Leave types + quotas, balance ledger with transactional reservation, request submission, overlap
prevention, balance display, leave calendar/list, cancellation rules.

Exit criteria: balance always equals the sum of ledger deltas; concurrent submissions cannot
overspend a balance (tested).

### Phase 7 — Approval Workflow

Generic approval requests/steps, sequential approvers, delegate support, decision history, inbox UI
(`Drawer` detail), wiring for leave (and overtime next). Replaces any phase-6 temporary approval stub.

### Phase 8 — Overtime

Overtime requests, planned vs approved vs actual minutes, reconciliation with attendance, approval
integration, payroll export hook.

### Phase 9 — Payroll

Salary components, periods, payroll run (draft → published → closed), payslip generation with
snapshot lines, immutable published results + adjustment flow, employee payslip view, export.
Jurisdiction rules (tax/BPJS) require an explicit later decision.

### Phase 10 — Performance and Learning

Review cycles, goals, reviews; courses, sessions, enrollments with capacity checks.

### Phase 11 — Notifications and Reports

In-app notifications (badge, list, read state), email channel behind an interface, worker-driven
dispatch, report screens (headcount, attendance, leave, payroll cost) using module read services.

### Phase 12 — Hardening and deployment

Audit log viewer, security review (CSRF, uploads, throttling), performance pass with measurements,
accessibility audit, Nginx/Docker production images, Jenkins pipeline, AWS target if requested.

## Risks and open questions

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Figma reference inaccessible | Visual fidelity to SmartHR unverified | Build on verified Nemo tokens (§2 of the design analysis); restyle once screenshots/exports arrive |
| Nest 12 ecosystem lag (e.g. `nestjs-zod` supports only up to Swagger 11) | Would force a downgrade | ADR-005: class-validator DTOs; no incompatible bridge |
| Prisma `latest` = 8.0.0-rc | Accidental prerelease install | Exact pin 7.10.1 for CLI and client; no `@latest` in scripts |
| Very new Node (26) and TS 7 line | Tooling incompatibility | Pin TS 5.9.3; Prisma supports Node ≥24; CI on Node 24 LTS |
| Tailwind 4 + Nemo CSS variables overlap | Inconsistent styling | Tailwind for layout only; tokens for visuals (ADR-003) |
| Attendance/timezone correctness | Wrong work dates, payroll errors | UTC storage + company timezone config; explicit tests around midnight |
| Payroll statutory rules unspecified | Rework risk | Keep calculation components configurable; confirm jurisdiction before Phase 9 |
| No Figma/inventory access to charts | Dashboard gaps | Defer charts to a dedicated decision in Phase 11 |
| Two validation sources (DTO + Zod) | Drift | Shared types package + contract tests in the API e2e suite |

## Recommended next step

**Phase 3 — Organization** (branches, departments, positions) is unblocked: Phase 2 gates pass and
authentication/RBAC are in place. Do not start it until the instructions mark it active. No Phase 2
tech debt is outstanding; the known limitations (stubbed e2e throttling, unavailable Figma references,
bundle size warning) are documented in `technical-decisions.md`.
