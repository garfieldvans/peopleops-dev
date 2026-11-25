# Leave Management Module

Status: implemented in Phase 5. Covers leave types, policy versions, effective-dated policy
assignments, entitlement periods, monthly/upfront accrual, a transactional balance ledger with
pending reservations, carry-over and expiration, leave requests, leave-specific manager/HR approval,
cancellation and reversal, private attachments, history, dashboards, calendar, reports, and the
Attendance integration.

Out of scope for this phase: hourly leave, overtime, payroll, a generic approval engine, GPS or
biometric verification, multi-tenancy, and claims of full Indonesian employment-law compliance.

## Domain model

| Entity                                                      | Purpose                                                                                                                                                                                                                     |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LeaveType`                                                 | Master data: paid/unpaid, approval requirement, attachment requirement, half-day support, past/future date rules, whether a ledger balance is required.                                                                     |
| `LeavePolicy`                                               | Versioned rule set for one leave type: entitlement amount, accrual method/frequency/start rule, eligibility, caps, request limits, carry-over, approval mode, leave-year start month, cancellation cutoff, effective dates. |
| `LeavePolicyAssignment`                                     | Effective-dated link between an employee and a policy. Active assignments for the same employee and leave type may not overlap.                                                                                             |
| `LeaveEntitlementPeriod`                                    | One leave year for one employee/type. Stores the policy snapshot used for that period.                                                                                                                                      |
| `LeaveTransaction`                                          | Immutable ledger row: entitlement, accrual, deduction, reversal, carry-over, expiration, or adjustment.                                                                                                                     |
| `LeaveTransactionAllocation`                                | FIFO link showing which credit tranche a debit consumed.                                                                                                                                                                    |
| `LeaveBalanceReservation`                                   | Pending amount held while a request is awaiting approval.                                                                                                                                                                   |
| `LeaveRequest` / `LeaveRequestDay` / `LeaveRequestApproval` | Request header, working-day duration detail, and immutable approval history.                                                                                                                                                |
| `LeaveAttachment`                                           | Private supporting file stored outside the public web root.                                                                                                                                                                 |

The database ledger is authoritative. No mutable `used` or `remaining` column exists.

## Leave types

The API validates unique codes, active status, and the boolean behavior flags. Deactivation keeps
historical requests, policies, and ledger rows readable. Types with existing policies cannot be
deleted (there is no delete endpoint).

## Policies and effective dates

A policy is created with `effectiveFrom` and an optional `effectiveTo`. Assignments must start inside
the policy window, and only active policies can be assigned. Eligibility months are checked against
the employee's `joinDate`.

`LeaveEntitlementPeriod.policySnapshot` freezes the policy rules at the time the period is first
created. Updating a policy therefore does **not** rewrite an already-created period or its ledger.
New periods use the new policy values. Overlapping active assignments are rejected by a service check
and by a PostgreSQL exclusion constraint, so concurrent writes cannot create an overlap.

## Leave year and entitlement

`leaveYearStartMonth` (1–12) controls the calendar leave year. For example, month `4` produces
`2026-04-01` through `2027-03-31`. A request must stay inside one leave period.

Entitlement is generated when an assignment is created (current period immediately) and by the daily
worker for later periods. Rules:

| Accrual method                      | Rule                                                                                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GRANTED_UPFRONT`, `ANNUAL_ACCRUAL` | Full annual amount, prorated by remaining months when the assignment starts after the period start. A mid-month start begins proration in the following month (no partial-month proration). |
| `MONTHLY_ACCRUAL`                   | `entitlementAmount / 12` per month from the assignment month. A mid-month assignment starts accruing the following month.                                                                   |
| `MANUAL_GRANT`                      | No automatic entitlement; HR creates explicit adjustments.                                                                                                                                  |

All generated credits use a unique `(sourceType, sourceRef, type)` key. Retries and concurrent worker
runs therefore cannot duplicate entitlement or accrual.

