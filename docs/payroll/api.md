# Payroll API

Base path: `/api/v1/payroll`. All routes require a bearer access token. Permissions are enforced by
the global `PermissionsGuard`; UI checks are not a security boundary.

## Settings

| Method | Path              | Permission                | Purpose                              |
| ------ | ----------------- | ------------------------- | ------------------------------------ |
| GET    | `/settings`       | `payroll.settings.read`   | Read the singleton payroll settings  |
| PATCH  | `/settings`       | `payroll.settings.manage` | Update hours/days/rounding/scale     |

`PATCH` body fields are optional: `standardMonthlyHours`, `standardMonthlyDays`, `roundingMode`
(`HALF_UP`/`ROUND_DOWN`/`ROUND_UP`), `currencyScale` (0–6).

## Compensation

| Method | Path                                           | Permission                    | Purpose                              |
| ------ | ---------------------------------------------- | ----------------------------- | ------------------------------------ |
| GET    | `/compensation`                                | `payroll.compensation.read`   | Paginated compensation records       |
| GET    | `/compensation/employees/:employeeId/history`  | `payroll.compensation.read`   | Effective-dated history              |
| POST   | `/compensation`                                | `payroll.compensation.manage` | Create an effective-dated record     |
| PATCH  | `/compensation/:id`                            | `payroll.compensation.manage` | Update a record                      |

Create body: `employeeId`, `baseSalary` (decimal string), optional `currency`, `paymentFrequency`,
`effectiveFrom`, `effectiveTo`, `status`, `notes`. Active ranges for one employee may not overlap;
the database also has an exclusion constraint.

## Components and assignments

| Method | Path                               | Permission                     | Purpose                              |
| ------ | ---------------------------------- | ------------------------------ | ------------------------------------ |
| GET    | `/components`                      | `payroll.components.read`      | Paginated components                 |
| GET    | `/components/active`               | `payroll.components.read`      | Active components for pickers        |
| GET    | `/components/:id`                  | `payroll.components.read`      | Component detail                     |
| POST   | `/components`                      | `payroll.components.manage`    | Create a component                   |
| PATCH  | `/components/:id`                  | `payroll.components.manage`    | Update a component                   |
| POST   | `/components/:id/deactivate`       | `payroll.components.manage`    | Deactivate without deleting history  |
| GET    | `/assignments`                     | `payroll.components.read`      | Paginated employee assignments       |
| POST   | `/assignments`                     | `payroll.assignments.manage`   | Assign a component                   |
| PATCH  | `/assignments/:id`                 | `payroll.assignments.manage`   | Update an assignment                 |
| POST   | `/assignments/:id/deactivate`      | `payroll.assignments.manage`   | Deactivate an assignment             |

Component types: `EARNING`, `DEDUCTION`, `EMPLOYER_CONTRIBUTION`, `INFORMATIONAL`.
Calculation types: `FIXED_AMOUNT`, `PERCENTAGE`, `MANUAL_AMOUNT`, `SOURCE_BASED`.
`SOURCE_BASED` requires `sourceType` (`ABSENCE`, `LATE`, `EARLY_LEAVE`, `UNPAID_LEAVE`, `OVERTIME`).

## Periods and runs

| Method | Path                         | Permission                  | Purpose                                  |
| ------ | ---------------------------- | --------------------------- | ---------------------------------------- |
| GET    | `/periods`                   | `payroll.periods.read`      | Paginated periods                        |
| GET    | `/periods/:id`               | `payroll.periods.read`      | Period detail                            |
| POST   | `/periods`                   | `payroll.periods.manage`    | Create a non-overlapping period          |
| PATCH  | `/periods/:id`               | `payroll.periods.manage`    | Update dates/status/notes                |
| GET    | `/dashboard`                 | `payroll.runs.read`         | Payroll operation counters               |
| GET    | `/runs`                      | `payroll.runs.read`         | Paginated runs                           |
| GET    | `/runs/:id`                  | `payroll.runs.read`         | Run detail with approval history         |
| POST   | `/runs`                      | `payroll.runs.calculate`    | Create the one active run for a period   |
| POST   | `/runs/:id/calculate`        | `payroll.runs.calculate`    | Calculate or recalculate                 |
| POST   | `/runs/:id/submit-review`    | `payroll.runs.review`       | `CALCULATED → UNDER_REVIEW`              |
| POST   | `/runs/:id/approve`          | `payroll.runs.approve`      | `UNDER_REVIEW → APPROVED`                |
| POST   | `/runs/:id/publish`          | `payroll.runs.publish`      | `APPROVED → PUBLISHED`                   |
| POST   | `/runs/:id/cancel`           | `payroll.runs.cancel`       | Cancel with a required reason            |

`calculate` returns `409 PAYROLL_RUN_BUSY` when another calculation already claimed the run, and
`409 PAYROLL_OVERTIME_ALREADY_CONSUMED` when a verified overtime record is used by another
non-cancelled run. Recalculation increments `calculationVersion` and replaces draft payslips.

The creator cannot approve their own run unless they hold `payroll.runs.override`.

## Adjustments

| Method | Path                       | Permission                     | Purpose                              |
| ------ | -------------------------- | ------------------------------ | ------------------------------------ |
| GET    | `/adjustments`             | `payroll.adjustments.read`     | Paginated adjustments                |
| POST   | `/adjustments`             | `payroll.adjustments.create`   | Create a pending adjustment          |
| PATCH  | `/adjustments/:id`         | `payroll.adjustments.create`   | Edit a pending adjustment            |
| POST   | `/adjustments/:id/review`  | `payroll.adjustments.approve`  | Approve or reject with a comment     |

Only `APPROVED` adjustments enter the calculation. Reviewed adjustments are immutable.

## Payslips and reports

| Method | Path                        | Permission                      | Purpose                                  |
| ------ | --------------------------- | ------------------------------- | ---------------------------------------- |
| GET    | `/payslips`                 | `payroll.payslips.read.self`    | Own published payslips; all with read-all |
| GET    | `/payslips/:id`             | `payroll.payslips.read.self`    | Payslip detail and snapshots             |
| GET    | `/payslips/:id/pdf`         | `payroll.payslips.read.self`    | Authorized PDF download                  |
| GET    | `/reports/summary`          | `payroll.reports.read`          | Published totals for a date range        |
| GET    | `/reports/components`       | `payroll.reports.read`          | Component totals                         |
| GET    | `/reports/register`         | `payroll.reports.read`          | Paginated per-employee register          |

Employees only see payslips where `publishedAt` is set and `employeeId` matches their linked employee.
Reports accept optional `from`/`to` (`YYYY-MM-DD`) and use runs whose periods overlap the range. The
register also accepts `page` (default 1) and `pageSize` (default 20, max 100); its `totals` always
cover the whole filtered range, not only the returned page.

## Error envelope

Errors use the global shape:

```json
{
  "statusCode": 409,
  "code": "PAYROLL_RUN_EXISTS",
  "message": "This period already has an active payroll run",
  "traceId": "...",
  "timestamp": "...",
  "path": "/api/v1/payroll/runs"
}
```

Important payroll codes include `PAYROLL_COMPENSATION_OVERLAP`, `PAYROLL_ASSIGNMENT_OVERLAP`,
`PAYROLL_PERIOD_OVERLAP`, `PAYROLL_RUN_EXISTS`, `PAYROLL_RUN_NOT_CALCULABLE`,
`PAYROLL_RUN_CREATOR_APPROVAL`, `PAYROLL_OVERTIME_ALREADY_CONSUMED`, and
`PAYROLL_PAYSLIP_FORBIDDEN`.
