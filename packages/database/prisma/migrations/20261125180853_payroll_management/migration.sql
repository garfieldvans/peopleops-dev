-- CreateEnum
CREATE TYPE "PayrollComponentType" AS ENUM ('EARNING', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION', 'INFORMATIONAL');

-- CreateEnum
CREATE TYPE "PayrollCalculationType" AS ENUM ('FIXED_AMOUNT', 'PERCENTAGE', 'MANUAL_AMOUNT', 'SOURCE_BASED');

-- CreateEnum
CREATE TYPE "PayrollSourceType" AS ENUM ('ABSENCE', 'LATE', 'EARLY_LEAVE', 'UNPAID_LEAVE', 'OVERTIME');

-- CreateEnum
CREATE TYPE "PayrollSourceKind" AS ENUM ('ATTENDANCE', 'LEAVE', 'OVERTIME', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PayrollPaymentFrequency" AS ENUM ('MONTHLY', 'SEMI_MONTHLY', 'BIWEEKLY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'CALCULATING', 'CALCULATED', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED', 'LOCKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollAdjustmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PayrollRunAction" AS ENUM ('SUBMIT_REVIEW', 'APPROVE', 'PUBLISH', 'CANCEL', 'RECALCULATE');

-- CreateEnum
CREATE TYPE "PayrollRoundingMode" AS ENUM ('HALF_UP', 'ROUND_DOWN', 'ROUND_UP');

-- CreateTable
CREATE TABLE "payroll_settings" (
    "id" UUID NOT NULL,
    "standard_monthly_hours" DECIMAL(6,2) NOT NULL DEFAULT 173.00,
    "standard_monthly_days" DECIMAL(6,2) NOT NULL DEFAULT 22.00,
    "rounding_mode" "PayrollRoundingMode" NOT NULL DEFAULT 'HALF_UP',
    "currency_scale" INTEGER NOT NULL DEFAULT 2,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_compensations" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "base_salary" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "payment_frequency" "PayrollPaymentFrequency" NOT NULL DEFAULT 'MONTHLY',
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_compensations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_components" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "component_type" "PayrollComponentType" NOT NULL,
    "calculation_type" "PayrollCalculationType" NOT NULL,
    "default_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "percentage" DECIMAL(9,4),
    "rate_multiplier" DECIMAL(9,4),
    "source_type" "PayrollSourceType",
    "is_taxable" BOOLEAN NOT NULL DEFAULT false,
    "is_recurring" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_payroll_assignments" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "component_id" UUID NOT NULL,
    "amount_override" DECIMAL(18,2),
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_payroll_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_periods" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "payment_date" DATE NOT NULL,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" UUID NOT NULL,
    "period_id" UUID NOT NULL,
    "run_number" INTEGER NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "calculation_version" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "standard_monthly_hours" DECIMAL(6,2) NOT NULL,
    "standard_monthly_days" DECIMAL(6,2) NOT NULL,
    "rounding_mode" "PayrollRoundingMode" NOT NULL,
    "currency_scale" INTEGER NOT NULL,
    "gross_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "deduction_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "employer_contribution_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "warnings" JSONB,
    "calculated_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "created_by_id" UUID,
    "approved_by_id" UUID,
    "published_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_run_approvals" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "action" "PayrollRunAction" NOT NULL,
    "actor_user_id" UUID,
    "actor_name" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_run_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_payslips" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "employee_number_snapshot" TEXT NOT NULL,
    "employee_name_snapshot" TEXT NOT NULL,
    "department_snapshot" TEXT,
    "position_snapshot" TEXT,
    "currency" TEXT NOT NULL,
    "base_salary" DECIMAL(18,2) NOT NULL,
    "gross_pay" DECIMAL(18,2) NOT NULL,
    "total_deductions" DECIMAL(18,2) NOT NULL,
    "employer_contributions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net_pay" DECIMAL(18,2) NOT NULL,
    "compensation_snapshot" JSONB NOT NULL,
    "assignment_snapshot" JSONB NOT NULL,
    "attendance_snapshot" JSONB NOT NULL,
    "leave_snapshot" JSONB NOT NULL,
    "overtime_snapshot" JSONB NOT NULL,
    "adjustment_snapshot" JSONB NOT NULL,
    "settings_snapshot" JSONB NOT NULL,
    "warnings" JSONB,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_lines" (
    "id" UUID NOT NULL,
    "payslip_id" UUID NOT NULL,
    "component_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "component_type" "PayrollComponentType" NOT NULL,
    "calculation_type" "PayrollCalculationType" NOT NULL,
    "quantity" DECIMAL(18,4),
    "rate" DECIMAL(18,6),
    "amount" DECIMAL(18,2) NOT NULL,
    "source_type" "PayrollSourceType",
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_sources" (
    "id" UUID NOT NULL,
    "payslip_id" UUID NOT NULL,
    "kind" "PayrollSourceKind" NOT NULL,
    "source_id" UUID NOT NULL,
    "reference" JSONB,
    "quantity" DECIMAL(18,4),
    "amount" DECIMAL(18,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_adjustments" (
    "id" UUID NOT NULL,
    "period_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "component_id" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "PayrollAdjustmentStatus" NOT NULL DEFAULT 'PENDING',
    "created_by_id" UUID,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_compensations_employee_id_effective_from_effective_idx" ON "employee_compensations"("employee_id", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "employee_compensations_status_effective_from_idx" ON "employee_compensations"("status", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_components_code_key" ON "payroll_components"("code");

-- CreateIndex
CREATE INDEX "payroll_components_is_active_component_type_idx" ON "payroll_components"("is_active", "component_type");

-- CreateIndex
CREATE INDEX "payroll_components_effective_from_effective_to_idx" ON "payroll_components"("effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "employee_payroll_assignments_employee_id_effective_from_eff_idx" ON "employee_payroll_assignments"("employee_id", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "employee_payroll_assignments_component_id_effective_from_ef_idx" ON "employee_payroll_assignments"("component_id", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "payroll_periods_start_date_end_date_idx" ON "payroll_periods"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "payroll_periods_status_idx" ON "payroll_periods"("status");

-- CreateIndex
CREATE INDEX "payroll_runs_status_created_at_idx" ON "payroll_runs"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_period_id_run_number_key" ON "payroll_runs"("period_id", "run_number");

-- CreateIndex
CREATE INDEX "payroll_run_approvals_run_id_created_at_idx" ON "payroll_run_approvals"("run_id", "created_at");

-- CreateIndex
CREATE INDEX "payroll_payslips_employee_id_published_at_idx" ON "payroll_payslips"("employee_id", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_payslips_run_id_employee_id_key" ON "payroll_payslips"("run_id", "employee_id");

-- CreateIndex
CREATE INDEX "payroll_lines_payslip_id_idx" ON "payroll_lines"("payslip_id");

-- CreateIndex
CREATE INDEX "payroll_lines_component_id_idx" ON "payroll_lines"("component_id");

-- CreateIndex
CREATE INDEX "payroll_sources_kind_source_id_idx" ON "payroll_sources"("kind", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_sources_payslip_id_kind_source_id_key" ON "payroll_sources"("payslip_id", "kind", "source_id");

-- CreateIndex
CREATE INDEX "payroll_adjustments_period_id_status_idx" ON "payroll_adjustments"("period_id", "status");

-- CreateIndex
CREATE INDEX "payroll_adjustments_employee_id_period_id_idx" ON "payroll_adjustments"("employee_id", "period_id");

-- AddForeignKey
ALTER TABLE "employee_compensations" ADD CONSTRAINT "employee_compensations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_compensations" ADD CONSTRAINT "employee_compensations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_payroll_assignments" ADD CONSTRAINT "employee_payroll_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_payroll_assignments" ADD CONSTRAINT "employee_payroll_assignments_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "payroll_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_payroll_assignments" ADD CONSTRAINT "employee_payroll_assignments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_approvals" ADD CONSTRAINT "payroll_run_approvals_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_approvals" ADD CONSTRAINT "payroll_run_approvals_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_payslips" ADD CONSTRAINT "payroll_payslips_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_payslips" ADD CONSTRAINT "payroll_payslips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "payroll_payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "payroll_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_sources" ADD CONSTRAINT "payroll_sources_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "payroll_payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "payroll_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Payroll invariants that Prisma cannot express in the schema.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE UNIQUE INDEX "payroll_settings_singleton" ON "payroll_settings" ((true));

ALTER TABLE "employee_compensations"
  ADD CONSTRAINT "employee_compensations_amount_check" CHECK ("base_salary" >= 0),
  ADD CONSTRAINT "employee_compensations_range_check" CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from");

ALTER TABLE "employee_compensations"
  ADD CONSTRAINT "employee_compensations_no_overlap"
  EXCLUDE USING gist (
    "employee_id" WITH =,
    daterange("effective_from", COALESCE("effective_to", 'infinity'::date), '[]') WITH &&
  ) WHERE ("status" = 'ACTIVE');

ALTER TABLE "payroll_components"
  ADD CONSTRAINT "payroll_components_amounts_check" CHECK (
    "default_amount" >= 0
    AND ("percentage" IS NULL OR "percentage" >= 0)
    AND ("rate_multiplier" IS NULL OR "rate_multiplier" >= 0)
  ),
  ADD CONSTRAINT "payroll_components_range_check" CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from"),
  ADD CONSTRAINT "payroll_components_source_check" CHECK (
    ("calculation_type" = 'SOURCE_BASED' AND "source_type" IS NOT NULL)
    OR ("calculation_type" <> 'SOURCE_BASED' AND "source_type" IS NULL)
  ),
  ADD CONSTRAINT "payroll_components_percentage_check" CHECK (
    "calculation_type" <> 'PERCENTAGE' OR "percentage" IS NOT NULL
  );

ALTER TABLE "employee_payroll_assignments"
  ADD CONSTRAINT "employee_payroll_assignments_amount_check" CHECK ("amount_override" IS NULL OR "amount_override" >= 0),
  ADD CONSTRAINT "employee_payroll_assignments_range_check" CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from");

ALTER TABLE "employee_payroll_assignments"
  ADD CONSTRAINT "employee_payroll_assignments_no_overlap"
  EXCLUDE USING gist (
    "employee_id" WITH =,
    "component_id" WITH =,
    daterange("effective_from", COALESCE("effective_to", 'infinity'::date), '[]') WITH &&
  ) WHERE ("status" = 'ACTIVE');

ALTER TABLE "payroll_periods"
  ADD CONSTRAINT "payroll_periods_range_check" CHECK ("end_date" >= "start_date"),
  ADD CONSTRAINT "payroll_periods_payment_check" CHECK ("payment_date" >= "end_date");

ALTER TABLE "payroll_periods"
  ADD CONSTRAINT "payroll_periods_no_overlap"
  EXCLUDE USING gist (
    daterange("start_date", "end_date", '[]') WITH &&
  );

CREATE UNIQUE INDEX "payroll_runs_one_active_per_period"
  ON "payroll_runs" ("period_id")
  WHERE "status" <> 'CANCELLED';

ALTER TABLE "payroll_runs"
  ADD CONSTRAINT "payroll_runs_totals_check" CHECK (
    "gross_total" >= 0
    AND "deduction_total" >= 0
    AND "employer_contribution_total" >= 0
    AND "calculation_version" >= 0
    AND "currency_scale" BETWEEN 0 AND 6
    AND "standard_monthly_hours" > 0
    AND "standard_monthly_days" > 0
  );

ALTER TABLE "payroll_payslips"
  ADD CONSTRAINT "payroll_payslips_totals_check" CHECK (
    "base_salary" >= 0
    AND "gross_pay" >= 0
    AND "total_deductions" >= 0
    AND "employer_contributions" >= 0
  );

ALTER TABLE "payroll_lines"
  ADD CONSTRAINT "payroll_lines_amount_check" CHECK ("amount" >= 0);

ALTER TABLE "payroll_adjustments"
  ADD CONSTRAINT "payroll_adjustments_amount_check" CHECK ("amount" > 0);