## Balance ledger and reservations

Balance totals are derived from transactions plus pending reservations:

```text
entitled  = sum(positive transactions excluding LEAVE_REVERSAL)
used      = max(0, abs(sum(negative transactions)) - sum(positive LEAVE_REVERSAL))
reserved  = sum(PENDING reservations)
available = entitled - used - reserved
```

- Debits consume credit tranches earliest-expiring-first, then oldest transaction date, then oldest
  creation time. `LeaveTransactionAllocation` records the consumption.
- Submission checks available balance and creates a `PENDING` reservation.
- Approval consumes the reservation and writes `LEAVE_DEDUCTION` inside one transaction.
- Rejection and withdrawal release the reservation without a ledger debit.
- Cancellation of approved leave writes `LEAVE_REVERSAL`, restoring available balance, and retains the
  original deduction and approval history.
- Manual adjustments require `leave_balance.adjust`, a reason, and cannot make the balance negative
  unless the policy explicitly allows it.
- `pg_advisory_xact_lock` on `employeeId:leaveTypeId` serialises balance mutations for the same
  employee and type during request submission, approval, cancellation, and adjustment.

## Carry-over and expiration

The worker carries remaining balance from the previous open period into the new period when
`carryOverEnabled` is true. The amount is capped by `maxCarryOverAmount`. A `CARRY_OVER` debit closes
the previous period and a matching credit is created in the new period.

`carryOverExpirationMonths` sets the expiry of the carry-over credit; without it, the credit expires at
the end of the new period. Expired credit that has not been consumed is debited as `EXPIRATION` and is
excluded from the remaining source list. Carry-over and expiration writes are idempotent through their
source references.

The worker (`apps/worker/src/leave-jobs.service.ts`) runs daily at 01:00 `Asia/Jakarta` using
`@nestjs/schedule`. The API does not schedule cron jobs in every instance.

## Duration calculation

Only `FULL_DAY` and `HALF_DAY` requests are accepted. `HOURLY` returns
`HOURLY_LEAVE_NOT_SUPPORTED`.

For every date in the range the API resolves the employee's effective schedule and checks company or
branch holidays. Working days count `1`, non-working days and holidays count `0`. `HALF_DAY` requires
the same start and end date, an allowed type/policy, and a `FIRST_HALF` or `SECOND_HALF` period, and
counts `0.5`. The duration is derived from the actual schedule; it is not an assumed four hours.

The preview returns the day-by-day breakdown, balance, estimated remaining, and attachment requirement.
It is the same calculation used by submit, so a preview cannot disagree with the saved request.

## Request and approval workflow

Statuses: `DRAFT → PENDING → APPROVED | REJECTED`, plus `WITHDRAWN` (pending only) and `CANCELLED`
(approved only).

- Employees can only create, edit, submit, withdraw, or cancel their own requests.
- Submit validates duration, balance, attachments, overlap, and approval routing.
- Approval modes are `MANAGER`, `HR`, and `MANAGER_AND_HR`. Manager approval moves a
  `MANAGER_AND_HR` request to the HR stage; HR then finalises it.
- HR may override with `leave_request.override` and a reason. An override finalises the
  request immediately, even when the normal route still has an HR stage. Self-approval is always
  rejected.
- Concurrent reviews are claimed with a conditional `UPDATE`; the loser receives
  `LEAVE_REQUEST_ALREADY_REVIEWED`.
- Every decision is stored as a separate `LeaveRequestApproval` row with stage, decision, actor,
  comment, override flag, and timestamp. History is never replaced.
- Overlapping active requests are prevented by a database exclusion constraint.

## Attachments

Uploads are limited to the configured size and MIME allow-list, stored under the private
`storage/leave-attachments` root through the `LEAVE_FILE_STORAGE` provider. Download requires
`leave_request.read` plus request scope. Metadata and content are never exposed as public URLs.
Uploads and deletion are restricted to the request owner while the request is editable.

