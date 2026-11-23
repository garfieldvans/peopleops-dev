# PeopleOps — Technical Decisions

Status: Phase 0 deliverable. Each entry records the decision, why, and what it rules out.
Versions below were resolved from the npm registry on 2026-11-21, not from memory.

## Resolved toolchain

| Concern | Package | Version | Note |
| --- | --- | --- | --- |
| Runtime | Node.js | **>= 24** (local 26.7.0) | Required by `@prisma/client@7.10.1` engines (`^20.19 \|\| ^22.12 \|\| >=24.0`) |
| Package manager | pnpm | 11.24.0 | Workspace protocol for internal packages |
| Language | TypeScript | **5.9.3** | See ADR-002 (not 7.x) |
| Web framework | React / React DOM | 19.3.1 | `@nemo-ui/ui` peer `^19` |
| Bundler | Vite | 8.3.8 | Requires Node `^20.19 \|\| >=22.12` |
| Styling | Tailwind CSS + `@tailwindcss/vite` | 4.3.5 | CSS-first config, no `tailwind.config.js` required |
| UI kit | `@nemo-ui/ui` | 0.1.0 | ESM only; requires `import "@nemo-ui/ui/index.css"` |
| Server state | `@tanstack/react-query` | 5.108.2 | |
| Client state | `zustand` | 5.1.0 | |
| Forms | `react-hook-form` + `zod` | 7.92.0 / 4.6.7 | |
| API framework | `@nestjs/core` | 12.6.0 | |
| API docs | `@nestjs/swagger` | 12.1.2 | |
| ORM | `prisma` + `@prisma/client` | **7.10.1** | Pin exactly; `latest` currently resolves to `8.0.0-rc.34` (prerelease) |
| Throttling | `@nestjs/throttler` | 6.8.0 | |
| Password hashing | `argon2` | 0.45.2 | Argon2id |

---

## ADR-001 — pnpm workspace monorepo, repository root is the project root

The repository root **is** the PeopleOps root (`apps/`, `packages/`, `docs/` live here). We do not
nest everything under an extra `peopleops/` directory: the repo already is that folder, and a
redundant level complicates Docker build contexts and CI paths.

Internal packages are consumed via `workspace:*` and referenced by their package name, never by
relative path across app boundaries.

## ADR-002 — TypeScript 5.9.x, not the 7.x line

`npm view typescript version` returns **7.0.2**, the native/Go-based compiler line. NestJS relies on
decorator metadata (`emitDecoratorMetadata`), `ts-jest`/SWC integration and mature type-checking of
decorator-heavy code. A brand-new compiler release is not an acceptable risk for the foundation of a
new project, so the workspace pins **5.9.3** and re-evaluates TS 7 in a later phase with a dedicated
upgrade check.

## ADR-003 — Tailwind CSS v4 via the Vite plugin, tokens bridged to `@nemo-ui/ui`

Tailwind is configured CSS-first (`@import "tailwindcss";` in `src/styles/index.css` plus `@theme`
for project tokens). There is no JS config file.

`@nemo-ui/ui` styles itself with CSS custom properties (`--nemo-*`) and has its own theme layer.
Therefore:

- `@nemo-ui/ui/index.css` is imported **once**, before any component renders.
- The app wraps everything in `ThemeProvider` (light/dark) and `ToastProvider`.
- Tailwind is used for **layout and composition only** (grid, flex, spacing between blocks,
  responsive visibility). Visual primitives (color of a button, border of an input, shadow of a
  card) come from `@nemo-ui/ui`, so the two systems cannot drift apart.
- If a project token is needed, it maps to a Nemo token value rather than a new palette.

## ADR-004 — NestJS modular monolith, module public surface via `index.ts`

See `system-overview.md` §4. Additional concrete rules:

- Modules are registered in `AppModule` only; feature modules do not wire each other's providers.
- A module exports exactly one public service (and optionally public types). Repositories,
  mappers and internal helpers are never exported.
