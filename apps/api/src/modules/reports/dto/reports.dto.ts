import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";
import { PageQueryDto } from "../../../common/dto/page-query.dto";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const DateKey = () => Matches(DATE_KEY, { message: "date must use YYYY-MM-DD" });

export class ReportRangeQueryDto {
  @IsOptional()
  @DateKey()
  from?: string;

  @IsOptional()
  @DateKey()
  to?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;
}

export class EmployeeReportQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsIn(["ACTIVE", "PROBATION", "INACTIVE", "RESIGNED", "TERMINATED"])
  status?: "ACTIVE" | "PROBATION" | "INACTIVE" | "RESIGNED" | "TERMINATED";

  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;
}

export class PerformanceReportQueryDto {
  @IsOptional()
  @IsUUID()
  cycleId?: string;
}

export class ExportReportQueryDto extends ReportRangeQueryDto {
  @IsIn([
    "employees",
    "attendance",
    "leave",
    "overtime",
    "payroll",
    "onboarding",
    "offboarding",
    "performance",
    "learning",
  ])
  type!:
    | "employees"
    | "attendance"
    | "leave"
    | "overtime"
    | "payroll"
    | "onboarding"
    | "offboarding"
    | "performance"
    | "learning";
}
