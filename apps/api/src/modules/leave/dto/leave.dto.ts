import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";
import {
  LEAVE_ACCRUAL_FREQUENCIES,
  LEAVE_ACCRUAL_METHODS,
  LEAVE_ACCRUAL_START_RULES,
  LEAVE_APPROVAL_MODES,
  LEAVE_DURATION_UNITS,
  LEAVE_HALF_DAY_PERIODS,
  LEAVE_REQUEST_MODES,
  LEAVE_REQUEST_STATUSES,
  MASTER_STATUSES,
  type LeaveAccrualFrequency,
  type LeaveAccrualMethod,
  type LeaveAccrualStartRule,
  type LeaveApprovalMode,
  type LeaveDurationUnit,
  type LeaveHalfDayPeriod,
  type LeaveRequestMode,
  type LeaveRequestStatus,
  type MasterStatus,
} from "@peopleops/shared-types";
import { PageQueryDto } from "../../../common/dto/page-query.dto";
import { DATE_KEY_PATTERN } from "../../../common/time/zoned-time";

const DateKey = () => Matches(DATE_KEY_PATTERN, { message: "date must use YYYY-MM-DD" });
const MonthKey = () => Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "month must use YYYY-MM" });

/** Explicit page fields keep the leave DTO metadata independent of inheritance. */
export class LeavePageQueryDto extends PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  override page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  override pageSize: number = 20;
}

export class CreateLeaveTypeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9_]+$/, { message: "code may only contain letters, digits and underscores" })
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresAttachment?: boolean;

  @IsOptional()
  @IsBoolean()
  allowHalfDay?: boolean;

  @IsOptional()
  @IsBoolean()
  allowPastDates?: boolean;

  @IsOptional()
  @IsBoolean()
  allowFutureDates?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresBalance?: boolean;

  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}

export class UpdateLeaveTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9_]+$/, { message: "code may only contain letters, digits and underscores" })
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresAttachment?: boolean;

  @IsOptional()
  @IsBoolean()
  allowHalfDay?: boolean;

  @IsOptional()
  @IsBoolean()
  allowPastDates?: boolean;

  @IsOptional()
  @IsBoolean()
  allowFutureDates?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresBalance?: boolean;

  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}

export class ListLeaveTypesQueryDto extends LeavePageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}

export class CreateLeavePolicyDto {
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

  @IsUUID()
  leaveTypeId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  entitlementAmount?: number;

  @IsOptional()
  @IsIn([...LEAVE_DURATION_UNITS])
  entitlementUnit?: LeaveDurationUnit;

  @IsOptional()
  @IsIn([...LEAVE_ACCRUAL_METHODS])
  accrualMethod?: LeaveAccrualMethod;

  @IsOptional()
  @IsIn([...LEAVE_ACCRUAL_FREQUENCIES])
  accrualFrequency?: LeaveAccrualFrequency;

  @IsOptional()
  @IsIn([...LEAVE_ACCRUAL_START_RULES])
  accrualStartRule?: LeaveAccrualStartRule;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  eligibilityMonths?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxBalance?: number | null;

  @IsOptional()
  @IsBoolean()
  carryOverEnabled?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxCarryOverAmount?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24)
  carryOverExpirationMonths?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minRequestDuration?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxRequestDuration?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  minAdvanceNoticeDays?: number;

  @IsOptional()
  @IsBoolean()
  allowNegativeBalance?: boolean;

  @IsOptional()
  @IsBoolean()
  allowHalfDay?: boolean;

  @IsOptional()
  @IsBoolean()
  allowUnpaidLeave?: boolean;

  @IsOptional()
  @IsIn([...LEAVE_APPROVAL_MODES])
  approvalMode?: LeaveApprovalMode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  leaveYearStartMonth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  cancellationCutoffDays?: number;

  @DateKey()
  effectiveFrom!: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @DateKey()
  effectiveTo?: string | null;

  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}

export class UpdateLeavePolicyDto {
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
  @IsUUID()
  leaveTypeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  entitlementAmount?: number;

  @IsOptional()
  @IsIn([...LEAVE_DURATION_UNITS])
  entitlementUnit?: LeaveDurationUnit;

  @IsOptional()
  @IsIn([...LEAVE_ACCRUAL_METHODS])
  accrualMethod?: LeaveAccrualMethod;

  @IsOptional()
  @IsIn([...LEAVE_ACCRUAL_FREQUENCIES])
  accrualFrequency?: LeaveAccrualFrequency;

