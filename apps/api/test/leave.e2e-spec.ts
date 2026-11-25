import type { INestApplication } from "@nestjs/common";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { DateTime } from "luxon";
import request from "supertest";
import { createPrismaClient, type PrismaClient } from "@peopleops/database";
import { runLeaveJobs } from "@peopleops/leave-engine";
import type {
  LeaveBalance,
  LeaveRequest,
  LeaveRequestPreview,
  LeaveTransaction,
  PaginatedResponse,
  RoleDetail,
  WorkSchedule,
} from "@peopleops/shared-types";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, TEST_DATABASE_URL } from "./test-env";

interface LoginBody {
  accessToken: string;
  user: { id: string; email: string; permissions: string[] };
}

const PASSWORD = "LeavePass123";
const TZ = "Asia/Jakarta";

describe("Leave management (e2e)", () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication["getHttpServer"]>;
  let adminToken: string;
  let managerToken: string;
  let employeeToken: string;
  let outsiderToken: string;

  let branchId: string;
  let departmentId: string;
  let positionId: string;
  let managerEmployeeId: string;
  let employeeId: string;
  let outsiderEmployeeId: string;
  let leaveTypeId: string;
  let policyId: string;
  let assignmentId: string;
  let approvedRequestId: string;
  let cancelledRequestId: string;
  let pendingRequestId: string;
  let prisma: PrismaClient;

  const today = DateTime.now().setZone(TZ).toFormat("yyyy-MM-dd");
  const yearStart = `${DateTime.now().setZone(TZ).year}-01-01`;
  const leaveStart = DateTime.now().setZone(TZ).plus({ days: 10 }).toFormat("yyyy-MM-dd");
  const leaveEnd = DateTime.now().setZone(TZ).plus({ days: 11 }).toFormat("yyyy-MM-dd");
  const halfDay = DateTime.now().setZone(TZ).plus({ days: 12 }).toFormat("yyyy-MM-dd");
  const withdrawDay = DateTime.now().setZone(TZ).plus({ days: 13 }).toFormat("yyyy-MM-dd");
  const month = leaveStart.slice(0, 7);
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

  async function createEmployee(overrides: Record<string, unknown>): Promise<string> {
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
    prisma = createPrismaClient({ connectionString: TEST_DATABASE_URL });

    adminToken = await login(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);

    const roles = await request(server)
      .get("/api/v1/roles?pageSize=100")
      .set(auth(adminToken))
      .expect(200);
    const roleItems = roles.body.items as RoleDetail[];
    const managerRole = roleItems.find((role) => role.code === "MANAGER");
    const employeeRole = roleItems.find((role) => role.code === "EMPLOYEE");

    const managerUserId = await createUser(
      "E2E Leave Manager",
      "e2e.leave.manager@peopleops.test",
      [managerRole!.id],
    );
    const employeeUserId = await createUser("E2E Leave Staff", "e2e.leave.staff@peopleops.test", [
      employeeRole!.id,
    ]);
    const outsiderUserId = await createUser(
      "E2E Leave Outsider",
      "e2e.leave.outsider@peopleops.test",
      [employeeRole!.id],
    );

    managerToken = await login("e2e.leave.manager@peopleops.test", PASSWORD);
    employeeToken = await login("e2e.leave.staff@peopleops.test", PASSWORD);
    outsiderToken = await login("e2e.leave.outsider@peopleops.test", PASSWORD);

    const branch = await request(server)
      .post("/api/v1/branches")
      .set(auth(adminToken))
      .send({ name: "E2E Leave Branch", code: "E2E-LV-BR" })
      .expect(201);
    branchId = branch.body.id as string;

    const department = await request(server)
      .post("/api/v1/departments")
      .set(auth(adminToken))
      .send({ name: "E2E Leave Ops", code: "E2E-LV-DEPT", branchId })
      .expect(201);
    departmentId = department.body.id as string;

    const position = await request(server)
      .post("/api/v1/positions")
      .set(auth(adminToken))
      .send({ title: "E2E Leave Officer", code: "E2E-LV-POS", departmentId })
      .expect(201);
    positionId = position.body.id as string;

    managerEmployeeId = await createEmployee({
      employeeNumber: "E2E-LV-MGR",
      firstName: "Maya",
      lastName: "Manager",
      personalEmail: "e2e.leave.mgr@example.com",
    });
    await request(server)
      .patch(`/api/v1/employees/${managerEmployeeId}/user`)
      .set(auth(adminToken))
      .send({ userId: managerUserId })
      .expect(200);

    employeeId = await createEmployee({
      employeeNumber: "E2E-LV-EMP",
      firstName: "Rina",
      lastName: "Staff",
      personalEmail: "e2e.leave.emp@example.com",
      managerId: managerEmployeeId,
    });
    await request(server)
      .patch(`/api/v1/employees/${employeeId}/user`)
      .set(auth(adminToken))
      .send({ userId: employeeUserId })
      .expect(200);

    outsiderEmployeeId = await createEmployee({
      employeeNumber: "E2E-LV-OUT",
      firstName: "Oka",
      lastName: "Outsider",
      personalEmail: "e2e.leave.out@example.com",
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
        name: "E2E Leave Standard",
        code: "E2E-LV-WS",
        graceLateMinutes: 0,
        graceEarlyMinutes: 0,
        days: Array.from({ length: 7 }, (_, index) => ({
          dayOfWeek: index + 1,
          isWorkingDay: true,
          startTime: "08:00",
          endTime: "17:00",
          breakMinutes: 60,
        })),
      })
      .expect(201);
    const scheduleId = (schedule.body as WorkSchedule).id;
    for (const id of [managerEmployeeId, employeeId, outsiderEmployeeId]) {
      await request(server)
        .post(`/api/v1/employees/${id}/schedules`)
        .set(auth(adminToken))
        .send({ workScheduleId: scheduleId, effectiveFrom: today, changeReason: "E2E leave" })
        .expect(201);
    }

    const leaveType = await request(server)
      .post("/api/v1/leave-types")
      .set(auth(adminToken))
      .send({
        name: "E2E Annual Leave",
        code: "E2E_LV_ANNUAL",
        description: "E2E fixture",
        requiresBalance: true,
        allowHalfDay: true,
        allowFutureDates: true,
      })
      .expect(201);
    leaveTypeId = leaveType.body.id as string;

    const policy = await request(server)
      .post("/api/v1/leave-policies")
      .set(auth(adminToken))
      .send({
        name: "E2E Annual Policy",
        code: "E2E-LV-POLICY",
        leaveTypeId,
        entitlementAmount: 10,
        entitlementUnit: "DAY",
        accrualMethod: "GRANTED_UPFRONT",
        accrualFrequency: "ONE_TIME",
        accrualStartRule: "PERIOD_START",
        approvalMode: "MANAGER",
        allowHalfDay: true,
        effectiveFrom: yearStart,
        leaveYearStartMonth: 1,
      })
      .expect(201);
    policyId = policy.body.id as string;

    const assignment = await request(server)
      .post("/api/v1/leave-policy-assignments")
      .set(auth(adminToken))
      .send({ employeeIds: [employeeId], policyId, effectiveFrom: yearStart })
      .expect(201);
    expect(assignment.body.assigned).toBe(1);

    const assignments = await request(server)
      .get(`/api/v1/leave-policy-assignments?employeeId=${employeeId}`)
      .set(auth(adminToken))
      .expect(200);
    assignmentId = assignments.body.items[0].id as string;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it("validates leave types and rejects duplicate codes", async () => {
    await request(server)
      .post("/api/v1/leave-types")
      .set(auth(adminToken))
      .send({ name: "Broken", code: "no spaces" })
      .expect(400);

    await request(server)
      .post("/api/v1/leave-types")
      .set(auth(adminToken))
      .send({ name: "Duplicate annual", code: "E2E_LV_ANNUAL" })
      .expect(409);
  });

  it("rejects overlapping active policy assignments", async () => {
    const response = await request(server)
      .post("/api/v1/leave-policy-assignments")
      .set(auth(adminToken))
      .send({
        employeeIds: [employeeId],
        policyId,
        effectiveFrom: DateTime.fromISO(today).plus({ days: 1 }).toFormat("yyyy-MM-dd"),
      })
      .expect(409);
    expect(response.body.code).toBe("LEAVE_ASSIGNMENT_OVERLAP");
  });

  it("generates an entitlement period and balance on assignment", async () => {
    const balances = await request(server)
      .get("/api/v1/leave-balances/me")
      .set(auth(employeeToken))
      .expect(200);
    expect(Array.isArray(balances.body)).toBe(true);
    const balance = (balances.body as LeaveBalance[]).find(
      (row) => row.leaveType.id === leaveTypeId,
    );
    expect(balance).toBeDefined();
    expect(balance!.entitled).toBe(10);
    expect(balance!.used).toBe(0);
    expect(balance!.reserved).toBe(0);
    expect(balance!.available).toBe(10);
  });

  it("calculates duration from the employee schedule and supports half days", async () => {
    const preview = await request(server)
      .post("/api/v1/leave-requests/preview")
      .set(auth(employeeToken))
      .send({ leaveTypeId, startDate: leaveStart, endDate: leaveEnd })
      .expect(201);
    const body = preview.body as LeaveRequestPreview;
    expect(body.duration).toBe(2);
    expect(body.days).toHaveLength(2);
    expect(body.balance?.available).toBe(10);

    const half = await request(server)
      .post("/api/v1/leave-requests/preview")
      .set(auth(employeeToken))
      .send({
        leaveTypeId,
        startDate: halfDay,
        endDate: halfDay,
        requestMode: "HALF_DAY",
        halfDayPeriod: "FIRST_HALF",
      })
      .expect(201);
    expect((half.body as LeaveRequestPreview).duration).toBe(0.5);
    expect((half.body as LeaveRequestPreview).halfDayPeriod).toBe("FIRST_HALF");
  });

  it("reserves balance on submission and prevents overlapping pending requests", async () => {
    const created = await request(server)
      .post("/api/v1/leave-requests")
      .set(auth(employeeToken))
      .send({
        leaveTypeId,
        startDate: leaveStart,
        endDate: leaveEnd,
        reason: "E2E family trip",
      })
      .expect(201);
    approvedRequestId = created.body.id as string;
    expect(created.body.status).toBe("DRAFT");

    const submitted = await request(server)
      .post(`/api/v1/leave-requests/${approvedRequestId}/submit`)
      .set(auth(employeeToken))
      .expect(201);
    expect(submitted.body.status).toBe("PENDING");
    expect(submitted.body.approvalStage).toBe("MANAGER");

    const balance = await request(server)
      .get("/api/v1/leave-balances/me")
      .set(auth(employeeToken))
      .expect(200);
    const row = (balance.body as LeaveBalance[]).find((item) => item.leaveType.id === leaveTypeId);
    expect(row!.reserved).toBe(2);
    expect(row!.used).toBe(0);
    expect(row!.available).toBe(8);

    const overlapping = await request(server)
      .post("/api/v1/leave-requests")
      .set(auth(employeeToken))
      .send({
        leaveTypeId,
        startDate: leaveStart,
        endDate: leaveStart,
        reason: "E2E overlapping request",
      })
      .expect(201);
    await request(server)
      .post(`/api/v1/leave-requests/${overlapping.body.id as string}/submit`)
      .set(auth(employeeToken))
      .expect(409);
  });

  it("enforces team access and manager approval", async () => {
    await request(server)
      .get(`/api/v1/leave-requests/${approvedRequestId}`)
      .set(auth(outsiderToken))
      .expect(403);

    const inbox = await request(server)
      .get("/api/v1/leave-requests?status=PENDING")
      .set(auth(managerToken))
      .expect(200);
    expect((inbox.body as PaginatedResponse<LeaveRequest>).items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: approvedRequestId })]),
    );

    const approved = await request(server)
      .post(`/api/v1/leave-requests/${approvedRequestId}/approve`)
      .set(auth(managerToken))
      .send({ comment: "Approved by E2E manager" })
      .expect(201);
    expect(approved.body.status).toBe("APPROVED");
    expect(approved.body.approvals).toHaveLength(1);
    expect(approved.body.approvals[0].decision).toBe("APPROVED");

    const balance = await request(server)
      .get("/api/v1/leave-balances/me")
      .set(auth(employeeToken))
      .expect(200);
    const row = (balance.body as LeaveBalance[]).find((item) => item.leaveType.id === leaveTypeId);
    expect(row!.reserved).toBe(0);
    expect(row!.used).toBe(2);
    expect(row!.available).toBe(8);

    const ledger = await request(server)
      .get(`/api/v1/leave-transactions?leaveTypeId=${leaveTypeId}`)
      .set(auth(employeeToken))
      .expect(200);
    const transactions = (ledger.body as PaginatedResponse<LeaveTransaction>).items;
    expect(transactions.some((transaction) => transaction.type === "LEAVE_DEDUCTION")).toBe(true);
  });

  it("reverses the deduction when an approved request is cancelled", async () => {
    const created = await request(server)
      .post("/api/v1/leave-requests")
      .set(auth(employeeToken))
      .send({
        leaveTypeId,
        startDate: halfDay,
        endDate: halfDay,
        reason: "E2E half day",
      })
      .expect(201);
    cancelledRequestId = created.body.id as string;
    await request(server)
      .post(`/api/v1/leave-requests/${cancelledRequestId}/submit`)
      .set(auth(employeeToken))
      .expect(201);
    await request(server)
      .post(`/api/v1/leave-requests/${cancelledRequestId}/approve`)
      .set(auth(managerToken))
      .send({})
      .expect(201);

    const cancelled = await request(server)
      .post(`/api/v1/leave-requests/${cancelledRequestId}/cancel`)
      .set(auth(employeeToken))
      .send({ reason: "E2E plans changed" })
      .expect(201);
    expect(cancelled.body.status).toBe("CANCELLED");

    const balance = await request(server)
      .get("/api/v1/leave-balances/me")
      .set(auth(employeeToken))
      .expect(200);
    const row = (balance.body as LeaveBalance[]).find((item) => item.leaveType.id === leaveTypeId);
    expect(row!.used).toBe(2);
    expect(row!.available).toBe(8);

    const ledger = await request(server)
      .get(`/api/v1/leave-transactions?leaveTypeId=${leaveTypeId}`)
      .set(auth(employeeToken))
      .expect(200);
    expect(
      (ledger.body as PaginatedResponse<LeaveTransaction>).items.some(
        (transaction) => transaction.type === "LEAVE_REVERSAL",
      ),
    ).toBe(true);
  });

  it("releases reservations when a pending request is withdrawn", async () => {
    const created = await request(server)
      .post("/api/v1/leave-requests")
      .set(auth(employeeToken))
      .send({
        leaveTypeId,
        startDate: withdrawDay,
        endDate: withdrawDay,
        reason: "E2E withdrawal",
      })
      .expect(201);
    pendingRequestId = created.body.id as string;
    await request(server)
      .post(`/api/v1/leave-requests/${pendingRequestId}/submit`)
      .set(auth(employeeToken))
      .expect(201);

    await request(server)
      .post(`/api/v1/leave-requests/${pendingRequestId}/withdraw`)
      .set(auth(employeeToken))
      .expect(201);

    const balance = await request(server)
      .get("/api/v1/leave-balances/me")
      .set(auth(employeeToken))
      .expect(200);
    const row = (balance.body as LeaveBalance[]).find((item) => item.leaveType.id === leaveTypeId);
    expect(row!.reserved).toBe(0);
    expect(row!.available).toBe(8);
  });

  it("blocks overdrawing the balance and invalid manual adjustments", async () => {
    await request(server)
      .post(`/api/v1/leave-balances/${employeeId}/adjustments`)
      .set(auth(adminToken))
      .send({
        leaveTypeId,
        amount: -20,
        transactionDate: today,
        reason: "E2E overdraft fixture",
      })
      .expect(409);

    await request(server)
      .post(`/api/v1/leave-balances/${employeeId}/adjustments`)
      .set(auth(employeeToken))
      .send({
        leaveTypeId,
        amount: 1,
        transactionDate: today,
        reason: "Employee cannot adjust",
      })
      .expect(403);
  });

  it("exposes approved leave to attendance without deleting the calendar", async () => {
    const calendar = await request(server)
      .get(`/api/v1/attendance/employees/${employeeId}/calendar?month=${month}`)
      .set(auth(adminToken))
      .expect(200);
    const day = (calendar.body.days as Array<Record<string, unknown>>).find(
      (item) => item.date === leaveStart,
    );
    expect(day).toBeDefined();
    expect((day as { leave: { requestId: string } | null }).leave?.requestId).toBe(
      approvedRequestId,
    );
    expect((calendar.body.summary as { onLeave: number }).onLeave).toBeGreaterThan(0);
  });

  it("returns report summaries and CSV export for HR", async () => {
    const summary = await request(server)
      .get(`/api/v1/leave-reports/summary?from=${leaveStart}&to=${leaveEnd}`)
      .set(auth(adminToken))
      .expect(200);
    expect(summary.body.approvedCount).toBeGreaterThan(0);
    expect(summary.body.rows.length).toBeGreaterThan(0);

    const csv = await request(server)
      .get(`/api/v1/leave-reports/export?from=${leaveStart}&to=${leaveEnd}`)
      .set(auth(adminToken))
      .expect(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.text).toContain("employee_number");
  });

  it("runs monthly accrual idempotently", async () => {
    const monthlyType = await request(server)
      .post("/api/v1/leave-types")
      .set(auth(adminToken))
      .send({ name: "E2E Monthly Leave", code: "E2E_LV_MONTHLY", requiresBalance: true })
      .expect(201);
    const monthlyPolicy = await request(server)
      .post("/api/v1/leave-policies")
      .set(auth(adminToken))
      .send({
        name: "E2E Monthly Policy",
        code: "E2E-LV-MONTHLY-POLICY",
        leaveTypeId: monthlyType.body.id,
        entitlementAmount: 12,
        accrualMethod: "MONTHLY_ACCRUAL",
        accrualFrequency: "MONTHLY",
        accrualStartRule: "PERIOD_START",
        approvalMode: "HR",
        effectiveFrom: yearStart,
        leaveYearStartMonth: 1,
      })
      .expect(201);
    await request(server)
      .post("/api/v1/leave-policy-assignments")
      .set(auth(adminToken))
      .send({
        employeeIds: [employeeId],
        policyId: monthlyPolicy.body.id,
        effectiveFrom: yearStart,
      })
      .expect(201);

    const readMonthly = async () => {
      const balances = await request(server)
        .get("/api/v1/leave-balances/me")
        .set(auth(employeeToken))
        .expect(200);
      return (balances.body as LeaveBalance[]).find(
        (row) => row.leaveType.id === (monthlyType.body.id as string),
      )!;
    };
    const before = await readMonthly();
    const monthsElapsed = DateTime.now().setZone(TZ).month;
    expect(before.entitled).toBeCloseTo(monthsElapsed, 2);

    const firstRun = await runLeaveJobs(prisma, today);
    const secondRun = await runLeaveJobs(prisma, today);
    expect(firstRun.accrualsCreated).toBe(0);
    expect(secondRun.accrualsCreated).toBe(0);

    const after = await readMonthly();
    expect(after.entitled).toBe(before.entitled);
    expect(after.available).toBe(before.available);
    expect(
      await prisma.leaveTransaction.count({
        where: {
          leaveTypeId: monthlyType.body.id as string,
          type: "ACCRUAL",
        },
      }),
    ).toBe(monthsElapsed);
  });

  it("keeps assignment history when a policy changes", async () => {
    await request(server)
      .patch(`/api/v1/leave-policies/${policyId}`)
      .set(auth(adminToken))
      .send({ entitlementAmount: 12 })
      .expect(200);

    const assignment = await request(server)
      .get(`/api/v1/leave-policy-assignments?employeeId=${employeeId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(assignment.body.items[0].id).toBe(assignmentId);

    const balances = await request(server)
      .get("/api/v1/leave-balances/me")
      .set(auth(employeeToken))
      .expect(200);
    const row = (balances.body as LeaveBalance[]).find((item) => item.leaveType.id === leaveTypeId);
    expect(row!.entitled).toBe(10);
  });
});
