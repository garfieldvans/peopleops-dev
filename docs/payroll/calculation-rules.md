# Payroll Calculation Rules

## Precision

- Monetary values use PostgreSQL `Decimal(18,2)` and `decimal.js` in the API.
- Intermediate rates use higher precision (`Decimal(18,6)` where needed).
- Default rounding: `HALF_UP` to the configured currency scale (2 for IDR).
- Round each payroll line once, then sum rounded lines. Net pay is the rounded gross minus rounded
  deductions.
- JavaScript floating-point arithmetic is never authoritative.

## Settings

`PayrollSetting` is a single row:

- `standardMonthlyHours` (default `173.00`) for hourly rates.
- `standardMonthlyDays` (default `22.00`) for daily rates.
- `roundingMode` (`HALF_UP`, `ROUND_DOWN`, `ROUND_UP`).
- `currencyScale` (default `2`).

Hourly base rate = `baseSalary / standardMonthlyHours`.

Daily base rate = `baseSalary / standardMonthlyDays`.

## Base salary

The active compensation effective on the period end date supplies the base salary and currency.
If compensation starts after the period start, the full base salary is used and a
`COMPENSATION_STARTS_MID_PERIOD` warning is recorded. Proration is intentionally not invented.

## Recurring components

For each active assignment effective on the period end:

- `FIXED_AMOUNT`: `assignment.amountOverride ?? component.defaultAmount`.
- `PERCENTAGE`: `baseSalary × percentage / 100`.
- `SOURCE_BASED`: handled by the source rules below.
- `MANUAL_AMOUNT`: skipped until an approved adjustment references it.

Earnings add to gross; deductions add to total deductions; employer contributions are reported
separately; informational lines do not affect totals.

## Attendance sources

Only active `SOURCE_BASED` components create these lines. Source components are global payroll
configuration in this phase: they apply to every calculated employee, while recurring fixed and
percentage components remain employee-assigned. Assigning a source component is optional and does
not narrow its scope yet.

- `ABSENCE`: count `ABSENT` attendance records in the period; amount = daily rate × multiplier × days.
- `LATE`: sum `lateMinutes`; amount = hourly rate × multiplier × minutes / 60.
- `EARLY_LEAVE`: sum `earlyLeaveMinutes`; amount = hourly rate × multiplier × minutes / 60.

`INCOMPLETE` records produce a warning and no automatic deduction. Attendance corrections are read
as already-applied attendance values; payroll never mutates attendance.

## Leave sources

`UNPAID_LEAVE`: approved leave requests whose leave type has `isPaid = false` and whose days overlap
the period. Amount = daily rate × multiplier × overlapping leave days. Pending, rejected, withdrawn
and cancelled leave is ignored.

## Overtime sources

`OVERTIME`: `VERIFIED` overtime requests with `workDate` inside the period. Amount =
hourly rate × multiplier × `verifiedMinutes / 60`.

- No active `OVERTIME` component means no overtime pay and an `OVERTIME_RATE_NOT_CONFIGURED` warning.
- If more than one active overtime component exists, the first by code is used and a warning is
  recorded.
- A verified overtime record already consumed by another non-cancelled run causes a conflict.
- The run stores the overtime request IDs as payroll sources.

## Adjustments

Approved adjustments are applied after recurring/source lines:

- `EARNING` adds to gross.
- `DEDUCTION` adds to deductions.
- `EMPLOYER_CONTRIBUTION` adds to employer contributions.
- `INFORMATIONAL` appears only in the breakdown.

## Totals

```
grossPay = baseSalary + total earnings (recurring + source + earning adjustments)
totalDeductions = total deduction lines (recurring + source + deduction adjustments)
netPay = grossPay - totalDeductions
employerContributions = separate total, never deducted from netPay
```

## Reproducibility

Each payslip stores:

- compensation and assignment snapshots;
- attendance/leave/overtime source references and summaries;
- adjustment IDs;
- settings and calculation version;
- every payroll line and warning.

A published payslip can therefore be reproduced even if current employee, compensation, attendance,
leave, or overtime data changes.
