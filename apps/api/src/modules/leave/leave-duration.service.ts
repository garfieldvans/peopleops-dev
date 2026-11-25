import { BadRequestException, Injectable } from "@nestjs/common";
import { addDays, leavePeriodForDate, roundAmount } from "@peopleops/leave-engine";
import { dateKeyOf } from "../../common/time/zoned-time";
import type {
  LeaveRequestMode,
  LeaveRequestPreview,
  LeaveRequestPreviewDay,
} from "@peopleops/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { AttendanceService } from "../attendance/attendance.service";
import type { LeavePreviewDto } from "./dto/leave.dto";
import { LeaveEntitlementService, type ResolvedPeriod } from "./leave-entitlement.service";

export interface LeavePreviewInternal {
  preview: LeaveRequestPreview;
  resolved: ResolvedPeriod;
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    preferredName: string | null;
    branchId: string | null;
    joinDate: Date;
  };
}

function addMonths(date: Date, months: number): Date {
  const value = new Date(date.getTime());
  value.setUTCMonth(value.getUTCMonth() + months);
  return value;
}

@Injectable()
export class LeaveDurationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
    private readonly entitlement: LeaveEntitlementService,
  ) {}

  async preview(employeeId: string, dto: LeavePreviewDto): Promise<LeavePreviewInternal> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        branchId: true,
        joinDate: true,
      },
    });
    if (!employee) {
      throw new BadRequestException({
        code: "EMPLOYEE_NOT_FOUND",
        message: "Employee not found",
      });
    }
    if (dto.startDate > dto.endDate) {
      throw new BadRequestException({
        code: "INVALID_LEAVE_RANGE",
        message: "The leave start date must not be after the end date",
      });
    }
    const mode: LeaveRequestMode = dto.requestMode ?? "FULL_DAY";
    if (mode === "HOURLY") {
      throw new BadRequestException({
        code: "HOURLY_LEAVE_NOT_SUPPORTED",
        message: "Hourly leave is not supported in Phase 5",
      });
    }
    if (mode === "HALF_DAY") {
      if (dto.startDate !== dto.endDate) {
        throw new BadRequestException({
          code: "HALF_DAY_SINGLE_DATE_REQUIRED",
          message: "A half-day request must start and end on the same date",
        });
      }
      if (!dto.halfDayPeriod) {
        throw new BadRequestException({
          code: "HALF_DAY_PERIOD_REQUIRED",
          message: "Choose the first or second half of the working day",
        });
      }
    }

    const resolved = await this.entitlement.resolvePeriod(
      employeeId,
      dto.leaveTypeId,
      dto.startDate,
    );
    if (!resolved) {
      throw new BadRequestException({
        code: "NO_LEAVE_POLICY",
        message: "You do not have an active policy for this leave type",
      });
    }
    const timezone = await this.attendance.getCompanyTimezone();
    const today = dateKeyOf(new Date(), timezone);
    if (dto.startDate < today && !resolved.leaveType.allowPastDates) {
      throw new BadRequestException({
        code: "PAST_LEAVE_NOT_ALLOWED",
        message: "This leave type does not allow requests for past dates",
      });
    }
    if (dto.endDate > today && !resolved.leaveType.allowFutureDates) {
      throw new BadRequestException({
        code: "FUTURE_LEAVE_NOT_ALLOWED",
        message: "This leave type does not allow requests for future dates",
      });
    }
    if (resolved.policy.minAdvanceNoticeDays > 0) {
      const earliest = addDays(today, resolved.policy.minAdvanceNoticeDays);
      if (dto.startDate < earliest) {
        throw new BadRequestException({
          code: "LEAVE_ADVANCE_NOTICE_REQUIRED",
          message: `This policy requires ${resolved.policy.minAdvanceNoticeDays} day(s) advance notice`,
          details: { earliestStartDate: earliest },
        });
      }
    }
    if (resolved.policy.eligibilityMonths > 0) {
      const eligibleFrom = addMonths(employee.joinDate, resolved.policy.eligibilityMonths)
        .toISOString()
        .slice(0, 10);
      if (dto.startDate < eligibleFrom) {
        throw new BadRequestException({
          code: "LEAVE_NOT_ELIGIBLE",
          message: `The employee becomes eligible on ${eligibleFrom}`,
        });
      }
    }
    if (
      mode === "HALF_DAY" &&
      (!resolved.leaveType.allowHalfDay || !resolved.policy.allowHalfDay)
    ) {
      throw new BadRequestException({
        code: "HALF_DAY_NOT_ALLOWED",
        message: "This leave type or policy does not allow half-day requests",
      });
    }

    const periodWindow = leavePeriodForDate(dto.startDate, resolved.policy.leaveYearStartMonth);
    if (dto.endDate > periodWindow.end) {
      throw new BadRequestException({
        code: "LEAVE_SPANS_MULTIPLE_PERIODS",
        message: "A leave request must stay within one leave period; split the request instead",
        details: { periodEnd: periodWindow.end },
      });
    }

    const days: LeaveRequestPreviewDay[] = [];
    let cursor = dto.startDate;
    let total = 0;
    while (cursor <= dto.endDate) {
      const schedule = await this.attendance.resolveScheduleForEmployee(
        employeeId,
        cursor,
        timezone,
      );
      const holiday = await this.attendance.findHoliday(cursor, employee.branchId);
      const isWorkingDay = Boolean(schedule) && !holiday;
      const duration = isWorkingDay ? (mode === "HALF_DAY" ? 0.5 : 1) : 0;
      total = roundAmount(total + duration);
      days.push({
        date: cursor,
        duration,
        isWorkingDay,
        halfDayPeriod: isWorkingDay && mode === "HALF_DAY" ? dto.halfDayPeriod! : null,
      });
      cursor = addDays(cursor, 1);
    }

    if (total <= 0) {
      throw new BadRequestException({
        code: "NO_WORKING_DAYS",
        message: "The selected range contains no working days",
      });
    }
    if (
      resolved.policy.minRequestDuration !== null &&
      total < Number(resolved.policy.minRequestDuration)
    ) {
      throw new BadRequestException({
        code: "LEAVE_DURATION_BELOW_MINIMUM",
        message: `The request must be at least ${Number(resolved.policy.minRequestDuration)} day(s)`,
      });
    }
    if (
      resolved.policy.maxRequestDuration !== null &&
      total > Number(resolved.policy.maxRequestDuration)
    ) {
      throw new BadRequestException({
        code: "LEAVE_DURATION_ABOVE_MAXIMUM",
        message: `The request must not exceed ${Number(resolved.policy.maxRequestDuration)} day(s)`,
      });
    }

    const balance = resolved.leaveType.requiresBalance
      ? await this.entitlement.getBalance(employeeId, dto.leaveTypeId, dto.startDate)
      : null;
    return {
      employee,
      resolved,
      preview: {
        startDate: dto.startDate,
        endDate: dto.endDate,
        duration: total,
        durationUnit: resolved.period.entitlementUnit,
        requestMode: mode,
        halfDayPeriod: mode === "HALF_DAY" ? dto.halfDayPeriod! : null,
        days,
        balance,
        estimatedRemaining: balance ? roundAmount(balance.available - total) : null,
        requiresAttachment: resolved.leaveType.requiresAttachment,
      },
    };
  }
}
