# Advanced HR Business Rules

## Onboarding

- A template is reusable and may be inactive without deleting historical onboarding records.
- Template task definitions are ordered by `sortOrder`; required tasks cannot be removed from a
  generated checklist.
- An employee may have one active onboarding record. Completed/cancelled records remain history.
- Creating an onboarding record copies template tasks into independent task rows with due dates
  calculated from `startDate + dueOffsetDays`.
- Task assignees are users, not employees, because not every employee has an account.
- Completing onboarding requires all required tasks to be `COMPLETED`.
- Onboarding completion is explicit and audited; it does not create accounts or change employment
  status.
- Overdue means `dueDate < today` and status is not `COMPLETED`/`CANCELLED`.

## Offboarding

- Offboarding stores resignation date and last working date; last working date cannot precede the
  resignation date.
- One active offboarding record per employee. Completed/cancelled records remain history.
- A checklist may be generated from an offboarding template, with independent task rows.
- Exit-interview notes, equipment-return notes, and access-review notes are sensitive and require
  `offboarding.sensitive.read`.
- Completing offboarding requires all required tasks to be completed.
- Completion updates the employee status through `EmployeesService.update` with an effective date
  equal to the last working date. It never deletes the employee or historical records.
- User accounts and sessions are not deleted automatically. Access revocation is an explicit user
  management action.
- Published payroll is never modified. If the last working date affects a payroll period, the
  response surfaces the period overlap as an integration note; it does not rewrite payroll.
- No final salary, termination compensation, or statutory calculation is performed.

## Performance cycles

- Cycle dates must be ordered: `startDate ≤ endDate`, `reviewStartDate ≤ reviewEndDate`.
- Review dates must fall within the cycle dates.
- Only `DRAFT` cycles can be edited freely. `ACTIVE` cycles may open reviews.
- `REVIEW_IN_PROGRESS` requires an active cycle and is the only state where reviews may be submitted.
- `COMPLETED` and `CANCELLED` cycles are read-only.
- One cycle name is not required to be unique, but the service prevents exact duplicate date ranges.
- Eligible employees are active/probation employees who joined by the cycle end date.

## Goals and weights

- Goals belong to one employee and one cycle.
- A goal title is required; description/category are optional.
- `NUMERIC` and `PERCENTAGE` goals may have target/current values; qualitative goals may not.
- Weight must be greater than zero and at most 100.
- For a weighted cycle, active goal weights per employee/cycle must total 100 before review
  submission. The service validates the total and returns a clear conflict when it is invalid.
- Progress updates are append-only and record previous value, new value, comment, actor, and time.
- Goal status changes are explicit; no automatic rating or promotion is derived.

## Performance reviews

- Review types: `SELF_REVIEW`, `MANAGER_REVIEW`, `HR_REVIEW`.
- One review per cycle/employee/review type.
- Employees may create and edit only their own `SELF_REVIEW` while the cycle is in review and the
  review is `DRAFT`.
- Managers may create/edit `MANAGER_REVIEW` only for employees in their reporting scope.
- HR may create/edit `HR_REVIEW` with `performance.reviews.manage`.
- Submitted reviews cannot be edited through the normal update path. Submission records
  `submittedAt` and is audited.
- Overall rating must be between 0 and the configured maximum (default 5).
- Employee-visible comments and internal HR notes are separate fields. Internal notes require
  `performance.reviews.internal-notes.read` and are never returned to employees.
- Review items reference goals from the same cycle/employee; rating is optional for qualitative
  evidence.

## Learning programs

- Program title and dates are required; end date cannot precede start date.
- Registration deadline cannot be after the start date.
- Capacity must be positive when set.
- Only `PUBLISHED`/`ONGOING` programs accept enrollment requests.
- Programs with a passed registration deadline do not accept new requests.
- A program cannot be deleted; use `CANCELLED`.
- Training types: `INTERNAL`, `EXTERNAL`, `ONLINE`, `WORKSHOP`, `SEMINAR`, `CERTIFICATION`, `OTHER`.
- Delivery methods: `IN_PERSON`, `ONLINE`, `HYBRID`.

## Enrollment

- One enrollment per employee/program, enforced by a unique constraint.
- Employees may request enrollment for themselves only.
- HR/managers with `learning.enrollment.manage` may approve/reject.
- Capacity is checked inside a transaction; active states are `REQUESTED`, `APPROVED`, `ENROLLED`,
  `IN_PROGRESS`, `COMPLETED`.
- Rejected/cancelled enrollments do not consume capacity.
- Completion requires an enrollment in `ENROLLED` or `IN_PROGRESS`; it records result, feedback, and
  completion time.
- Failed completion is explicit (`FAILED`) and remains in history.

## Documents and certificates

- Files use the existing private storage abstraction.
- Allowed MIME types and maximum size are validated by the existing storage/upload conventions.
- Materials belong to a program. Certificates belong to an enrollment/employee and may have issue and
  expiry dates.
- Downloads always pass through an authorized API route; no public URL is returned.

## Reports

- Reports read existing module tables; they never create a second source of truth.
- Published/locked payroll only for finalized payroll figures.
- Individual compensation/payslip data requires payroll permissions, not merely report permissions.
- Employee scope is enforced for managers and self-service users.
- Date-range, department, and employee filters are optional and validated.
- Row-level reports use server-side pagination; aggregate reports use SQL aggregation where possible.
- CSV export requires `reports.export`.
- Draft vs finalized payroll is labelled explicitly.
