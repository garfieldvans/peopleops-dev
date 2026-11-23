-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'EARLY_LEAVE', 'LATE_AND_EARLY_LEAVE', 'ABSENT', 'HALF_DAY', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "AttendanceCorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceCorrectionType" AS ENUM ('CLOCK_IN', 'CLOCK_OUT', 'BOTH');

-- CreateEnum
CREATE TYPE "HolidayType" AS ENUM ('NATIONAL', 'COMPANY', 'BRANCH');

-- CreateTable
CREATE TABLE "work_schedules" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "grace_late_minutes" INTEGER NOT NULL DEFAULT 0,
    "grace_early_minutes" INTEGER NOT NULL DEFAULT 0,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_schedule_days" (
    "id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "is_working_day" BOOLEAN NOT NULL DEFAULT true,
    "start_time" VARCHAR(5),
    "end_time" VARCHAR(5),
    "break_minutes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "work_schedule_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "grace_late_minutes" INTEGER NOT NULL DEFAULT 0,
    "grace_early_minutes" INTEGER NOT NULL DEFAULT 0,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_schedule_assignments" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "work_schedule_id" UUID NOT NULL,
    "shift_id" UUID,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "change_reason" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_schedule_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "schedule_assignment_id" UUID,
    "work_schedule_id" UUID,
    "shift_id" UUID,
    "work_date" DATE NOT NULL,
    "timezone" TEXT NOT NULL,
    "scheduled_start_at" TIMESTAMP(3) NOT NULL,
    "scheduled_end_at" TIMESTAMP(3) NOT NULL,
    "expected_break_minutes" INTEGER NOT NULL DEFAULT 0,
    "grace_late_minutes" INTEGER NOT NULL DEFAULT 0,
    "grace_early_minutes" INTEGER NOT NULL DEFAULT 0,
    "clock_in_at" TIMESTAMP(3),
    "clock_out_at" TIMESTAMP(3),
    "status" "AttendanceStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "early_leave_minutes" INTEGER NOT NULL DEFAULT 0,
    "worked_minutes" INTEGER NOT NULL DEFAULT 0,
    "break_minutes_taken" INTEGER NOT NULL DEFAULT 0,
    "is_corrected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_breaks" (
    "id" UUID NOT NULL,
    "attendance_record_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_breaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_corrections" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "attendance_record_id" UUID,
    "work_date" DATE NOT NULL,
    "type" "AttendanceCorrectionType" NOT NULL,
    "status" "AttendanceCorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "original_clock_in_at" TIMESTAMP(3),
    "original_clock_out_at" TIMESTAMP(3),
    "requested_clock_in_at" TIMESTAMP(3),
    "requested_clock_out_at" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "reviewed_by_id" UUID,
    "review_notes" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "type" "HolidayType" NOT NULL,
    "branch_id" UUID,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_schedules_code_key" ON "work_schedules"("code");

-- CreateIndex
CREATE UNIQUE INDEX "work_schedule_days_schedule_id_day_of_week_key" ON "work_schedule_days"("schedule_id", "day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_code_key" ON "shifts"("code");

-- CreateIndex
CREATE INDEX "employee_schedule_assignments_employee_id_effective_from_ef_idx" ON "employee_schedule_assignments"("employee_id", "effective_from", "effective_to");

-- CreateIndex
CREATE UNIQUE INDEX "employee_schedule_assignments_employee_id_effective_from_key" ON "employee_schedule_assignments"("employee_id", "effective_from");

-- CreateIndex
CREATE INDEX "attendance_records_work_date_status_idx" ON "attendance_records"("work_date", "status");

-- CreateIndex
CREATE INDEX "attendance_records_employee_id_work_date_idx" ON "attendance_records"("employee_id", "work_date");

-- CreateIndex
CREATE INDEX "attendance_records_schedule_assignment_id_idx" ON "attendance_records"("schedule_assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_employee_id_work_date_key" ON "attendance_records"("employee_id", "work_date");

-- CreateIndex
CREATE INDEX "attendance_breaks_attendance_record_id_idx" ON "attendance_breaks"("attendance_record_id");

-- CreateIndex
CREATE INDEX "attendance_corrections_employee_id_status_idx" ON "attendance_corrections"("employee_id", "status");

-- CreateIndex
CREATE INDEX "attendance_corrections_status_created_at_idx" ON "attendance_corrections"("status", "created_at");

-- CreateIndex
CREATE INDEX "attendance_corrections_attendance_record_id_idx" ON "attendance_corrections"("attendance_record_id");

-- CreateIndex
CREATE INDEX "holidays_date_status_idx" ON "holidays"("date", "status");

-- CreateIndex
CREATE INDEX "holidays_branch_id_idx" ON "holidays"("branch_id");

-- AddForeignKey
ALTER TABLE "work_schedule_days" ADD CONSTRAINT "work_schedule_days_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "work_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_schedule_assignments" ADD CONSTRAINT "employee_schedule_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_schedule_assignments" ADD CONSTRAINT "employee_schedule_assignments_work_schedule_id_fkey" FOREIGN KEY ("work_schedule_id") REFERENCES "work_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_schedule_assignments" ADD CONSTRAINT "employee_schedule_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_schedule_assignments" ADD CONSTRAINT "employee_schedule_assignments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_schedule_assignment_id_fkey" FOREIGN KEY ("schedule_assignment_id") REFERENCES "employee_schedule_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_work_schedule_id_fkey" FOREIGN KEY ("work_schedule_id") REFERENCES "work_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_breaks" ADD CONSTRAINT "attendance_breaks_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_breaks" ADD CONSTRAINT "attendance_breaks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One open attendance session per employee; also protects clock-in from races.
CREATE UNIQUE INDEX "attendance_records_one_open_per_employee"
  ON "attendance_records"("employee_id") WHERE "clock_out_at" IS NULL;

-- One active break per attendance record.
CREATE UNIQUE INDEX "attendance_breaks_one_open_per_record"
  ON "attendance_breaks"("attendance_record_id") WHERE "ended_at" IS NULL;

-- One pending correction per attendance record, and per employee/work date when
-- the request targets a day without a record.
CREATE UNIQUE INDEX "attendance_corrections_one_pending_per_record"
  ON "attendance_corrections"("attendance_record_id")
  WHERE "status" = 'PENDING' AND "attendance_record_id" IS NOT NULL;
CREATE UNIQUE INDEX "attendance_corrections_one_pending_per_day"
  ON "attendance_corrections"("employee_id", "work_date")
  WHERE "status" = 'PENDING' AND "attendance_record_id" IS NULL;

-- Holidays are unique within their scope: one company/national entry per date and
-- one branch-specific entry per date.
CREATE UNIQUE INDEX "holidays_company_date_unique"
  ON "holidays"("date") WHERE "branch_id" IS NULL;
CREATE UNIQUE INDEX "holidays_branch_date_unique"
  ON "holidays"("date", "branch_id") WHERE "branch_id" IS NOT NULL;
