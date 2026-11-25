# Overtime Workflow

## 1. Policy setup (HR)

1. Create a policy with duration limits, rounding, approval mode, and
   weekend/holiday eligibility.
2. Assign the policy to an employee, department, or branch with effective dates.
3. Overlapping active assignments at the same scope are rejected.

## 2. Request (employee)

1. Open **Create overtime request**.
2. Choose the work date, planned start/end, planned break, and reason.
3. The server resolves the applicable policy and derives the category:
   `HOLIDAY`, `WEEKDAY`, `WEEKEND`, or `REST_DAY`.
4. The server validates leave, overlapping overtime, policy limits, and
   attachments.
5. The request is created as `DRAFT`, then submitted immediately by the form.

## 3. Approval (manager / HR)

1. Pending requests appear in the approval inbox.
2. A manager sees requests for their reporting subtree; HR sees all requests.
3. Approve or reject with a comment.
4. `MANAGER_AND_HR` moves from `PENDING_MANAGER_APPROVAL` to
   `PENDING_HR_APPROVAL`; other modes finalize.
5. HR override is available only with `overtime.manage` and is recorded on the
   approval row.

## 4. Actual work (employee / HR)

1. After the work date, open the approved request.
2. Enter actual start/end and actual break, or derive the window from the
   attendance record.
3. Completion moves the request to `PENDING_VERIFICATION`.

## 5. Verification (HR)

1. Open the verification queue.
2. Compare planned, actual, attendance, and leave evidence.
3. Accept actual minutes or enter a verified value with a reason.
4. Verification creates an immutable correction when the value changes and
   moves the request to `VERIFIED`.

## 6. Correction and reporting

- A later correction changes `verifiedMinutes` only, records the previous value,
  and preserves the audit trail.
- Reports summarize requested, actual, and verified minutes by employee,
  department, category, and status.
- CSV export is available with `overtime.export`.
- Payroll may consume only verified minutes in a future phase; Phase 6 does not
  calculate pay.
