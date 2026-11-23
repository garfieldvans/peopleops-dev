import { Type } from "class-transformer";
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import {
  HOLIDAY_TYPES,
  MASTER_STATUSES,
  type HolidayType,
  type MasterStatus,
} from "@peopleops/shared-types";
import { PageQueryDto } from "../../../common/dto/page-query.dto";
import { DATE_KEY_PATTERN } from "../../../common/time/zoned-time";

export class CreateHolidayDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @Matches(DATE_KEY_PATTERN, { message: "date must use YYYY-MM-DD" })
  date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string | null;

  @IsIn(HOLIDAY_TYPES)
  type!: HolidayType;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  branchId?: string | null;

  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}

export class UpdateHolidayDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Matches(DATE_KEY_PATTERN, { message: "date must use YYYY-MM-DD" })
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string | null;

  @IsOptional()
  @IsIn(HOLIDAY_TYPES)
  type?: HolidayType;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  branchId?: string | null;

  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}

export class ListHolidaysQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Matches(DATE_KEY_PATTERN)
  from?: string;

  @IsOptional()
  @Matches(DATE_KEY_PATTERN)
  to?: string;

  @IsOptional()
  @IsIn(HOLIDAY_TYPES)
  type?: HolidayType;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}

export class DeactivateHolidayDto {
  @IsOptional()
  @Type(() => String)
  @IsString()
  reason?: string;
}