- Cross-module transactions: the **initiating** module owns the `$transaction` and calls public
  services that accept an optional Prisma transaction client internally — but the public signature
  stays domain-shaped, not Prisma-shaped.

## ADR-005 — Validation: class-validator DTOs on the API, Zod on the web

The instruction stack lists Zod, and sharing one schema would be ideal. A verified compatibility
check rules out the usual bridge:

```
nestjs-zod@5.6.0 peerDependencies:
  zod: ^3.25.0 || ^4.0.0
  @nestjs/common: ^10.0.0 || ^11.0.0
  @nestjs/swagger: ^7.4.2 || ^8.0.0 || ^11.0.0     ← no support for Swagger 12 / Nest 12
```

`@nestjs/core` latest is 12.6.0 and `@nestjs/swagger` latest is 12.1.2, so `nestjs-zod` would force
the whole API down to Nest 11. Decision:

- **API**: `class-validator` + `class-transformer` DTOs, global `ValidationPipe` with
  `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`. DTOs carry `@ApiProperty`
  metadata so Swagger stays accurate.
- **Web**: Zod schemas per form; inferred types via `z.infer`.
- Enum/contract types shared through `packages/shared-types`; no runtime duplication of validation
  rules beyond what each side genuinely needs.

Consequence: a rule change touches the DTO and the Zod schema. Accepted for now; revisit when a
Zod-native Nest version supports the current majors.

## ADR-006 — Prisma schema lives in `packages/database`

Both `apps/api` and `apps/worker` need the same client and migrations, so the schema is not owned by
the API app. `packages/database` contains `schema.prisma`, migrations, the generated client export
and a singleton `PrismaClient` factory. It is the only package allowed to import `@prisma/client`.

Pin `prisma` and `@prisma/client` to the same exact version. Never run `prisma@latest` in scripts.

## ADR-007 — UTC storage, company timezone as configuration

- All `DateTime` columns: `timestamptz`, stored UTC.
- Company timezone in config (`COMPANY_TIMEZONE`, default `Asia/Jakarta`), not hardcoded.
- "Work date" for attendance is a `date` column derived from clock-in/out in the company timezone.
- Date-only business values (hire date, leave range, payroll period) are `date` columns.
- The web formats with an explicit timezone; no reliance on the browser locale for business dates.

## ADR-008 — Authentication: Argon2id + short access token + rotating refresh token

- Access token: JWT, 15 minutes, held **in memory** on the client (never localStorage).
- Refresh token: opaque random value, httpOnly + Secure + SameSite=Lax cookie, stored **hashed**
  server-side (`sessions`/`refresh_tokens` table), 7–30 days.
- Rotation on every refresh; reuse of an already-rotated token revokes the whole token family
  (theft detection).
- Logout revokes the session; password change revokes all sessions.
- Cookie-based refresh requires correct CORS (`credentials: true`) and CSRF awareness: state-changing
  endpoints are JSON + same-site, and the refresh endpoint checks origin.

## ADR-009 — RBAC with a permission table, plus service-level data scoping

Roles: `SYSTEM_ADMIN`, `HR_ADMIN`, `PAYROLL_OFFICER`, `MANAGER`, `EMPLOYEE`. Roles map to
permissions (`employee:read`, `employee:write`, `payroll:run`, `leave:approve`, ...). Guards check
permissions; **services** additionally scope data:

- Employee sees own records only.
- Manager sees direct/indirect reports, subject to permission.
- HR/payroll see company-wide, with salary fields gated separately.

A dedicated `salary:read` style permission protects monetary data even for HR roles. Frontend route
guards improve UX but are never the enforcement point.

## ADR-010 — Error contract

All API errors return a stable envelope:

```json
{
  "statusCode": 422,
  "code": "LEAVE_BALANCE_INSUFFICIENT",
  "message": "Requested 3 days, 1 day remaining",
  "details": [{ "field": "endDate", "issue": "exceeds_balance" }],
  "traceId": "..."
}
```

