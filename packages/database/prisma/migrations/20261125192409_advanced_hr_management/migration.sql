-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OnboardingTaskCategory" AS ENUM ('DOCUMENTATION', 'HR_ADMINISTRATION', 'IT_SETUP', 'EQUIPMENT', 'ORIENTATION', 'DEPARTMENT_INTRODUCTION', 'OTHER');

-- CreateEnum
CREATE TYPE "OffboardingStatus" AS ENUM ('INITIATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OffboardingReasonCategory" AS ENUM ('RESIGNATION', 'CONTRACT_END', 'TERMINATION', 'RETIREMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "OffboardingTaskCategory" AS ENUM ('HR_ADMINISTRATION', 'DOCUMENTATION', 'KNOWLEDGE_TRANSFER', 'EQUIPMENT_RETURN', 'ACCESS_REVIEW', 'PAYROLL_REVIEW', 'EXIT_INTERVIEW', 'OTHER');

-- CreateEnum
CREATE TYPE "PerformanceCycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'REVIEW_IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PerformanceGoalCategory" AS ENUM ('BUSINESS', 'LEADERSHIP', 'DEVELOPMENT', 'BEHAVIORAL', 'OTHER');

-- CreateEnum
CREATE TYPE "PerformanceMeasurementType" AS ENUM ('NUMERIC', 'PERCENTAGE', 'BOOLEAN', 'QUALITATIVE');

-- CreateEnum
CREATE TYPE "PerformanceGoalStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ACHIEVED', 'MISSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PerformanceReviewType" AS ENUM ('SELF_REVIEW', 'MANAGER_REVIEW', 'HR_REVIEW');

-- CreateEnum
CREATE TYPE "PerformanceReviewStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TrainingType" AS ENUM ('INTERNAL', 'EXTERNAL', 'ONLINE', 'WORKSHOP', 'SEMINAR', 'CERTIFICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "TrainingDeliveryMethod" AS ENUM ('IN_PERSON', 'ONLINE', 'HYBRID');

-- CreateEnum
CREATE TYPE "TrainingProgramStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TrainingEnrollmentStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "TrainingDocumentKind" AS ENUM ('MATERIAL', 'CERTIFICATE', 'OTHER');

-- CreateTable
CREATE TABLE "onboarding_templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_task_templates" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "OnboardingTaskCategory" NOT NULL DEFAULT 'OTHER',
    "assigned_role" TEXT,
    "due_offset_days" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_onboardings" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "expected_completion_date" DATE,
    "completed_at" TIMESTAMP(3),
    "status" "OnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_onboardings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_tasks" (
    "id" UUID NOT NULL,
    "onboarding_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "OnboardingTaskCategory" NOT NULL DEFAULT 'OTHER',
    "assigned_to_id" UUID,
    "due_date" DATE,
    "completed_at" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offboarding_templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offboarding_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offboarding_task_templates" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "OffboardingTaskCategory" NOT NULL DEFAULT 'OTHER',
    "assigned_role" TEXT,
    "due_offset_days" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offboarding_task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_offboardings" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "template_id" UUID,
    "resignation_date" DATE NOT NULL,
    "last_working_date" DATE NOT NULL,
    "reason_category" "OffboardingReasonCategory" NOT NULL DEFAULT 'RESIGNATION',
    "reason" TEXT,
    "status" "OffboardingStatus" NOT NULL DEFAULT 'INITIATED',
    "initiated_by_id" UUID,
    "completed_at" TIMESTAMP(3),
    "exit_interview_notes" TEXT,
    "equipment_return_notes" TEXT,
    "access_review_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_offboardings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offboarding_tasks" (
    "id" UUID NOT NULL,
    "offboarding_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "OffboardingTaskCategory" NOT NULL DEFAULT 'OTHER',
    "assigned_to_id" UUID,
    "due_date" DATE,
    "completed_at" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offboarding_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_cycles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "review_start_date" DATE NOT NULL,
    "review_end_date" DATE NOT NULL,
    "status" "PerformanceCycleStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_goals" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "PerformanceGoalCategory" NOT NULL DEFAULT 'OTHER',
    "measurement_type" "PerformanceMeasurementType" NOT NULL DEFAULT 'QUALITATIVE',
    "target_value" DECIMAL(18,2),
    "current_value" DECIMAL(18,2),
    "weight" DECIMAL(5,2) NOT NULL,
    "status" "PerformanceGoalStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_goal_updates" (
    "id" UUID NOT NULL,
    "goal_id" UUID NOT NULL,
    "previous_value" DECIMAL(18,2),
    "new_value" DECIMAL(18,2),
    "comment" TEXT,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_goal_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_reviews" (
    "id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "reviewer_id" UUID,
    "review_type" "PerformanceReviewType" NOT NULL,
    "status" "PerformanceReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "overall_rating" DECIMAL(3,1),
    "summary" TEXT,
    "internal_notes" TEXT,
    "submitted_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_review_items" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "goal_id" UUID,
    "rating" DECIMAL(3,1),
    "comments" TEXT,
    "evidence" TEXT,

    CONSTRAINT "performance_review_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_programs" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "training_type" "TrainingType" NOT NULL DEFAULT 'INTERNAL',
    "provider" TEXT,
    "duration_minutes" INTEGER,
    "delivery_method" "TrainingDeliveryMethod" NOT NULL DEFAULT 'IN_PERSON',
    "location" TEXT,
    "registration_deadline" DATE,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "capacity" INTEGER,
    "status" "TrainingProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_enrollments" (
    "id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "status" "TrainingEnrollmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "enrolled_at" TIMESTAMP(3),
    "approved_by_id" UUID,
    "completed_at" TIMESTAMP(3),
    "result" TEXT,
    "feedback" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_documents" (
    "id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "enrollment_id" UUID,
    "employee_id" UUID,
    "kind" "TrainingDocumentKind" NOT NULL DEFAULT 'MATERIAL',
    "title" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "issued_at" DATE,
    "expires_at" DATE,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "onboarding_templates_is_active_idx" ON "onboarding_templates"("is_active");

-- CreateIndex
CREATE INDEX "onboarding_task_templates_template_id_idx" ON "onboarding_task_templates"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_task_templates_template_id_sort_order_key" ON "onboarding_task_templates"("template_id", "sort_order");

-- CreateIndex
CREATE INDEX "employee_onboardings_employee_id_status_idx" ON "employee_onboardings"("employee_id", "status");

-- CreateIndex
CREATE INDEX "employee_onboardings_status_expected_completion_date_idx" ON "employee_onboardings"("status", "expected_completion_date");

-- CreateIndex
CREATE UNIQUE INDEX "employee_onboardings_employee_id_start_date_key" ON "employee_onboardings"("employee_id", "start_date");

-- CreateIndex
CREATE INDEX "onboarding_tasks_onboarding_id_status_idx" ON "onboarding_tasks"("onboarding_id", "status");

-- CreateIndex
CREATE INDEX "onboarding_tasks_assigned_to_id_due_date_idx" ON "onboarding_tasks"("assigned_to_id", "due_date");

-- CreateIndex
CREATE INDEX "offboarding_templates_is_active_idx" ON "offboarding_templates"("is_active");

-- CreateIndex
CREATE INDEX "offboarding_task_templates_template_id_idx" ON "offboarding_task_templates"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "offboarding_task_templates_template_id_sort_order_key" ON "offboarding_task_templates"("template_id", "sort_order");

-- CreateIndex
CREATE INDEX "employee_offboardings_employee_id_status_idx" ON "employee_offboardings"("employee_id", "status");

-- CreateIndex
CREATE INDEX "employee_offboardings_status_last_working_date_idx" ON "employee_offboardings"("status", "last_working_date");

-- CreateIndex
CREATE INDEX "offboarding_tasks_offboarding_id_status_idx" ON "offboarding_tasks"("offboarding_id", "status");

-- CreateIndex
CREATE INDEX "offboarding_tasks_assigned_to_id_due_date_idx" ON "offboarding_tasks"("assigned_to_id", "due_date");

-- CreateIndex
CREATE INDEX "performance_cycles_status_start_date_idx" ON "performance_cycles"("status", "start_date");

-- CreateIndex
CREATE INDEX "performance_cycles_start_date_end_date_idx" ON "performance_cycles"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "performance_goals_employee_id_cycle_id_idx" ON "performance_goals"("employee_id", "cycle_id");

-- CreateIndex
CREATE INDEX "performance_goals_cycle_id_status_idx" ON "performance_goals"("cycle_id", "status");

-- CreateIndex
CREATE INDEX "performance_goal_updates_goal_id_created_at_idx" ON "performance_goal_updates"("goal_id", "created_at");

-- CreateIndex
CREATE INDEX "performance_reviews_cycle_id_status_idx" ON "performance_reviews"("cycle_id", "status");

-- CreateIndex
CREATE INDEX "performance_reviews_employee_id_created_at_idx" ON "performance_reviews"("employee_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "performance_reviews_cycle_id_employee_id_review_type_key" ON "performance_reviews"("cycle_id", "employee_id", "review_type");

-- CreateIndex
CREATE INDEX "performance_review_items_review_id_idx" ON "performance_review_items"("review_id");

-- CreateIndex
CREATE INDEX "performance_review_items_goal_id_idx" ON "performance_review_items"("goal_id");

-- CreateIndex
CREATE INDEX "training_programs_status_start_date_idx" ON "training_programs"("status", "start_date");

-- CreateIndex
CREATE INDEX "training_programs_registration_deadline_idx" ON "training_programs"("registration_deadline");

-- CreateIndex
CREATE INDEX "training_enrollments_employee_id_status_idx" ON "training_enrollments"("employee_id", "status");

-- CreateIndex
CREATE INDEX "training_enrollments_program_id_status_idx" ON "training_enrollments"("program_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "training_enrollments_program_id_employee_id_key" ON "training_enrollments"("program_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "training_documents_storage_key_key" ON "training_documents"("storage_key");

-- CreateIndex
CREATE INDEX "training_documents_program_id_kind_idx" ON "training_documents"("program_id", "kind");

-- CreateIndex
CREATE INDEX "training_documents_employee_id_kind_idx" ON "training_documents"("employee_id", "kind");

-- CreateIndex
CREATE INDEX "training_documents_enrollment_id_idx" ON "training_documents"("enrollment_id");

-- AddForeignKey
ALTER TABLE "onboarding_task_templates" ADD CONSTRAINT "onboarding_task_templates_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "onboarding_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_onboardings" ADD CONSTRAINT "employee_onboardings_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_onboardings" ADD CONSTRAINT "employee_onboardings_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "onboarding_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_onboardings" ADD CONSTRAINT "employee_onboardings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_onboarding_id_fkey" FOREIGN KEY ("onboarding_id") REFERENCES "employee_onboardings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offboarding_task_templates" ADD CONSTRAINT "offboarding_task_templates_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "offboarding_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_offboardings" ADD CONSTRAINT "employee_offboardings_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_offboardings" ADD CONSTRAINT "employee_offboardings_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "offboarding_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_offboardings" ADD CONSTRAINT "employee_offboardings_initiated_by_id_fkey" FOREIGN KEY ("initiated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offboarding_tasks" ADD CONSTRAINT "offboarding_tasks_offboarding_id_fkey" FOREIGN KEY ("offboarding_id") REFERENCES "employee_offboardings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offboarding_tasks" ADD CONSTRAINT "offboarding_tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_cycles" ADD CONSTRAINT "performance_cycles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "performance_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_goal_updates" ADD CONSTRAINT "performance_goal_updates_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "performance_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_goal_updates" ADD CONSTRAINT "performance_goal_updates_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "performance_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_review_items" ADD CONSTRAINT "performance_review_items_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "performance_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_review_items" ADD CONSTRAINT "performance_review_items_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "performance_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_programs" ADD CONSTRAINT "training_programs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "training_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_documents" ADD CONSTRAINT "training_documents_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "training_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_documents" ADD CONSTRAINT "training_documents_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "training_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_documents" ADD CONSTRAINT "training_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_documents" ADD CONSTRAINT "training_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