  @IsOptional()
  @IsIn([...LEAVE_ACCRUAL_START_RULES])
  accrualStartRule?: LeaveAccrualStartRule;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  eligibilityMonths?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxBalance?: number | null;

  @IsOptional()
  @IsBoolean()
  carryOverEnabled?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxCarryOverAmount?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24)
  carryOverExpirationMonths?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minRequestDuration?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxRequestDuration?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  minAdvanceNoticeDays?: number;

  @IsOptional()
  @IsBoolean()
  allowNegativeBalance?: boolean;

  @IsOptional()
  @IsBoolean()
  allowHalfDay?: boolean;

  @IsOptional()
  @IsBoolean()
  allowUnpaidLeave?: boolean;

  @IsOptional()
  @IsIn([...LEAVE_APPROVAL_MODES])
  approvalMode?: LeaveApprovalMode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  leaveYearStartMonth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  cancellationCutoffDays?: number;

  @IsOptional()
  @DateKey()
  effectiveFrom?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @DateKey()
  effectiveTo?: string | null;

  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}

export class ListLeavePoliciesQueryDto extends LeavePageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsUUID()
  leaveTypeId?: string;

  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}

export class CreateLeavePolicyAssignmentDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  employeeIds!: string[];

  @IsUUID()
  policyId!: string;

  @DateKey()
  effectiveFrom!: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @DateKey()
  effectiveTo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdateLeavePolicyAssignmentDto {
  @IsOptional()
  @DateKey()
  effectiveFrom?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @DateKey()
  effectiveTo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}

export class ListLeaveAssignmentsQueryDto extends LeavePageQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  policyId?: string;

  @IsOptional()
  @IsUUID()
  leaveTypeId?: string;

  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}

export class MyLeaveBalanceQueryDto {
  @IsOptional()
  @DateKey()
  asOf?: string;
}

export class ListLeaveBalancesQueryDto extends LeavePageQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  leaveTypeId?: string;

  @IsOptional()
  @DateKey()
  asOf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class ListLeaveTransactionsQueryDto extends LeavePageQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  leaveTypeId?: string;

  @IsOptional()
  @DateKey()
  from?: string;

  @IsOptional()
  @DateKey()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class AdjustLeaveBalanceDto {
  @IsUUID()
  leaveTypeId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  amount!: number;

  @DateKey()
  transactionDate!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class LeavePreviewDto {
  @IsUUID()
  leaveTypeId!: string;

  @DateKey()
  startDate!: string;

  @DateKey()
  endDate!: string;

  @IsOptional()
  @IsIn([...LEAVE_REQUEST_MODES])
  requestMode?: LeaveRequestMode;

  @IsOptional()
  @IsIn([...LEAVE_HALF_DAY_PERIODS])
  halfDayPeriod?: LeaveHalfDayPeriod;
}

export class CreateLeaveRequestDto extends LeavePreviewDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientRequestId?: string;
}

export class UpdateLeaveRequestDto {
  @IsOptional()
  @IsUUID()
  leaveTypeId?: string;

  @IsOptional()
  @DateKey()
  startDate?: string;

  @IsOptional()
  @DateKey()
  endDate?: string;

  @IsOptional()
  @IsIn([...LEAVE_REQUEST_MODES])
  requestMode?: LeaveRequestMode;

  @IsOptional()
  @IsIn([...LEAVE_HALF_DAY_PERIODS])
  halfDayPeriod?: LeaveHalfDayPeriod | null;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason?: string;
}

export class ListLeaveRequestsQueryDto extends LeavePageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  leaveTypeId?: string;

  @IsOptional()
  @IsIn([...LEAVE_REQUEST_STATUSES])
  status?: LeaveRequestStatus;

  @IsOptional()
  @DateKey()
  from?: string;

  @IsOptional()
  @DateKey()
  to?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class ReviewLeaveRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string | null;

  @IsOptional()
  @IsBoolean()
  override?: boolean;
}

export class CancelLeaveRequestDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class LeaveCalendarQueryDto {
  @MonthKey()
  month!: string;
}

export class LeaveReportQueryDto {
  @DateKey()
  from!: string;

  @DateKey()
  to!: string;

  @IsOptional()
  @IsUUID()
  leaveTypeId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsIn([...LEAVE_REQUEST_STATUSES])
  status?: LeaveRequestStatus;
}

export class UploadLeaveAttachmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}
