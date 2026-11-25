# Overtime Domain Analysis

Status: Phase 6. Overtime is a first-class module, not a payroll calculation.

## Purpose

Overtime records work performed outside an employee's scheduled hours. The module
answers four separate questions and never collapses them into one number:

1. **Requested overtime** — what the employee asked to work in advance.
2. **Actual overtime** — what attendance evidence shows was worked.
3. **Verified overtime** — what an authorized HR reviewer accepted after checking
   the evidence and any correction.
4. **Payroll-eligible overtime** — only `verifiedMinutes` on a `VERIFIED` request.
   Phase 6 exposes this value but does not calculate pay, multipliers, or
   statutory premiums.

Approval and verification are separate gates. An approved request is not
automatically payroll-eligible; it must be completed and verified after the work
date.

## Core entities

| Entity                     | Responsibility                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `OvertimePolicy`           | Versioned rule set: minimum/maximum duration, rounding, approval mode, weekend/holiday eligibility, and attachment requirement.         |
| `OvertimePolicyAssignment` | Effective-dated assignment of a policy to an employee, department, or branch.                                                           |
| `OvertimeRequest`          | The employee's request, lifecycle status, planned/actual/verified minutes, policy snapshot, and links to attendance and leave evidence. |
| `OvertimeApproval`         | Immutable decision history for manager and HR stages.                                                                                   |
| `OvertimeCorrection`       | Immutable trail whenever verified minutes are changed from actual minutes.                                                              |
| `OvertimeAttachment`       | Optional private supporting document, stored behind the existing file-storage abstraction.                                              |

## Lifecycle

```
DRAFT
  └─ submit ─► PENDING_MANAGER_APPROVAL ─► PENDING_HR_APPROVAL ─► APPROVED
                              │                       │
                              └──── reject ───────────┴─► REJECTED

PENDING_* ─ withdraw ─► WITHDRAWN

APPROVED ─ complete ─► PENDING_VERIFICATION ─ verify ─► VERIFIED
APPROVED / PENDING_VERIFICATION / VERIFIED ─ cancel ─► CANCELLED
```

`DRAFT` and `PENDING_*` requests are editable/withdrawable only by the owner.
`APPROVED` requests may be completed by the owner or HR. Verification and
correction require HR permissions. No endpoint allows arbitrary status updates.

## Policy resolution

An employee's policy for a work date is resolved with this precedence:

1. employee assignment;
2. department assignment;
3. branch assignment.

Within one precedence level there must be exactly one active assignment covering
the date. A missing policy blocks request creation. Policy changes affect new
requests only; each request stores a JSON snapshot of the policy used at
submission.

## Relationship to attendance and leave

- Attendance remains the source of clock-in, clock-out, scheduled hours, breaks,
  holidays, and schedules. Overtime never edits attendance rows.
- Approved leave blocks overtime on the same work date. Pending leave is not
  treated as approved.
- Actual overtime may be derived from an attendance record when the employee has
  clocked out: the window starts at `max(plannedStartAt, scheduledEndAt)` and ends
  at `clockOutAt`. Early arrival is never treated as overtime. If no usable
  attendance record exists, the owner or HR must enter actual times manually.
- Breaks are deducted from the actual window. The default deduction is the
  planned break; an explicit actual break overrides it.

## Boundaries

In scope: policy administration, assignments, request lifecycle, manager/HR
approval, actual recording, verification, corrections, attachments, dashboard,
reports, CSV export, audit, and permission-aware UI.

Out of scope: payroll calculation, statutory multipliers, PPh 21, BPJS, THR,
salary disbursement, generic approval workflow engine, GPS/biometrics, and
notifications.
