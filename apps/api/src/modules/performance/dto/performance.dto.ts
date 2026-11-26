import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import type {
  PerformanceCycleStatus,
  PerformanceGoalCategory,
  PerformanceGoalStatus,
  PerformanceMeasurementType,
  PerformanceReviewStatus,
  PerformanceReviewType,
} from "@peopleops/shared-types";
import { PageQueryDto } from "../../../common/dto/page-query.dto";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const DateKey = () => Matches(DATE_KEY, { message: "date must use YYYY-MM-DD" });

export class ListPerformanceCyclesQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(["DRAFT", "ACTIVE", "REVIEW_IN_PROGRESS", "COMPLETED", "CANCELLED"])
  status?: PerformanceCycleStatus;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;
}

export class CreatePerformanceCycleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @DateKey()
  startDate!: string;

  @DateKey()
  endDate!: string;

  @DateKey()
  reviewStartDate!: string;

  @DateKey()
  reviewEndDate!: string;
}

export class UpdatePerformanceCycleDto {
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
  @DateKey()
  startDate?: string;

  @IsOptional()
  @DateKey()
  endDate?: string;

  @IsOptional()
  @DateKey()
  reviewStartDate?: string;

  @IsOptional()
  @DateKey()
  reviewEndDate?: string;
}

export class TransitionPerformanceCycleDto {
  @IsIn(["ACTIVE", "REVIEW_IN_PROGRESS", "COMPLETED", "CANCELLED"])
  status!: "ACTIVE" | "REVIEW_IN_PROGRESS" | "COMPLETED" | "CANCELLED";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string | null;
}

export class ListPerformanceGoalsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  cycleId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsIn(["DRAFT", "ACTIVE", "ACHIEVED", "MISSED", "CANCELLED"])
  status?: PerformanceGoalStatus;
}

export class CreatePerformanceGoalDto {
  @IsUUID()
  employeeId!: string;

  @IsUUID()
  cycleId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsIn(["BUSINESS", "LEADERSHIP", "DEVELOPMENT", "BEHAVIORAL", "OTHER"])
  category?: PerformanceGoalCategory;

  @IsOptional()
  @IsIn(["NUMERIC", "PERCENTAGE", "BOOLEAN", "QUALITATIVE"])
  measurementType?: PerformanceMeasurementType;

  @IsOptional()
  @IsNumberString()
  targetValue?: string | null;

  @IsOptional()
  @IsNumberString()
  currentValue?: string | null;

  @IsNumberString()
  weight!: string;

  @IsOptional()
  @IsIn(["DRAFT", "ACTIVE", "ACHIEVED", "MISSED", "CANCELLED"])
  status?: PerformanceGoalStatus;
}

export class UpdatePerformanceGoalDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsIn(["BUSINESS", "LEADERSHIP", "DEVELOPMENT", "BEHAVIORAL", "OTHER"])
  category?: PerformanceGoalCategory;

  @IsOptional()
  @IsIn(["NUMERIC", "PERCENTAGE", "BOOLEAN", "QUALITATIVE"])
  measurementType?: PerformanceMeasurementType;

  @IsOptional()
  @IsNumberString()
  targetValue?: string | null;

  @IsOptional()
  @IsNumberString()
  currentValue?: string | null;

  @IsOptional()
  @IsNumberString()
  weight?: string;

  @IsOptional()
  @IsIn(["DRAFT", "ACTIVE", "ACHIEVED", "MISSED", "CANCELLED"])
  status?: PerformanceGoalStatus;
}

export class AddGoalUpdateDto {
  @IsOptional()
  @IsNumberString()
  newValue?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string | null;
}

export class ListPerformanceReviewsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  cycleId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsIn(["SELF_REVIEW", "MANAGER_REVIEW", "HR_REVIEW"])
  reviewType?: PerformanceReviewType;

  @IsOptional()
  @IsIn(["DRAFT", "SUBMITTED", "COMPLETED"])
  status?: PerformanceReviewStatus;
}

export class ReviewItemDto {
  @IsOptional()
  @IsUUID()
  goalId?: string | null;

  @IsOptional()
  @IsNumberString()
  rating?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comments?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  evidence?: string | null;
}

export class CreatePerformanceReviewDto {
  @IsUUID()
  cycleId!: string;

  @IsUUID()
  employeeId!: string;

  @IsIn(["SELF_REVIEW", "MANAGER_REVIEW", "HR_REVIEW"])
  reviewType!: PerformanceReviewType;

  @IsOptional()
  @IsUUID()
  reviewerId?: string | null;

  @IsOptional()
  @IsNumberString()
  overallRating?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  summary?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  internalNotes?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewItemDto)
  items?: ReviewItemDto[];
}

export class UpdatePerformanceReviewDto {
  @IsOptional()
  @IsNumberString()
  overallRating?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  summary?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  internalNotes?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewItemDto)
  items?: ReviewItemDto[];
}
