# PeopleOps

Single-company HRIS — one company, its branches, departments, positions, employees and HR operations.

> Status: **Phases 1–7 complete** — foundation, authentication/RBAC, organization and employees,
> attendance, leave, overtime, and payroll. Performance/learning and later phases are not started.

## Stack

- **Web**: React 19, TypeScript, Vite 8, Tailwind CSS 4, TanStack Query, Zustand, React Hook Form, Zod
- **UI**: [`@nemo-ui/ui`](https://www.npmjs.com/package/@nemo-ui/ui) (verified 0.1.0)
- **API**: NestJS 12 (modular monolith), Prisma 7 + PostgreSQL 16, class-validator, Swagger
- **Worker**: NestJS standalone process for daily leave accrual/expiry, overtime housekeeping, and payroll stale-run housekeeping
- **Auth**: Argon2id credentials, 15-minute JWT access token in memory, rotating refresh cookie with
  reuse detection, permission-based RBAC, audit log
- **Tooling**: pnpm workspace, TypeScript 5.9 strict, ESLint 10, Prettier, Jest + Vitest, Docker Compose

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm db:up          # PostgreSQL 16 on :5432
pnpm db:generate
pnpm db:migrate
pnpm db:seed        # roles, permissions, first administrator (password printed once)
pnpm dev            # API :3001 + web :5173
```

- Health: <http://localhost:3001/api/v1/health>
- API docs: <http://localhost:3001/api/docs>
- Web: <http://localhost:5173> (sign in at `/login` with the seeded administrator)

Ports are configurable in `.env` (`PORT`, `VITE_DEV_API_TARGET`). Full details, commands and the Prisma
7 workflow are in [`docs/development/getting-started.md`](docs/development/getting-started.md).

## Documentation

| Document | Contents |
| --- | --- |
| [`docs/architecture/system-overview.md`](docs/architecture/system-overview.md) | Actors, runtime topology, module map, cross-cutting rules |
| [`docs/architecture/technical-decisions.md`](docs/architecture/technical-decisions.md) | ADRs, pinned versions, incompatibilities found |
| [`docs/architecture/project-structure.md`](docs/architecture/project-structure.md) | Repository layout and conventions |
| [`docs/database/erd.md`](docs/database/erd.md) | Initial ERD, constraints, indexes, transaction-sensitive flows |
| [`docs/design/design-system-analysis.md`](docs/design/design-system-analysis.md) | Verified design tokens and layout system |
| [`docs/design/ui-library-inventory.md`](docs/design/ui-library-inventory.md) | `@nemo-ui/ui` inventory and app-level gaps |
| [`docs/development/roadmap.md`](docs/development/roadmap.md) | Phase plan, exit criteria, risks |
| [`docs/development/getting-started.md`](docs/development/getting-started.md) | Local setup and commands |
| [`docs/modules/attendance.md`](docs/modules/attendance.md) | Attendance, schedules, shifts, holidays, corrections |
| [`docs/modules/leave.md`](docs/modules/leave.md) | Leave policies, balances, requests, approvals |
| [`docs/overtime/domain-analysis.md`](docs/overtime/domain-analysis.md) | Overtime domain, workflow, API, permissions, testing |
| [`docs/payroll/domain-analysis.md`](docs/payroll/domain-analysis.md) | Payroll domain, boundaries, entities, lifecycle |
| [`docs/payroll/calculation-rules.md`](docs/payroll/calculation-rules.md) | Decimal rules, source integration, totals |
| [`docs/payroll/api.md`](docs/payroll/api.md) | Payroll endpoints, permissions, error codes |
| [`docs/payroll/testing.md`](docs/payroll/testing.md) | Payroll test coverage and validation results |

## Scripts

```bash
pnpm build         # build all projects
pnpm test          # unit tests everywhere (Jest in the API, Vitest in web/packages)
pnpm typecheck     # tsc --noEmit everywhere
pnpm lint          # ESLint everywhere
pnpm db:seed       # roles, permissions and the bootstrap administrator
```

End-to-end API tests: `pnpm --filter @peopleops/api test:e2e` (requires PostgreSQL; they use the
`peopleops_test` schema).
```
