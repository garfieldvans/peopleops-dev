import type { OvertimeCategory, OvertimeRoundingStrategy } from "@peopleops/shared-types";

export interface OvertimeAttendanceEvidence {
  scheduledEndAt: Date;
  clockOutAt: Date | null;
}

export function minutesBetween(from: Date, to: Date): number {
  return Math.trunc((to.getTime() - from.getTime()) / 60_000);
}

export function calculateWindowMinutes(startAt: Date, endAt: Date, breakMinutes: number): number {
  if (endAt <= startAt) return 0;
  return Math.max(0, minutesBetween(startAt, endAt) - Math.max(0, breakMinutes));
}

export function roundOvertimeMinutes(
  minutes: number,
  strategy: OvertimeRoundingStrategy,
  increment: number,
): number {
  if (strategy === "NONE" || increment <= 0) return minutes;
  if (strategy === "ROUND_DOWN") return Math.floor(minutes / increment) * increment;
  if (strategy === "ROUND_UP") return Math.ceil(minutes / increment) * increment;
  return Math.round(minutes / increment) * increment;
}

export function deriveOvertimeCategory(input: {
  holiday: boolean;
  hasSchedule: boolean;
  isoWeekday: number;
}): OvertimeCategory {
  if (input.holiday) return "HOLIDAY";
  if (input.hasSchedule) return "WEEKDAY";
  if (input.isoWeekday === 6 || input.isoWeekday === 7) return "WEEKEND";
  return "REST_DAY";
}

/**
 * Derives the actual overtime window from attendance. Early arrival is never
 * overtime: the window cannot start before the planned start or the scheduled
 * end, whichever is later. The planned break is deducted unless an explicit
 * actual break is supplied by the caller.
 */
export function deriveActualWindow(input: {
  plannedStartAt: Date;
  plannedEndAt: Date;
  plannedBreakMinutes: number;
  attendance: OvertimeAttendanceEvidence | null;
}): { startAt: Date; endAt: Date; breakMinutes: number } | null {
  const { attendance } = input;
  if (!attendance?.clockOutAt) return null;

  const startAt =
    attendance.scheduledEndAt > input.plannedStartAt
      ? attendance.scheduledEndAt
      : input.plannedStartAt;
  const endAt = attendance.clockOutAt;

  if (endAt <= startAt) return null;

  return {
    startAt,
    endAt,
    breakMinutes: Math.max(0, input.plannedBreakMinutes),
  };
}
