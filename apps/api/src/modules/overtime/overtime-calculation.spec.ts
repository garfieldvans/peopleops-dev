import {
  calculateWindowMinutes,
  deriveActualWindow,
  deriveOvertimeCategory,
  minutesBetween,
  roundOvertimeMinutes,
} from "./overtime-calculation";

const at = (iso: string) => new Date(iso);

describe("overtime calculation", () => {
  it("calculates planned duration and deducts the break", () => {
    expect(
      calculateWindowMinutes(at("2026-11-25T11:00:00.000Z"), at("2026-11-25T14:00:00.000Z"), 30),
    ).toBe(150);
  });

  it("handles an overnight window as one continuous duration", () => {
    expect(
      calculateWindowMinutes(at("2026-11-25T17:00:00.000Z"), at("2026-11-26T01:00:00.000Z"), 60),
    ).toBe(420);
  });

  it("never returns a negative duration", () => {
    expect(
      calculateWindowMinutes(at("2026-11-25T14:00:00.000Z"), at("2026-11-25T13:00:00.000Z"), 0),
    ).toBe(0);
    expect(
      calculateWindowMinutes(at("2026-11-25T13:00:00.000Z"), at("2026-11-25T14:00:00.000Z"), 120),
    ).toBe(0);
  });

  it("truncates partial minutes", () => {
    expect(minutesBetween(at("2026-11-25T11:00:00.000Z"), at("2026-11-25T11:01:59.999Z"))).toBe(1);
  });

  it.each([
    ["NONE", 67, 67],
    ["ROUND_DOWN", 67, 60],
    ["ROUND_UP", 67, 75],
    ["NEAREST", 68, 75],
    ["NEAREST", 60, 60],
  ] as const)("applies %s rounding to %i minutes", (strategy, input, expected) => {
    expect(roundOvertimeMinutes(input, strategy, 15)).toBe(expected);
  });

  it("ignores a non-positive rounding increment", () => {
    expect(roundOvertimeMinutes(67, "ROUND_UP", 0)).toBe(67);
  });

  it("derives holiday, weekday, weekend, and rest-day categories", () => {
    expect(deriveOvertimeCategory({ holiday: true, hasSchedule: true, isoWeekday: 3 })).toBe(
      "HOLIDAY",
    );
    expect(deriveOvertimeCategory({ holiday: false, hasSchedule: true, isoWeekday: 6 })).toBe(
      "WEEKDAY",
    );
    expect(deriveOvertimeCategory({ holiday: false, hasSchedule: false, isoWeekday: 6 })).toBe(
      "WEEKEND",
    );
    expect(deriveOvertimeCategory({ holiday: false, hasSchedule: false, isoWeekday: 3 })).toBe(
      "REST_DAY",
    );
  });

  it("derives actual overtime from clock-out without counting early arrival", () => {
    const result = deriveActualWindow({
      plannedStartAt: at("2026-11-25T11:00:00.000Z"),
      plannedEndAt: at("2026-11-25T14:00:00.000Z"),
      plannedBreakMinutes: 30,
      attendance: {
        scheduledEndAt: at("2026-11-25T10:00:00.000Z"),
        clockOutAt: at("2026-11-25T13:30:00.000Z"),
      },
    });

    expect(result).toEqual({
      startAt: at("2026-11-25T11:00:00.000Z"),
      endAt: at("2026-11-25T13:30:00.000Z"),
      breakMinutes: 30,
    });
    expect(calculateWindowMinutes(result!.startAt, result!.endAt, result!.breakMinutes)).toBe(120);
  });

  it("starts after the scheduled end when overtime is planned before it", () => {
    const result = deriveActualWindow({
      plannedStartAt: at("2026-11-25T09:00:00.000Z"),
      plannedEndAt: at("2026-11-25T12:00:00.000Z"),
      plannedBreakMinutes: 0,
      attendance: {
        scheduledEndAt: at("2026-11-25T10:00:00.000Z"),
        clockOutAt: at("2026-11-25T12:00:00.000Z"),
      },
    });

    expect(result?.startAt).toEqual(at("2026-11-25T10:00:00.000Z"));
    expect(result?.endAt).toEqual(at("2026-11-25T12:00:00.000Z"));
  });

  it("requires a clock-out and a positive actual window", () => {
    expect(
      deriveActualWindow({
        plannedStartAt: at("2026-11-25T11:00:00.000Z"),
        plannedEndAt: at("2026-11-25T14:00:00.000Z"),
        plannedBreakMinutes: 0,
        attendance: null,
      }),
    ).toBeNull();
    expect(
      deriveActualWindow({
        plannedStartAt: at("2026-11-25T11:00:00.000Z"),
        plannedEndAt: at("2026-11-25T14:00:00.000Z"),
        plannedBreakMinutes: 0,
        attendance: {
          scheduledEndAt: at("2026-11-25T10:00:00.000Z"),
          clockOutAt: at("2026-11-25T11:00:00.000Z"),
        },
      }),
    ).toBeNull();
  });
});
