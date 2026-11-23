# Phase 4 Database ERD (implemented)

Reflects `packages/database/prisma/schema.prisma` and migration
`20261123083842_attendance`.

```mermaid
erDiagram
  COMPANIES ||--o{ ATTENDANCE_RECORDS : "timezone policy (implicit)"
  WORK_SCHEDULES ||--o{ WORK_SCHEDULE_DAYS : "weekly days"
  WORK_SCHEDULES ||--o{ EMPLOYEE_SCHEDULE_ASSIGNMENTS : "assigned"
  SHIFTS |o--o{ EMPLOYEE_SCHEDULE_ASSIGNMENTS : "optional override"
  EMPLOYEES ||--o{ EMPLOYEE_SCHEDULE_ASSIGNMENTS : "has"
  EMPLOYEE_SCHEDULE_ASSIGNMENTS |o--o{ ATTENDANCE_RECORDS : "snapshot source"
  WORK_SCHEDULES |o--o{ ATTENDANCE_RECORDS : "snapshot"
  SHIFTS |o--o{ ATTENDANCE_RECORDS : "snapshot"
  EMPLOYEES ||--o{ ATTENDANCE_RECORDS : "records"
  ATTENDANCE_RECORDS ||--o{ ATTENDANCE_BREAKS : "breaks"
  ATTENDANCE_RECORDS ||--o{ ATTENDANCE_CORRECTIONS : "corrections"
  EMPLOYEES ||--o{ ATTENDANCE_CORRECTIONS : "requests"
  USERS |o--o{ ATTENDANCE_CORRECTIONS : "reviews"
  USERS |o--o{ EMPLOYEE_SCHEDULE_ASSIGNMENTS : "creates"
  USERS |o--o{ ATTENDANCE_BREAKS : "starts"
  BRANCHES |o--o{ HOLIDAYS : "branch scope"

  WORK_SCHEDULES {
    uuid id PK
    text code UK
    text name
    int grace_late_minutes
    int grace_early_minutes
    text status
  }
  WORK_SCHEDULE_DAYS {
    uuid id PK
    uuid schedule_id FK
    int day_of_week "1=Mon … 7=Sun"
    boolean is_working_day
    varchar start_time "HH:mm"
    varchar end_time "HH:mm"
    int break_minutes
  }
  SHIFTS {
    uuid id PK
    text code UK
    varchar start_time
    varchar end_time "may cross midnight"
    int break_minutes
    int grace_late_minutes
    int grace_early_minutes
    text status
  }
  EMPLOYEE_SCHEDULE_ASSIGNMENTS {
    uuid id PK
    uuid employee_id FK
    uuid work_schedule_id FK
    uuid shift_id FK "nullable"
    date effective_from
    date effective_to "nullable"
    uuid created_by_id FK "nullable"
  }
  HOLIDAYS {
    uuid id PK
    date date
    text name
    text type
    uuid branch_id FK "nullable = company"
    text status
  }
  ATTENDANCE_RECORDS {
    uuid id PK
    uuid employee_id FK
    uuid schedule_assignment_id FK "nullable"
    uuid work_schedule_id FK "nullable"
    uuid shift_id FK "nullable"
    date work_date "local shift start date"
    text timezone
    timestamptz scheduled_start_at
    timestamptz scheduled_end_at
    int expected_break_minutes
    int grace_late_minutes
    int grace_early_minutes
    timestamptz clock_in_at "nullable"
    timestamptz clock_out_at "nullable"
    text status
    int late_minutes
    int early_leave_minutes
    int worked_minutes
    int break_minutes_taken
    boolean is_corrected
  }
  ATTENDANCE_BREAKS {
    uuid id PK
    uuid attendance_record_id FK
    timestamptz started_at
    timestamptz ended_at "nullable = running"
    uuid created_by_id FK "nullable"
  }
  ATTENDANCE_CORRECTIONS {
    uuid id PK
    uuid employee_id FK
    uuid attendance_record_id FK "nullable"
    date work_date
    text type
    text status
    timestamptz original_clock_in_at
    timestamptz original_clock_out_at
    timestamptz requested_clock_in_at
    timestamptz requested_clock_out_at
    text reason
    uuid reviewed_by_id FK "nullable"
    text review_notes
    timestamptz reviewed_at
  }
```

## Integrity decisions

- `attendance_records` is unique on `(employee_id, work_date)`, so one work date cannot produce two
  sessions.
- Partial unique indexes enforce one open break per record, one open attendance session per employee,
  one pending correction per record, one pending correction per employee/work date, and one holiday per
  company date or branch date.
- Schedule/shift assignment rows are never deleted by the application. A change closes the previous
  `effective_to` and inserts a new row.
- Attendance rows copy schedule, shift, grace, expected break and timezone values. Master-data edits
  therefore affect only future records.
- Deleting an employee cascades attendance and corrections. Deleting a schedule/shift is restricted
  while assignments reference it; attendance history is not cascaded (nullable snapshot relations use
  `SetNull` when a master row is eventually removed).
- All instants are stored in UTC (`timestamptz`); `work_date`, effective dates and holiday dates are
  PostgreSQL `date` values.
