# Advanced HR Domain Analysis

Status: Phase 8 design. This phase adds four capabilities on top of the existing employee,
attendance, leave, overtime, payroll, and RBAC modules:

1. Onboarding and offboarding management.
2. Performance management.
3. Learning and development.
4. Advanced HR reports and analytics.

The system remains a single-company modular monolith. No new datastore, queue, workflow engine, or
external LMS is introduced.

## Onboarding and offboarding

Onboarding turns a reusable template into an employee-specific checklist. A template owns ordered
task definitions; an employee onboarding record owns the generated task instances, assignees, due
dates, notes, and completion state. Completion is explicit and audited. Onboarding never creates
login accounts, provisions external systems, or changes employment status by itself.

Offboarding records the resignation/last-working date, reason, checklist, exit-interview notes,
equipment return, access review, and payroll-review tasks. Completing offboarding updates the
employee lifecycle through the existing employee service (status + employment history) but never
deletes the employee, payroll, attendance, leave, overtime, or performance history. User accounts and
sessions are not deleted automatically; access revocation remains an explicit user-management action.

## Performance

A performance cycle defines the review window and lifecycle. Goals belong to an employee and cycle,
carry a weight, and record progress through an append-only update trail. Reviews are typed
(`SELF_REVIEW`, `MANAGER_REVIEW`, `HR_REVIEW`), contain goal-based items, and move from draft to
submitted/completed. Submitted reviews are immutable through the normal update path; later changes
must be traceable.

Performance data is sensitive. Employees see their own authorized reviews and employee-visible
comments. Managers see only their reporting scope. HR sees all only with dedicated permissions.
Internal HR notes are stored separately from employee-visible comments and require
`performance.reviews.internal-notes.read`.

## Learning and development

Training programs define schedule, capacity, provider, delivery, registration deadline, and status.
Employees request enrollment; HR/managers approve according to permissions. Enrollment transitions
are capacity-checked and duplicate-safe. Completion records result, feedback, and completion time.
Training materials and certificates use the existing private `FileStorage` abstraction; downloads are
authorized per request. No external LMS integration is added.

## Reports

Reports are read models over existing tables. They do not copy source records into a warehouse.
Aggregation happens in PostgreSQL where practical, with server-side pagination for row-level
reports. Payroll reports use only published/locked runs. Individual compensation and payslips remain
behind payroll permissions; aggregate payroll figures remain behind report permissions.

## Lifecycle summary

- Onboarding: `NOT_STARTED → IN_PROGRESS → COMPLETED`, with `CANCELLED`.
- Offboarding: `INITIATED → IN_PROGRESS → COMPLETED`, with `CANCELLED`.
- Performance cycle: `DRAFT → ACTIVE → REVIEW_IN_PROGRESS → COMPLETED`, with `CANCELLED`.
- Goal: `DRAFT → ACTIVE → ACHIEVED | MISSED`, with `CANCELLED`.
- Review: `DRAFT → SUBMITTED → COMPLETED`.
- Enrollment: `REQUESTED → APPROVED → ENROLLED → IN_PROGRESS → COMPLETED`, with `REJECTED`,
  `CANCELLED`, and `FAILED`.

## Assumptions

- One active onboarding/offboarding record per employee is enforced by the service; historical
  completed records remain queryable.
- Task due dates are date-only values in the company timezone.
- Goal weights are percentages and must total 100 when a cycle requires weighted goals.
- Ratings use a configurable numeric scale stored on the review; no automatic promotion, salary, or
  termination decision is made.
- Training capacity counts active enrollment states, not rejected/cancelled ones.
- Notifications are not implemented in Phase 8; the worker records reminder/overdue counts and
  failures without adding a new notification transport.
