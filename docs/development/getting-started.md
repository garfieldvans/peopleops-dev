# PeopleOps — Getting Started

Local setup for the pnpm workspace, NestJS API, Vite web app, worker and PostgreSQL.

## Prerequisites

| Tool | Version | Why |
| --- | --- | --- |
| Node.js | **>= 24** (LTS recommended) | `@prisma/client@7.10.1` requires `^20.19 \|\| ^22.12 \|\| >=24` |
| pnpm | 11.x | Workspace + `allowBuilds` in `pnpm-workspace.yaml` |
| Docker + Compose | any recent | Local PostgreSQL 16 |

## First run

```bash
pnpm install
cp .env.example .env          # adjust ports if needed
pnpm db:up                    # starts postgres:16-alpine (container peopleops-db)
pnpm db:generate              # generates the Prisma client
pnpm db:migrate               # applies prisma/migrations
pnpm db:seed                  # roles, permissions and the first administrator
pnpm dev                      # builds shared packages, then API + web in watch mode
```

Verify:

- API health: <http://localhost:3001/api/v1/health> → `200` with `checks.database.status: "up"`
- Swagger UI: <http://localhost:3001/api/docs>
- Web app: <http://localhost:5173> → system status card, theme toggle, Nemo UI components
- Worker: `pnpm --filter @peopleops/worker start:prod` → logs `Database reachable` and the scheduled leave/overtime jobs, then stays running

If something else already listens on 3000/3001/5173, change `PORT` and `VITE_DEV_API_TARGET` in `.env`
and start Vite with another port (`pnpm --filter @peopleops/web exec vite --port 5174`).

## Environment

| Variable | Default | Used by |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://peopleops:peopleops_dev@localhost:5432/peopleops?schema=public` | API, worker, Prisma CLI |
| `PORT` | `3001` | API |
| `NODE_ENV` | `development` | API, worker |
| `COMPANY_TIMEZONE` | `Asia/Jakarta` | API health/reporting default; company settings are the runtime source of truth |
| `CORS_ORIGIN` | `http://localhost:5173` | API (comma-separated list allowed) |
| `JWT_ACCESS_SECRET` | — (required, min 32 chars) | API access-token signing (`openssl rand -base64 48`) |
| `JWT_ACCESS_TTL_SECONDS` | `900` | Access-token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | Refresh-session lifetime |
| `COOKIE_SECURE` | `false` | `true` when the API is served over HTTPS |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | `admin@peopleops.local` / generated | `pnpm db:seed` bootstrap only |
| `VITE_API_BASE_URL` | `/api/v1` | Web bundle |
| `VITE_DEV_API_TARGET` | `http://localhost:3001` | Vite dev proxy only (not bundled) |

`.env` is gitignored; `.env.example` is the committed template. Startup validates the server variables
with Zod and fails with a readable list of problems instead of booting half-configured.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Build packages, then API (`nest --watch`) + web (`vite`) |
| `pnpm build` | Build every workspace project (topological order) |
| `pnpm test` | Unit tests everywhere (Jest in the API, Vitest in the web/package projects) |
| `pnpm --filter @peopleops/api test:e2e` | API end-to-end suite (needs PostgreSQL and the `peopleops_test` schema) |
| `pnpm typecheck` | `tsc --noEmit` in every project |
| `pnpm lint` | ESLint 10 + typescript-eslint in every project |
| `pnpm format` / `pnpm format:check` | Prettier |
| `pnpm db:up` / `pnpm db:down` | Start/stop the PostgreSQL container |
| `pnpm db:generate` | Regenerate the Prisma client |
| `pnpm db:migrate` | Apply committed migrations (`prisma migrate deploy`) |
| `pnpm db:migrate:dev` | Create + apply a migration during development |
| `pnpm db:studio` | Prisma Studio |
| `pnpm db:seed` | Seed roles, permissions and the bootstrap administrator |
| `pnpm --filter @peopleops/api start:prod` | Run the built API (`node dist/main.js`) |
| `pnpm --filter @peopleops/worker start:prod` | Run the built worker |

