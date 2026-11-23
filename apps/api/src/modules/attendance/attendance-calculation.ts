import type { AttendanceStatus } from "@peopleops/shared-types";

export interface CalculationBreak {
  startedAt: Date;
  endedAt: Date | null;
}

export interface AttendanceCalculationInput {
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  clockInAt: Date | null;
  clockOutAt: Date | null;
  graceLateMinutes: number;
  graceEarlyMinutes: number;
  expectedBreakMinutes: number;
  breaks: CalculationBreak[];
  now?: Date;
}

export interface AttendanceCalculationResult {
  status: AttendanceStatus;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workedMinutes: number;
  breakMinutesTaken: number;
  expectedBreakMinutes: number;
  unpaidBreakMinutes: number;
  scheduledMinutes: number;
}

const MINUTE_MS = 60_000;

function minutesRoundedDown(ms: number): number {
  return Math.max(0, Math.trunc(ms / MINUTE_MS));
}

function clippedBreakMs(
  breaks: CalculationBreak[],
  sessionStart: Date,
  sessionEnd: Date,
): number {
  return breaks.reduce((total, entry) => {
    const end = entry.endedAt ?? sessionEnd;
    const startMs = Math.max(entry.startedAt.getTime(), sessionStart.getTime());
    const endMs = Math.min(end.getTime(), sessionEnd.getTime());
    return total + Math.max(0, endMs - startMs);
  }, 0);
}

/**
 * Single source of truth for attendance arithmetic.
 *
 * - Late minutes start counting after `scheduledStartAt + graceLateMinutes`.
 * - Early-leave minutes start counting before `scheduledEndAt - graceEarlyMinutes`.
 * - Worked time is actual elapsed time minus the larger of the configured unpaid
 *   break and the recorded breaks. This keeps a policy break unpaid even when the
 *   employee forgets to press start/end.
 * - A completed session below half of the scheduled duration is HALF_DAY unless a
 *   late/early flag already describes it.
 * - `ABSENT` only applies to a record that has neither clock-in nor clock-out; the
 *   system never creates such records automatically for missing days.
 */
export function calculateAttendance(
  input: AttendanceCalculationInput,
): AttendanceCalculationResult {
  const scheduledMinutes = minutesRoundedDown(
    input.scheduledEndAt.getTime() - input.scheduledStartAt.getTime(),
  );

  if (!input.clockInAt && !input.clockOutAt) {
    return {
      status: "ABSENT",
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      workedMinutes: 0,
      breakMinutesTaken: 0,
      expectedBreakMinutes: input.expectedBreakMinutes,
      unpaidBreakMinutes: 0,
      scheduledMinutes,
    };
  }

  if (!input.clockInAt || !input.clockOutAt) {
    return {
      status: "INCOMPLETE",
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      workedMinutes: 0,
      breakMinutesTaken: 0,
      expectedBreakMinutes: input.expectedBreakMinutes,
      unpaidBreakMinutes: 0,
      scheduledMinutes,
    };
  }

  const lateThreshold = input.scheduledStartAt.getTime() + input.graceLateMinutes * MINUTE_MS;
  const lateMs = Math.max(0, input.clockInAt.getTime() - lateThreshold);
  const lateMinutes = minutesRoundedDown(lateMs);

  const earlyThreshold = input.scheduledEndAt.getTime() - input.graceEarlyMinutes * MINUTE_MS;
  const earlyMs = Math.max(0, earlyThreshold - input.clockOutAt.getTime());
  const earlyLeaveMinutes = minutesRoundedDown(earlyMs);

  const breakMinutesTaken = minutesRoundedDown(
    clippedBreakMs(input.breaks, input.clockInAt, input.clockOutAt),
  );
  const unpaidBreakMinutes = Math.max(input.expectedBreakMinutes, breakMinutesTaken);
  const elapsedMinutes = minutesRoundedDown(
    input.clockOutAt.getTime() - input.clockInAt.getTime(),
  );
  const workedMinutes = Math.max(0, elapsedMinutes - unpaidBreakMinutes);

  let status: AttendanceStatus = "PRESENT";
  if (lateMinutes > 0 && earlyLeaveMinutes > 0) {
    status = "LATE_AND_EARLY_LEAVE";
  } else if (lateMinutes > 0) {
    status = "LATE";
  } else if (earlyLeaveMinutes > 0) {
    status = "EARLY_LEAVE";
  } else if (workedMinutes > 0 && workedMinutes < scheduledMinutes / 2) {
    status = "HALF_DAY";
  }

  return {
    status,
    lateMinutes,
    earlyLeaveMinutes,
    workedMinutes,
    breakMinutesTaken,
    expectedBreakMinutes: input.expectedBreakMinutes,
    unpaidBreakMinutes,
    scheduledMinutes,
  };
}
