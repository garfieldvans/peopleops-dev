import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { MASTER_STATUSES, type MasterStatus } from "@peopleops/shared-types";
import { PageQueryDto } from "../../../common/dto/page-query.dto";
import { TIME_PATTERN } from "../../../common/time/zoned-time";

export class WorkScheduleDayDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;

  @IsBoolean()
  isWorkingDay!: boolean;

  @IsOptional()
  @Matches(TIME_PATTERN, { message: "startTime must use HH:mm" })
  startTime?: string | null;

  @IsOptional()
  @Matches(TIME_PATTERN, { message: "endTime must use HH:mm" })
  endTime?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(240)
  breakMinutes?: number;
}

export class CreateWorkScheduleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(24)
  @Matches(/^[A-Za-z0-9-]+$/, { message: "code may only contain letters, digits and dashes" })
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string | null;

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
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkScheduleDayDto)
  days!: WorkScheduleDayDto[];
}

export class UpdateWorkScheduleDto {
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
  @IsString()
  @MaxLength(400)
  description?: string | null;

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
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkScheduleDayDto)
  days?: WorkScheduleDayDto[];
}

export class ListWorkSchedulesQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}
