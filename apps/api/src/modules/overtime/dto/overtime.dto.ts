import { Transform, Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import {
  EMPLOYMENT_STATUSES,
  MASTER_STATUSES,
  OVERTIME_CATEGORIES,
  OVERTIME_ROUNDING_STRATEGIES,
  OVERTIME_STATUSES,
  type EmploymentStatus,
  type MasterStatus,
  type OvertimeCategory,
  type OvertimeRoundingStrategy,
  type OvertimeStatus,
} from "@peopleops/shared-types";
import { PageQueryDto } from "../../../common/dto/page-query.dto";
import { DATE_KEY_PATTERN } from "../../../common/time/zoned-time";

const DateKey = () => Matches(DATE_KEY_PATTERN, { message: "date must use YYYY-MM-DD" });

export class CreateOvertimePolicyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: "code may only contain letters, digits, dashes and underscores",
  })
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;

  @DateKey()
  effectiveFrom!: string;

  @IsOptional()
  @DateKey()
  effectiveTo?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  minMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  maxMinutes?: number;

  @IsOptional()
  @IsIn([...OVERTIME_ROUNDING_STRATEGIES])
  roundingStrategy?: OvertimeRoundingStrategy;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(240)
  roundingMinutes?: number;

  @IsOptional()
  @IsIn(["MANAGER", "HR", "MANAGER_AND_HR"])
  approvalMode?: "MANAGER" | "HR" | "MANAGER_AND_HR";

  @IsOptional()
  @IsBoolean()
  requiresAttachment?: boolean;

  @IsOptional()
  @IsBoolean()
  allowWeekend?: boolean;

  @IsOptional()
  @IsBoolean()
  allowHoliday?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn([...EMPLOYMENT_STATUSES], { each: true })
  eligibleEmploymentStatuses?: EmploymentStatus[];
}

export class UpdateOvertimePolicyDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: "code may only contain letters, digits, dashes and underscores",
  })
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;

  @IsOptional()
  @DateKey()
  effectiveFrom?: string;

  @IsOptional()
  @DateKey()
  effectiveTo?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  minMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  maxMinutes?: number;

  @IsOptional()
  @IsIn([...OVERTIME_ROUNDING_STRATEGIES])
  roundingStrategy?: OvertimeRoundingStrategy;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(240)
  roundingMinutes?: number;

  @IsOptional()
  @IsIn(["MANAGER", "HR", "MANAGER_AND_HR"])
  approvalMode?: "MANAGER" | "HR" | "MANAGER_AND_HR";

  @IsOptional()
  @IsBoolean()
  requiresAttachment?: boolean;

  @IsOptional()
  @IsBoolean()
  allowWeekend?: boolean;

  @IsOptional()
  @IsBoolean()
  allowHoliday?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn([...EMPLOYMENT_STATUSES], { each: true })
  eligibleEmploymentStatuses?: EmploymentStatus[];
}

export class ListOvertimePoliciesQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}

export class CreateOvertimeAssignmentDto {
  @IsUUID()
  policyId!: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @DateKey()
  effectiveFrom!: string;

  @IsOptional()
  @DateKey()
  effectiveTo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdateOvertimeAssignmentDto {
  @IsOptional()
  @DateKey()
  effectiveFrom?: string;

  @IsOptional()
  @DateKey()
  effectiveTo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class ListOvertimeAssignmentsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  policyId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class CreateOvertimeRequestDto {
  @DateKey()
  workDate!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;

  @IsISO8601()
  plannedStartAt!: string;

  @IsISO8601()
  plannedEndAt!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(240)
  plannedBreakMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientRequestId?: string;
}

export class UpdateOvertimeRequestDto {
  @IsOptional()
  @DateKey()
  workDate?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason?: string;

  @IsOptional()
  @IsISO8601()
  plannedStartAt?: string;

  @IsOptional()
  @IsISO8601()
  plannedEndAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(240)
  plannedBreakMinutes?: number;
}

export class ListOvertimeRequestsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn([...OVERTIME_STATUSES])
  status?: OvertimeStatus;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.split(",").filter(Boolean) : value))
  @IsArray()
  @IsIn([...OVERTIME_STATUSES], { each: true })
  statuses?: OvertimeStatus[];

  @IsOptional()
  @IsIn([...OVERTIME_CATEGORIES])
  category?: OvertimeCategory;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @DateKey()
  from?: string;

  @IsOptional()
  @DateKey()
  to?: string;

  @IsOptional()
  @IsIn(["workDate", "createdAt", "status"])
  sortBy?: "workDate" | "createdAt" | "status";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDir?: "asc" | "desc";
}

export class ReviewOvertimeRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string | null;

  @IsOptional()
  @IsBoolean()
  override?: boolean;
}

export class RejectOvertimeRequestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  comment!: string;

  @IsOptional()
  @IsBoolean()
  override?: boolean;
}

export class CancelOvertimeRequestDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class CompleteOvertimeRequestDto {
  @IsOptional()
  @IsISO8601()
  actualStartAt?: string;

  @IsOptional()
  @IsISO8601()
  actualEndAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(240)
  actualBreakMinutes?: number;
}

export class VerifyOvertimeRequestDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  verifiedMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

export class CorrectOvertimeRequestDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  correctedMinutes!: number;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class OvertimeSummaryQueryDto {
  @IsOptional()
  @DateKey()
  from?: string;

  @IsOptional()
  @DateKey()
  to?: string;
}
