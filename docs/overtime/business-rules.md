# Overtime Business Rules

## Duration

- Planned duration is `plannedEndAt - plannedStartAt - plannedBreakMinutes`.
- Actual duration is `actualEndAt - actualStartAt - actualBreakMinutes`.
- Both endpoints are UTC instants; the company timezone is used for display and
  for interpreting local work dates.
- Overnight windows are supported because instants are compared directly, not
  clock strings.
- Requested minutes are rounded using the policy strategy (`NONE`,
  `ROUND_DOWN`, `ROUND_UP`, `NEAREST`) and increment.
- Requested minutes must be at least `minMinutes` and at most `maxMinutes`.
- Actual minutes are stored unrounded. Verification applies the policy rounding
  only when the reviewer does not supply an explicit verified value.
- Verified minutes may not exceed actual minutes. A correction can only lower or
  re-confirm verified minutes, never exceed actual evidence.

## Eligibility

- Only `ACTIVE` and `PROBATION` employees may create requests.
- The employee must have an active, effective policy assignment.
- A policy may restrict eligible employment statuses.
- Weekend/rest-day work requires `allowWeekend`; holiday work requires
  `allowHoliday`.
- Approved leave on the same work date is a hard conflict. Pending leave is not.
- Overlapping active overtime requests (draft, pending, approved, pending
  verification, verified) are rejected. Rejected, withdrawn, and cancelled
  requests do not block a new request.
- A policy that requires an attachment blocks submission until at least one
  attachment exists.

## Approval

- `MANAGER`: direct manager approves; if there is no manager, HR is the stage.
- `HR`: HR approves directly.
- `MANAGER_AND_HR`: direct manager approves first, then HR.
- Self-approval is forbidden.
- Managers may only decide requests inside their reporting subtree.
- HR may override a pending stage only with `overtime.manage`; the override is
  recorded on the immutable approval row.
- Rejection requires a comment.
- Approval sets `approvedMinutes = requestedMinutes`; it does not set verified
  minutes.

## Completion and verification

- Completion is allowed only for `APPROVED` or `PENDING_VERIFICATION` requests
  whose work date is today or earlier.
- Actual times may be supplied manually or derived from attendance. At least one
  usable source is required.
- Completion moves the request to `PENDING_VERIFICATION`; it never marks it
  verified.
- Verification requires `overtime.verify`, organization-wide scope, and a
  `PENDING_VERIFICATION` request.
- If the verified value differs from actual, a reason is mandatory and an
  `OvertimeCorrection` row is created.
- Correcting a verified value requires `overtime.correct`, a reason, and creates
  another immutable correction row. A correction changes `verifiedMinutes` but
  never moves `verifiedAt`, so the original verification time stays auditable.
- Only `VERIFIED` requests expose payroll-eligible minutes; summary totals exclude
  `CANCELLED` and other non-verified rows.

## Cancellation and withdrawal

- Owners may withdraw `PENDING_*` requests.
- Owners, HR, or a caller with `overtime.manage` may cancel an approved,
  pending-verification, or verified request with a reason.
- History is preserved; requests are never deleted after submission.

## Audit

Every create, update, submit, approve, reject, withdraw, cancel, complete,
verify, correct, attachment upload/removal, and policy/assignment change writes
an audit entry with the actor and relevant metadata. Attachment contents and
unnecessary personal data are never logged.
