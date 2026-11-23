import type { INestApplication } from "@nestjs/common";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { DateTime } from "luxon";
import request from "supertest";
import type {
  AttendanceCalendar,
  AttendanceCorrection,
  AttendanceDashboard,
  AttendanceRecord,
  EmployeeScheduleAssignment,
  Holiday,
  PaginatedResponse,
  RoleDetail,
  Shift,
  WorkSchedule,
} from "@peopleops/shared-types";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "./test-env";

interface LoginBody {
  accessToken: string;
  user: { id: string; email: string; permissions: string[] };
}

const PASSWORD = "AttendancePass123";
const TZ = "Asia/Jakarta";

describe("Attendance management (e2e)", () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication["getHttpServer"]>;
  let adminToken: string;
  let managerToken: string;
  let employeeToken: string;
  let nightToken: string;
  let outsiderToken: string;

  let branchId: string;
  let departmentId: string;
  let positionId: string;
  let scheduleId: string;
  let shiftId: string;
  let managerEmployeeId: string;
  let employeeId: string;
  let nightEmployeeId: string;
  let outsiderEmployeeId: string;
  let employeeRecordId: string;
  let correctionId: string;
  let holidayId: string;

  const today = DateTime.now().setZone(TZ).toFormat("yyyy-MM-dd");
  const currentMonth = DateTime.now().setZone(TZ).toFormat("yyyy-MM");
  const nextMonthDate = DateTime.now().setZone(TZ).plus({ months: 1 }).startOf("month");
  const nextMonth = nextMonthDate.toFormat("yyyy-MM");
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(server)
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(200);
    return (response.body as LoginBody).accessToken;
  }

  async function createUser(name: string, email: string, roleIds: string[]): Promise<string> {
    const response = await request(server)
      .post("/api/v1/users")
      .set(auth(adminToken))
      .send({ name, email, password: PASSWORD, roleIds })
      .expect(201);
    return response.body.id as string;
  }

  async function createEmployee(
    overrides: Record<string, unknown>,
  ): Promise<string> {
    const response = await request(server)
      .post("/api/v1/employees")
      .set(auth(adminToken))
      .send({
        employmentType: "PERMANENT",
        joinDate: "2025-01-06",
        branchId,
        departmentId,
        positionId,
        ...overrides,
      })
      .expect(201);
    return response.body.id as string;
  }

  async function assignSchedule(
    employeeIdToAssign: string,
    effectiveFrom = today,
    shift: string | null = null,
  ): Promise<EmployeeScheduleAssignment> {
    const response = await request(server)
      .post(`/api/v1/employees/${employeeIdToAssign}/schedules`)
      .set(auth(adminToken))
      .send({
        workScheduleId: scheduleId,
        shiftId: shift,
        effectiveFrom,
        changeReason: "E2E schedule",
      })
      .expect(201);
    return response.body as EmployeeScheduleAssignment;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api");
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    server = app.getHttpServer();

    adminToken = await login(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);

    const roles = await request(server)
      .get("/api/v1/roles?pageSize=100")
      .set(auth(adminToken))
      .expect(200);
    const roleItems = roles.body.items as RoleDetail[];
    const managerRole = roleItems.find((role) => role.code === "MANAGER");
    const employeeRole = roleItems.find((role) => role.code === "EMPLOYEE");

    const managerUserId = await createUser("E2E Attendance Manager", "e2e.attendance.manager@peopleops.test", [
      managerRole!.id,
    ]);
    const employeeUserId = await createUser("E2E Attendance Staff", "e2e.attendance.staff@peopleops.test", [
      employeeRole!.id,
    ]);
    const nightUserId = await createUser("E2E Attendance Night", "e2e.attendance.night@peopleops.test", [
      employeeRole!.id,
    ]);
    const outsiderUserId = await createUser("E2E Attendance Outsider", "e2e.attendance.outsider@peopleops.test", [
      employeeRole!.id,
    ]);

    managerToken = await login("e2e.attendance.manager@peopleops.test", PASSWORD);
    employeeToken = await login("e2e.attendance.staff@peopleops.test", PASSWORD);
    nightToken = await login("e2e.attendance.night@peopleops.test", PASSWORD);
    outsiderToken = await login("e2e.attendance.outsider@peopleops.test", PASSWORD);

    const branch = await request(server)
      .post("/api/v1/branches")
      .set(auth(adminToken))
      .send({ name: "E2E Attendance Branch", code: "E2E-ATT-BR" })
      .expect(201);
    branchId = branch.body.id as string;

    const department = await request(server)
      .post("/api/v1/departments")
      .set(auth(adminToken))
      .send({ name: "E2E Attendance Ops", code: "E2E-ATT-DEPT", branchId })
      .expect(201);
    departmentId = department.body.id as string;

    const position = await request(server)
      .post("/api/v1/positions")
      .set(auth(adminToken))
      .send({ title: "E2E Attendance Officer", code: "E2E-ATT-POS", departmentId })
      .expect(201);
    positionId = position.body.id as string;

    managerEmployeeId = await createEmployee({
      employeeNumber: "E2E-ATT-MGR",
      firstName: "Maya",
      lastName: "Manager",
      personalEmail: "e2e.att.mgr@example.com",
    });
    await request(server)
      .patch(`/api/v1/employees/${managerEmployeeId}/user`)
      .set(auth(adminToken))
      .send({ userId: managerUserId })
      .expect(200);

    employeeId = await createEmployee({
      employeeNumber: "E2E-ATT-EMP",
      firstName: "Rina",
      lastName: "Staff",
      personalEmail: "e2e.att.emp@example.com",
      managerId: managerEmployeeId,
    });
    await request(server)
      .patch(`/api/v1/employees/${employeeId}/user`)
      .set(auth(adminToken))
      .send({ userId: employeeUserId })
      .expect(200);

    nightEmployeeId = await createEmployee({
      employeeNumber: "E2E-ATT-NIGHT",
      firstName: "Bayu",
      lastName: "Night",
      personalEmail: "e2e.att.night@example.com",
    });
    await request(server)
      .patch(`/api/v1/employees/${nightEmployeeId}/user`)
      .set(auth(adminToken))
      .send({ userId: nightUserId })
      .expect(200);

    outsiderEmployeeId = await createEmployee({
      employeeNumber: "E2E-ATT-OUT",
      firstName: "Oka",
      lastName: "Outsider",
      personalEmail: "e2e.att.out@example.com",
    });
    await request(server)
      .patch(`/api/v1/employees/${outsiderEmployeeId}/user`)
      .set(auth(adminToken))
      .send({ userId: outsiderUserId })
      .expect(200);

    const schedule = await request(server)
      .post("/api/v1/work-schedules")
      .set(auth(adminToken))
      .send({
        name: "E2E All Day",
        code: "E2E-WS-ALLDAY",
        graceLateMinutes: 0,
        graceEarlyMinutes: 0,
        days: Array.from({ length: 7 }, (_, index) => ({
          dayOfWeek: index + 1,
          isWorkingDay: true,
          startTime: "08:00",
          endTime: "17:00",
          breakMinutes: 0,
        })),
      })
      .expect(201);
    scheduleId = (schedule.body as WorkSchedule).id;

    const shift = await request(server)
      .post("/api/v1/shifts")
      .set(auth(adminToken))
      .send({
        name: "E2E Night",
        code: "E2E-SHIFT-NIGHT",
        startTime: "22:00",
        endTime: "06:00",
        breakMinutes: 30,
      })
      .expect(201);
    shiftId = (shift.body as Shift).id;

    await assignSchedule(managerEmployeeId);
    await assignSchedule(employeeId);
    await assignSchedule(nightEmployeeId, today, shiftId);
    await assignSchedule(outsiderEmployeeId);
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates schedules with seven days and rejects duplicate codes", async () => {
    const list = await request(server)
      .get("/api/v1/work-schedules?search=E2E-WS-ALLDAY")
      .set(auth(adminToken))
      .expect(200);
    const body = list.body as PaginatedResponse<WorkSchedule>;
    expect(body.total).toBe(1);
    expect(body.items[0]?.days).toHaveLength(7);

    await request(server)
      .post("/api/v1/work-schedules")
      .set(auth(adminToken))
      .send({
        name: "Duplicate",
        code: "E2E-WS-ALLDAY",
        days: [
          {
            dayOfWeek: 1,
            isWorkingDay: true,
            startTime: "08:00",
            endTime: "17:00",
            breakMinutes: 60,
          },
        ],
      })
      .expect(409);
  });

  it("records clock-in, breaks and clock-out without duplicates", async () => {
    const clockIn = await request(server)
      .post("/api/v1/attendance/clock-in")
      .set(auth(employeeToken))
      .expect(201);
    const record = clockIn.body as AttendanceRecord;
    employeeRecordId = record.id;
    expect(record.workDate).toBe(today);
    expect(record.clockInAt).not.toBeNull();
    expect(record.status).toBe("INCOMPLETE");

    const duplicate = await request(server)
      .post("/api/v1/attendance/clock-in")
      .set(auth(employeeToken))
      .expect(409);
    expect(duplicate.body.code).toBe("ALREADY_CLOCKED_IN");

    await request(server)
      .post("/api/v1/attendance/breaks/start")
      .set(auth(employeeToken))
      .expect(201);
    await request(server)
      .post("/api/v1/attendance/breaks/start")
      .set(auth(employeeToken))
      .expect(409);

    const breakEnd = await request(server)
      .post("/api/v1/attendance/breaks/end")
      .set(auth(employeeToken))
      .expect(201);
    expect((breakEnd.body as AttendanceRecord).breaks[0]?.endedAt).not.toBeNull();
    await request(server)
      .post("/api/v1/attendance/breaks/end")
      .set(auth(employeeToken))
      .expect(409);

    const clockOut = await request(server)
      .post("/api/v1/attendance/clock-out")
      .set(auth(employeeToken))
      .expect(201);
    expect((clockOut.body as AttendanceRecord).clockOutAt).not.toBeNull();
    await request(server)
      .post("/api/v1/attendance/clock-out")
      .set(auth(employeeToken))
      .expect(409);
  });

  it("handles concurrent clock-in and clock-out safely", async () => {
    const [first, second] = await Promise.all([
      request(server).post("/api/v1/attendance/clock-in").set(auth(nightToken)),
      request(server).post("/api/v1/attendance/clock-in").set(auth(nightToken)),
    ]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);

    const record = (first.status === 201 ? first.body : second.body) as AttendanceRecord;
    expect(DateTime.fromISO(record.scheduledEndLocal, { zone: TZ }).toFormat("yyyy-MM-dd")).toBe(
      DateTime.fromISO(today, { zone: TZ }).plus({ days: 1 }).toFormat("yyyy-MM-dd"),
    );
    expect(record.shift?.id).toBe(shiftId);

    const [outOne, outTwo] = await Promise.all([
      request(server).post("/api/v1/attendance/clock-out").set(auth(nightToken)),
      request(server).post("/api/v1/attendance/clock-out").set(auth(nightToken)),
    ]);
    expect([outOne.status, outTwo.status].sort()).toEqual([201, 409]);
  });

  it("submits a correction and lets a manager approve it with recalculation", async () => {
    const create = await request(server)
      .post("/api/v1/attendance/corrections")
      .set(auth(employeeToken))
      .send({
        attendanceRecordId: employeeRecordId,
        type: "BOTH",
        requestedClockIn: "08:00",
        requestedClockOut: "17:00",
        reason: "My device clock was wrong, please correct the times.",
      })
      .expect(201);
    correctionId = (create.body as AttendanceCorrection).id;
    expect((create.body as AttendanceCorrection).status).toBe("PENDING");

    const duplicate = await request(server)
      .post("/api/v1/attendance/corrections")
      .set(auth(employeeToken))
      .send({
        attendanceRecordId: employeeRecordId,
        type: "BOTH",
        requestedClockIn: "08:10",
        requestedClockOut: "17:10",
        reason: "Second request on the same day should conflict.",
      })
      .expect(409);
    expect(duplicate.body.code).toBe("CORRECTION_ALREADY_PENDING");

    const managerList = await request(server)
      .get("/api/v1/attendance/corrections?status=PENDING")
      .set(auth(managerToken))
      .expect(200);
    expect((managerList.body as PaginatedResponse<AttendanceCorrection>).total).toBe(1);

    const approved = await request(server)
      .patch(`/api/v1/attendance/corrections/${correctionId}/approve`)
      .set(auth(managerToken))
      .send({ reviewNotes: "Verified against the access log." })
      .expect(200);
    expect((approved.body as AttendanceCorrection).status).toBe("APPROVED");

    const record = await request(server)
      .get(`/api/v1/attendance/${employeeRecordId}`)
      .set(auth(employeeToken))
      .expect(200);
    const corrected = record.body as AttendanceRecord;
    expect(corrected.isCorrected).toBe(true);
    expect(corrected.clockInLocal?.slice(11, 16)).toBe("08:00");
    expect(corrected.clockOutLocal?.slice(11, 16)).toBe("17:00");
    expect(corrected.workedMinutes).toBe(540);
    expect(corrected.status).toBe("PRESENT");
  });

  it("enforces manager and employee attendance scope", async () => {
    const managerRecords = await request(server)
      .get(`/api/v1/attendance?employeeId=${employeeId}`)
      .set(auth(managerToken))
      .expect(200);
    expect((managerRecords.body as PaginatedResponse<AttendanceRecord>).total).toBe(1);

    await request(server)
      .get(`/api/v1/attendance/${employeeRecordId}`)
      .set(auth(outsiderToken))
      .expect(403);

    const outsiderList = await request(server)
      .get("/api/v1/attendance")
      .set(auth(outsiderToken))
      .expect(200);
    expect((outsiderList.body as PaginatedResponse<AttendanceRecord>).total).toBe(0);

    await request(server)
      .get("/api/v1/attendance/overview")
      .set(auth(managerToken))
      .expect(403);

    await request(server)
      .get(`/api/v1/attendance/employees/${outsiderEmployeeId}/calendar?month=${currentMonth}`)
      .set(auth(managerToken))
      .expect(403);
  });

  it("returns the self dashboard and a calendar with holiday statuses", async () => {
    const dashboard = await request(server)
      .get("/api/v1/attendance/dashboard")
      .set(auth(employeeToken))
      .expect(200);
    expect((dashboard.body as AttendanceDashboard).state).toBe("CLOCKED_OUT");

    const holiday = await request(server)
      .post("/api/v1/holidays")
      .set(auth(adminToken))
      .send({
        name: "E2E Next Month Holiday",
        date: nextMonthDate.toFormat("yyyy-MM-dd"),
        type: "NATIONAL",
      })
      .expect(201);
    holidayId = (holiday.body as Holiday).id;

    const calendar = await request(server)
      .get(`/api/v1/attendance/me/calendar?month=${nextMonth}`)
      .set(auth(employeeToken))
      .expect(200);
    const days = (calendar.body as AttendanceCalendar).days;
    const holidayDay = days.find(
      (day) => day.date === nextMonthDate.toFormat("yyyy-MM-dd"),
    );
    expect(holidayDay?.status).toBe("HOLIDAY");
    expect(holidayDay?.holiday?.id).toBe(holidayId);
  });

  it("bulk assigns by branch and preserves previous assignments", async () => {
    const bulk = await request(server)
      .post("/api/v1/employee-schedules/bulk")
      .set(auth(adminToken))
      .send({
        workScheduleId: scheduleId,
        branchId,
        effectiveFrom: nextMonthDate.toFormat("yyyy-MM-dd"),
        changeReason: "E2E bulk rollover",
      })
      .expect(201);
    expect((bulk.body as { assigned: number }).assigned).toBeGreaterThanOrEqual(4);

    const history = await request(server)
      .get(`/api/v1/employees/${employeeId}/schedules`)
      .set(auth(adminToken))
      .expect(200);
    const assignments = history.body as PaginatedResponse<EmployeeScheduleAssignment>;
    expect(assignments.total).toBeGreaterThanOrEqual(2);
    expect(assignments.items.some((entry) => entry.effectiveTo !== null)).toBe(true);
  });

  it("manually corrects attendance and exports CSV", async () => {
    const start = DateTime.fromISO(`${today}T08:00`, { zone: TZ }).toUTC().toISO()!;
    const end = DateTime.fromISO(`${today}T17:00`, { zone: TZ }).toUTC().toISO()!;
    const updated = await request(server)
      .patch(`/api/v1/attendance/${employeeRecordId}`)
      .set(auth(adminToken))
      .send({ clockInAt: start, clockOutAt: end, reason: "HR correction after review" })
      .expect(200);
    expect((updated.body as AttendanceRecord).status).toBe("PRESENT");

    const csv = await request(server)
      .get(`/api/v1/attendance/export?from=${today}&to=${today}`)
      .set(auth(adminToken))
      .expect(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.text).toContain("employee_number");
    expect(csv.text).toContain("E2E-ATT-EMP");
  });
});
