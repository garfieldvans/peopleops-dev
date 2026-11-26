# Advanced HR Module Boundaries

## New modules

| Module | Owns | Depends on |
| --- | --- | --- |
| `onboarding` | onboarding_templates, onboarding_task_templates, employee_onboardings, onboarding_tasks, offboarding_templates, offboarding_task_templates, employee_offboardings, offboarding_tasks | employees, users, audit, storage |
| `performance` | performance_cycles, performance_goals, performance_goal_updates, performance_reviews, performance_review_items | employees, users, audit |
| `learning` | training_programs, training_enrollments, training_documents | employees, users, audit, storage |
| `reports` | no tables (read models) | employees, attendance, leave, overtime, payroll, onboarding, performance, learning |

`onboarding` owns both onboarding and offboarding because they share checklist/template behavior and
the same employee-lifecycle boundary. Controllers remain separated by URL group.

## Dependency rules

- New modules call `EmployeesService` for employee lookup, scope checks, and lifecycle updates. They
  do not write employee rows directly.
- `reports` consumes public services or dedicated read methods; it does not mutate source modules.
- Storage is injected through `FileStorage`; no module writes files directly.
- Audit entries are written through `AuditService`.
- No new generic workflow engine, notification transport, queue, or microservice.

## Data access restrictions

- Onboarding/offboarding employees may read their own records; managers do not get offboarding
  access by default.
- Offboarding sensitive notes require `offboarding.sensitive.read`.
- Performance employees may read their own goals/reviews. Managers are scoped to their reporting
  tree. Internal HR notes require a dedicated permission.
- Learning employees may read the published catalog, their own enrollments, and their own
  certificates. Enrollment management is permission-gated.
- Reports enforce both report permission and underlying employee/payroll scope.

## Storage

Training materials and certificates use `FileStorage.save/read/remove` and store only opaque keys.
Downloads use an authorized controller route with `Content-Disposition: attachment` and no public URL.

## Background processing

The existing worker gains read-only housekeeping for:

- overdue onboarding tasks;
- overdue offboarding tasks;
- performance cycles in review with missing reviews;
- training programs whose registration deadline has passed.

Jobs are idempotent because they only count/read; they do not create duplicate notifications. No
notification transport exists in Phase 8, so results are logged and failures are logged without
changing source records.

## Reporting sources

- Employees: employee directory/status/hire date/department/position.
- Attendance: attendance records and statuses.
- Leave: approved requests and leave types.
- Overtime: verified requests and minutes.
- Payroll: published/locked runs and payslips; aggregate totals only for report permissions.
- Onboarding/offboarding: records and task completion.
- Performance: cycles, reviews, completion status.
- Learning: programs, enrollments, completion.
