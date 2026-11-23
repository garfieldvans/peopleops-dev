import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { MASTER_STATUSES, type MasterStatus } from "@peopleops/shared-types";
import { PageQueryDto } from "../../../common/dto/page-query.dto";
import { TIME_PATTERN } from "../../../common/time/zoned-time";

export class CreateShiftDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(24)
  @Matches(/^[A-Za-z0-9-]+$/, { message: "code may only contain letters, digits and dashes" })
  code!: string;

  @Matches(TIME_PATTERN, { message: "startTime must use HH:mm" })
  startTime!: string;

  @Matches(TIME_PATTERN, { message: "endTime must use HH:mm" })
  endTime!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(240)
  breakMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  graceLateMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  graceEarlyMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string | null;

  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}

export class UpdateShiftDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(24)
  @Matches(/^[A-Za-z0-9-]+$/, { message: "code may only contain letters, digits and dashes" })
  code?: string;

  @IsOptional()
  @Matches(TIME_PATTERN, { message: "startTime must use HH:mm" })
  startTime?: string;

  @IsOptional()
  @Matches(TIME_PATTERN, { message: "endTime must use HH:mm" })
  endTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(240)
  breakMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  graceLateMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  graceEarlyMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string | null;

  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}

export class ListShiftsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}
