# Phase 3 Database ERD (implemented)

This reflects the applied schema in `packages/database/prisma/schema.prisma` and migration
`20261122055607_organization_employees`. It supersedes the Phase 0 proposal for the tables shown
here; later-phase tables remain proposals.

```mermaid
erDiagram
  USERS |o--o| EMPLOYEES : "optional account link (unique user_id)"
  BRANCHES ||--o{ DEPARTMENTS : "contains"
  BRANCHES ||--o{ EMPLOYEES : "based at"
  DEPARTMENTS ||--o{ DEPARTMENTS : "parent of"
  DEPARTMENTS ||--o{ POSITIONS : "defines"
  JOB_LEVELS ||--o{ POSITIONS : "classifies"
  POSITIONS ||--o{ EMPLOYEES : "current position"
  EMPLOYEES ||--o{ EMPLOYEES : "manager of"
  EMPLOYEES ||--o{ EMPLOYEE_EMERGENCY_CONTACTS : "has"
  EMPLOYEES ||--o{ EMPLOYEE_DOCUMENTS : "owns"
  EMPLOYEES ||--o{ EMPLOYMENT_HISTORIES : "assignment trail"
  USERS ||--o{ EMPLOYEE_DOCUMENTS : "uploaded by"
  USERS ||--o{ EMPLOYMENT_HISTORIES : "recorded by"

  COMPANIES {
    uuid id PK
    text name
    text code UK
    text timezone
    text currency
    timestamptz created_at
    timestamptz updated_at
  }
  BRANCHES {
    uuid id PK
    text code UK
    text name
    text status
  }
  DEPARTMENTS {
    uuid id PK
    text code UK
    text name
    uuid branch_id FK
    uuid parent_id FK "nullable"
    uuid head_employee_id FK "nullable"
    text status
  }
  JOB_LEVELS {
    uuid id PK
    text code UK
    text name
    int display_order
    text status
  }
  POSITIONS {
    uuid id PK
    text code UK
    text title
    uuid department_id FK
    uuid job_level_id FK "nullable"
    text status
  }
  EMPLOYEES {
    uuid id PK
    text employee_number UK
    uuid user_id FK "nullable, unique"
    text first_name
    text last_name
    text personal_email
    text employment_type
    text employment_status
    date join_date
    uuid branch_id FK "nullable"
    uuid department_id FK "nullable"
    uuid position_id FK "nullable"
    uuid job_level_id FK "nullable"
    uuid manager_id FK "nullable, self"
  }
  EMPLOYEE_EMERGENCY_CONTACTS {
    uuid id PK
    uuid employee_id FK
    text full_name
    text relationship
    text phone
    boolean is_primary
  }
  EMPLOYEE_DOCUMENTS {
    uuid id PK
    uuid employee_id FK
    text category
    text title
    text file_name
    text mime_type
    int size_bytes
    text storage_key UK
    uuid uploaded_by_id FK "nullable"
  }
  EMPLOYMENT_HISTORIES {
    uuid id PK
    uuid employee_id FK
    date effective_from
    date effective_to "nullable = current"
    text employment_type
    text employment_status
    uuid branch_id FK "nullable"
    uuid department_id FK "nullable"
    uuid position_id FK "nullable"
    uuid job_level_id FK "nullable"
    uuid manager_id FK "nullable"
    text change_reason
    uuid created_by_id FK "nullable"
  }
```

## Integrity decisions

- **Dates** use PostgreSQL `date` for join/effective dates, so timezone changes cannot shift a work
  date. Timestamps are `timestamptz` in UTC.
- **Employees vs users**: `employees.user_id` is nullable and unique. Deleting a user sets the link
  to null (`onDelete: SetNull`); it never deletes the employee.
- **Manager line**: self-referencing `manager_id` with `onDelete: Restrict`. Self-management and
  cycles are rejected in the service inside the same transaction as the write.
- **Master data** referenced by employees uses `onDelete: Restrict`; the API returns `409` rather
  than cascading. Historical rows use `SetNull` for organization references, so a later archival
  cannot erase where someone worked.
- **Emergencies** cascade with the employee; at most one primary is maintained transactionally by the
  service (no partial unique index in this migration).
- **Documents** store metadata only. `storage_key` is unique; binary content never enters
  PostgreSQL. Deleting an employee cascades metadata, and the storage adapter is asked to remove the
  object.
- **History** is append-only. Index `(employee_id, effective_from)` supports the profile timeline and
  the "open row" lookup. One open row per employee is a service invariant, not a database constraint.
- **Indexes** exist on all employee foreign keys (`branch_id`, `department_id`, `position_id`,
  `job_level_id`, `manager_id`), `employment_status`, names, and `employee_documents.employee_id`.

## Known gaps

- A partial unique index enforcing at most one `is_primary` contact per employee and one open history
  row per employee could be added as defense in depth; current enforcement is transactional in the
  service.
- No trigger prevents manager cycles at the database level, so direct SQL writes bypass the rule.
