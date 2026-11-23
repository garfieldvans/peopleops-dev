import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";
import { PageQueryDto } from "../../../common/dto/page-query.dto";
import { DATE_KEY_PATTERN } from "../../../common/time/zoned-time";

const DateKey = () => Matches(DATE_KEY_PATTERN, { message: "date must use YYYY-MM-DD" });

export class CreateEmployeeScheduleDto {
  @IsUUID()
  workScheduleId!: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  shiftId?: string | null;

  @DateKey()
  effectiveFrom!: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @DateKey()
  effectiveTo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  changeReason?: string | null;

  /** Close an overlapping open assignment the day before the new start date. */
  @IsOptional()
  @IsBoolean()
  closePrevious?: boolean;
}

export class UpdateEmployeeScheduleDto {
  @IsOptional()
  @IsUUID()
  workScheduleId?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  shiftId?: string | null;

  @IsOptional()
  @DateKey()
  effectiveFrom?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @DateKey()
  effectiveTo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  changeReason?: string | null;
}

export class BulkEmployeeScheduleDto extends CreateEmployeeScheduleDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  branchId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  employeeIds?: string[];
}

export class ListEmployeeSchedulesQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @DateKey()
  activeOn?: string;
}

export class ListEmployeeSchedulesQueryDtoForEmployee extends PageQueryDto {}

export class AssignmentSortQueryDto {
  @IsOptional()
  @IsIn(["effectiveFrom", "employeeName"])
  sortBy?: "effectiveFrom" | "employeeName";
}
