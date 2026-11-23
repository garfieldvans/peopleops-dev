# Permission Matrix — Organization & Employees

Permissions are enforced by `JwtAuthGuard` + `PermissionsGuard`. `@RequirePermissions(...)` requires
all listed codes; `@RequireAnyPermission(...)` requires at least one. Hiding a UI action is never the
only control.

## Role grants

| Permission | SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE | PAYROLL_OFFICER |
| --- | :---: | :---: | :---: | :---: | :---: |
| `company.read` | ✓ | ✓ | ✓ | | ✓ |
| `company.update` | ✓ | ✓ | | | |
| `branch.read` | ✓ | ✓ | ✓ | | ✓ |
| `branch.create/update/delete` | ✓ | ✓ | | | |
| `department.read` | ✓ | ✓ | ✓ | | ✓ |
| `department.create/update/delete` | ✓ | ✓ | | | |
| `position.read` | ✓ | ✓ | ✓ | | ✓ |
| `position.create/update/delete` | ✓ | ✓ | | | |
| `job_level.read` | ✓ | ✓ | ✓ | | ✓ |
| `job_level.create/update/delete` | ✓ | ✓ | | | |
| `employee.read` | ✓ | ✓ | | | |
| `employee.read_sensitive` | ✓ | ✓ | | | |
| `employee.read_team` | ✓ | ✓ | ✓ | | |
| `employee.read_self` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `employee.create` | ✓ | ✓ | | | |
| `employee.update` | ✓ | ✓ | | | |
| `employee.update_self` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `employee.deactivate` | ✓ | ✓ | | | |
| `employee.manage_documents` | ✓ | ✓ | | | |
| `employee.manage_user_account` | ✓ | ✓ | | | |
| `work_schedule.read` | ✓ | ✓ | ✓ | ✓ | |
| `work_schedule.create/update/deactivate` | ✓ | ✓ | | | |
| `shift.read` | ✓ | ✓ | ✓ | ✓ | |
| `shift.create/update/deactivate` | ✓ | ✓ | | | |
| `attendance.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `attendance.read_all` | ✓ | ✓ | | | ✓ |
| `attendance.read_team` | ✓ | | ✓ | | |
| `attendance.clock_in` | ✓ | | | ✓ | |
| `attendance.clock_out` | ✓ | | | ✓ | |
| `attendance.manage` | ✓ | ✓ | | | |
| `attendance.export` | ✓ | ✓ | | | ✓ |
| `attendance_correction.read` | ✓ | ✓ | ✓ | ✓ | |
| `attendance_correction.create` | ✓ | ✓ | | ✓ | |
| `attendance_correction.review` | ✓ | ✓ | ✓ | | |
| `holiday.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `holiday.create/update/deactivate` | ✓ | ✓ | | | |

`SUPER_ADMIN` receives the full permission catalogue. Role definitions live in
`apps/api/src/modules/rbac/rbac.constants.ts` and are synchronized by the idempotent database seed.

## Scope rules

| Caller | Employee list | Employee detail | Sensitive personal fields | Employment writes |
| --- | --- | --- | --- | --- |
| Read-all (`employee.read` or `read_sensitive`) | All employees | Any | Yes | Requires `employee.update` |
| Manager (`read_team` only) | Own subtree | Own subtree | Hidden | No |
| Employee (`read_self` only) | Own row | Own row | Yes (own) | No; self-service contact fields only |
| No linked employee | Empty list | Denied / `404` | — | — |

The reporting subtree is the employee themselves plus every employee reachable through
`manager_id`, walked iteratively so a corrupt cycle cannot hang the request. `employee.update_self`
is additionally constrained by `UpdateSelfEmployeeDto`, which does not declare any employment field.

## Document access

Document metadata and downloads follow the same read scope as the employee profile. Upload and delete
require `employee.manage_documents`; a manager or employee cannot upload or delete documents even for
their own record. Downloads are authorized per request — there is no public or signed permanent URL.

## Attendance scope

- `attendance.read_all` sees every record and may call the HR overview. Export additionally requires
  `attendance.export`.
- `attendance.read_team` sees the signed-in employee plus the full reporting subtree. Overview and
  export are denied.
- `attendance.read` alone resolves to the linked employee only; an unlinked account gets an empty list
  and `404 EMPLOYEE_NOT_LINKED` from self endpoints.
- Correction review requires both `attendance_correction.review` and employee scope; reviewing one's
  own request is rejected with `SELF_REVIEW_FORBIDDEN`.
- Schedule assignment writes require `work_schedule.update`; clock actions require the matching
  `attendance.clock_in` / `attendance.clock_out` permission.

## Tests

`permissions.guard.spec.ts` covers guard semantics, and `employees.e2e-spec.ts` verifies manager
scoping, self-service field restrictions, document authorization and the account-without-employee
case against a real database.