A global exception filter maps validation errors, domain errors (a small `DomainError` hierarchy)
and unknown errors. `code` is what the frontend switches on; `message` is human-readable and may
change.

## ADR-011 — API shape

- Prefix `/api/v1`, URI versioning (`/api/v2` later without breaking v1).
- Admin collections use page-based pagination: `?page=1&pageSize=20&sort=name&order=asc` and return
  `{ items, page, pageSize, total, totalPages }`. This matches the verified `Table` component's
  server-side mode (`pageCount`, controlled `sort`).
- Cursor pagination only for genuinely large append-only lists (audit logs, notifications).
- Naming: plural resources, kebab-case paths, camelCase JSON, ISO-8601 dates.

## ADR-012 — In-process domain events now, outbox later

Nest `EventEmitter2` (`@nestjs/event-emitter`) covers cross-module side effects inside one process:
`leave.requested` → notify approver; `payroll.published` → notify employees. Listeners must be
idempotent and must not be required for the originating transaction to succeed.

When a side effect must survive a process crash or must reach the worker reliably, add a
transactional outbox table written in the same transaction and drained by the worker. Kafka is not
introduced for this.

## ADR-013 — Worker is a Nest standalone application, queue added with the first job

`apps/worker` boots Nest without an HTTP adapter, shares `packages/database`, and in Phase 1 contains
only bootstrap, config and logging. Scheduled work:

- Phase 1: nothing scheduled.
- First real job (attendance daily rollup / leave accrual): add `@nestjs/schedule` for timers, and
  `BullMQ` + Redis only if jobs need retries, concurrency or must be triggered from the API.

The worker must be horizontally safe: every job it eventually runs is idempotent.

## ADR-014 — File storage behind an interface

`StorageService` with `put`, `getStream`, `delete`, `getSignedUrl`. Local disk implementation for
development (outside the repo, e.g. `.storage/`, gitignored); S3-compatible implementation for
production. Uploads are validated by MIME type, extension, size limit and magic bytes; filenames are
regenerated (UUID) and never trusted from the client. Employee documents (contracts, ID scans,
payslips) require an authenticated, authorized endpoint to download.

## ADR-015 — Testing split

- `apps/api`, `apps/worker`: Jest (Nest default) for unit tests, `supertest` for critical e2e flows.
- `apps/web`, `packages/*`: Vitest + Testing Library.
- Money, leave balance, payroll totals and approval transitions require unit tests in the phase
  that implements them.

## ADR-016 — What is deliberately absent in Phase 1

No Redis, Kafka, Socket.IO, Nginx, Jenkins, AWS resources, no CI pipeline definition beyond local
commands, and no HR domain tables. These arrive only with a phase that needs them, as required by the
instructions.

---

## Phase 1 verification addendum (2026-11-21)

Facts discovered while building the foundation, kept here so later phases do not re-learn them:

1. **Prisma 7 requires a driver adapter.** A bare `new PrismaClient()` throws
   `PrismaClientInitializationError: ... A driver adapter is required`. The repo therefore uses
   `@prisma/adapter-pg` and constructs clients only through `PeopleOpsPrismaClient` in
   `packages/database`. This refines ADR-006.
2. **`prisma-client-js` still works in 7.10.1** and generates into `node_modules/@prisma/client`, which
   keeps NestJS CommonJS builds simple. The `prisma-client` generator (custom output, TS sources) is
   not used.
3. **The Prisma CLI does not load `.env`** on its own when a config file is present;
   `prisma7.config.ts` imports `dotenv` and points at the workspace `.env`. Config filename is
   `prisma7.config.ts` (what `prisma init` generates for v7).
4. **pnpm 11 gates install scripts via `allowBuilds`** in `pnpm-workspace.yaml`. The older
   `onlyBuiltDependencies` key was ignored and `prisma`/`@prisma/engines` postinstalls were skipped
   until `allowBuilds` was set (scarf telemetry explicitly denied).
