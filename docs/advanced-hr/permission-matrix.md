# Advanced HR Permission Matrix

| Permission | SUPER_ADMIN | HR_ADMIN | PAYROLL_OFFICER | MANAGER | EMPLOYEE |
| --- | :---: | :---: | :---: | :---: | :---: |
| `onboarding.read` | ✓ | ✓ |  | ✓ | ✓ |
| `onboarding.manage` | ✓ | ✓ |  |  |  |
| `onboarding.task.update` | ✓ | ✓ |  | ✓ | ✓ |
| `offboarding.read` | ✓ | ✓ |  |  | ✓ |
| `offboarding.manage` | ✓ | ✓ |  |  |  |
| `offboarding.task.update` | ✓ | ✓ |  |  |  |
| `offboarding.sensitive.read` | ✓ | ✓ |  |  |  |
| `performance.cycles.read` | ✓ | ✓ |  | ✓ | ✓ |
| `performance.cycles.manage` | ✓ | ✓ |  |  |  |
| `performance.goals.read.self` | ✓ | ✓ |  | ✓ | ✓ |
| `performance.goals.manage` | ✓ | ✓ |  | ✓ |  |
| `performance.reviews.read.self` | ✓ | ✓ |  | ✓ | ✓ |
| `performance.reviews.read.team` | ✓ | ✓ |  | ✓ |  |
| `performance.reviews.read.all` | ✓ | ✓ |  |  |  |
| `performance.reviews.submit.self` | ✓ | ✓ |  | ✓ | ✓ |
| `performance.reviews.submit.manager` | ✓ | ✓ |  | ✓ |  |
| `performance.reviews.manage` | ✓ | ✓ |  |  |  |
| `performance.reviews.internal-notes.read` | ✓ | ✓ |  |  |  |
| `learning.programs.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `learning.programs.manage` | ✓ | ✓ |  |  |  |
| `learning.enrollment.create` | ✓ | ✓ |  | ✓ | ✓ |
| `learning.enrollment.read.self` | ✓ | ✓ |  | ✓ | ✓ |
| `learning.enrollment.read.all` | ✓ | ✓ |  | ✓ |  |
| `learning.enrollment.manage` | ✓ | ✓ |  | ✓ |  |
| `learning.certificates.read.self` | ✓ | ✓ |  | ✓ | ✓ |
| `learning.certificates.manage` | ✓ | ✓ |  |  |  |
| `reports.hr.read` | ✓ | ✓ |  |  |  |
| `reports.employee.read` | ✓ | ✓ |  | ✓ |  |
| `reports.attendance.read` | ✓ | ✓ |  | ✓ |  |
| `reports.leave.read` | ✓ | ✓ |  | ✓ |  |
| `reports.overtime.read` | ✓ | ✓ | ✓ | ✓ |  |
| `reports.payroll.read` | ✓ | ✓ | ✓ |  |  |
| `reports.export` | ✓ | ✓ | ✓ |  |  |

Notes:

- `SUPER_ADMIN` receives all permissions through the existing `ALL` grant.
- Managers only receive team/read scope; backend services still enforce reporting-tree scope.
- `PAYROLL_OFFICER` receives payroll/overtime report access, not individual payroll data beyond
  existing payroll permissions.
- Employees receive self-service permissions only. Frontend navigation is not a security boundary.
