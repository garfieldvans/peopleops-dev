import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import {
  PERMISSIONS,
  type AttendanceCalendar,
  type AttendanceCalendarDay,
  type AttendanceDashboard,
  type AttendanceOverview,
  type AttendanceRecord,
  type PaginatedResponse,
} from "@peopleops/shared-types";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { toPageMeta } from "../../common/dto/page-query.dto";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
  addDaysToDateKey,
  dateKeyOf,
  daysInMonth,
  isoWeekday,
  localDateTimeOf,
  monthKeyOf,
} from "../../common/time/zoned-time";
import { EmployeesService, type EmployeeScope } from "../employee/employees.service";
import { LeaveIntegrationService } from "../leave/leave-integration.service";
import { calculateAttendance } from "./attendance-calculation";
import {
  attendanceInclude,
  displayName,
  toAttendanceRecord,
} from "./attendance.mapper";
import {
  buildResolvedSchedule,
  type ResolvedSchedule,
} from "./attendance-schedule";
import type {
  AttendanceCalendarQueryDto,
  AttendanceExportQueryDto,
  ListAttendanceQueryDto,
  ManualAttendanceDto,
  MyAttendanceQueryDto,
  OverviewQueryDto,
} from "./dto/attendance.dto";

export interface AttendanceActor {
  actorUserId: string;
  actorEmail: string;
  meta: RequestMeta;
}

const scheduleAssignmentInclude = {
  workSchedule: { include: { days: true } },
  shift: true,
} satisfies Prisma.EmployeeScheduleAssignmentInclude;

type ScheduleAssignmentRow = Prisma.EmployeeScheduleAssignmentGetPayload<{
  include: typeof scheduleAssignmentInclude;
}>;

