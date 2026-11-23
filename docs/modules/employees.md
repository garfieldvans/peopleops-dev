# Employee Module

Status: implemented in Phase 3. Covers employee records, directory, emergency contacts, private
documents, employment history, optional account linking and manager/self access scoping.

## Data model

| Table | Notes |
| --- | --- |
| `employees` | Current profile and employment assignment. `employee_number` and `user_id` are unique; `user_id` is nullable. |
| `employee_emergency_contacts` | Many per employee; at most one `is_primary = true`. |
| `employee_documents` | Metadata only. Binary content lives in private storage under `storage_key`. |
| `employment_histories` | Append-only employment assignments with `effective_from` / `effective_to`; the open row (`effective_to IS NULL`) mirrors `employees`. |
| `employee_documents.uploaded_by_id` | Set to null if the uploader account is removed; the document remains. |

Employees and user accounts are deliberately separate. A login account can exist with no employee
record (`GET /employees/me` returns `404 EMPLOYEE_NOT_LINKED`), and an employee can exist with no
account. Linking is unique in both directions.

## Directory

`GET /employees` is server-side only: search over employee number, names and emails; filters for
branch, department, position and employment status; sorting by name, employee number or join date;
pagination with `page` / `pageSize` (max 100). The response is
`{ items, page, pageSize, total, totalPages }`.

Scoping is applied before pagination:

- `employee.read` or `employee.read_sensitive`: all employees; personal email included.
- `employee.read_team` only: the signed-in employee plus their full reporting subtree, computed by
  walking `manager_id` level by level. Personal email and the sensitive personal block are hidden.
- `employee.read_self` only: the linked employee only.
- An account without an employee record and without read-all permissions gets an empty page.

Requests for employees outside the caller's scope return `403 EMPLOYEE_OUT_OF_SCOPE`.

## Profile and validation

`POST /employees` requires `firstName`, `lastName`, `personalEmail`, `employmentType` and
`joinDate`; `employeeNumber` is generated as `EMP-0001`, `EMP-0002`, … when omitted. Creation writes
the employee and its initial employment history in one transaction.

Employment assignment consistency:

- A position belongs to a department. If the position is supplied without a department, the
  department is derived from the position.
- If both are supplied and disagree, the request fails with `POSITION_DEPARTMENT_MISMATCH` (`400`).
- A department's branch is used when the branch is omitted; a mismatched branch fails with
  `DEPARTMENT_BRANCH_MISMATCH`.
- Managers must exist; setting the employee themselves or any report as manager fails with
  `MANAGER_CYCLE`.

`PATCH /employees/:id` updates profile fields and, when any employment field changes, records an
effective-dated history entry. `employeeNumber` and `joinDate` are intentionally immutable after
creation.

`POST /employees/:id/deactivate` sets the status to `INACTIVE` through the same history flow.

Self-service (`PATCH /employees/me`, permission `employee.update_self`) only accepts preferred name,
phone, address, city, province, postal code, country and photo URL. Sending employment fields is
rejected by the DTO whitelist, and `PATCH /employees/:id` itself requires `employee.update`.

## Employment history

Tracked fields: `employmentType`, `employmentStatus`, `branchId`, `departmentId`, `positionId`,
`jobLevelId`, `managerId`.

A change runs inside one transaction:

1. Read the open history row for the employee.
2. Reject `effectiveDate <= open.effectiveFrom` with `EFFECTIVE_DATE_OVERLAP`.
3. Close the open row at `effectiveDate - 1 day`.
4. Update the employee's current assignment.
5. Insert a new open history row starting at `effectiveDate` with the actor and reason.

If any step fails the transaction rolls back, so the current row and history cannot diverge. History
is never deleted or overwritten. `GET /employees/:id/history` returns newest first.

## Emergency contacts

Nested routes under `/employees/:employeeId/emergency-contacts` support list, create, update and
delete. Creating or updating a primary contact clears the previous primary inside the same
transaction; deleting the primary promotes the oldest remaining contact. All reads use the same
employee scope as the profile; writes require `employee.update`.

## Documents and storage

