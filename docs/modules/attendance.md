# Attendance Module

Status: implemented in Phase 4. Covers work schedules, shifts, effective-dated schedule assignments,
clock-in/out, unpaid breaks, company-timezone work dates, centralized calculations, attendance
history/calendar, manual corrections, correction requests, holidays, HR/self dashboards, CSV export,
and audit logging.

Out of scope: leave, overtime, payroll, a generic approval engine, GPS or selfie verification.

## Timezone and work date

All wall-clock rules are interpreted in `Company.timezone` (default `Asia/Jakarta`). Instants are
stored as `timestamptz` in UTC; the attendance record stores a snapshot of the schedule and timezone
so later master-data edits cannot rewrite history.

- `workDate` is the local date on which the shift starts.
- An overnight shift (end time `<=` start time) ends on the following local date.
- A clock-in after midnight is attached to yesterday's overnight shift when `now` is still inside
  that shift (start ≤ now ≤ end). Otherwise today's schedule is used.
- Date-only values are parsed as `YYYY-MM-DD` in UTC, never through the server timezone.

`apps/api/src/common/time/zoned-time.ts` owns the conversion helpers using Luxon, and its unit tests
cover Jakarta offsets, local midnight, overnight end dates and DST offsets in another timezone.

## Calculation rules

`calculateAttendance` in
`apps/api/src/modules/attendance/attendance-calculation.ts` is the single calculation entry point.

| Value | Rule |
| --- | --- |
| `lateMinutes` | Minutes after `scheduledStart + graceLateMinutes`; whole minutes only. |
| `earlyLeaveMinutes` | Minutes before `scheduledEnd - graceEarlyMinutes`; whole minutes only. |
| `workedMinutes` | Elapsed clock-in → clock-out minus `max(expectedBreakMinutes, recordedBreakMinutes)`, clamped at 0. |
| `breakMinutesTaken` | Recorded breaks clipped to the clock-in/out window. |
| `status` | `INCOMPLETE` when one side is missing; `ABSENT` only when both are missing; otherwise `LATE_AND_EARLY_LEAVE`, `LATE`, `EARLY_LEAVE`, `HALF_DAY` (worked less than half the schedule with no late/early flag), or `PRESENT`. |

The API does not manufacture `ABSENT` rows for employees who never clock in. The HR overview derives
absence for past dates from scheduled employees without a record and without a holiday.

## Schedules and shifts

`WorkSchedule` stores one row per ISO weekday (1 = Monday … 7 = Sunday) with working flag, start/end
time and break minutes. Non-working days carry no hours. Schedules also define late/early grace
defaults.

`Shift` overrides the daily hours (and break/grace) when assigned; the weekly schedule still decides
whether the date is a working day. Equal start and end times are rejected, and a break cannot consume
the whole shift.

`EmployeeScheduleAssignment` is effective-dated (`effectiveFrom`, optional `effectiveTo`). Creating a
new assignment with `closePrevious = true` (default) closes the previous open row the day before the
new start, preserving history. Overlapping periods, duplicate start dates, inactive schedules/shifts
and inactive employees are rejected. Bulk assignment accepts a branch, a department, or an explicit
employee list and runs in one transaction.

The schedule snapshot is copied into every attendance record: assignment/schedule/shift ids, UTC
scheduled instants, expected break, grace values and timezone.

## Clock and breaks

- `POST /attendance/clock-in` requires an active/probation employee, a working schedule and no existing
  record for that work date. The unique `(employee_id, work_date)` constraint and a partial unique
  index for open sessions make duplicate or concurrent clock-ins safe.
- `POST /attendance/clock-out` atomically claims the open record (`UPDATE … WHERE clock_out IS NULL`),
  closes any running break at the clock-out instant and recalculates late/early/worked/status values.
- `POST /attendance/breaks/start` rejects a second open break; the partial unique index enforces this
  under concurrency.
- `POST /attendance/breaks/end` claims the open break atomically and updates recorded break minutes.
- Clock-out auto-closes an active break so no session is left with an open break.

## Corrections

An employee submits a request with a work date, affected fields (`CLOCK_IN`, `CLOCK_OUT`, `BOTH`),
local `HH:mm` values and a reason. Clock-out times that fall at or before clock-in are moved to the
next local day, which covers overnight corrections. Original values are copied into the request.

There is at most one `PENDING` correction per record and per employee/work date, enforced by partial
unique indexes. Review requires `attendance_correction.review`, the employee must be in the
reviewer's scope, and self-review is rejected. Approval applies the requested values, closes no open
sessions (open attendance must be clocked out first), recalculates attendance inside a transaction,
marks `isCorrected`, and stores the reviewer, notes and timestamp. Rejections leave attendance
untouched. Employees can cancel their own pending request.

## Holidays

Holiday types are `NATIONAL`, `COMPANY` and `BRANCH`; only `BRANCH` may target a branch. Dates are
unique per scope (company-wide or branch) through partial unique indexes. Active holidays appear in
the self calendar, dashboard state (`HOLIDAY`) and are excluded from derived absence. Attendance can
still be recorded on a holiday.

