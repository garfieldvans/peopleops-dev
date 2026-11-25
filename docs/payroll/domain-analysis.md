# Payroll Domain Analysis

Status: Phase 7 implemented. This module calculates payroll and produces payslips. It does **not**
transfer money, integrate with banks, or implement statutory Indonesian tax/BPJS/THR rules.

## Boundaries

Payroll owns:

- employee compensation history (base salary, currency, payment frequency);
- earning/deduction/employer-contribution component configuration;
- effective-dated recurring component assignments;
- payroll periods and calculation runs;
- immutable calculation snapshots and payslips;
- manual adjustments and their review;
- payroll approval/publication history and reports.

Payroll reads, but never writes:

- employees and employment status;
- attendance records;
- approved leave requests and leave type paid/unpaid flags;
- verified overtime requests.

## Actors

| Actor | Responsibility |
| --- | --- |
| Payroll officer | Configure payroll, create periods/runs, calculate, review, adjust, publish |
| HR administrator | Manage compensation and payroll configuration; may review/approve if granted |
| Approver | Approve a calculated run; cannot approve their own run unless granted override |
| Employee | View/download only their own published payslips |
| Manager | No payroll access by default |
| Super administrator | Administrative access through explicit permissions |

## Core entities

- `EmployeeCompensation` — effective-dated base salary history.
- `PayrollComponent` — configurable earning, deduction, employer contribution or informational line.
- `EmployeePayrollAssignment` — effective-dated recurring component assignment with optional amount.
- `PayrollPeriod` — the payroll timeframe and payment date.
- `PayrollRun` — one calculation attempt/version for a period.
- `PayrollPayslip` — per-employee result with immutable input/output snapshots.
- `PayrollLine` — earning/deduction/contribution breakdown on a payslip.
- `PayrollSource` — attendance/leave/overtime references consumed by a calculation.
- `PayrollAdjustment` — reviewed one-time earning or deduction for a period/employee.
- `PayrollSetting` — single-row calculation settings (standard monthly hours/days, rounding).

## Lifecycle

`PayrollPeriod`: `OPEN → CLOSED`.

`PayrollRun`: `DRAFT → CALCULATED → UNDER_REVIEW → APPROVED → PUBLISHED`, with `CANCELLED` as a
terminal audit-preserving transition. `LOCKED` is reserved for a future archival step; published runs
are already immutable through service rules.

## Assumptions

- One company, one currency per run. The company currency is the default.
- A period cannot overlap another period.
- One non-cancelled run may exist per period; recalculation increments the run version.
- Base salary is paid in full for eligible employees. Mid-period compensation starts produce a
  warning rather than silent proration.
- Attendance deductions are opt-in through explicit `SOURCE_BASED` components. No absence is
  deducted automatically.
- Overtime is paid only from `VERIFIED` overtime and only when an active `OVERTIME` source component
  with a multiplier exists.
- Unpaid leave is counted only from approved leave whose leave type has `isPaid = false`.
- Employer contributions are reported separately and never reduce employee net pay.
- Published payroll is immutable; corrections require a new adjustment/correction process and a new
  calculation version, never an in-place edit of a published payslip.

## Payslip generation

Payslips are generated from the stored run/payslip snapshot on demand as a PDF (`pdf-lib`). The PDF
is not a source of truth: every value comes from the immutable payslip, and access is authorized per
employee or through read-all/download permissions. No PDF is generated for draft or unapproved runs.

## Future statutory compliance

PPh 21, BPJS, THR, and statutory overtime multipliers are intentionally **not implemented**. Adding
them requires a written jurisdiction scope, validated effective-date rules, official rate tables, a
rounding/negative-pay policy, and tests against published examples. Configurable components alone
must not be described as legal compliance.

## Future payment integration

Bank transfer and salary disbursement are out of scope. A later payment phase would add a payment
batch after publication, idempotent bank references, status reconciliation, failure handling, and an
append-only payment history. Payroll itself would remain the calculation record; it would never
mutate a published payslip when a bank transfer fails.
