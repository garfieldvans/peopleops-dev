import { ApiPropertyOptional } from "@nestjs/swagger";
import { MASTER_STATUSES, type MasterStatus } from "@peopleops/shared-types";
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from "class-validator";

export class CreateJobLevelDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(24)
  @Matches(/^[A-Za-z0-9-]+$/, { message: "code may only contain letters, digits and dashes" })
  code!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ enum: MASTER_STATUSES })
  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}

export class UpdateJobLevelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(24)
  @Matches(/^[A-Za-z0-9-]+$/, { message: "code may only contain letters, digits and dashes" })
  code?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ enum: MASTER_STATUSES })
  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}