## Database workflow

Prisma 7 specifics (verified against 7.10.1 in Phase 1):

- A **driver adapter is mandatory**. `new PrismaClient()` without an adapter throws
  `PrismaClientInitializationError`; `packages/database` wires `@prisma/adapter-pg` and every app
  must construct clients through `PeopleOpsPrismaClient` / `createPrismaClient`.
- The legacy `prisma-client-js` generator is still supported and is what this repo uses: the client is
  generated into `node_modules/@prisma/client`, so `@peopleops/database` re-exports its types and
  NestJS CommonJS builds work without a special build pipeline.
- CLI configuration lives in `packages/database/prisma7.config.ts` (schema, migrations path, datasource
  URL). The Prisma CLI does **not** read `.env` by itself; the config file loads the root `.env` via
  `dotenv`.
- `prisma` and `@prisma/client` are pinned to the same exact version. npm's `latest` tag currently
  points at `8.0.0-rc.34`, a prerelease — never install it accidentally.

Adding a model:

```bash
# 1. edit packages/database/prisma/schema.prisma
pnpm db:migrate:dev --name add_employees   # creates + applies migration, regenerates client
pnpm --filter @peopleops/database build    # rebuild the shared package
```

The initial migration `0_init` is intentionally empty: Phase 1 adds no HRIS tables.

## Run order and shared packages

Apps consume `@peopleops/shared-types`, `@peopleops/validators` and `@peopleops/database` from their
built `dist/` folders, so those packages must be built before starting an app. `pnpm dev` does this
automatically; if you change a shared package during development, rebuild it
(`pnpm build:packages`) or run `pnpm -r --parallel build`.

## Authentication in development

```bash
pnpm db:seed                      # idempotent: roles, permissions, first administrator
# sign in at http://localhost:5173/login
```

The seed prints the generated password once when `SEED_ADMIN_PASSWORD` is not set. The access token
lives in memory only; the refresh token is an httpOnly cookie, so a page reload restores the session
through `POST /api/v1/auth/refresh`. Because the cookie is `SameSite=Lax` and the web app calls the
API through the Vite proxy, no extra CORS cookie setup is needed locally.

## Form inputs

`@nemo-ui/ui`'s `Input` exposes an imperative ref (`focus`/`blur`/`select`) instead of the DOM node,
so react-hook-form's `register()` cannot read the typed value — the field stays empty and validation
always fails. Always bind Nemo inputs through `apps/web/src/components/form-input.tsx`
(`<FormInput control={control} name="email" ... />`), which wraps `useController`.

## Phase scope

Phase 1 (foundation): monorepo, strict TypeScript, shared packages, Prisma + PostgreSQL, migration
workflow, API with versioning/Swagger/validation/error envelope, health endpoint with DB probe,
worker bootstrap with connectivity check, web smoke page using Nemo UI + TanStack Query + Zustand,
lint/format config.

Phase 2 (authentication and access management): Argon2id credentials, JWT access token + rotating
refresh cookie with reuse detection, users/roles/permissions modules, global auth and permission
guards, origin check, login throttling, audit log, seed, web login page, session bootstrap,
protected routing and permission-aware navigation, Users and Roles screens.

Phases 3–6 (completed): organization (company, branches, departments, positions, job levels) and
employees; attendance with schedules, shifts, holidays, corrections, calendar, dashboard and export;
leave with policies, assignments, balances, requests, approvals, attachments, calendar, reports and
daily accrual/expiry jobs; overtime with policies, assignments, approvals, actual/verified minutes,
corrections, attachments, reports, export and daily housekeeping.

Not implemented (later phases): payroll, performance/learning, notifications, Redis, Kafka, Socket.IO,
Nginx, Jenkins, deployment assets.

Tests: `pnpm test` (API unit + web Vitest) and `pnpm --filter @peopleops/api test:e2e` (auth, RBAC and
users/roles flows against the `peopleops_test` schema).
