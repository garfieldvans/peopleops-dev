import {
  addDaysToDateKey,
  isOvernight,
  isoWeekday,
  zonedDateTimeToUtc,
} from "../../common/time/zoned-time";

export interface ScheduleAssignmentDetails {
  id: string;
  workSchedule: {
    id: string;
    name: string;
    code: string;
    graceLateMinutes: number;
    graceEarlyMinutes: number;
    days: {
      dayOfWeek: number;
      isWorkingDay: boolean;
      startTime: string | null;
      endTime: string | null;
      breakMinutes: number;
    }[];
  };
  shift: {
    id: string;
    name: string;
    code: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    graceLateMinutes: number;
    graceEarlyMinutes: number;
  } | null;
}

export interface ResolvedSchedule {
  assignmentId: string;
  workDate: string;
  workSchedule: { id: string; name: string; code: string };
  shift: { id: string; name: string; code: string } | null;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  expectedBreakMinutes: number;
  graceLateMinutes: number;
  graceEarlyMinutes: number;
  startTime: string;
  endTime: string;
  overnight: boolean;
}

/** Resolves the working day using the schedule, with shift hours taking precedence. */
export function buildResolvedSchedule(
  assignment: ScheduleAssignmentDetails,
  dateKey: string,
  timezone: string,
): ResolvedSchedule | null {
  const weekday = isoWeekday(dateKey);
  const day = assignment.workSchedule.days.find((entry) => entry.dayOfWeek === weekday);
  if (!day || !day.isWorkingDay) return null;

  const shift = assignment.shift;
  const startTime = shift?.startTime ?? day.startTime;
  const endTime = shift?.endTime ?? day.endTime;
  if (!startTime || !endTime) return null;

  const overnight = isOvernight(startTime, endTime);
  const endDateKey = overnight ? addDaysToDateKey(dateKey, 1) : dateKey;
  const scheduledStartAt = zonedDateTimeToUtc(dateKey, startTime, timezone);
  const scheduledEndAt = zonedDateTimeToUtc(endDateKey, endTime, timezone);
  if (scheduledEndAt <= scheduledStartAt) return null;

  return {
    assignmentId: assignment.id,
    workDate: dateKey,
    workSchedule: {
      id: assignment.workSchedule.id,
      name: assignment.workSchedule.name,
      code: assignment.workSchedule.code,
    },
    shift: shift ? { id: shift.id, name: shift.name, code: shift.code } : null,
    scheduledStartAt,
    scheduledEndAt,
    expectedBreakMinutes: shift?.breakMinutes ?? day.breakMinutes,
    graceLateMinutes:
      shift?.graceLateMinutes ?? assignment.workSchedule.graceLateMinutes,
    graceEarlyMinutes:
      shift?.graceEarlyMinutes ?? assignment.workSchedule.graceEarlyMinutes,
    startTime,
    endTime,
    overnight,
  };
}
