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

export class CreateDepartmentDto {
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

  @ApiPropertyOptional({ nullable: true, format: "uuid" })
  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @ApiPropertyOptional({ nullable: true, format: "uuid" })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional({ nullable: true, format: "uuid" })
  @IsOptional()
  @IsUUID()
  headEmployeeId?: string | null;

  @ApiPropertyOptional({ enum: MASTER_STATUSES })
  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}

export class UpdateDepartmentDto {
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

  @ApiPropertyOptional({ nullable: true, format: "uuid" })
  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @ApiPropertyOptional({ nullable: true, format: "uuid" })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional({ nullable: true, format: "uuid" })
  @IsOptional()
  @IsUUID()
  headEmployeeId?: string | null;

  @ApiPropertyOptional({ enum: MASTER_STATUSES })
  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}

export class ListDepartmentsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: "Matches name or code" })
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
  branchId?: string;

  @ApiPropertyOptional({ format: "uuid", description: "Only direct children of this department" })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
