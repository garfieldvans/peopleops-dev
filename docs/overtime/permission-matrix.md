# Overtime Permission Matrix

All authorization is enforced by the API. UI checks only hide actions.

| Permission                   | SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE | PAYROLL_OFFICER |
| ---------------------------- | :---------: | :------: | :-----: | :------: | :-------------: |
| `overtime.read.self`         |      ✓      |    ✓     |    ✓    |    ✓     |        ✓        |
| `overtime.create`            |      ✓      |    ✓     |    ✓    |    ✓     |        ✓        |
| `overtime.update.self`       |      ✓      |    ✓     |    ✓    |    ✓     |        ✓        |
| `overtime.withdraw.self`     |      ✓      |    ✓     |    ✓    |    ✓     |        ✓        |
| `overtime.read.team`         |      ✓      |          |    ✓    |          |                 |
| `overtime.approve`           |      ✓      |    ✓     |    ✓    |          |                 |
| `overtime.reject`            |      ✓      |    ✓     |    ✓    |          |                 |
| `overtime.read.all`          |      ✓      |    ✓     |         |          |        ✓        |
| `overtime.manage`            |      ✓      |    ✓     |         |          |                 |
| `overtime.verify`            |      ✓      |    ✓     |         |          |                 |
| `overtime.correct`           |      ✓      |    ✓     |         |          |                 |
| `overtime.export`            |      ✓      |    ✓     |         |          |        ✓        |
| `overtime.policy.read`       |      ✓      |    ✓     |    ✓    |          |        ✓        |
| `overtime.policy.manage`     |      ✓      |    ✓     |         |          |                 |
| `overtime.assignment.manage` |      ✓      |    ✓     |         |          |                 |

## Scope rules

- `overtime.read.all` sees every request. `overtime.read.team` sees the signed-in
  employee plus the full reporting subtree. `overtime.read.self` sees only the
  linked employee record.
- Manager approval requires both `overtime.approve`/`overtime.reject` and the
  request employee being inside the reviewer's subtree.
- HR approval requires organization-wide scope.
- Self-approval is always rejected.
- Verification/correction requires organization-wide scope and the dedicated
  permission.
- Policy and assignment writes require `overtime.policy.manage` or
  `overtime.assignment.manage`.
- Attachment download follows the same read scope as the request; upload/removal
  requires ownership (or `overtime.manage`) and a draft/pending request.