- Upload: multipart `file` plus `title` and optional `category` (`CONTRACT`, `IDENTITY`,
  `CERTIFICATE`, `OTHER`).
- Allowed MIME types: PDF, JPEG, PNG, WebP, DOC, DOCX; maximum 5 MB.
- Files are written through the `FileStorage` interface
  (`apps/api/src/common/storage/file-storage.ts`). The development adapter
  (`LocalFileStorage`) stores files under `FILE_STORAGE_ROOT` (default
  `apps/api/storage/employee-documents`) with generated UUID keys, outside the web root.
- PostgreSQL stores metadata only. No permanent public URL exists.
- Download is `GET /employees/:employeeId/documents/:documentId/download`, requires read access and
  streams the file with `Content-Disposition: attachment` and `Cache-Control: private, no-store`.
- Upload/delete require `employee.manage_documents`; reads follow employee scope.
- Deleting metadata removes the stored object best-effort; a failed storage cleanup is logged
  without resurrecting the database row.

Swapping in S3/GCS means implementing `FileStorage` and changing the `StorageModule` provider; no
business service changes are required.

## Account linking

`PATCH /employees/:id/user` with `{ userId }` links an account; `{ userId: null }` unlinks it.
Requires `employee.manage_user_account`. A user already linked to another employee returns
`409 USER_ALREADY_LINKED`.

## API surface

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/employees` | any of `employee.read`, `employee.read_sensitive`, `employee.read_team`, `employee.read_self` |
| GET | `/employees/me` | any read permission above |
| PATCH | `/employees/me` | `employee.update_self` or `employee.update` |
| GET | `/employees/:id` | any read permission above |
| GET | `/employees/:id/history` | any read permission above |
| POST | `/employees` | `employee.create` |
| PATCH | `/employees/:id` | `employee.update` |
| POST | `/employees/:id/deactivate` | `employee.deactivate` |
| PATCH | `/employees/:id/user` | `employee.manage_user_account` |
| GET/POST | `/employees/:id/emergency-contacts` | read / `employee.update` |
| PATCH/DELETE | `/employees/:id/emergency-contacts/:contactId` | `employee.update` |
| GET | `/employees/:id/documents` | any read permission above |
| POST | `/employees/:id/documents` | `employee.manage_documents` |
| GET | `/employees/:id/documents/:documentId/download` | any read permission above |
| DELETE | `/employees/:id/documents/:documentId` | `employee.manage_documents` |

## Web screens

- `/employees`: directory with debounced search, branch/department/position/status filters, sort and
  pagination.
- `/employees/new`, `/employees/:id/edit`: sectioned form (personal, address, employment) with
  effective date and change reason on edit.
- `/employees/:id`: tabbed profile (overview, personal, employment, emergency contacts, documents,
  history) with permission-aware actions.
- `/employees/me`: the signed-in user's profile, including a self-service contact dialog.

## Audit actions

`employee.created`, `employee.updated`, `employee.self_updated`, `employee.deactivated`,
`employee.user_linked`, `employee.user_unlinked`, `employee.emergency_contact_created`,
`employee.emergency_contact_updated`, `employee.emergency_contact_deleted`,
`employee.document_uploaded`, `employee.document_deleted`.

Metadata contains identifiers and changed field names only — no document contents, credentials or
unnecessary personal data.

## Tests

`apps/api/test/employees.e2e-spec.ts` covers the Phase 3 verification list: employee with
branch/department/position, position change history with overlap rejection, self/circular manager
rejection, manager team scoping, employee inability to change employment data, document upload +
authorization denials, and an account without an employee record. The suite runs against the
isolated `peopleops_test` schema and cleans its fixtures on setup.

## Assumptions and limitations

- One active employment assignment per employee; prior assignments live in history.
- Personal fields are hidden from managers who lack `employee.read_sensitive`; there is no separate
  field-level permission beyond that block.
- Local disk storage is development-only. No virus scanning, retention policy or document versioning
  is implemented.
- Employee photos are URL-based; photo upload is not part of this phase.
- Linking an employee to an account does not create the account automatically.
