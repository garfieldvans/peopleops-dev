import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import type {
  OffboardingReasonCategory,
  OffboardingStatus,
  OffboardingTaskCategory,
  OnboardingStatus,
  OnboardingTaskCategory,
  TaskStatus,
} from "@peopleops/shared-types";
import { PageQueryDto } from "../../../common/dto/page-query.dto";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const DateKey = () => Matches(DATE_KEY, { message: "date must use YYYY-MM-DD" });

export class OnboardingTaskTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsIn([
    "DOCUMENTATION",
    "HR_ADMINISTRATION",
    "IT_SETUP",
    "EQUIPMENT",
    "ORIENTATION",
    "DEPARTMENT_INTRODUCTION",
    "OTHER",
  ])
  category?: OnboardingTaskCategory;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  assignedRole?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  dueOffsetDays?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateOnboardingTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OnboardingTaskTemplateDto)
  tasks!: OnboardingTaskTemplateDto[];
}

export class UpdateOnboardingTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OnboardingTaskTemplateDto)
  tasks?: OnboardingTaskTemplateDto[];
}

export class ListOnboardingTemplatesQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

export class CreateOnboardingRecordDto {
  @IsUUID()
  employeeId!: string;

  @IsUUID()
  templateId!: string;

  @DateKey()
  startDate!: string;

  @IsOptional()
  @DateKey()
  expectedCompletionDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateOnboardingRecordDto {
  @IsOptional()
  @DateKey()
  expectedCompletionDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @IsIn(["NOT_STARTED", "IN_PROGRESS", "CANCELLED"])
  status?: OnboardingStatus;
}

export class ListOnboardingQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
  status?: OnboardingStatus;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;
}

export class UpdateOnboardingTaskDto {
  @IsOptional()
  @IsIn(["PENDING", "IN_PROGRESS", "COMPLETED"])
  status?: TaskStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @IsUUID()
  assignedToId?: string | null;

  @IsOptional()
  @DateKey()
  dueDate?: string | null;
}

export class CompleteOnboardingDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string | null;
}

export class OffboardingTaskTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsIn([
    "HR_ADMINISTRATION",
    "DOCUMENTATION",
    "KNOWLEDGE_TRANSFER",
    "EQUIPMENT_RETURN",
    "ACCESS_REVIEW",
    "PAYROLL_REVIEW",
    "EXIT_INTERVIEW",
    "OTHER",
  ])
  category?: OffboardingTaskCategory;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  assignedRole?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  dueOffsetDays?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateOffboardingTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OffboardingTaskTemplateDto)
  tasks!: OffboardingTaskTemplateDto[];
}

export class UpdateOffboardingTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OffboardingTaskTemplateDto)
  tasks?: OffboardingTaskTemplateDto[];
}

export class CreateOffboardingRecordDto {
  @IsUUID()
  employeeId!: string;

  @IsOptional()
  @IsUUID()
  templateId?: string | null;

  @DateKey()
  resignationDate!: string;

  @DateKey()
  lastWorkingDate!: string;

  @IsOptional()
  @IsIn(["RESIGNATION", "CONTRACT_END", "TERMINATION", "RETIREMENT", "OTHER"])
  reasonCategory?: OffboardingReasonCategory;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  exitInterviewNotes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  equipmentReturnNotes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  accessReviewNotes?: string | null;
}

export class UpdateOffboardingRecordDto {
  @IsOptional()
  @DateKey()
  resignationDate?: string;

  @IsOptional()
  @DateKey()
  lastWorkingDate?: string;

  @IsOptional()
  @IsIn(["RESIGNATION", "CONTRACT_END", "TERMINATION", "RETIREMENT", "OTHER"])
  reasonCategory?: OffboardingReasonCategory;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string | null;

  @IsOptional()
  @IsIn(["INITIATED", "IN_PROGRESS", "CANCELLED"])
  status?: OffboardingStatus;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  exitInterviewNotes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  equipmentReturnNotes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  accessReviewNotes?: string | null;
}

export class ListOffboardingQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(["INITIATED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
  status?: OffboardingStatus;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;
}

export class UpdateOffboardingTaskDto {
  @IsOptional()
  @IsIn(["PENDING", "IN_PROGRESS", "COMPLETED"])
  status?: TaskStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @IsUUID()
  assignedToId?: string | null;

  @IsOptional()
  @DateKey()
  dueDate?: string | null;
}

export class CompleteOffboardingDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string | null;
}