## Attendance integration

`LeaveIntegrationService` is a read-only adapter. Approved leave that overlaps a work date is exposed
to attendance reads and calendar responses and is rendered as `ON_LEAVE`.

Contract:

- Approved full-day leave marks a scheduled day `ON_LEAVE`; it is never treated as absence.
- Approved half-day leave is returned as `ON_LEAVE` with `requestMode = HALF_DAY` and
  `halfDayPeriod`; the half-day leave exemption is not yet applied to attendance late/early or
  absence calculations.
- Existing attendance records and clock sessions are preserved. A clock-in on an approved leave day is
  retained and the conflict remains visible rather than being silently deleted. Partial-day
  recalculation against a leave window is a known follow-up.
- Attendance code does not mutate leave requests or balances, and leave code does not rewrite clock
  records.
- Pending leave is not treated as approved attendance leave.

## Read scope and permissions

| Capability            | Permission                                                  |
| --------------------- | ----------------------------------------------------------- |
| Manage types          | `leave_type.read/create/update/deactivate`                  |
| Manage policies       | `leave_policy.read/create/update/deactivate`                |
| Assign policies       | `leave_policy.assign` (read also needs `leave_policy.read`) |
| Own requests          | `leave_request.read/create/submit/withdraw/cancel`          |
| Team requests         | `leave_request.read_team`                                   |
| All requests          | `leave_request.read_all`                                    |
| Approve / reject      | `leave_request.approve` / `leave_request.reject`            |
| HR override           | `leave_request.override`                                    |
| Own balance / ledger  | `leave_balance.read` / `leave_transaction.read`             |
| All balances / ledger | `leave_balance.read_all` / `leave_transaction.read_all`     |
| Adjust balance        | `leave_balance.adjust`                                      |
| Reports               | `leave_report.read`                                         |

Managers can read requests, balances, ledger rows, and the calendar for their reporting subtree.
Employees resolve to their linked employee record only. Requests outside scope return
`403 LEAVE_OUT_OF_SCOPE` or an equivalent domain error. Hiding a UI action is never the only control;
the API guards enforce every permission.

## API surface

Base prefix: `/api/v1`.

| Method              | Path                                                                     | Permission                                        |
| ------------------- | ------------------------------------------------------------------------ | ------------------------------------------------- |
| GET                 | `/leave-types`, `/leave-types/active`, `/leave-types/:id`                | `leave_type.read`                                 |
| POST                | `/leave-types`                                                           | `leave_type.create`                               |
| PATCH               | `/leave-types/:id`, `/leave-types/:id/deactivate`                        | `leave_type.update` / `leave_type.deactivate`     |
| GET                 | `/leave-policies`, `/leave-policies/active`, `/leave-policies/:id`       | `leave_policy.read`                               |
| POST                | `/leave-policies`                                                        | `leave_policy.create`                             |
| PATCH               | `/leave-policies/:id`, `/leave-policies/:id/deactivate`                  | `leave_policy.update` / `leave_policy.deactivate` |
| GET                 | `/leave-policy-assignments`                                              | `leave_policy.read`                               |
| POST                | `/leave-policy-assignments`                                              | `leave_policy.assign`                             |
| PATCH               | `/leave-policy-assignments/:id`                                          | `leave_policy.assign`                             |
| GET                 | `/leave-balances/me`, `/leave-balances/me/:leaveTypeId`                  | `leave_balance.read`                              |
| GET                 | `/leave-balances`, `/leave-balances/:employeeId`                         | `leave_balance.read` (scope applied)              |
| POST                | `/leave-balances/:employeeId/adjustments`                                | `leave_balance.adjust`                            |
| GET                 | `/leave-transactions/me`, `/leave-transactions`                          | `leave_transaction.read` (scope applied)          |
| GET                 | `/leave-requests/me`, `/leave-requests/dashboard`, `/leave-requests/:id` | `leave_request.read`                              |
| GET                 | `/leave-requests`                                                        | `leave_request.read` (scope applied)              |
| POST                | `/leave-requests/preview`                                                | `leave_request.create`                            |
| POST                | `/leave-requests`                                                        | `leave_request.create`                            |
| PATCH               | `/leave-requests/:id`                                                    | `leave_request.create` (owner, draft only)        |
| POST                | `/leave-requests/:id/submit`, `/withdraw`                                | `leave_request.submit` / `leave_request.withdraw` |
| POST                | `/leave-requests/:id/approve`, `/reject`                                 | `leave_request.approve` / `leave_request.reject`  |
| POST                | `/leave-requests/:id/cancel`                                             | `leave_request.cancel`                            |
| POST / GET / DELETE | `/leave-requests/:id/attachments[/:attachmentId]`                        | create / read / create (owner scope)              |
| GET                 | `/leave-calendar/me`                                                     | `leave_request.read`                              |
| GET                 | `/leave-calendar/team`                                                   | `leave_request.read_team`                         |
| GET                 | `/leave-calendar`                                                        | `leave_request.read_all`                          |
| GET                 | `/leave-reports/summary`, `/leave-reports/export`                        | `leave_report.read`                               |

