import { Type } from "class-transformer";
import {
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
} from "class-validator";
import type {
  TrainingDeliveryMethod,
  TrainingEnrollmentStatus,
  TrainingProgramStatus,
  TrainingType,
} from "@peopleops/shared-types";
import { PageQueryDto } from "../../../common/dto/page-query.dto";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const DateKey = () => Matches(DATE_KEY, { message: "date must use YYYY-MM-DD" });

export class ListTrainingProgramsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(["DRAFT", "PUBLISHED", "ONGOING", "COMPLETED", "CANCELLED"])
  status?: TrainingProgramStatus;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @IsIn(["INTERNAL", "EXTERNAL", "ONLINE", "WORKSHOP", "SEMINAR", "CERTIFICATION", "OTHER"])
  trainingType?: TrainingType;
}

export class CreateTrainingProgramDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string | null;

  @IsOptional()
  @IsIn(["INTERNAL", "EXTERNAL", "ONLINE", "WORKSHOP", "SEMINAR", "CERTIFICATION", "OTHER"])
  trainingType?: TrainingType;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  provider?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  durationMinutes?: number | null;

  @IsOptional()
  @IsIn(["IN_PERSON", "ONLINE", "HYBRID"])
  deliveryMethod?: TrainingDeliveryMethod;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @IsOptional()
  @DateKey()
  registrationDeadline?: string | null;

  @DateKey()
  startDate!: string;

  @DateKey()
  endDate!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  capacity?: number | null;

  @IsOptional()
  @IsIn(["DRAFT", "PUBLISHED", "ONGOING", "COMPLETED", "CANCELLED"])
  status?: TrainingProgramStatus;
}

export class UpdateTrainingProgramDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string | null;

  @IsOptional()
  @IsIn(["INTERNAL", "EXTERNAL", "ONLINE", "WORKSHOP", "SEMINAR", "CERTIFICATION", "OTHER"])
  trainingType?: TrainingType;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  provider?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  durationMinutes?: number | null;

  @IsOptional()
  @IsIn(["IN_PERSON", "ONLINE", "HYBRID"])
  deliveryMethod?: TrainingDeliveryMethod;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @IsOptional()
  @DateKey()
  registrationDeadline?: string | null;

  @IsOptional()
  @DateKey()
  startDate?: string;

  @IsOptional()
  @DateKey()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  capacity?: number | null;

  @IsOptional()
  @IsIn(["DRAFT", "PUBLISHED", "ONGOING", "COMPLETED", "CANCELLED"])
  status?: TrainingProgramStatus;
}

export class EnrollTrainingDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class ListTrainingEnrollmentsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  programId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsIn([
    "REQUESTED",
    "APPROVED",
    "REJECTED",
    "ENROLLED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
    "FAILED",
  ])
  status?: TrainingEnrollmentStatus;
}

export class UpdateTrainingEnrollmentDto {
  @IsIn([
    "APPROVED",
    "REJECTED",
    "ENROLLED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
    "FAILED",
  ])
  status!: Exclude<TrainingEnrollmentStatus, "REQUESTED">;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  result?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string | null;
}

export class UploadTrainingDocumentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsIn(["MATERIAL", "CERTIFICATE", "OTHER"])
  kind?: "MATERIAL" | "CERTIFICATE" | "OTHER";

  @IsOptional()
  @IsUUID()
  enrollmentId?: string | null;

  @IsOptional()
  @IsUUID()
  employeeId?: string | null;

  @IsOptional()
  @DateKey()
  issuedAt?: string | null;

  @IsOptional()
  @DateKey()
  expiresAt?: string | null;
}
