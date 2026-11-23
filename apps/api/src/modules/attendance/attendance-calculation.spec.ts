import { calculateAttendance } from "./attendance-calculation";

const at = (iso: string) => new Date(iso);

function base(overrides: Partial<Parameters<typeof calculateAttendance>[0]> = {}) {
  return calculateAttendance({
    scheduledStartAt: at("2026-01-05T08:00:00.000Z"),
    scheduledEndAt: at("2026-01-05T17:00:00.000Z"),
    clockInAt: at("2026-01-05T08:00:00.000Z"),
    clockOutAt: at("2026-01-05T17:00:00.000Z"),
    graceLateMinutes: 0,
    graceEarlyMinutes: 0,
    expectedBreakMinutes: 60,
    breaks: [],
    ...overrides,
  });
}

describe("calculateAttendance", () => {
  it("computes a normal day and subtracts the unpaid break", () => {
    const result = base();
    expect(result).toMatchObject({
      status: "PRESENT",
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      workedMinutes: 480,
      scheduledMinutes: 540,
    });
  });

  it("applies the late grace period", () => {
    const result = base({
      clockInAt: at("2026-01-05T08:15:00.000Z"),
      clockOutAt: at("2026-01-05T17:10:00.000Z"),
      graceLateMinutes: 10,
    });
    expect(result.lateMinutes).toBe(5);
    expect(result.earlyLeaveMinutes).toBe(0);
    expect(result.status).toBe("LATE");
    expect(result.workedMinutes).toBe(475);
  });

  it("applies the early-departure grace period", () => {
    const result = base({
      clockOutAt: at("2026-01-05T16:30:00.000Z"),
      graceEarlyMinutes: 5,
    });
    expect(result.earlyLeaveMinutes).toBe(25);
    expect(result.status).toBe("EARLY_LEAVE");
  });

  it("combines late arrival and early departure", () => {
    const result = base({
      clockInAt: at("2026-01-05T08:30:00.000Z"),
      clockOutAt: at("2026-01-05T16:00:00.000Z"),
    });
    expect(result.lateMinutes).toBe(30);
    expect(result.earlyLeaveMinutes).toBe(60);
    expect(result.status).toBe("LATE_AND_EARLY_LEAVE");
  });

  it("marks a session without clock-out as incomplete", () => {
    const result = base({ clockOutAt: null });
    expect(result.status).toBe("INCOMPLETE");
    expect(result.workedMinutes).toBe(0);
  });

  it("marks a session without any clock event as absent", () => {
    const result = base({ clockInAt: null, clockOutAt: null });
    expect(result.status).toBe("ABSENT");
  });

  it("marks a short completed session as half day", () => {
    const result = base({
      clockOutAt: at("2026-01-05T12:00:00.000Z"),
      graceEarlyMinutes: 300,
    });
    expect(result.workedMinutes).toBe(180);
    expect(result.status).toBe("HALF_DAY");
  });

  it("deducts recorded breaks when they exceed the configured break", () => {
    const result = base({
      breaks: [
        {
          startedAt: at("2026-01-05T10:00:00.000Z"),
          endedAt: at("2026-01-05T11:30:00.000Z"),
        },
      ],
    });
    expect(result.breakMinutesTaken).toBe(90);
    expect(result.unpaidBreakMinutes).toBe(90);
    expect(result.workedMinutes).toBe(450);
  });

  it("clips breaks to the actual session and ignores an open break end", () => {
    const result = base({
      clockInAt: at("2026-01-05T09:00:00.000Z"),
      clockOutAt: at("2026-01-05T17:00:00.000Z"),
      breaks: [
        {
          startedAt: at("2026-01-05T08:30:00.000Z"),
          endedAt: at("2026-01-05T09:30:00.000Z"),
        },
      ],
    });
    expect(result.breakMinutesTaken).toBe(30);
    expect(result.workedMinutes).toBe(420);
  });

  it("handles an overnight shift as one continuous session", () => {
    const result = base({
      scheduledStartAt: at("2026-01-05T22:00:00.000Z"),
      scheduledEndAt: at("2026-01-06T06:00:00.000Z"),
      clockInAt: at("2026-01-05T21:55:00.000Z"),
      clockOutAt: at("2026-01-06T06:05:00.000Z"),
      expectedBreakMinutes: 30,
    });
    expect(result.scheduledMinutes).toBe(480);
    expect(result.workedMinutes).toBe(460);
    expect(result.status).toBe("PRESENT");
  });
});
