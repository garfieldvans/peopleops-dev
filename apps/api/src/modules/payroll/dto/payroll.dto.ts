import { Transform, Type } from "class-transformer";
import {
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
} from "class-validator";
import {
  MASTER_STATUSES,
  PAYROLL_CALCULATION_TYPES,
  PAYROLL_COMPONENT_TYPES,
  PAYROLL_PAYMENT_FREQUENCIES,
  PAYROLL_RUN_STATUSES,
  PAYROLL_SOURCE_TYPES,
  type MasterStatus,
  type PayrollCalculationType,
  type PayrollComponentType,
  type PayrollPaymentFrequency,
  type PayrollRunStatus,
  type PayrollSourceType,
  type PayrollRoundingMode,
} from "@peopleops/shared-types";
import { PageQueryDto } from "../../../common/dto/page-query.dto";
import { DATE_KEY_PATTERN } from "../../../common/time/zoned-time";

const DateKey = () => Matches(DATE_KEY_PATTERN, { message: "date must use YYYY-MM-DD" });
const DecimalString = () =>
  Matches(/^\d+(\.\d+)?$/, { message: "value must be a non-negative decimal string" });
const OptionalDecimalString = () =>
  Matches(/^\d+(\.\d+)?$/, { message: "value must be a non-negative decimal string" });

export class UpdatePayrollSettingsDto {
  @IsOptional()
  @DecimalString()
  standardMonthlyHours?: string;

  @IsOptional()
  @DecimalString()
  standardMonthlyDays?: string;

  @IsOptional()
  @IsIn(["HALF_UP", "ROUND_DOWN", "ROUND_UP"])
  roundingMode?: PayrollRoundingMode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  currencyScale?: number;
}

export class ListCompensationQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}

export class CreateCompensationDto {
  @IsUUID()
  employeeId!: string;

  @DecimalString()
  baseSalary!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsIn([...PAYROLL_PAYMENT_FREQUENCIES])
  paymentFrequency?: PayrollPaymentFrequency;

  @DateKey()
  effectiveFrom!: string;

  @IsOptional()
  @DateKey()
  effectiveTo?: string | null;

  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdateCompensationDto {
  @IsOptional()
  @DecimalString()
  baseSalary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsIn([...PAYROLL_PAYMENT_FREQUENCIES])
  paymentFrequency?: PayrollPaymentFrequency;

  @IsOptional()
  @DateKey()
  effectiveFrom?: string;

  @IsOptional()
  @DateKey()
  effectiveTo?: string | null;

  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class ListPayrollComponentsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn([...PAYROLL_COMPONENT_TYPES])
  componentType?: PayrollComponentType;

  @IsOptional()
  @IsIn([...PAYROLL_CALCULATION_TYPES])
  calculationType?: PayrollCalculationType;

  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  isActive?: boolean;
}

export class CreatePayrollComponentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9_.-]+$/)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsIn([...PAYROLL_COMPONENT_TYPES])
  componentType!: PayrollComponentType;

  @IsIn([...PAYROLL_CALCULATION_TYPES])
  calculationType!: PayrollCalculationType;

  @IsOptional()
  @DecimalString()
  defaultAmount?: string;

  @IsOptional()
  @OptionalDecimalString()
  percentage?: string | null;

  @IsOptional()
  @OptionalDecimalString()
  rateMultiplier?: string | null;

  @IsOptional()
  @IsIn([...PAYROLL_SOURCE_TYPES])
  sourceType?: PayrollSourceType | null;

  @IsOptional()
  @IsBoolean()
  isTaxable?: boolean;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @DateKey()
  effectiveFrom!: string;

  @IsOptional()
  @DateKey()
  effectiveTo?: string | null;
}

export class UpdatePayrollComponentDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9_.-]+$/)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsIn([...PAYROLL_COMPONENT_TYPES])
  componentType?: PayrollComponentType;

  @IsOptional()
  @IsIn([...PAYROLL_CALCULATION_TYPES])
  calculationType?: PayrollCalculationType;

  @IsOptional()
  @DecimalString()
  defaultAmount?: string;

  @IsOptional()
  @OptionalDecimalString()
  percentage?: string | null;

  @IsOptional()
  @OptionalDecimalString()
  rateMultiplier?: string | null;

  @IsOptional()
  @IsIn([...PAYROLL_SOURCE_TYPES])
  sourceType?: PayrollSourceType | null;

  @IsOptional()
  @IsBoolean()
  isTaxable?: boolean;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @DateKey()
  effectiveFrom?: string;

  @IsOptional()
  @DateKey()
  effectiveTo?: string | null;
}

export class ListPayrollAssignmentsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  componentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class CreatePayrollAssignmentDto {
  @IsUUID()
  employeeId!: string;

  @IsUUID()
  componentId!: string;

  @IsOptional()
  @OptionalDecimalString()
  amountOverride?: string | null;

  @DateKey()
  effectiveFrom!: string;

  @IsOptional()
  @DateKey()
  effectiveTo?: string | null;

  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdatePayrollAssignmentDto {
  @IsOptional()
  @OptionalDecimalString()
  amountOverride?: string | null;

  @IsOptional()
  @DateKey()
  effectiveFrom?: string;

  @IsOptional()
  @DateKey()
  effectiveTo?: string | null;

  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class ListPayrollPeriodsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(["OPEN", "CLOSED"])
  status?: "OPEN" | "CLOSED";

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class CreatePayrollPeriodDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @DateKey()
  startDate!: string;

  @DateKey()
  endDate!: string;

  @DateKey()
  paymentDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdatePayrollPeriodDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @DateKey()
  startDate?: string;

  @IsOptional()
  @DateKey()
  endDate?: string;

  @IsOptional()
  @DateKey()
  paymentDate?: string;

  @IsOptional()
  @IsIn(["OPEN", "CLOSED"])
  status?: "OPEN" | "CLOSED";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class ListPayrollRunsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  periodId?: string;

  @IsOptional()
  @IsIn([...PAYROLL_RUN_STATUSES])
  status?: PayrollRunStatus;
}

export class CreatePayrollRunDto {
  @IsUUID()
  periodId!: string;
}

export class PayrollRunCommentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string | null;
}

export class CancelPayrollRunDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class ListPayrollAdjustmentsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  periodId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsIn(["PENDING", "APPROVED", "REJECTED"])
  status?: "PENDING" | "APPROVED" | "REJECTED";
}

export class CreatePayrollAdjustmentDto {
  @IsUUID()
  periodId!: string;

  @IsUUID()
  employeeId!: string;

  @IsUUID()
  componentId!: string;

  @DecimalString()
  amount!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class UpdatePayrollAdjustmentDto {
  @IsOptional()
  @DecimalString()
  amount?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason?: string;
}

export class ReviewPayrollAdjustmentDto {
  @IsIn(["APPROVED", "REJECTED"])
  status!: "APPROVED" | "REJECTED";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string | null;
}

export class ListPayrollPayslipsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  runId?: string;

  @IsOptional()
  @IsUUID()
  periodId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;
}

export class PayrollReportQueryDto {
  @IsOptional()
  @DateKey()
  from?: string;

  @IsOptional()
  @DateKey()
  to?: string;
}

export class PayrollRegisterQueryDto extends PageQueryDto {
  @IsOptional()
  @DateKey()
  from?: string;

  @IsOptional()
  @DateKey()
  to?: string;
}
