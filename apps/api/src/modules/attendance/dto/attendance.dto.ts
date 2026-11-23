import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";
import {
  ATTENDANCE_STATUSES,
  type AttendanceStatus,
} from "@peopleops/shared-types";
import { PageQueryDto } from "../../../common/dto/page-query.dto";
import { DATE_KEY_PATTERN } from "../../../common/time/zoned-time";

const DateKey = () => Matches(DATE_KEY_PATTERN, { message: "date must use YYYY-MM-DD" });

export class ListAttendanceQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @DateKey()
  from?: string;

  @IsOptional()
  @DateKey()
  to?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsIn(ATTENDANCE_STATUSES)
  status?: AttendanceStatus;

  @IsOptional()
  @IsIn(["workDate", "employeeName", "status"])
  sortBy?: "workDate" | "employeeName" | "status" = "workDate";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDir?: "asc" | "desc" = "desc";
}

export class MyAttendanceQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @DateKey()
  from?: string;

  @IsOptional()
  @DateKey()
  to?: string;

  @IsOptional()
  @IsIn(ATTENDANCE_STATUSES)
  status?: AttendanceStatus;
}

export class AttendanceCalendarQueryDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "month must use YYYY-MM" })
  month!: string;
}

export class OverviewQueryDto {
  @IsOptional()
  @DateKey()
  date?: string;
}

export class ManualAttendanceDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  clockInAt?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  clockOutAt?: string | null;

  @IsString()
  @MaxLength(300)
  reason!: string;
}

export class CreateCorrectionDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  attendanceRecordId?: string | null;

  @IsOptional()
  @DateKey()
  workDate?: string;

  @IsIn(["CLOCK_IN", "CLOCK_OUT", "BOTH"])
  type!: "CLOCK_IN" | "CLOCK_OUT" | "BOTH";

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "requestedClockIn must use HH:mm" })
  requestedClockIn?: string | null;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "requestedClockOut must use HH:mm" })
  requestedClockOut?: string | null;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class ListCorrectionsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(["PENDING", "APPROVED", "REJECTED", "CANCELLED"])
  status?: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @DateKey()
  from?: string;

  @IsOptional()
  @DateKey()
  to?: string;
}

export class ReviewCorrectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNotes?: string | null;
}

export class CancelCorrectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class AttendanceIdParamDto {
  @IsUUID()
  id!: string;
}

export class AttendanceExportQueryDto extends ListAttendanceQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
