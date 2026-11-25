# Payroll Workflow

## 1. Configure

1. Set standard monthly hours/days and rounding in payroll settings.
2. Create earning/deduction components, including optional source-based attendance/leave/overtime
   components.
3. Record employee compensation with effective dates.
4. Assign recurring components to employees with effective dates and optional amount overrides.

## 2. Prepare a period

1. Create a payroll period with start date, end date and payment date.
2. The period must not overlap another period.
3. Create a run for the period. A period may have one active run.

## 3. Calculate

1. Select eligible employees (`ACTIVE`/`PROBATION`, joined by period end).
2. Resolve compensation effective at period end.
3. Add base salary and recurring assignments.
4. Add approved adjustments.
5. Read attendance, approved unpaid leave, and verified overtime through source-based components.
6. Store a payslip with input snapshots, lines, sources, warnings and totals.
7. Store the run calculation version and totals.

Calculation is deterministic for the stored inputs and version. Missing configuration produces a
warning; it does not invent a rate or silently deduct.

## 4. Review and adjust

1. Review employee breakdown, warnings and source references.
2. Create one-time adjustments with a reason.
3. Approve or reject adjustments.
4. Recalculate to include approved adjustments.

## 5. Approve

1. Submit the calculated run for review.
2. An authorized approver approves it.
3. The creator cannot approve their own run unless granted the explicit override permission.

## 6. Publish

1. An authorized publisher publishes the approved run.
2. Payslips become visible to employees.
3. Published results are immutable.

## 7. Employee access

Employees open **My payslips**, view a published payslip, and download the PDF. Access is limited to
their linked employee record.

## 8. Corrections

A correction after publication must use a new adjustment/correction record and a new calculation
version or a separately authorized correction run. Existing published payslips are never edited in
place.
