# PeopleOps — Project Structure

Status: Phase 0 deliverable. Nothing here is scaffolded yet; Phase 1 creates it.

## 1. Top level

```
hris-expl/                       # repository root = PeopleOps root (ADR-001)
├── apps/
│   ├── web/                     React + Vite SPA
│   ├── api/                     NestJS HTTP API (modular monolith)
│   └── worker/                  NestJS standalone process (no HTTP)
├── packages/
│   ├── database/                Prisma schema, migrations, PrismaClient factory  (ADR-006)
│   ├── shared-types/            Cross-app TypeScript types/enums (no runtime deps)
│   ├── validators/              Zod schemas shared by web (and future contract tests)
│   └── config/                  Shared TS, ESLint, Prettier, env-schema helpers
├── docs/
│   ├── architecture/
│   ├── database/
│   ├── design/
│   └── development/
├── infrastructure/              Dockerfiles, Nginx config, deployment assets (added per phase)
├── docker-compose.yml           Local services (PostgreSQL first)
├── pnpm-workspace.yaml
├── package.json                 Root scripts only, no application code
├── tsconfig.base.json
├── .env.example
└── .gitignore
```

Deviation from the phase text: `packages/database` is added because two apps share the schema. It is
the only justified structural change; everything else matches the requested layout.

## 2. `apps/web`

```
apps/web/
├── index.html
├── vite.config.ts               React plugin, Tailwind plugin, /api proxy to :3000
├── tsconfig.json                references tsconfig.base.json, strict
├── src/
│   ├── main.tsx                 imports "@nemo-ui/ui/index.css" first
│   ├── app/
│   │   ├── providers.tsx        ThemeProvider, ToastProvider, QueryClientProvider
│   │   ├── router.tsx           route tree, lazy feature routes
│   │   └── app-shell.tsx        sidebar + topbar + content outlet
│   ├── features/
│   │   └── <domain>/
│   │       ├── api.ts           query/mutation functions (fetch wrappers)
│   │       ├── queries.ts       query keys + useQuery/useMutation hooks
│   │       ├── pages/           route-level components
│   │       ├── components/      domain-only components
│   │       └── schemas.ts       Zod form schemas
│   ├── components/              app-wide components (PageHeader, DataTable, ConfirmDialog, ...)
│   ├── lib/                     http client, query client, formatters, permissions, env
│   └── styles/
│       └── index.css            @import "tailwindcss"; project @theme tokens
└── .env.example                 VITE_API_URL
```

Rules:

- A feature never imports another feature's internals. Shared UI moves to `components/`; shared
  logic to `lib/`.
- Pages do not call `fetch` directly; they use feature hooks built on the shared HTTP client.
- All four UI states (loading, empty, error, success) are rendered explicitly — no bare
  "no data" screens.

## 3. `apps/api`

```
apps/api/
├── src/
│   ├── main.ts                  bootstrap: versioning, pipes, filters, swagger, cookies
│   ├── app.module.ts
│   ├── common/
│   │   ├── filters/             global exception filter (ADR-010)
│   │   ├── guards/              JWT guard, permissions guard
│   │   ├── interceptors/        audit interceptor, response logging
│   │   ├── decorators/          @CurrentUser, @RequirePermissions
│   │   └── errors/              DomainError hierarchy
│   ├── config/                  typed config + env validation (Zod at startup)
│   ├── modules/
│   │   ├── health/              GET /api/v1/health (+ readiness with DB ping)
│   │   └── <domain>/            module, controller, service, repository, dto/, index.ts
│   └── prisma/                  thin wrapper around packages/database client
├── test/                        e2e specs (supertest)
└── .env.example
```

`modules/health` is the only business-free module created in Phase 1. Every later module follows the
same internal shape, and its `index.ts` is its public surface.

## 4. `apps/worker`

```
apps/worker/
├── src/
│   ├── main.ts                  NestFactory.createApplicationContext
│   ├── worker.module.ts
│   └── jobs/                    job modules (empty until the first job exists)
└── .env.example
```

Shares `packages/database` and `packages/config`. Contains no HTTP listener and no Kafka/Redis code
in Phase 1 (ADR-013, ADR-016).

## 5. Packages

