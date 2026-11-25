# Overtime API

Base path: `/api/v1`. All routes require a bearer access token. Authorization is
enforced by the API; frontend checks are UX only.

## Permissions

| Permission                   | Grants                                            |
| ---------------------------- | ------------------------------------------------- |
| `overtime.read.self`         | Read own requests and dashboard                   |
| `overtime.create`            | Create a draft and upload attachments             |
| `overtime.update.self`       | Edit own drafts and record actual overtime        |
| `overtime.withdraw.self`     | Withdraw own pending request                      |
| `overtime.read.team`         | Read requests in the reporting subtree            |
| `overtime.approve`           | Approve the current stage                         |
| `overtime.reject`            | Reject the current stage                          |
| `overtime.read.all`          | Read every request                                |
| `overtime.manage`            | HR override, cancellation, administrative actions |
| `overtime.verify`            | Verify actual overtime                            |
| `overtime.correct`           | Correct verified minutes                          |
| `overtime.export`            | Download CSV                                      |
| `overtime.policy.read`       | Read policies and assignments                     |
| `overtime.policy.manage`     | Create, update, deactivate policies               |
| `overtime.assignment.manage` | Create, update, close assignments                 |

## Policies

| Method | Path                                | Permission               | Notes                            |
| ------ | ----------------------------------- | ------------------------ | -------------------------------- |
| GET    | `/overtime/policies`                | `overtime.policy.read`   | Paginated; `search`, `status`    |
| GET    | `/overtime/policies/active`         | `overtime.policy.read`   | Active policies for selects      |
| GET    | `/overtime/policies/:id`            | `overtime.policy.read`   |                                  |
| POST   | `/overtime/policies`                | `overtime.policy.manage` | Code is unique and upper-cased   |
| PATCH  | `/overtime/policies/:id`            | `overtime.policy.manage` |                                  |
| PATCH  | `/overtime/policies/:id/deactivate` | `overtime.policy.manage` | Sets `INACTIVE`; history remains |

Create/update body fields: `name`, `code`, `description`, `status`,
`effectiveFrom`, `effectiveTo`, `minMinutes`, `maxMinutes`,
`roundingStrategy`, `roundingMinutes`, `approvalMode`, `requiresAttachment`,
`allowWeekend`, `allowHoliday`, `eligibleEmploymentStatuses`.

`approvalMode` is `MANAGER`, `HR`, or `MANAGER_AND_HR`. Rounding is `NONE`,
`ROUND_DOWN`, `ROUND_UP`, or `NEAREST`.

## Assignments

| Method | Path                        | Permission                   | Notes                                                         |
| ------ | --------------------------- | ---------------------------- | ------------------------------------------------------------- |
| GET    | `/overtime/assignments`     | `overtime.policy.read`       | Filters: `policyId`, `employeeId`, `departmentId`, `branchId` |
| POST   | `/overtime/assignments`     | `overtime.assignment.manage` | Exactly one of employee/department/branch                     |
| PATCH  | `/overtime/assignments/:id` | `overtime.assignment.manage` | Dates and notes only                                          |
| DELETE | `/overtime/assignments/:id` | `overtime.assignment.manage` | Closes the range; never deletes history                       |

Resolution precedence is employee, then department, then branch. Multiple active
assignments at the winning scope are rejected as ambiguous.

## Requests

| Method | Path                              | Permission               | Notes                                                   |
| ------ | --------------------------------- | ------------------------ | ------------------------------------------------------- |
| GET    | `/overtime/requests`              | read self/team/all       | Scoped list; server-side page/filter/sort               |
| GET    | `/overtime/requests/me`           | `overtime.read.self`     | Forces the linked employee                              |
| POST   | `/overtime/requests`              | `overtime.create`        | Creates a `DRAFT`                                       |
| GET    | `/overtime/requests/:id`          | read self/team/all       | Scope checked in the service                            |
| PATCH  | `/overtime/requests/:id`          | `overtime.update.self`   | Drafts only; recalculates policy snapshot               |
| POST   | `/overtime/requests/:id/submit`   | `overtime.create`        | Atomic draft → pending transition                       |
| POST   | `/overtime/requests/:id/withdraw` | `overtime.withdraw.self` | Pending only                                            |
| POST   | `/overtime/requests/:id/cancel`   | `overtime.withdraw.self` | Approved/pending-verification/verified; reason required |
| POST   | `/overtime/requests/:id/approve`  | `overtime.approve`       | Optional `comment`, `override`                          |
| POST   | `/overtime/requests/:id/reject`   | `overtime.reject`        | Comment required; optional `override`                    |
| POST   | `/overtime/requests/:id/complete` | `overtime.update.self`   | Actual times optional; attendance fallback              |
| POST   | `/overtime/requests/:id/verify`   | `overtime.verify`        | Optional `verifiedMinutes`, `reason`                    |
| POST   | `/overtime/requests/:id/correct`  | `overtime.correct`       | `correctedMinutes` and `reason` required                |

