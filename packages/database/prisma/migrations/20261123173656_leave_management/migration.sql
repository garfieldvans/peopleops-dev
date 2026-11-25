-- Required for the exclusion constraints that make date-range overlap a
-- database guarantee, not only an application check.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateEnum
CREATE TYPE "LeaveDurationUnit" AS ENUM ('DAY', 'HOUR');

-- CreateEnum
CREATE TYPE "LeaveAccrualMethod" AS ENUM ('GRANTED_UPFRONT', 'MONTHLY_ACCRUAL', 'ANNUAL_ACCRUAL', 'MANUAL_GRANT');

-- CreateEnum
CREATE TYPE "LeaveAccrualFrequency" AS ENUM ('MONTHLY', 'ANNUAL', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "LeaveAccrualStartRule" AS ENUM ('PERIOD_START', 'ASSIGNMENT_START');

-- CreateEnum
CREATE TYPE "LeaveApprovalMode" AS ENUM ('MANAGER', 'HR', 'MANAGER_AND_HR');

-- CreateEnum
CREATE TYPE "LeaveApprovalStage" AS ENUM ('MANAGER', 'HR');

-- CreateEnum
CREATE TYPE "LeaveApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "LeaveRequestMode" AS ENUM ('FULL_DAY', 'HALF_DAY', 'HOURLY');

-- CreateEnum
CREATE TYPE "LeaveHalfDayPeriod" AS ENUM ('FIRST_HALF', 'SECOND_HALF');

-- CreateEnum
CREATE TYPE "LeaveTransactionType" AS ENUM ('OPENING_BALANCE', 'ENTITLEMENT', 'ACCRUAL', 'LEAVE_DEDUCTION', 'LEAVE_REVERSAL', 'CARRY_OVER', 'EXPIRATION', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "LeaveReservationStatus" AS ENUM ('PENDING', 'CONSUMED', 'RELEASED');

-- CreateEnum
CREATE TYPE "LeavePeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "leave_types" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "is_paid" BOOLEAN NOT NULL DEFAULT true,
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "requires_attachment" BOOLEAN NOT NULL DEFAULT false,
    "allow_half_day" BOOLEAN NOT NULL DEFAULT false,
    "allow_past_dates" BOOLEAN NOT NULL DEFAULT false,
    "allow_future_dates" BOOLEAN NOT NULL DEFAULT true,
    "requires_balance" BOOLEAN NOT NULL DEFAULT true,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_policies" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "leave_type_id" UUID NOT NULL,
    "entitlement_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "entitlement_unit" "LeaveDurationUnit" NOT NULL DEFAULT 'DAY',
    "accrual_method" "LeaveAccrualMethod" NOT NULL DEFAULT 'GRANTED_UPFRONT',
    "accrual_frequency" "LeaveAccrualFrequency" NOT NULL DEFAULT 'ONE_TIME',
    "accrual_start_rule" "LeaveAccrualStartRule" NOT NULL DEFAULT 'PERIOD_START',
    "eligibility_months" INTEGER NOT NULL DEFAULT 0,
    "max_balance" DECIMAL(10,2),
    "carry_over_enabled" BOOLEAN NOT NULL DEFAULT false,
    "max_carry_over_amount" DECIMAL(10,2),
    "carry_over_expiration_months" INTEGER,
    "min_request_duration" DECIMAL(10,2),
    "max_request_duration" DECIMAL(10,2),
    "min_advance_notice_days" INTEGER NOT NULL DEFAULT 0,
    "allow_negative_balance" BOOLEAN NOT NULL DEFAULT false,
    "allow_half_day" BOOLEAN NOT NULL DEFAULT false,
    "allow_unpaid_leave" BOOLEAN NOT NULL DEFAULT true,
    "approval_mode" "LeaveApprovalMode" NOT NULL DEFAULT 'MANAGER',
    "leave_year_start_month" INTEGER NOT NULL DEFAULT 1,
    "cancellation_cutoff_days" INTEGER NOT NULL DEFAULT 0,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_policy_assignments" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_policy_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_entitlement_periods" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "assignment_id" UUID,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "entitlement_amount" DECIMAL(10,2) NOT NULL,
    "entitlement_unit" "LeaveDurationUnit" NOT NULL DEFAULT 'DAY',
    "policy_snapshot" JSONB NOT NULL,
    "status" "LeavePeriodStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_entitlement_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_transactions" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "entitlement_period_id" UUID NOT NULL,
    "type" "LeaveTransactionType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "transaction_date" DATE NOT NULL,
    "expires_at" DATE,
    "source_type" VARCHAR(40) NOT NULL,
    "source_ref" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "reversal_of_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_transaction_allocations" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "source_transaction_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_transaction_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balance_reservations" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "entitlement_period_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "LeaveReservationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3),

    CONSTRAINT "leave_balance_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "entitlement_period_id" UUID NOT NULL,
    "client_request_id" VARCHAR(100),
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "duration" DECIMAL(10,2) NOT NULL,
    "duration_unit" "LeaveDurationUnit" NOT NULL DEFAULT 'DAY',
    "request_mode" "LeaveRequestMode" NOT NULL DEFAULT 'FULL_DAY',
    "half_day_period" "LeaveHalfDayPeriod",
    "reason" TEXT NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "approval_stage" "LeaveApprovalStage",
    "submitted_at" TIMESTAMP(3),
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_comments" TEXT,
    "withdrawn_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_id" UUID,
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_request_days" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "duration" DECIMAL(4,2) NOT NULL,
    "half_day_period" "LeaveHalfDayPeriod",

    CONSTRAINT "leave_request_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_request_approvals" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "stage" "LeaveApprovalStage" NOT NULL,
    "decision" "LeaveApprovalDecision" NOT NULL,
    "actor_user_id" UUID,
    "actor_name" TEXT NOT NULL,
    "comment" TEXT,
    "is_override" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_request_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_attachments" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_code_key" ON "leave_types"("code");

-- CreateIndex
CREATE INDEX "leave_types_status_idx" ON "leave_types"("status");

-- CreateIndex
CREATE UNIQUE INDEX "leave_policies_code_key" ON "leave_policies"("code");

-- CreateIndex
CREATE INDEX "leave_policies_leave_type_id_status_idx" ON "leave_policies"("leave_type_id", "status");

-- CreateIndex
CREATE INDEX "leave_policies_effective_from_effective_to_idx" ON "leave_policies"("effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "leave_policy_assignments_employee_id_leave_type_id_effectiv_idx" ON "leave_policy_assignments"("employee_id", "leave_type_id", "effective_from");

-- CreateIndex
CREATE INDEX "leave_policy_assignments_policy_id_idx" ON "leave_policy_assignments"("policy_id");

-- CreateIndex
CREATE INDEX "leave_entitlement_periods_employee_id_leave_type_id_status_idx" ON "leave_entitlement_periods"("employee_id", "leave_type_id", "status");

-- CreateIndex
CREATE INDEX "leave_entitlement_periods_period_start_period_end_idx" ON "leave_entitlement_periods"("period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "leave_entitlement_periods_employee_id_leave_type_id_period__key" ON "leave_entitlement_periods"("employee_id", "leave_type_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "leave_transactions_employee_id_leave_type_id_transaction_da_idx" ON "leave_transactions"("employee_id", "leave_type_id", "transaction_date");

-- CreateIndex
CREATE INDEX "leave_transactions_entitlement_period_id_idx" ON "leave_transactions"("entitlement_period_id");

-- CreateIndex
CREATE INDEX "leave_transactions_expires_at_idx" ON "leave_transactions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "leave_transactions_source_type_source_ref_type_key" ON "leave_transactions"("source_type", "source_ref", "type");

-- CreateIndex
CREATE INDEX "leave_transaction_allocations_source_transaction_id_idx" ON "leave_transaction_allocations"("source_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_transaction_allocations_transaction_id_source_transac_key" ON "leave_transaction_allocations"("transaction_id", "source_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balance_reservations_request_id_key" ON "leave_balance_reservations"("request_id");

-- CreateIndex
CREATE INDEX "leave_balance_reservations_employee_id_leave_type_id_status_idx" ON "leave_balance_reservations"("employee_id", "leave_type_id", "status");

-- CreateIndex
CREATE INDEX "leave_balance_reservations_entitlement_period_id_status_idx" ON "leave_balance_reservations"("entitlement_period_id", "status");

-- CreateIndex
CREATE INDEX "leave_requests_employee_id_status_idx" ON "leave_requests"("employee_id", "status");

-- CreateIndex
CREATE INDEX "leave_requests_status_created_at_idx" ON "leave_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "leave_requests_leave_type_id_start_date_end_date_idx" ON "leave_requests"("leave_type_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "leave_requests_start_date_end_date_idx" ON "leave_requests"("start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "leave_requests_employee_id_client_request_id_key" ON "leave_requests"("employee_id", "client_request_id");

-- CreateIndex
CREATE INDEX "leave_request_days_date_idx" ON "leave_request_days"("date");

-- CreateIndex
CREATE UNIQUE INDEX "leave_request_days_request_id_date_key" ON "leave_request_days"("request_id", "date");

-- CreateIndex
CREATE INDEX "leave_request_approvals_request_id_created_at_idx" ON "leave_request_approvals"("request_id", "created_at");

-- CreateIndex
CREATE INDEX "leave_request_approvals_actor_user_id_idx" ON "leave_request_approvals"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_attachments_storage_key_key" ON "leave_attachments"("storage_key");

-- CreateIndex
CREATE INDEX "leave_attachments_request_id_idx" ON "leave_attachments"("request_id");

-- A single active policy assignment per employee/type may cover any given day.
ALTER TABLE "leave_policy_assignments"
  ADD CONSTRAINT "leave_policy_assignments_no_overlap"
  EXCLUDE USING gist (
    "employee_id" WITH =,
    "leave_type_id" WITH =,
    daterange("effective_from", "effective_to", '[]') WITH &&
  )
  WHERE ("status" = 'ACTIVE');

-- Pending and approved requests cannot overlap for one employee. This also
-- closes the race between two simultaneous submissions.
ALTER TABLE "leave_requests"
  ADD CONSTRAINT "leave_requests_no_overlap"
  EXCLUDE USING gist (
    "employee_id" WITH =,
    daterange("start_date", "end_date", '[]') WITH &&
  )
  WHERE ("status" IN ('PENDING', 'APPROVED'));

ALTER TABLE "leave_policies"
  ADD CONSTRAINT "leave_policies_year_start_month_check"
  CHECK ("leave_year_start_month" BETWEEN 1 AND 12);

-- AddForeignKey
ALTER TABLE "leave_policies" ADD CONSTRAINT "leave_policies_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_policy_assignments" ADD CONSTRAINT "leave_policy_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_policy_assignments" ADD CONSTRAINT "leave_policy_assignments_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_policy_assignments" ADD CONSTRAINT "leave_policy_assignments_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "leave_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_policy_assignments" ADD CONSTRAINT "leave_policy_assignments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_entitlement_periods" ADD CONSTRAINT "leave_entitlement_periods_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_entitlement_periods" ADD CONSTRAINT "leave_entitlement_periods_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_entitlement_periods" ADD CONSTRAINT "leave_entitlement_periods_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "leave_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_entitlement_periods" ADD CONSTRAINT "leave_entitlement_periods_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "leave_policy_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_transactions" ADD CONSTRAINT "leave_transactions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_transactions" ADD CONSTRAINT "leave_transactions_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_transactions" ADD CONSTRAINT "leave_transactions_entitlement_period_id_fkey" FOREIGN KEY ("entitlement_period_id") REFERENCES "leave_entitlement_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_transactions" ADD CONSTRAINT "leave_transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_transactions" ADD CONSTRAINT "leave_transactions_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "leave_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_transaction_allocations" ADD CONSTRAINT "leave_transaction_allocations_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "leave_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_transaction_allocations" ADD CONSTRAINT "leave_transaction_allocations_source_transaction_id_fkey" FOREIGN KEY ("source_transaction_id") REFERENCES "leave_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance_reservations" ADD CONSTRAINT "leave_balance_reservations_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance_reservations" ADD CONSTRAINT "leave_balance_reservations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance_reservations" ADD CONSTRAINT "leave_balance_reservations_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance_reservations" ADD CONSTRAINT "leave_balance_reservations_entitlement_period_id_fkey" FOREIGN KEY ("entitlement_period_id") REFERENCES "leave_entitlement_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_entitlement_period_id_fkey" FOREIGN KEY ("entitlement_period_id") REFERENCES "leave_entitlement_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_request_days" ADD CONSTRAINT "leave_request_days_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_request_approvals" ADD CONSTRAINT "leave_request_approvals_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_request_approvals" ADD CONSTRAINT "leave_request_approvals_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_attachments" ADD CONSTRAINT "leave_attachments_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_attachments" ADD CONSTRAINT "leave_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
