# Phase 8 Implementation Plan

## Sequence

1. Schema and migration for onboarding/offboarding, performance, learning.
2. Shared types, permission catalogue, role grants, seed.
3. Onboarding/offboarding API + audit + employee lifecycle integration.
4. Performance API with goal weighting and privacy rules.
5. Learning API with capacity-safe enrollment and private documents.
6. Advanced HR reports API with aggregation, pagination, and CSV export.
7. Frontend routes, dashboards, forms, detail screens, and permission-aware navigation.
8. Worker housekeeping jobs.
9. Tests, documentation, migration/seed/typecheck/lint/build validation.

## API groups

- `/api/v1/onboarding/templates`, `/records`, `/tasks`
- `/api/v1/offboarding/templates`, `/records`, `/tasks`
- `/api/v1/performance/cycles`, `/goals`, `/reviews`
- `/api/v1/learning/programs`, `/enrollments`, `/documents`
- `/api/v1/reports/hr-dashboard`, `/employees`, `/attendance`, `/leave`, `/overtime`, `/payroll`,
  `/onboarding`, `/offboarding`, `/performance`, `/learning`, `/export`

## Data rules

- All new tables use UUID primary keys, `timestamptz` timestamps, and explicit `onDelete` behavior.
- Unique constraints: one review per cycle/employee/type; one enrollment per program/employee;
  template task sort order per template.
- Capacity and goal-weight checks run in transactions.
- Submitted reviews and completed onboarding/offboarding are immutable through normal updates.
- Private files store only `storageKey`; downloads are authorized.

## Frontend route plan

- `/onboarding` dashboard, `/onboarding/templates`, `/onboarding/records/:id`
- `/offboarding` dashboard, `/offboarding/records/:id`
- `/performance` dashboard, `/performance/cycles`, `/performance/cycles/:id`,
  `/performance/goals`, `/performance/reviews/self`, `/performance/reviews/manager`,
  `/performance/history`
- `/learning` catalog, `/learning/programs`, `/learning/programs/:id`, `/learning/enrollments`,
  `/learning/my`
- `/reports/hr`, `/reports/employees`, `/reports/attendance-leave`, `/reports/overtime-payroll`,
  `/reports/performance-learning`

## Risks

| Risk | Mitigation |
| --- | --- |
| Performance privacy leakage | Separate internal notes, self/team/all permissions, backend scope tests |
| Offboarding changes employee status incorrectly | Explicit completion action through `EmployeesService`, audit, no deletion |
| Capacity race | Conditional transaction + unique enrollment constraint |
| Large reports | SQL aggregation, pagination, CSV streaming, payroll permission checks |
| No notification transport | Worker logs overdue/reminder counts; no duplicate notifications |
| Scope creep into Phase 9 | No generic workflow, no external LMS, no new infrastructure |

## Validation gates

- Migration applies cleanly to the test database.
- Seed is idempotent and grants the documented permissions.
- Unit tests cover task generation, weights, capacity, and report scope.
- E2E covers onboarding/offboarding, performance privacy, learning capacity, reports, and CSV.
- Web tests cover permission-aware rendering and core workflows.
- Typecheck, lint, build, and worker smoke pass.
