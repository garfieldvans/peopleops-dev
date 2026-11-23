import {
  addDaysToDateKey,
  dateKeyOf,
  isOvernight,
  shiftDurationMinutes,
  timeOf,
  zonedDateTimeToUtc,
} from "./zoned-time";

describe("zoned-time", () => {
  it("converts a Jakarta wall-clock time to UTC and back", () => {
    const instant = zonedDateTimeToUtc("2026-01-05", "08:00", "Asia/Jakarta");
    expect(instant.toISOString()).toBe("2026-01-05T01:00:00.000Z");
    expect(timeOf(instant, "Asia/Jakarta")).toBe("08:00");
    expect(dateKeyOf(instant, "Asia/Jakarta")).toBe("2026-01-05");
  });

  it("derives the next local date for an overnight shift end", () => {
    const start = zonedDateTimeToUtc("2026-01-05", "22:00", "Asia/Jakarta");
    const end = zonedDateTimeToUtc(addDaysToDateKey("2026-01-05", 1), "06:00", "Asia/Jakarta");
    expect(start.toISOString()).toBe("2026-01-05T15:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-05T23:00:00.000Z");
    expect(dateKeyOf(end, "Asia/Jakarta")).toBe("2026-01-06");
  });

  it("keeps the local work date before midnight", () => {
    const instant = new Date("2026-01-05T16:30:00.000Z"); // 23:30 Jakarta
    expect(dateKeyOf(instant, "Asia/Jakarta")).toBe("2026-01-05");
    expect(timeOf(instant, "Asia/Jakarta")).toBe("23:30");
  });

  it("resolves a date across the local midnight boundary", () => {
    const instant = new Date("2026-01-05T17:30:00.000Z"); // 00:30 Jakarta next day
    expect(dateKeyOf(instant, "Asia/Jakarta")).toBe("2026-01-06");
  });

  it("handles DST offsets in a non-Indonesian timezone", () => {
    const summer = zonedDateTimeToUtc("2026-07-01", "09:00", "America/New_York");
    const winter = zonedDateTimeToUtc("2026-12-01", "09:00", "America/New_York");
    expect(summer.toISOString()).toBe("2026-07-01T13:00:00.000Z");
    expect(winter.toISOString()).toBe("2026-12-01T14:00:00.000Z");
  });

  it("computes overnight shifts and weekday-independent durations", () => {
    expect(isOvernight("22:00", "06:00")).toBe(true);
    expect(shiftDurationMinutes("22:00", "06:00")).toBe(480);
    expect(shiftDurationMinutes("08:00", "17:00")).toBe(540);
  });
});
