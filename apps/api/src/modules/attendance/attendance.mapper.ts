import { Prisma } from "@peopleops/database";
import type {
  AttendanceBreak,
  AttendanceCorrection,
  AttendanceRecord,
  EmployeeScheduleAssignment,
  Holiday,
  Shift,
  WorkSchedule,
} from "@peopleops/shared-types";
import { localDateTimeOf } from "../../common/time/zoned-time";

export const workScheduleInclude = {
  days: { orderBy: { dayOfWeek: "asc" } },
  _count: { select: { assignments: true } },
} satisfies Prisma.WorkScheduleInclude;

export type WorkScheduleRow = Prisma.WorkScheduleGetPayload<{
  include: typeof workScheduleInclude;
}>;

export const shiftInclude = {
  _count: { select: { assignments: true } },
} satisfies Prisma.ShiftInclude;

export type ShiftRow = Prisma.ShiftGetPayload<{ include: typeof shiftInclude }>;

export const assignmentInclude = {
  employee: {
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      preferredName: true,
    },
  },
  workSchedule: { select: { id: true, name: true, code: true } },
  shift: { select: { id: true, name: true, code: true } },
} satisfies Prisma.EmployeeScheduleAssignmentInclude;

export type AssignmentRow = Prisma.EmployeeScheduleAssignmentGetPayload<{
  include: typeof assignmentInclude;
}>;

export const holidayInclude = {
  branch: { select: { id: true, name: true } },
} satisfies Prisma.HolidayInclude;

export type HolidayRow = Prisma.HolidayGetPayload<{ include: typeof holidayInclude }>;

export const attendanceInclude = {
  employee: {
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      branch: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      position: { select: { id: true, title: true } },
    },
  },
  workSchedule: { select: { id: true, name: true, code: true } },
  shift: { select: { id: true, name: true, code: true } },
  breaks: { orderBy: { startedAt: "asc" } },
  corrections: {
    where: { status: "PENDING" },
    select: { id: true },
  },
} satisfies Prisma.AttendanceRecordInclude;

export type AttendanceRow = Prisma.AttendanceRecordGetPayload<{
  include: typeof attendanceInclude;
}>;

export const correctionInclude = {
  employee: {
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      preferredName: true,
    },
  },
  attendance: { select: { timezone: true } },
  reviewer: { select: { id: true, name: true } },
} satisfies Prisma.AttendanceCorrectionInclude;

export type CorrectionRow = Prisma.AttendanceCorrectionGetPayload<{
  include: typeof correctionInclude;
}>;

export function displayName(row: {
  firstName: string;
  lastName: string;
  preferredName: string | null;
}): string {
  return row.preferredName?.trim() || `${row.firstName} ${row.lastName}`.trim();
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toWorkSchedule(row: WorkScheduleRow): WorkSchedule {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    graceLateMinutes: row.graceLateMinutes,
    graceEarlyMinutes: row.graceEarlyMinutes,
    status: row.status,
    days: row.days.map((day) => ({
      id: day.id,
      dayOfWeek: day.dayOfWeek,
      isWorkingDay: day.isWorkingDay,
      startTime: day.startTime,
      endTime: day.endTime,
      breakMinutes: day.breakMinutes,
    })),
    assignmentCount: row._count.assignments,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toShift(row: ShiftRow): Shift {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    startTime: row.startTime,
    endTime: row.endTime,
    breakMinutes: row.breakMinutes,
    graceLateMinutes: row.graceLateMinutes,
    graceEarlyMinutes: row.graceEarlyMinutes,
    status: row.status,
    assignmentCount: row._count.assignments,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAssignment(row: AssignmentRow): EmployeeScheduleAssignment {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employee: {
      id: row.employee.id,
      employeeNumber: row.employee.employeeNumber,
      fullName: displayName(row.employee),
    },
    workSchedule: row.workSchedule,
    shift: row.shift,
    effectiveFrom: isoDate(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? isoDate(row.effectiveTo) : null,
    changeReason: row.changeReason,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toHoliday(row: HolidayRow): Holiday {
  return {
    id: row.id,
    name: row.name,
    date: isoDate(row.date),
    description: row.description,
    type: row.type,
    branchId: row.branchId,
    branch: row.branch,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAttendanceBreak(row: {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
}): AttendanceBreak {
  return {
    id: row.id,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    durationMinutes: row.endedAt
      ? Math.max(0, Math.trunc((row.endedAt.getTime() - row.startedAt.getTime()) / 60_000))
      : null,
  };
}

export function toAttendanceRecord(row: AttendanceRow): AttendanceRecord {
  const employee = row.employee;
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeNumber: employee.employeeNumber,
    employeeName: displayName(employee),
    branch: employee.branch,
    department: employee.department,
    position: employee.position
      ? { id: employee.position.id, name: employee.position.title }
      : null,
    workDate: isoDate(row.workDate),
    timezone: row.timezone,
    workSchedule: row.workSchedule,
    shift: row.shift,
    scheduledStartAt: row.scheduledStartAt.toISOString(),
    scheduledEndAt: row.scheduledEndAt.toISOString(),
    scheduledStartLocal: localDateTimeOf(row.scheduledStartAt, row.timezone),
    scheduledEndLocal: localDateTimeOf(row.scheduledEndAt, row.timezone),
    clockInAt: row.clockInAt?.toISOString() ?? null,
    clockOutAt: row.clockOutAt?.toISOString() ?? null,
    clockInLocal: row.clockInAt ? localDateTimeOf(row.clockInAt, row.timezone) : null,
    clockOutLocal: row.clockOutAt ? localDateTimeOf(row.clockOutAt, row.timezone) : null,
    expectedBreakMinutes: row.expectedBreakMinutes,
    graceLateMinutes: row.graceLateMinutes,
    graceEarlyMinutes: row.graceEarlyMinutes,
    status: row.status,
    lateMinutes: row.lateMinutes,
    earlyLeaveMinutes: row.earlyLeaveMinutes,
    workedMinutes: row.workedMinutes,
    breakMinutesTaken: row.breakMinutesTaken,
    isCorrected: row.isCorrected,
    hasPendingCorrection: row.corrections.length > 0,
    breaks: row.breaks.map(toAttendanceBreak),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCorrection(
  row: CorrectionRow,
  fallbackTimezone: string,
): AttendanceCorrection {
  const timezone = row.attendance?.timezone ?? fallbackTimezone;
  const local = (date: Date | null) =>
    date ? localDateTimeOf(date, timezone) : null;
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeNumber: row.employee.employeeNumber,
    employeeName: displayName(row.employee),
    attendanceRecordId: row.attendanceRecordId,
    workDate: isoDate(row.workDate),
    type: row.type,
    status: row.status,
    originalClockInLocal: local(row.originalClockInAt),
    originalClockOutLocal: local(row.originalClockOutAt),
    requestedClockInLocal: local(row.requestedClockInAt),
    requestedClockOutLocal: local(row.requestedClockOutAt),
    reason: row.reason,
    reviewer: row.reviewer,
    reviewNotes: row.reviewNotes,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
