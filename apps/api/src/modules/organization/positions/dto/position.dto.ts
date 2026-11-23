import { ApiPropertyOptional } from "@nestjs/swagger";
import { MASTER_STATUSES, type MasterStatus } from "@peopleops/shared-types";
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { PageQueryDto } from "../../../../common/dto/page-query.dto";

export class CreatePositionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

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

  @IsUUID()
  departmentId!: string;

  @ApiPropertyOptional({ nullable: true, format: "uuid" })
  @IsOptional()
  @IsUUID()
  jobLevelId?: string | null;

  @ApiPropertyOptional({ enum: MASTER_STATUSES })
  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}

export class UpdatePositionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

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

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ nullable: true, format: "uuid" })
  @IsOptional()
  @IsUUID()
  jobLevelId?: string | null;

  @ApiPropertyOptional({ enum: MASTER_STATUSES })
  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}

export class ListPositionsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: "Matches title or code" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: MASTER_STATUSES })
  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  jobLevelId?: string;
}
