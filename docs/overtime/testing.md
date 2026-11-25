# Overtime Testing

## Commands

```bash
pnpm --filter @peopleops/api test -- overtime-calculation.spec.ts
pnpm --filter @peopleops/api test:e2e -- overtime.e2e-spec.ts
pnpm --filter @peopleops/web test
pnpm --filter @peopleops/api typecheck
pnpm --filter @peopleops/web typecheck
pnpm --filter @peopleops/worker typecheck
```

The e2e suite runs against the isolated `peopleops_test` schema. Its global
setup applies migrations and seeds roles/permissions before the suite.

## Results (26 November 2026)

| Check                              | Result       |
| ---------------------------------- | ------------ |
| API unit suites                    | 36/36 passed |
| Overtime calculation unit suite    | 14/14 passed |
| API e2e suites                     | 41/41 passed |
| Overtime e2e suite                 | 6/6 passed   |
| Web suite including overtime flows | 34/34 passed |
| API typecheck                      | passed       |
| Web typecheck                      | passed       |
| Worker typecheck                   | passed       |
| API/web/worker lint                | passed       |
| API/web/worker build               | passed       |

## Unit coverage

`apps/api/src/modules/overtime/overtime-calculation.spec.ts` covers:

- planned duration and break deduction;
- overnight windows;
- non-positive and partial-minute results;
- `NONE`, `ROUND_DOWN`, `ROUND_UP`, and `NEAREST` rounding;
- holiday, weekday, weekend, and rest-day categories;
- actual-window derivation from attendance;
- early arrival exclusion;
- missing clock-out and empty actual windows.

## Integration coverage

`apps/api/test/overtime.e2e-spec.ts` covers:

- employee draft creation and submission;
- manager approval followed by HR approval;
- HR override of a manager stage, finalising the request immediately;
- actual recording, verification, and correction with immutable correction rows;
- summary totals excluding cancelled requests from verified minutes;
- rejection and withdrawal;
- duplicate `clientRequestId` prevention;
- concurrent double submission (one succeeds, one conflicts);
- audit entry for submission;
- summary totals;
- out-of-scope read denial;
- approval without permission denial;
- manager visibility of a team request;
- employee-name search independent of the reason text;
- multi-status approval filtering;
- a very early local start whose UTC date is the previous day.

## Frontend coverage

`apps/web/src/features/overtime/overtime-flows.test.tsx` covers:

- form validation before submission;
- create + submit request flow;
- manager approval with a comment;
- permission-aware detail actions (review and withdraw buttons hidden).

The existing web suite also covers the app shell, authentication, employees,
leave, and dashboard, confirming Phase 1–5 behavior remains intact. Route pages
are lazy-loaded; the production build emits one chunk per page plus shared
React, Nemo, query, and vendor chunks. No chunk exceeds Vite's 500 kB warning
threshold.

## Not covered automatically

- Real file upload/download round-trip for attachments.
- Browser-level visual review of the new screens.
- Worker scheduling in real time (the job is read-only and logs counts).
- Payroll consumption of verified minutes, which is intentionally out of scope.
- Leave-conflict and attendance-derived completion are implemented and
  exercised indirectly, but not every branch has a dedicated e2e case.
