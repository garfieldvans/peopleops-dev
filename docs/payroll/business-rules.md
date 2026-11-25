# Payroll Business Rules

## Compensation

- Every employee has at most one active compensation row on any date.
- Compensation is effective-dated and never overwritten; changes create new history.
- Compensation may be future-dated.
- A compensation row used by a payroll run remains unchanged because the run stores a snapshot.
- Only `ACTIVE` or `PROBATION` employees are included in a run.

## Components

- Component codes are unique and uppercase.
- Types: `EARNING`, `DEDUCTION`, `EMPLOYER_CONTRIBUTION`, `INFORMATIONAL`.
- Calculation types: `FIXED_AMOUNT`, `PERCENTAGE`, `MANUAL_AMOUNT`, `SOURCE_BASED`.
- `SOURCE_BASED` components must declare a source: `ABSENCE`, `LATE`, `EARLY_LEAVE`, `UNPAID_LEAVE`,
  or `OVERTIME`.
- No arbitrary JavaScript or user-supplied formulas are executed.
- Components have effective dates and an active flag.

## Assignments

- Assignments are effective-dated and belong to one employee and one recurring component.
- Active assignments for the same employee/component may not overlap.
- An amount override is allowed; otherwise the component default is used.
- `MANUAL_AMOUNT` components are applied only through approved adjustments.

## Periods and runs

- Period start must be before or equal to period end.
- Payment date must not be before period end.
- Periods may not overlap.
- A period may have only one non-cancelled run.
- A run starts as `DRAFT`; calculation produces `CALCULATED`.
- Only `DRAFT`, `CALCULATED`, or `UNDER_REVIEW` runs may be recalculated.
- Recalculation deletes the run's previous draft payslips and creates a new calculation version.
- `APPROVED` and `PUBLISHED` runs cannot be recalculated or edited.

## Adjustments

- Adjustments are created against a period and employee, with a component and reason.
- They start as `PENDING`; only `APPROVED` adjustments affect calculation.
- A rejected adjustment never affects payroll.
- Approved adjustments are included on the next calculation/recalculation.
- Published payroll is never silently rewritten by a later adjustment.

## Approval and publication

- `CALCULATED → UNDER_REVIEW` requires review permission.
- `UNDER_REVIEW → APPROVED` requires approve permission and a different actor from the run creator,
  unless the actor has `payroll.runs.override`.
- `APPROVED → PUBLISHED` requires a separate publish permission.
- `PUBLISHED` runs and payslips are immutable.
- Cancelling a run requires a reason and the cancel permission; published runs may only be cancelled
  by a caller with that dedicated permission.
- Every transition writes an append-only `PayrollRunApproval` row and an audit entry.

## Payslips

- Payslips exist only for calculated runs and become visible to employees after publication.
- Employees can read/download only their own published payslips.
- HR/payroll callers need `payroll.payslips.read.all` or equivalent.
- Payslip data comes from snapshots, not current employee/compensation records.
- PDF downloads are authorized per request and never use public URLs.

## Integration rules

- Attendance: only explicit source components create deductions; incomplete records produce warnings.
- Leave: only approved leave; pending/rejected/withdrawn leave is ignored.
- Overtime: only `VERIFIED` requests; unverified/approved-but-not-verified overtime is ignored.
- The same overtime record cannot be consumed by two non-cancelled payroll runs.
- Leave cancellation after publication does not rewrite the published payslip.

## Audit

Compensation, component, assignment, period, run, adjustment, approval, publication, cancellation,
and payslip download actions are audited with actor and relevant metadata. Sensitive salary values
are stored in payroll records but are not written to general application logs.