5. **Port choice**: the API defaults to `3001`, not 3000, because this workstation already had a
   process on 3000. `VITE_DEV_API_TARGET` lets the Vite proxy follow the API port without editing
   config; both are documented in `.env.example`.
6. **Node 26 warning**: `prisma`'s preinstall prints "Prisma only supports Node.js versions 20.19+,
   22.12+, 24.0+" on Node 26.7 although `@prisma/client` engines allow `>=24.0`; generation and
   runtime work. CI should run Node 24 LTS to stay in the fully supported matrix.
7. **Web bundle**: the production build is ~1.04 MB (262 kB gzip). `@nemo-ui/ui` ships a single
   pre-bundled `dist/index.js`, so importing a handful of components pulls the whole library; React 19
   and Zod account for the rest. Vite warns about chunks over 500 kB — expected and accepted for
   Phase 1. Route-level code splitting becomes meaningful once routing exists (Phase 2+); splitting
   the UI library itself is not an option from this repo (rule: do not modify the package).

---

## Phase 2 verification addendum (2026-11-22)

Findings from authentication, RBAC and the Users/Roles screens:

1. **The Prisma 7 driver adapter ignores `?schema=` in the URL.** `@prisma/adapter-pg` builds its own
   `pg.Pool` from the connection string and drops the `schema` query parameter, so migrations landed
   in `public` while the client queried the requested schema (or vice versa). `packages/database`
   parses `DATABASE_URL` and passes `{ schema }` explicitly to `PrismaPg`; the test suite relies on
   this to keep `peopleops_test` isolated from development data.
2. **The API Jest suites run as ESM.** Nest 12 + Prisma 7 ship ESM-only entry points, so the API
   scripts set `NODE_OPTIONS=--experimental-vm-modules`, `ts-jest` uses `useESM: true` with
   `tsconfig.jest.json`, and `extensionsToTreatAsEsm: [".ts"]` is configured. Do not "simplify" this
   back to CommonJS: the Prisma client import fails at runtime.
3. **The web dev server cannot consume the packages' CommonJS `dist`.** Both workspace packages
   compile to CommonJS (no `"type": "module"`), which is what the Nest API needs. Vite's dev server
   serves linked packages as raw ESM, so `dist/index.js` with `exports.clientEnvSchema = ...` threw
   `does not provide an export named 'clientEnvSchema'` even though the source exported it. Rollup
   (production build) and Vitest are interop-tolerant, so only `pnpm dev` broke. `vite.config.ts` now
   aliases `@peopleops/shared-types` and `@peopleops/validators` to their `src/index.ts`, so the web
   app compiles the TypeScript sources directly and no longer depends on `dist` being fresh.
   `optimizeDeps.exclude` keeps Vite from prebundling them; `pnpm build:packages` is still required
   before an API build/typecheck that reads the emitted `dist`.
4. **Nemo `Input` refs are imperative handles, not DOM nodes.** `register()` from react-hook-form
   stores that handle as the field ref; `event.target.name` still matches, but RHF cannot read the
   value from the handle, so submitted values stay at their defaults and validation fails forever
   ("Email is required" after typing). Every Nemo input is therefore bound with
   `apps/web/src/components/form-input.tsx` (`useController`), which keeps `value`/`onChange`
   controlled. This is an app-side adapter; `@nemo-ui/ui` stays unmodified.
5. **E2E throttling is stubbed.** The auth e2e suite overrides the ThrottlerGuard so repeated login
   attempts can be asserted without waiting out the limiter window; the real limiter is only exercised
   manually. Rate limiting itself is configured on the login route and covered by unit-level checks.
6. **Bundle size after routing**: the production web build is ~1.17 MB (299 kB gzip) because
   `@nemo-ui/ui` ships one pre-bundled file. React Router pages are still imported eagerly; route-level
   `lazy()` is the next lever and is deferred to a hardening phase.
