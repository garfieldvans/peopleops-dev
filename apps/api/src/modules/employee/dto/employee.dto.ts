import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
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
  ValidateIf,
} from "class-validator";
import {
  EMPLOYEE_DOCUMENT_CATEGORIES,
  EMPLOYEE_SORT_FIELDS,
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  GENDERS,
  MARITAL_STATUSES,
  type EmployeeDocumentCategory,
  type EmployeeSortField,
  type EmploymentStatus,
  type EmploymentType,
  type Gender,
  type MaritalStatus,
} from "@peopleops/shared-types";
import { PageQueryDto } from "../../../common/dto/page-query.dto";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DateString = () =>
  Matches(DATE_PATTERN, { message: "date must use YYYY-MM-DD format" });

export class CreateEmployeeDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  employeeNumber?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  middleName?: string | null;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  preferredName?: string | null;

  @IsOptional()
  @IsIn(GENDERS)
  gender?: Gender | null;

  @IsOptional()
  @DateString()
  birthDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  placeOfBirth?: string | null;

  @IsOptional()
  @IsIn(MARITAL_STATUSES)
  maritalStatus?: MaritalStatus | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  nationality?: string | null;

  @IsEmail()
  @MaxLength(160)
  personalEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  province?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  workEmail?: string | null;

  @IsIn(EMPLOYMENT_TYPES)
  employmentType!: EmploymentType;

  @DateString()
  joinDate!: string;

  @IsOptional()
  @DateString()
  probationEndDate?: string | null;

  @IsOptional()
  @DateString()
  contractStartDate?: string | null;

  @IsOptional()
  @DateString()
  contractEndDate?: string | null;

  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsUUID()
  positionId?: string | null;

  @IsOptional()
  @IsUUID()
  jobLevelId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  managerId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdateEmployeeProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  middleName?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  preferredName?: string | null;

  @IsOptional()
  @IsIn(GENDERS)
  gender?: Gender | null;

  @IsOptional()
  @DateString()
  birthDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  placeOfBirth?: string | null;

  @IsOptional()
  @IsIn(MARITAL_STATUSES)
  maritalStatus?: MaritalStatus | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  nationality?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  personalEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  province?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  workEmail?: string | null;

  @IsOptional()
  @DateString()
  contractEndDate?: string | null;

  @IsOptional()
  @DateString()
  probationEndDate?: string | null;

  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsUUID()
  positionId?: string | null;

  @IsOptional()
  @IsUUID()
  jobLevelId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  managerId?: string | null;

  @IsOptional()
  @IsIn(EMPLOYMENT_TYPES)
  employmentType?: EmploymentType;

  @IsOptional()
  @IsIn(EMPLOYMENT_STATUSES)
  employmentStatus?: EmploymentStatus;

  /** Effective date of the employment change; defaults to today. */
  @IsOptional()
  @DateString()
  effectiveDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  changeReason?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdateSelfEmployeeDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  province?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  preferredName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string | null;
}

export class DeactivateEmployeeDto {
  @IsOptional()
  @DateString()
  effectiveDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string | null;
}

export class LinkEmployeeUserDto {
  /** `null` unlinks the account. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  userId!: string | null;
}

export class ListEmployeesQueryDto extends PageQueryDto {
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

  @IsOptional()
  @IsUUID()
  positionId?: string;

  @IsOptional()
  @IsIn(EMPLOYMENT_STATUSES)
  employmentStatus?: EmploymentStatus;

  @IsOptional()
  @IsIn(EMPLOYEE_SORT_FIELDS)
  sortBy?: EmployeeSortField = "name";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDir?: "asc" | "desc" = "asc";
}

export class CreateEmergencyContactDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  fullName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  relationship!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string | null;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class UpdateEmergencyContactDto extends CreateEmergencyContactDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  declare fullName: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  declare relationship: string;
}

export class UploadEmployeeDocumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsIn(EMPLOYEE_DOCUMENT_CATEGORIES)
  category?: EmployeeDocumentCategory = "OTHER";

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string | null;
}

export class ListEmployeeHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}