| Package | May depend on | Exposes |
| --- | --- | --- |
| `@peopleops/database` | `@prisma/client`, `config` | `prisma` singleton, Prisma types, migration scripts |
| `@peopleops/shared-types` | nothing | Enums (`EmploymentStatus`, `LeaveStatus`, `RoleCode`, ...), API contract types |
| `@peopleops/validators` | `zod`, `shared-types` | Zod schemas and inferred types |
| `@peopleops/config` | `typescript`, `eslint`, `prettier` | `tsconfig.base.json`, eslint flat config, prettier config, env helper |

Dependency direction is strictly `apps → packages`. A package never imports an app, and packages do
not import each other circularly (`validators` may read `shared-types`; not the reverse).

## 6. Naming conventions

- Files: `kebab-case.ts` for modules/components; Nest conventional names
  (`leave-requests.service.ts`, `leave-requests.controller.ts`).
- React components: `PascalCase` export from a `PascalCase.tsx` file or a kebab-case page file
  (`employee-list-page.tsx` exporting `EmployeeListPage`). Pick one per folder and stay consistent.
- Database: tables `snake_case` plural (`leave_requests`), columns `snake_case`, Prisma models
  `PascalCase`. Map explicitly with `@@map` / `@map` so SQL naming is consistent.
- API JSON: `camelCase`.
- Env vars: `SCREAMING_SNAKE_CASE`; only `VITE_*` reaches the browser, and it must never hold a
  secret.

## 7. Environment files

```
.env.example          # committed, documents every variable with safe placeholders
.env                  # local, gitignored
apps/api/.env         # optional per-app overrides, gitignored
```

Naming: `DATABASE_URL`, `PORT`, `COMPANY_TIMEZONE`, `JWT_ACCESS_SECRET`,
`JWT_ACCESS_TTL`, `REFRESH_TOKEN_TTL_DAYS`, `CORS_ORIGIN`, `STORAGE_DRIVER`, `STORAGE_LOCAL_DIR`.
Startup validates these with Zod and fails fast with a readable message; never fall back to
benchmark secrets in production.

## 8. Adding a new domain module (later phases)

1. Add Prisma models in `packages/database/schema.prisma` + migration.
2. Create `apps/api/src/modules/<domain>/` with module, controller, service, repository, dto, index.
3. Export only the public service from `index.ts`; register the module in `app.module.ts`.
4. Add permissions to the RBAC seed and guards.
5. Add `apps/web/src/features/<domain>/` (api, queries, pages, components, schemas).
6. Add the route and sidebar entry, gated by permission.
7. Write tests for the rules that can break money, balances or state transitions.

## 9. As built in Phase 1

Actual layout (all paths verified by build/typecheck/lint):

```
.
├── apps/
│   ├── api/            Nest 12: config, prisma, health, exception filter, Swagger
│   ├── web/            React 19 + Vite 8: providers, system-status page, api client, theme store
│   └── worker/         Nest standalone: bootstrap + DB connectivity check only
├── packages/
│   ├── config/         tsconfig.base.json, eslint.config.mjs (no build step)
│   ├── database/       Prisma schema + prisma7.config.ts + PrismaClient factory
│   ├── shared-types/   HealthResponse, ApiErrorResponse
│   └── validators/     serverEnvSchema, healthResponseSchema, clientEnvSchema
├── docs/
├── infrastructure/     README only (deployment assets arrive later)
├── docker-compose.yml  postgres:16-alpine + named volume + healthcheck
├── pnpm-workspace.yaml packages + allowBuilds (pnpm 11)
├── .env.example
└── README.md
```

Deviations and details worth knowing:

- `packages/database` exists because both apps share one schema (ADR-006).
- No `tailwind.config.js`: Tailwind 4 is configured in `apps/web/src/styles/index.css` with
  `@import "tailwindcss"` and `@theme`; the Vite plugin is `@tailwindcss/vite`.
- `apps/web` declares `"type": "module"` so `vite.config.ts` is loaded as ESM (Vite 8 warns otherwise).
- Root scripts orchestrate everything; there is no application code at the root.
- `pnpm -r build` orders packages before apps because apps depend on them through `workspace:*`.
- Tests are not configured in Phase 1 (no business logic yet); see the roadmap for when runners
  arrive.