interface LinkedEmployee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  branchId: string | null;
  employmentStatus: string;
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly employees: EmployeesService,
    private readonly leaveIntegration: LeaveIntegrationService,
  ) {}

  async getCompanyTimezone(): Promise<string> {
    const company = await this.prisma.company.findFirst({ select: { timezone: true } });
    return company?.timezone ?? "Asia/Jakarta";
  }

  async getLinkedEmployee(userId: string): Promise<LinkedEmployee> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        branchId: true,
        employmentStatus: true,
      },
    });
    if (!employee) {
      throw new NotFoundException({
        code: "EMPLOYEE_NOT_LINKED",
        message: "No employee record is linked to this account",
      });
    }
    return employee;
  }

  async getScope(user: AuthenticatedUser): Promise<EmployeeScope> {
    const permissions = new Set(user.permissions);
    const scope = await this.employees.resolveScope(user);
    return {
      readAll:
        permissions.has(PERMISSIONS.ATTENDANCE_READ_ALL) || scope.readAll,
      readTeam:
        permissions.has(PERMISSIONS.ATTENDANCE_READ_TEAM) || scope.readTeam,
      employeeId: scope.employeeId,
    };
  }

  async resolveScheduleForEmployee(
    employeeId: string,
    workDate: string,
    timezone?: string,
  ): Promise<ResolvedSchedule | null> {
    const tz = timezone ?? (await this.getCompanyTimezone());
    const assignment = await this.findAssignment(employeeId, workDate);
    return assignment ? buildResolvedSchedule(assignment, workDate, tz) : null;
  }

  async findHoliday(
    workDate: string,
    branchId: string | null,
  ): Promise<{ id: string; name: string; type: "NATIONAL" | "COMPANY" | "BRANCH" } | null> {
    const date = dateOnly(workDate);
    const rows = await this.prisma.holiday.findMany({
      where: {
        date,
        status: "ACTIVE",
        OR: branchId ? [{ branchId: null }, { branchId }] : [{ branchId: null }],
      },
      select: { id: true, name: true, type: true, branchId: true },
    });
    return rows.find((row) => row.branchId === branchId) ?? rows[0] ?? null;
  }

  async getAccessibleEmployeeIds(
    user: AuthenticatedUser,
  ): Promise<string[] | null> {
    const scope = await this.getScope(user);
    if (scope.readAll) return null;
    if (scope.readTeam) return this.employees.scopedEmployeeIds(scope);
    return scope.employeeId ? [scope.employeeId] : [];
  }

  async assertEmployeeAccess(employeeId: string, user: AuthenticatedUser): Promise<void> {
    const scope = await this.getScope(user);
    if (scope.readAll || scope.employeeId === employeeId) return;
    if (scope.readTeam) {
      const ids = await this.employees.scopedEmployeeIds(scope);
      if (ids.includes(employeeId)) return;
    }
    throw new ForbiddenException({
      code: "ATTENDANCE_OUT_OF_SCOPE",
      message: "You can only access attendance inside your reporting line",
    });
  }

  async clockIn(user: AuthenticatedUser, actor: AttendanceActor): Promise<AttendanceRecord> {
    const employee = await this.getLinkedEmployee(user.id);
    this.assertEmployeeActive(employee);
    const timezone = await this.getCompanyTimezone();
    const now = new Date();
    const schedule = await this.resolveClockSchedule(employee.id, now, timezone);

    if (!schedule) {
      throw new BadRequestException({
        code: "NO_SCHEDULE_TODAY",
        message: "There is no working schedule for this employee today",
      });
    }

    let recordId: string;
    try {
      recordId = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.attendanceRecord.findUnique({
          where: {
            employeeId_workDate: {
              employeeId: employee.id,
              workDate: dateOnly(schedule.workDate),
            },
          },
        });
        if (existing) {
          throw new ConflictException({
            code: "ALREADY_CLOCKED_IN",
            message: "Attendance for this work date already exists",
          });
        }

        const open = await tx.attendanceRecord.findFirst({
          where: { employeeId: employee.id, clockInAt: { not: null }, clockOutAt: null },
          select: { id: true },
        });
        if (open) {
          throw new ConflictException({
            code: "OPEN_ATTENDANCE_EXISTS",
            message: "Finish the previous open attendance session before clocking in",
          });
        }

        const created = await tx.attendanceRecord.create({
          data: {
            employeeId: employee.id,
            scheduleAssignmentId: schedule.assignmentId,
            workScheduleId: schedule.workSchedule.id,
            shiftId: schedule.shift?.id ?? null,
            workDate: dateOnly(schedule.workDate),
            timezone,
            scheduledStartAt: schedule.scheduledStartAt,
            scheduledEndAt: schedule.scheduledEndAt,
            expectedBreakMinutes: schedule.expectedBreakMinutes,
            graceLateMinutes: schedule.graceLateMinutes,
            graceEarlyMinutes: schedule.graceEarlyMinutes,
            clockInAt: now,
            status: "INCOMPLETE",
          },
          select: { id: true },
        });
        return created.id;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "ALREADY_CLOCKED_IN",
          message: "Attendance for this work date already exists",
        });
      }
      throw error;
    }

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "attendance.clocked_in",
      entityType: "attendance_record",
      entityId: recordId,
      metadata: { workDate: schedule.workDate, employeeId: employee.id },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return this.findRecordById(recordId);
  }

  async clockOut(user: AuthenticatedUser, actor: AttendanceActor): Promise<AttendanceRecord> {
    const employee = await this.getLinkedEmployee(user.id);
    const now = new Date();

    const record = await this.prisma.attendanceRecord.findFirst({
      where: { employeeId: employee.id, clockInAt: { not: null }, clockOutAt: null },
      orderBy: { workDate: "desc" },
    });
    if (!record) {
      const today = dateKeyOf(now, await this.getCompanyTimezone());
      const closedToday = await this.prisma.attendanceRecord.findUnique({
        where: {
          employeeId_workDate: { employeeId: employee.id, workDate: dateOnly(today) },
        },
        select: { clockOutAt: true },
      });
      throw new ConflictException({
        code: closedToday?.clockOutAt ? "ALREADY_CLOCKED_OUT" : "NO_OPEN_ATTENDANCE",
        message: closedToday?.clockOutAt
          ? "Attendance for today is already completed"
          : "There is no open attendance session to clock out from",
      });
    }

    if (now <= record.clockInAt!) {
      throw new BadRequestException({
        code: "INVALID_CLOCK_OUT",
        message: "Clock-out must be later than clock-in",
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.attendanceRecord.updateMany({
        where: { id: record.id, clockOutAt: null },
        data: { clockOutAt: now },
      });
      if (claimed.count === 0) {
        throw new ConflictException({
          code: "ALREADY_CLOCKED_OUT",
          message: "Attendance for today is already completed",
        });
      }
      await tx.attendanceBreak.updateMany({
        where: { attendanceRecordId: record.id, endedAt: null },
        data: { endedAt: now },
      });
      await this.recalculateRecord(tx, record.id);
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "attendance.clocked_out",
      entityType: "attendance_record",
      entityId: record.id,
      metadata: { workDate: dateKey(record.workDate) },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return this.findRecordById(record.id);
  }

  async startBreak(user: AuthenticatedUser, actor: AttendanceActor): Promise<AttendanceRecord> {
    const employee = await this.getLinkedEmployee(user.id);
    const now = new Date();
    const record = await this.prisma.attendanceRecord.findFirst({
      where: { employeeId: employee.id, clockInAt: { not: null }, clockOutAt: null },
      orderBy: { workDate: "desc" },
      include: { breaks: true },
    });
    if (!record) {
      throw new ConflictException({
        code: "NO_OPEN_ATTENDANCE",
        message: "Clock in before starting a break",
      });
    }
    if (record.breaks.some((entry) => !entry.endedAt)) {
      throw new ConflictException({
        code: "BREAK_ALREADY_ACTIVE",
        message: "A break is already running",
      });
    }

    try {
      await this.prisma.attendanceBreak.create({
        data: {
          attendanceRecordId: record.id,
          startedAt: now,
          createdById: actor.actorUserId,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "BREAK_ALREADY_ACTIVE",
          message: "A break is already running",
        });
      }
      throw error;
    }

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "attendance.break_started",
      entityType: "attendance_record",
      entityId: record.id,
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return this.findRecordById(record.id);
  }

  async endBreak(user: AuthenticatedUser, actor: AttendanceActor): Promise<AttendanceRecord> {
    const employee = await this.getLinkedEmployee(user.id);
    const now = new Date();
    const record = await this.prisma.attendanceRecord.findFirst({
      where: { employeeId: employee.id, clockInAt: { not: null }, clockOutAt: null },
      orderBy: { workDate: "desc" },
      include: { breaks: true },
    });
    if (!record) {
      throw new ConflictException({
        code: "NO_OPEN_ATTENDANCE",
        message: "There is no open attendance session",
      });
    }
    const openBreak = record.breaks.find((entry) => !entry.endedAt);
    if (!openBreak) {
      throw new ConflictException({
        code: "NO_ACTIVE_BREAK",
        message: "There is no active break to end",
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const ended = await tx.attendanceBreak.updateMany({
        where: { id: openBreak.id, endedAt: null },
        data: { endedAt: now },
      });
      if (ended.count === 0) {
        throw new ConflictException({
          code: "NO_ACTIVE_BREAK",
          message: "There is no active break to end",
        });
      }
      const breaks = await tx.attendanceBreak.findMany({
        where: { attendanceRecordId: record.id },
      });
      const taken = breaks.reduce(
        (total, entry) =>
          total +
          (entry.endedAt ? Math.max(0, entry.endedAt.getTime() - entry.startedAt.getTime()) : 0),
        0,
      );
      await tx.attendanceRecord.update({
        where: { id: record.id },
        data: { breakMinutesTaken: Math.trunc(taken / 60_000) },
      });
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "attendance.break_ended",
      entityType: "attendance_record",
      entityId: record.id,
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return this.findRecordById(record.id);
  }

  async list(
    query: ListAttendanceQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<AttendanceRecord>> {
    const scope = await this.getScope(user);
    if (!scope.readAll && !scope.readTeam && !scope.employeeId) return this.emptyPage(query);
    if (query.employeeId && !scope.readAll) {
      await this.assertEmployeeAccess(query.employeeId, user);
    }

    const ids = await this.getAccessibleEmployeeIds(user);
    const where = this.buildWhere(query, ids);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.attendanceRecord.count({ where }),
      this.prisma.attendanceRecord.findMany({
        where,
        include: attendanceInclude,
        orderBy: this.orderBy(query),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const meta = toPageMeta(query.page, query.pageSize, total);
    return { items: rows.map(toAttendanceRecord), ...meta };
  }

  async listMine(
    query: MyAttendanceQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<AttendanceRecord>> {
    const employee = await this.getLinkedEmployee(user.id);
    return this.list(
      { ...query, employeeId: employee.id },
      { ...user, permissions: [...user.permissions, PERMISSIONS.ATTENDANCE_READ] },
    );
  }

  async listForEmployee(
    employeeId: string,
    query: MyAttendanceQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<AttendanceRecord>> {
    await this.employees.assertCanReadEmployee(employeeId, user);
    await this.assertEmployeeAccess(employeeId, {
      ...user,
      permissions: [...user.permissions, PERMISSIONS.ATTENDANCE_READ],
    });
    return this.list({ ...query, employeeId }, {
      ...user,
      permissions: [...user.permissions, PERMISSIONS.ATTENDANCE_READ],
    });
  }

  async getById(id: string, user: AuthenticatedUser): Promise<AttendanceRecord> {
    const row = await this.prisma.attendanceRecord.findUnique({
      where: { id },
      include: attendanceInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: "ATTENDANCE_NOT_FOUND",
        message: "Attendance record not found",
      });
    }
    await this.assertEmployeeAccess(row.employeeId, user);
    return toAttendanceRecord(row);
  }

  async updateManual(
    id: string,
    dto: ManualAttendanceDto,
    actor: AttendanceActor,
  ): Promise<AttendanceRecord> {
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { id },
      include: { breaks: true },
    });
    if (!record) {
      throw new NotFoundException({
        code: "ATTENDANCE_NOT_FOUND",
        message: "Attendance record not found",
      });
    }

    const clockInAt =
      dto.clockInAt === undefined
        ? record.clockInAt
        : dto.clockInAt
          ? new Date(dto.clockInAt)
          : null;
    const clockOutAt =
      dto.clockOutAt === undefined
        ? record.clockOutAt
        : dto.clockOutAt
          ? new Date(dto.clockOutAt)
          : null;

    if (clockInAt && Number.isNaN(clockInAt.getTime())) {
      throw new BadRequestException({ code: "INVALID_CLOCK_IN", message: "Invalid clock-in" });
    }
    if (clockOutAt && Number.isNaN(clockOutAt.getTime())) {
      throw new BadRequestException({ code: "INVALID_CLOCK_OUT", message: "Invalid clock-out" });
    }
    if (clockInAt && clockOutAt && clockOutAt <= clockInAt) {
      throw new BadRequestException({
        code: "INVALID_ATTENDANCE_RANGE",
        message: "Clock-out must be later than clock-in",
      });
    }

    const result = calculateAttendance({
      scheduledStartAt: record.scheduledStartAt,
      scheduledEndAt: record.scheduledEndAt,
      clockInAt,
      clockOutAt,
      graceLateMinutes: record.graceLateMinutes,
      graceEarlyMinutes: record.graceEarlyMinutes,
      expectedBreakMinutes: record.expectedBreakMinutes,
      breaks: record.breaks.filter((entry) => entry.endedAt),
    });

    const row = await this.prisma.$transaction(async (tx) => {
      if (clockOutAt) {
        await tx.attendanceBreak.updateMany({
          where: { attendanceRecordId: record.id, endedAt: null },
          data: { endedAt: clockOutAt },
        });
      }
      return tx.attendanceRecord.update({
        where: { id },
        data: {
          clockInAt,
          clockOutAt,
          status: result.status,
          lateMinutes: result.lateMinutes,
          earlyLeaveMinutes: result.earlyLeaveMinutes,
          workedMinutes: result.workedMinutes,
          breakMinutesTaken: result.breakMinutesTaken,
          isCorrected: true,
        },
        include: attendanceInclude,
      });
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "attendance.manually_updated",
      entityType: "attendance_record",
      entityId: id,
      metadata: {
        reason: dto.reason,
        clockInAt: clockInAt?.toISOString() ?? null,
        clockOutAt: clockOutAt?.toISOString() ?? null,
      },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toAttendanceRecord(row);
  }

  async dashboard(user: AuthenticatedUser): Promise<AttendanceDashboard> {
    const employee = await this.getLinkedEmployee(user.id);
    const timezone = await this.getCompanyTimezone();
    const now = new Date();
    const today = dateKeyOf(now, timezone);
    const record = await this.prisma.attendanceRecord.findUnique({
      where: {
        employeeId_workDate: { employeeId: employee.id, workDate: dateOnly(today) },
      },
      include: attendanceInclude,
    });

    const holiday = await this.findHoliday(today, employee.branchId);
    const resolved = record
      ? null
      : await this.resolveClockSchedule(employee.id, now, timezone);
    const [pendingCorrections, leave] = await Promise.all([
      this.prisma.attendanceCorrection.count({
        where: { employeeId: employee.id, status: "PENDING" },
      }),
      this.leaveIntegration.approvedDay(employee.id, today),
    ]);

    let state: AttendanceDashboard["state"];
    if (record?.clockOutAt) state = "CLOCKED_OUT";
    else if (record?.clockInAt && record.breaks.some((entry) => !entry.endedAt)) {
      state = "ON_BREAK";
    } else if (record?.clockInAt) state = "WORKING";
    else if (holiday) state = "HOLIDAY";
    else if (leave) state = "ON_LEAVE";
    else if (!resolved) state = "DAY_OFF";
    else state = "NOT_CLOCKED_IN";

    const mappedRecord = record ? toAttendanceRecord(record) : null;
    const schedule = mappedRecord
      ? {
          workSchedule: mappedRecord.workSchedule!,
          shift: mappedRecord.shift,
          scheduledStartLocal: mappedRecord.scheduledStartLocal,
          scheduledEndLocal: mappedRecord.scheduledEndLocal,
        }
      : resolved
        ? {
            workSchedule: resolved.workSchedule,
            shift: resolved.shift,
            scheduledStartLocal: localDateTimeOf(resolved.scheduledStartAt, timezone),
            scheduledEndLocal: localDateTimeOf(resolved.scheduledEndAt, timezone),
          }
        : null;

    return {
      date: today,
      timezone,
      employee: {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        fullName: displayName(employee),
      },
      state,
      schedule,
      holiday,
      leave: leave
        ? {
            requestId: leave.requestId,
            leaveType: leave.leaveType,
            duration: leave.duration,
            requestMode: leave.requestMode,
            halfDayPeriod: leave.halfDayPeriod,
          }
        : null,
      record: mappedRecord,
      pendingCorrections,
    };
  }

  async overview(query: OverviewQueryDto): Promise<AttendanceOverview> {
    const timezone = await this.getCompanyTimezone();
    const workDate = query.date ?? dateKeyOf(new Date(), timezone);
    const dateStart = dateOnly(workDate);

    const employees = await this.prisma.employee.findMany({
      where: { employmentStatus: { in: ["ACTIVE", "PROBATION"] } },
      select: { id: true, branchId: true },
    });
    const employeeIds = employees.map((employee) => employee.id);

    const [assignments, records, holidays, pendingCorrections, leaveByEmployee] = await Promise.all([
      this.prisma.employeeScheduleAssignment.findMany({
        where: {
          employeeId: { in: employeeIds },
          effectiveFrom: { lte: dateStart },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: dateStart } }],
        },
        include: scheduleAssignmentInclude,
        orderBy: { effectiveFrom: "desc" },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { workDate: dateStart, employeeId: { in: employeeIds } },
        select: {
          employeeId: true,
          clockInAt: true,
          status: true,
          workScheduleId: true,
        },
      }),
      this.prisma.holiday.findMany({
        where: { date: dateStart, status: "ACTIVE" },
        select: { id: true, branchId: true },
      }),
      this.prisma.attendanceCorrection.count({
        where: {
          status: "PENDING",
          workDate: { lte: dateStart },
          employeeId: { in: employeeIds },
        },
      }),
      this.leaveIntegration.approvedDaysForEmployees(employeeIds, workDate),
    ]);

    const recordedIds = new Set(records.map((record) => record.employeeId));
    const isPast = workDate < dateKeyOf(new Date(), timezone);
    let scheduledEmployees = 0;
    let absent = 0;
    for (const employee of employees) {
      const assignment = assignments.find((row) => row.employeeId === employee.id);
      if (!assignment) continue;
      const schedule = buildResolvedSchedule(assignment, workDate, timezone);
      if (!schedule) continue;
      scheduledEmployees += 1;
      if (!isPast || recordedIds.has(employee.id)) continue;
      const holiday = holidays.some(
        (entry) => entry.branchId === null || entry.branchId === employee.branchId,
      );
      if (!holiday && !leaveByEmployee.has(employee.id)) absent += 1;
    }

    const present = records.filter((record) => record.clockInAt !== null).length;
    const late = records.filter(
      (record) => record.status === "LATE" || record.status === "LATE_AND_EARLY_LEAVE",
    ).length;
    const incomplete = records.filter((record) => record.status === "INCOMPLETE").length;

    return {
      date: workDate,
      timezone,
      scheduledEmployees,
      present,
      late,
      absent,
      onLeave: leaveByEmployee.size,
      incomplete,
      pendingCorrections,
    };
  }

  async calendarForEmployee(
    employeeId: string,
    query: AttendanceCalendarQueryDto,
    user: AuthenticatedUser,
  ): Promise<AttendanceCalendar> {
    await this.employees.assertCanReadEmployee(employeeId, user);
    await this.assertEmployeeAccess(employeeId, user);
    return this.buildCalendar(employeeId, query.month);
  }

  async myCalendar(
    query: AttendanceCalendarQueryDto,
    user: AuthenticatedUser,
  ): Promise<AttendanceCalendar> {
    const employee = await this.getLinkedEmployee(user.id);
    return this.buildCalendar(employee.id, query.month);
  }

  async exportCsv(
    query: AttendanceExportQueryDto,
    user: AuthenticatedUser,
  ): Promise<string> {
    const scope = await this.getScope(user);
    if (!scope.readAll && !scope.readTeam) {
      throw new ForbiddenException({
        code: "ATTENDANCE_EXPORT_FORBIDDEN",
        message: "Attendance export requires organisation-wide or team access",
      });
    }
    const ids = await this.getAccessibleEmployeeIds(user);
    const where = this.buildWhere(query, ids);
    const rows = await this.prisma.attendanceRecord.findMany({
      where,
      include: attendanceInclude,
      orderBy: this.orderBy(query),
      take: 5000,
    });

    const header = [
      "employee_number",
      "employee_name",
      "branch",
      "department",
      "work_date",
      "schedule",
      "shift",
      "scheduled_start_local",
      "scheduled_end_local",
      "clock_in_local",
      "clock_out_local",
      "status",
      "late_minutes",
      "early_leave_minutes",
      "worked_minutes",
      "break_minutes",
    ];
    const lines = rows.map((row) => {
      const record = toAttendanceRecord(row);
      return [
        record.employeeNumber,
        record.employeeName,
        record.branch?.name ?? "",
        record.department?.name ?? "",
        record.workDate,
        record.workSchedule?.name ?? "",
        record.shift?.name ?? "",
        record.scheduledStartLocal,
        record.scheduledEndLocal,
        record.clockInLocal ?? "",
        record.clockOutLocal ?? "",
        record.status,
        String(record.lateMinutes),
        String(record.earlyLeaveMinutes),
        String(record.workedMinutes),
        String(record.breakMinutesTaken),
      ]
        .map(this.csvCell)
        .join(",");
    });

    return `\uFEFF${[header.join(","), ...lines].join("\r\n")}`;
  }

  private async buildCalendar(
    employeeId: string,
    month: string,
  ): Promise<AttendanceCalendar> {
    const timezone = await this.getCompanyTimezone();
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { branchId: true },
    });
    const days = daysInMonth(`${month}-01`);
    const firstDay = days[0];
    const lastDay = days[days.length - 1];
    if (!firstDay || !lastDay) {
      return {
        month,
        timezone,
        days: [],
        summary: { present: 0, late: 0, incomplete: 0, off: 0, holiday: 0, onLeave: 0 },
      };
    }
    const rangeStart = dateOnly(firstDay);
    const rangeEnd = dateOnly(lastDay);

    const [assignments, records, holidays, leaveDays] = await Promise.all([
      this.prisma.employeeScheduleAssignment.findMany({
        where: {
          employeeId,
          effectiveFrom: { lte: rangeEnd },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: rangeStart } }],
        },
        include: scheduleAssignmentInclude,
        orderBy: { effectiveFrom: "desc" },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { employeeId, workDate: { gte: rangeStart, lte: rangeEnd } },
        include: attendanceInclude,
      }),
      this.prisma.holiday.findMany({
        where: {
          date: { gte: rangeStart, lte: rangeEnd },
          status: "ACTIVE",
          OR: [{ branchId: null }, ...(employee?.branchId ? [{ branchId: employee.branchId }] : [])],
        },
        select: { id: true, name: true, type: true, date: true, branchId: true },
      }),
      this.leaveIntegration.approvedDays(employeeId, firstDay, lastDay),
    ]);

    const recordByDate = new Map(records.map((row) => [dateKey(row.workDate), row]));
    const leaveByDate = new Map(leaveDays.map((row) => [row.date, row]));
    const calendarDays: AttendanceCalendarDay[] = [];
    const summary = { present: 0, late: 0, incomplete: 0, off: 0, holiday: 0, onLeave: 0 };

    for (const day of days) {
      const holidayCandidates = holidays.filter((entry) => dateKey(entry.date) === day);
      const holiday =
        holidayCandidates.find((entry) => entry.branchId === employee?.branchId) ??
        holidayCandidates[0];
      const record = recordByDate.get(day) ?? null;
      const leave = leaveByDate.get(day) ?? null;
      const assignment = assignments.find(
        (row) =>
          dateKey(row.effectiveFrom) <= day &&
          (!row.effectiveTo || dateKey(row.effectiveTo) >= day),
      );
      const schedule = assignment ? buildResolvedSchedule(assignment, day, timezone) : null;

      let status: AttendanceCalendarDay["status"];
      if (record) {
        status = record.status;
        if (record.clockInAt) summary.present += 1;
        if (record.status === "LATE" || record.status === "LATE_AND_EARLY_LEAVE") {
          summary.late += 1;
        }
        if (record.status === "INCOMPLETE") summary.incomplete += 1;
      } else if (holiday) {
        status = "HOLIDAY";
        summary.holiday += 1;
      } else if (leave) {
        status = "ON_LEAVE";
        summary.onLeave += 1;
      } else if (!schedule) {
        status = "OFF";
        summary.off += 1;
      } else {
        status = "NO_RECORD";
      }

      calendarDays.push({
        date: day,
        dayOfWeek: isoWeekday(day),
        status,
        holiday: holiday
          ? { id: holiday.id, name: holiday.name, type: holiday.type }
          : null,
        leave: leave
          ? {
              requestId: leave.requestId,
              leaveType: leave.leaveType,
              duration: leave.duration,
              requestMode: leave.requestMode,
              halfDayPeriod: leave.halfDayPeriod,
            }
          : null,
        record: record ? toAttendanceRecord(record) : null,
      });
    }

    return {
      month: monthKeyOf(`${month}-01`),
      timezone,
      days: calendarDays,
      summary,
    };
  }

  private async resolveClockSchedule(
    employeeId: string,
    now: Date,
    timezone: string,
  ): Promise<ResolvedSchedule | null> {
    const today = dateKeyOf(now, timezone);
    const yesterday = addDaysToDateKey(today, -1);

    const previous = await this.resolveScheduleForEmployee(employeeId, yesterday, timezone);
    if (
      previous?.overnight &&
      now >= previous.scheduledStartAt &&
      now <= previous.scheduledEndAt
    ) {
      return previous;
    }

    return this.resolveScheduleForEmployee(employeeId, today, timezone);
  }

  private async findAssignment(
    employeeId: string,
    workDate: string,
  ): Promise<ScheduleAssignmentRow | null> {
    const date = dateOnly(workDate);
    return this.prisma.employeeScheduleAssignment.findFirst({
      where: {
        employeeId,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      include: scheduleAssignmentInclude,
      orderBy: { effectiveFrom: "desc" },
    });
  }

  private async findRecordById(id: string): Promise<AttendanceRecord> {
    const row = await this.prisma.attendanceRecord.findUnique({
      where: { id },
      include: attendanceInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: "ATTENDANCE_NOT_FOUND",
        message: "Attendance record not found",
      });
    }
    return toAttendanceRecord(row);
  }

  private async recalculateRecord(tx: Prisma.TransactionClient, id: string): Promise<void> {
    const record = await tx.attendanceRecord.findUnique({
      where: { id },
      include: { breaks: true },
    });
    if (!record) return;

    const result = calculateAttendance({
      scheduledStartAt: record.scheduledStartAt,
      scheduledEndAt: record.scheduledEndAt,
      clockInAt: record.clockInAt,
      clockOutAt: record.clockOutAt,
      graceLateMinutes: record.graceLateMinutes,
      graceEarlyMinutes: record.graceEarlyMinutes,
      expectedBreakMinutes: record.expectedBreakMinutes,
      breaks: record.breaks.filter((entry) => entry.endedAt),
    });

    await tx.attendanceRecord.update({
      where: { id },
      data: {
        status: result.status,
        lateMinutes: result.lateMinutes,
        earlyLeaveMinutes: result.earlyLeaveMinutes,
        workedMinutes: result.workedMinutes,
        breakMinutesTaken: result.breakMinutesTaken,
      },
    });
  }

  private buildWhere(
    query: ListAttendanceQueryDto,
    employeeIds: string[] | null,
  ): Prisma.AttendanceRecordWhereInput {
    return {
      ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            workDate: {
              ...(query.from ? { gte: dateOnly(query.from) } : {}),
              ...(query.to ? { lte: dateOnly(query.to) } : {}),
            },
          }
        : {}),
      ...(query.branchId || query.departmentId
        ? {
            employee: {
              ...(query.branchId ? { branchId: query.branchId } : {}),
              ...(query.departmentId ? { departmentId: query.departmentId } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            employee: {
              ...(query.branchId ? { branchId: query.branchId } : {}),
              ...(query.departmentId ? { departmentId: query.departmentId } : {}),
              OR: [
                { employeeNumber: { contains: query.search, mode: "insensitive" } },
                { firstName: { contains: query.search, mode: "insensitive" } },
                { lastName: { contains: query.search, mode: "insensitive" } },
                { preferredName: { contains: query.search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };
  }

  private orderBy(
    query: ListAttendanceQueryDto,
  ): Prisma.AttendanceRecordOrderByWithRelationInput[] {
    const dir = query.sortDir ?? "desc";
    if (query.sortBy === "employeeName") {
      return [{ employee: { firstName: dir } }, { workDate: dir }];
    }
    if (query.sortBy === "status") {
      return [{ status: dir }, { workDate: "desc" }];
    }
    return [{ workDate: dir }, { employee: { firstName: "asc" } }];
  }

  private emptyPage(
    query: ListAttendanceQueryDto,
  ): PaginatedResponse<AttendanceRecord> {
    return {
      items: [],
      page: query.page,
      pageSize: query.pageSize,
      total: 0,
      totalPages: 0,
    };
  }

  private assertEmployeeActive(employee: LinkedEmployee): void {
    if (employee.employmentStatus !== "ACTIVE" && employee.employmentStatus !== "PROBATION") {
      throw new ForbiddenException({
        code: "EMPLOYEE_INACTIVE",
        message: "Inactive employees cannot record attendance",
      });
    }
  }

  private csvCell(value: string): string {
    return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }
}
