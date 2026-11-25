-- CreateEnum
CREATE TYPE "OvertimeCategory" AS ENUM ('WEEKDAY', 'WEEKEND', 'HOLIDAY', 'REST_DAY');

-- CreateEnum
CREATE TYPE "OvertimeApprovalMode" AS ENUM ('MANAGER', 'HR', 'MANAGER_AND_HR');

-- CreateEnum
CREATE TYPE "OvertimeApprovalStage" AS ENUM ('MANAGER', 'HR');

-- CreateEnum
CREATE TYPE "OvertimeApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OvertimeStatus" AS ENUM ('DRAFT', 'PENDING_MANAGER_APPROVAL', 'PENDING_HR_APPROVAL', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'PENDING_VERIFICATION', 'VERIFIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OvertimeRoundingStrategy" AS ENUM ('NONE', 'ROUND_DOWN', 'ROUND_UP', 'NEAREST');

-- CreateTable
CREATE TABLE "overtime_policies" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "min_minutes" INTEGER NOT NULL DEFAULT 30,
    "max_minutes" INTEGER NOT NULL DEFAULT 240,
    "rounding_strategy" "OvertimeRoundingStrategy" NOT NULL DEFAULT 'NONE',
    "rounding_minutes" INTEGER NOT NULL DEFAULT 15,
    "approval_mode" "OvertimeApprovalMode" NOT NULL DEFAULT 'MANAGER',
    "requires_attachment" BOOLEAN NOT NULL DEFAULT false,
    "allow_weekend" BOOLEAN NOT NULL DEFAULT false,
    "allow_holiday" BOOLEAN NOT NULL DEFAULT false,
    "eligible_employment_statuses" "EmploymentStatus"[] DEFAULT ARRAY[]::"EmploymentStatus"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overtime_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtime_policy_assignments" (
    "id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "employee_id" UUID,
    "department_id" UUID,
    "branch_id" UUID,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overtime_policy_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtime_requests" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "attendance_record_id" UUID,
    "client_request_id" VARCHAR(100),
    "work_date" DATE NOT NULL,
    "category" "OvertimeCategory" NOT NULL,
    "reason" TEXT NOT NULL,
    "planned_start_at" TIMESTAMP(3) NOT NULL,
    "planned_end_at" TIMESTAMP(3) NOT NULL,
    "planned_break_minutes" INTEGER NOT NULL DEFAULT 0,
    "actual_start_at" TIMESTAMP(3),
    "actual_end_at" TIMESTAMP(3),
    "actual_break_minutes" INTEGER,
    "requested_minutes" INTEGER NOT NULL,
    "actual_minutes" INTEGER,
    "verified_minutes" INTEGER,
    "approved_minutes" INTEGER,
    "status" "OvertimeStatus" NOT NULL DEFAULT 'DRAFT',
    "approval_stage" "OvertimeApprovalStage",
    "policy_snapshot" JSONB NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "verified_by_id" UUID,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_id" UUID,
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overtime_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtime_approvals" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "stage" "OvertimeApprovalStage" NOT NULL,
    "decision" "OvertimeApprovalDecision" NOT NULL,
    "approver_user_id" UUID,
    "approver_name" TEXT NOT NULL,
    "comment" TEXT,
    "is_override" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overtime_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtime_corrections" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "previous_value" INTEGER NOT NULL,
    "corrected_value" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "corrected_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overtime_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtime_attachments" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overtime_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "overtime_policies_code_key" ON "overtime_policies"("code");

-- CreateIndex
CREATE INDEX "overtime_policies_status_effective_from_idx" ON "overtime_policies"("status", "effective_from");

-- CreateIndex
CREATE INDEX "overtime_policy_assignments_policy_id_effective_from_idx" ON "overtime_policy_assignments"("policy_id", "effective_from");

-- CreateIndex
CREATE INDEX "overtime_policy_assignments_employee_id_effective_from_effe_idx" ON "overtime_policy_assignments"("employee_id", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "overtime_policy_assignments_department_id_effective_from_ef_idx" ON "overtime_policy_assignments"("department_id", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "overtime_policy_assignments_branch_id_effective_from_effect_idx" ON "overtime_policy_assignments"("branch_id", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "overtime_requests_employee_id_status_idx" ON "overtime_requests"("employee_id", "status");

-- CreateIndex
CREATE INDEX "overtime_requests_status_created_at_idx" ON "overtime_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "overtime_requests_work_date_status_idx" ON "overtime_requests"("work_date", "status");

-- CreateIndex
CREATE INDEX "overtime_requests_policy_id_idx" ON "overtime_requests"("policy_id");

-- CreateIndex
CREATE INDEX "overtime_requests_attendance_record_id_idx" ON "overtime_requests"("attendance_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "overtime_requests_employee_id_client_request_id_key" ON "overtime_requests"("employee_id", "client_request_id");

-- CreateIndex
CREATE INDEX "overtime_approvals_request_id_created_at_idx" ON "overtime_approvals"("request_id", "created_at");

-- CreateIndex
CREATE INDEX "overtime_approvals_approver_user_id_idx" ON "overtime_approvals"("approver_user_id");

-- CreateIndex
CREATE INDEX "overtime_corrections_request_id_created_at_idx" ON "overtime_corrections"("request_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "overtime_attachments_storage_key_key" ON "overtime_attachments"("storage_key");

-- CreateIndex
CREATE INDEX "overtime_attachments_request_id_idx" ON "overtime_attachments"("request_id");

-- AddForeignKey
ALTER TABLE "overtime_policy_assignments" ADD CONSTRAINT "overtime_policy_assignments_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "overtime_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_policy_assignments" ADD CONSTRAINT "overtime_policy_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_policy_assignments" ADD CONSTRAINT "overtime_policy_assignments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_policy_assignments" ADD CONSTRAINT "overtime_policy_assignments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_policy_assignments" ADD CONSTRAINT "overtime_policy_assignments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "overtime_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_approvals" ADD CONSTRAINT "overtime_approvals_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "overtime_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_approvals" ADD CONSTRAINT "overtime_approvals_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_corrections" ADD CONSTRAINT "overtime_corrections_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "overtime_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_corrections" ADD CONSTRAINT "overtime_corrections_corrected_by_id_fkey" FOREIGN KEY ("corrected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_attachments" ADD CONSTRAINT "overtime_attachments_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "overtime_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_attachments" ADD CONSTRAINT "overtime_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