List endpoints support server-side `page`, `pageSize`, `search`, and relevant filters. The report
export is a UTF-8 CSV with a BOM for spreadsheet compatibility.

## Frontend

| Route                       | Page                                           |
| --------------------------- | ---------------------------------------------- |
| `/leave`                    | Leave dashboard                                |
| `/leave/balances`           | My leave balance                               |
| `/leave/requests`           | My leave requests                              |
| `/leave/requests/new`       | New request with backend duration preview      |
| `/leave/requests/:id`       | Detail, approval history, attachments, actions |
| `/leave/team`               | Team requests                                  |
| `/leave/approvals`          | Approval inbox                                 |
| `/leave/calendar`           | Month calendar (me/team/organisation)          |
| `/leave/types`              | Leave type management                          |
| `/leave/policies`           | Leave policy management                        |
| `/leave/assignments`        | Policy assignments                             |
| `/leave/balance-management` | All balances and manual adjustment             |
| `/leave/transactions`       | Ledger history                                 |
| `/leave/reports`            | Summary and CSV export                         |

Routes and navigation are permission-aware. Lists use server-side search/filter/pagination and expose
loading, empty, error, and success states. Destructive actions use confirmation modals.

## Audit logging

The API records audit entries for type/policy create, update and deactivate, policy assignment,
request create/update/submit/withdraw/approve/reject/cancel, manual adjustments, and attachment
changes. Entries contain actor, action, entity type/id, timestamp, request metadata, and relevant
metadata. Attachment bytes and unnecessary personal data are not logged.

## Known limitations and decisions needing confirmation

- Hourly leave is not implemented even though `HOUR` exists in the schema.
- There is no public-holiday calendar import or statutory Indonesian leave rule set.
- Approval routing is leave-specific; it is not a general workflow engine.
- `MANAGER_AND_HR` with no manager routes directly to HR. This needs product-owner confirmation.
- Proration uses whole remaining months and ignores partial months. Product may prefer daily proration.
- Cancellation cutoff is measured in calendar days from the leave start.
- The leave year is a fixed calendar window; it does not support anniversary-based periods.
- Expiration only processes credits with an explicit `expiresAt`; base entitlement credits have no
  expiry unless created as carry-over.
- Approved half-day leave is exposed to attendance, but the remaining working half is not yet
  recalculated against late, early-leave, or absence rules. Decide the product behaviour before
  attendance feeds payroll.
- The worker is a single scheduled process; it is safe to run multiple instances thanks to unique
  source keys, but no distributed lock is used.
- The worker reads the company timezone from the database and schedules leave/overtime jobs in it;
  the API uses the same timezone for leave dates, cancellation cutoffs, and balance defaults.
