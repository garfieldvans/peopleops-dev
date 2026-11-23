# Organization Module

Status: implemented in Phase 3. Single company, no multi-tenancy.

## Scope

| Entity | Purpose | Delete behaviour |
| --- | --- | --- |
| Company | One organization profile (name, registration, contact, timezone, currency) | Not deletable |
| Branch | Physical/legal office location | Rejected while departments or employees reference it |
| Department | Hierarchy under a branch (`parentId`) | Rejected while positions, children or employees reference it |
| Position | Job title inside a department, optional job level | Rejected while employees reference it |
| Job level | Configurable seniority master with display order | Rejected while positions or employees reference it |

Employees reference branch, department, position and job level. Those master records are deactivated
or archived instead of deleted once referenced.

## Business rules

- Exactly one company row; `GET /company` returns it and `PATCH /company` updates it.
- `branches.code`, `departments.code`, `positions.code` and `job_levels.code` are unique.
- A department's parent must exist and must not create a cycle; a department cannot be its own parent.
- A position belongs to exactly one department, and its optional job level must exist.
- Deleting master data that is still referenced returns `409` rather than cascading.
- All writes are audit-logged (`company.updated`, `branch.*`, `department.*`, `position.*`,
  `job_level.*`).

## API surface

All routes are under `/api/v1` and require a bearer access token.

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/company` | `company.read` |
| PATCH | `/company` | `company.update` |
| GET | `/branches` (search, status, pagination) | `branch.read` |
| GET | `/branches/:id` | `branch.read` |
| POST | `/branches` | `branch.create` |
| PATCH | `/branches/:id` | `branch.update` |
| DELETE | `/branches/:id` | `branch.delete` |
| GET | `/departments` (search, branch, status, pagination) | `department.read` |
| GET | `/departments/tree` | `department.read` |
| GET | `/departments/:id` | `department.read` |
| POST | `/departments` | `department.create` |
| PATCH | `/departments/:id` | `department.update` |
| DELETE | `/departments/:id` | `department.delete` |
| GET | `/positions` (search, status, department, job level, pagination) | `position.read` |
| GET | `/positions/:id` | `position.read` |
| POST | `/positions` | `position.create` |
| PATCH | `/positions/:id` | `position.update` |
| DELETE | `/positions/:id` | `position.delete` |
| GET | `/job-levels` (array, optional search/status) | `job_level.read` |
| POST | `/job-levels` | `job_level.create` |
| PATCH | `/job-levels/:id` | `job_level.update` |
| DELETE | `/job-levels/:id` | `job_level.delete` |

## Web screens

`/organization/company`, `/organization/branches`, `/organization/departments`,
`/organization/positions`, `/organization/job-levels`. All use TanStack Query, React Hook Form +
Zod, and Nemo `Table`, `Modal`, `Select` and form components. Actions are hidden when the signed-in
user lacks the matching permission; the server enforces the same rules.

## Assumptions and limitations

- A department has one branch; a position inherits its department's branch when employees are
  assigned.
- Division/unit levels are represented by nested departments, not separate tables.
- Company logo upload is not part of Phase 3; only the profile fields exposed by the API are
  editable.