List query: `page`, `pageSize`, `search`, `status`, `statuses` (comma-separated),
`category`, `employeeId`, `departmentId`, `branchId`, `from`, `to`, `sortBy`,
`sortDir`. `search` matches employee number/name or the request reason. List rows
omit approval, correction, and attachment collections; fetch the request detail
for those.

Approval and verification queues use `statuses` and server-side pagination instead
of loading a fixed batch.

Create body:

```json
{
  "workDate": "2026-11-25",
  "reason": "Month-end close",
  "plannedStartAt": "2026-11-25T11:00:00.000Z",
  "plannedEndAt": "2026-11-25T13:00:00.000Z",
  "plannedBreakMinutes": 0,
  "clientRequestId": "optional-idempotency-key"
}
```

`clientRequestId` is unique per employee and turns a duplicate submission into
`409 OVERTIME_REQUEST_DUPLICATE`.

### Request lifecycle

```
DRAFT
  └─ submit ─► PENDING_MANAGER_APPROVAL ─► PENDING_HR_APPROVAL ─► APPROVED
                 │                              │
                 ├─ withdraw ─► WITHDRAWN       ├─ reject ─► REJECTED
                 └─ reject ─► REJECTED          └─ approve (final) ─► APPROVED

APPROVED ─ complete ─► PENDING_VERIFICATION ─ verify ─► VERIFIED
   │                         │                            │
   └──────── cancel ─────────┴──────── cancel ────────────┘
                              CANCELLED
```

`MANAGER` mode skips HR; `HR` mode starts at HR; `MANAGER_AND_HR` runs both
stages. A manager-less employee also starts at HR.

## Attachments

| Method | Path                                               | Permission         |
| ------ | -------------------------------------------------- | ------------------ |
| POST   | `/overtime/requests/:id/attachments`               | `overtime.create` or `overtime.manage` |
| GET    | `/overtime/requests/:id/attachments/:attachmentId` | read self/team/all |
| DELETE | `/overtime/requests/:id/attachments/:attachmentId` | `overtime.create` or `overtime.manage` |

Uploads use multipart field `file`. Files are private and streamed through the
authorized download route.

## Dashboard, summary, export

| Method | Path                  | Permission           | Notes                                         |
| ------ | --------------------- | -------------------- | --------------------------------------------- |
| GET    | `/overtime/dashboard` | `overtime.read.self` | Own counts plus reviewer counts when in scope |
| GET    | `/overtime/summary`   | read team/all        | `from`, `to`; grouped by employee             |
| GET    | `/overtime/export`    | `overtime.export`    | CSV of the same summary                       |

Summary totals expose `requestedMinutes`, `actualMinutes`, and
`verifiedMinutes` separately. Totals are aggregated in PostgreSQL by status and
employee rather than loading every request into application memory. Totals only
count `verifiedMinutes` from `VERIFIED` requests; cancelled or pending requests
never contribute. That value is the future payroll contract.

## Errors

Errors use the shared problem shape with a stable `code`, for example:

- `OVERTIME_POLICY_NOT_ASSIGNED`
- `OVERTIME_POLICY_AMBIGUOUS`
- `OVERTIME_LEAVE_CONFLICT`
- `OVERTIME_REQUEST_OVERLAP`
- `OVERTIME_ATTACHMENT_REQUIRED`
- `OVERTIME_SELF_REVIEW_FORBIDDEN`
- `OVERTIME_VERIFIED_EXCEEDS_ACTUAL`
- `OVERTIME_VERIFICATION_REASON_REQUIRED`
- `OVERTIME_REQUEST_ALREADY_PROCESSED`

## Worker

The worker runs a read-only overtime housekeeping job daily at 02:00 in the
company timezone read from the database. It logs counts of approvals older than three days and approved
requests whose planned end passed more than two days ago. It never advances
requests automatically because completion needs explicit actual evidence.
