import { ApiPropertyOptional } from "@nestjs/swagger";
import { MASTER_STATUSES, type MasterStatus } from "@peopleops/shared-types";
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { PageQueryDto } from "../../../../common/dto/page-query.dto";

export class CreateBranchDto {
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
  @MaxLength(240)
  address?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(96)
  city?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(96)
  province?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  postalCode?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({ enum: MASTER_STATUSES })
  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}

export class UpdateBranchDto {
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
  @MaxLength(240)
  address?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(96)
  city?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(96)
  province?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  postalCode?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({ enum: MASTER_STATUSES })
  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}

export class ListBranchesQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: "Matches name, code or city" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: MASTER_STATUSES })
  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}
