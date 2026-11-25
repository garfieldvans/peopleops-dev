# Payroll Permission Matrix

| Permission | SUPER_ADMIN | HR_ADMIN | PAYROLL_OFFICER | MANAGER | EMPLOYEE |
| --- | --- | --- | --- | --- | --- |
| `payroll.compensation.read` | ✓ | ✓ | ✓ |  |  |
| `payroll.compensation.manage` | ✓ | ✓ |  |  |  |
| `payroll.components.read` | ✓ | ✓ | ✓ |  |  |
| `payroll.components.manage` | ✓ | ✓ |  |  |  |
| `payroll.assignments.manage` | ✓ | ✓ | ✓ |  |  |
| `payroll.settings.read` | ✓ | ✓ | ✓ |  |  |
| `payroll.settings.manage` | ✓ | ✓ |  |  |  |
| `payroll.periods.read` | ✓ | ✓ | ✓ |  |  |
| `payroll.periods.manage` | ✓ | ✓ | ✓ |  |  |
| `payroll.runs.read` | ✓ | ✓ | ✓ |  |  |
| `payroll.runs.calculate` | ✓ | ✓ | ✓ |  |  |
| `payroll.runs.review` | ✓ | ✓ | ✓ |  |  |
| `payroll.runs.approve` | ✓ | ✓ | ✓ |  |  |
| `payroll.runs.publish` | ✓ | ✓ | ✓ |  |  |
| `payroll.runs.cancel` | ✓ | ✓ | ✓ |  |  |
| `payroll.runs.override` | ✓ |  |  |  |  |
| `payroll.adjustments.read` | ✓ | ✓ | ✓ |  |  |
| `payroll.adjustments.create` | ✓ | ✓ | ✓ |  |  |
| `payroll.adjustments.approve` | ✓ | ✓ | ✓ |  |  |
| `payroll.payslips.read.self` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `payroll.payslips.read.all` | ✓ | ✓ | ✓ |  |  |
| `payroll.payslips.download` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `payroll.reports.read` | ✓ | ✓ | ✓ |  |  |
| `payroll.history.read` | ✓ | ✓ | ✓ |  |  |

## Rules

- Managers receive no salary or payroll access by default.
- Employee self-access is limited to the linked employee record and published payslips.
- Compensation and payslip access are separate from employee management access.
- Approval and publication are separate permissions.
- The creator of a run cannot approve it without `payroll.runs.override`.
- Payroll officers may read verified overtime for payroll, but do not gain access to unverified
  overtime or employee personal documents.
- Frontend permission checks are presentation only; every endpoint enforces authorization in the API.