## Read scope

| Caller | Records | Overview | Export | Corrections |
| --- | --- | --- | --- | --- |
| `attendance.read_all` | All | Yes | With `attendance.export` | All (with review permission) |
| `attendance.read_team` | Own reporting subtree | No | No | Subtree |
| `attendance.read` only | Own linked employee | No | No | Own |
| No linked employee | Empty self list / `404 EMPLOYEE_NOT_LINKED` on self endpoints | — | — | — |

Out-of-scope detail requests return `403 ATTENDANCE_OUT_OF_SCOPE`.

## API surface

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/work-schedules`, `/work-schedules/:id` | `work_schedule.read` |
| POST / PATCH / PATCH deactivate | `/work-schedules` | `work_schedule.create/update/deactivate` |
| GET | `/shifts`, `/shifts/:id` | `shift.read` |
| POST / PATCH / PATCH deactivate | `/shifts` | `shift.create/update/deactivate` |
| GET | `/employee-schedules` | `employee.read` (scope applied) |
| GET / POST | `/employees/:id/schedules` | `work_schedule.read` / `work_schedule.update` |
| POST | `/employee-schedules/bulk` | `work_schedule.update` |
| PATCH | `/employee-schedules/:id` | `work_schedule.update` |
| GET | `/holidays`, `/holidays/:id` | `holiday.read` |
| POST / PATCH / PATCH deactivate | `/holidays` | `holiday.create/update/deactivate` |
| GET | `/attendance` | `attendance.read` (scope applied) |
| GET | `/attendance/me`, `/attendance/me/calendar` | `attendance.read` |
| GET | `/attendance/employees/:id/records`, `/calendar` | `attendance.read` (scope applied) |
| GET | `/attendance/dashboard` | `attendance.read` |
| GET | `/attendance/overview` | `attendance.read_all` |
| GET | `/attendance/export` | `attendance.export` |
| POST | `/attendance/clock-in`, `/attendance/breaks/start` | `attendance.clock_in` |
| POST | `/attendance/clock-out`, `/attendance/breaks/end` | `attendance.clock_out` |
| GET | `/attendance/:id` | `attendance.read` (scope applied) |
| PATCH | `/attendance/:id` | `attendance.manage` |
| GET / POST | `/attendance/corrections` | `attendance_correction.read/create` |
| GET | `/attendance/corrections/:id` | `attendance_correction.read` |
| PATCH | `/attendance/corrections/:id/approve`, `/reject` | `attendance_correction.review` |
| PATCH | `/attendance/corrections/:id/cancel` | `attendance_correction.create` (owner only) |

CSV export uses a UTF-8 BOM, local scheduled/clock times and up to 5,000 records matching the list
filters.

## Web screens

- `/`: self attendance card (state, schedule, clock/break actions, today's values), HR overview stats
  and module links.
- `/attendance`: HR/manager record list with debounced search, date/status/branch/department filters,
  pagination, pending-correction badges and CSV export.
- `/attendance/:id`: record breakdown, breaks and permission-gated manual correction.
- `/attendance/me`: monthly calendar and records, pending correction list, submit/cancel correction.
- `/attendance/schedules`, `/attendance/shifts`: master data with create/edit/deactivate modals.
- `/attendance/assignments`: effective-dated assignment list and bulk assign dialog by employee,
  branch or department.
- `/attendance/corrections`: review queue with approve/reject and notes.
- `/attendance/holidays`: holiday CRUD with company/branch scope.

## Audit actions

`work_schedule.created/updated/deactivated`, `shift.created/updated/deactivated`,
`employee_schedule.created/updated/bulk_created`, `holiday.created/updated/deactivated`,
`attendance.clocked_in/clocked_out`, `attendance.break_started/break_ended`,
`attendance.manually_updated`, `attendance_correction.created/approved/rejected/cancelled`.

Metadata contains ids, dates, reasons and changed field names only.

## Tests

- Unit: `attendance-calculation.spec.ts` (normal, grace, late/early, half day, break deduction,
  incomplete, absent, overnight) and `zoned-time.spec.ts` (Jakarta, midnight, overnight dates, DST).
- E2E: `apps/api/test/attendance.e2e-spec.ts` covers duplicate/concurrent clock-ins and clock-outs,
  break uniqueness, correction submission/approval/recalculation, manager vs outsider scope,
  dashboard state, holiday calendar, bulk assignment with history preservation, manual correction and
  CSV export.
- Web: `dashboard-page.test.tsx` covers the schedule/overview render and the clock-in mutation.

## Assumptions and limitations

- Attendance is not pre-generated from schedules. HR sees missing records as `NO_RECORD` in calendars
  and derived absence only for past dates.
- There is no automatic scheduler/rollup or notification in this phase.
- Correction attachments are not implemented; the audit trail records the reason and reviewer.
- Manual HR edits use the browser's timezone when converting `datetime-local` input to ISO instants.
- A deactivated schedule remains readable for historical assignments; new assignments require
  `ACTIVE` master data.
