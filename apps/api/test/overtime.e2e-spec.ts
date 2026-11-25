import type { INestApplication } from "@nestjs/common";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { DateTime } from "luxon";
import request from "supertest";
import { createPrismaClient, type PrismaClient } from "@peopleops/database";
import type {
  OvertimePolicy,
  OvertimePolicyAssignment,
  OvertimeRequest,
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

const PASSWORD = "OvertimePass123";
const TZ = "Asia/Jakarta";

describe("Overtime management (e2e)", () => {
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
  let policyId: string;
  let assignmentId: string;
  let prisma: PrismaClient;

  const today = DateTime.now().setZone(TZ).toFormat("yyyy-MM-dd");
  const tomorrow = DateTime.now().setZone(TZ).plus({ days: 1 }).toFormat("yyyy-MM-dd");
  const yearStart = `${DateTime.now().setZone(TZ).year}-01-01`;
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

  function instant(workDate: string, time: string): string {
    return DateTime.fromISO(`${workDate}T${time}:00`, { zone: TZ }).toUTC().toISO()!;
  }

  async function createDraft(
    workDate: string,
    startTime: string,
    endTime: string,
    clientRequestId?: string,
  ): Promise<OvertimeRequest> {
    const response = await request(server)
      .post("/api/v1/overtime/requests")
      .set(auth(employeeToken))
      .send({
        workDate,
        reason: "E2E overtime coverage",
        plannedStartAt: instant(workDate, startTime),
        plannedEndAt: instant(workDate, endTime),
        plannedBreakMinutes: 0,
        ...(clientRequestId ? { clientRequestId } : {}),
      })
      .expect(201);
    return response.body as OvertimeRequest;
  }

  async function submit(id: string): Promise<OvertimeRequest> {
    const response = await request(server)
      .post(`/api/v1/overtime/requests/${id}/submit`)
      .set(auth(employeeToken))
      .expect(201);
    return response.body as OvertimeRequest;
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
      "E2E Overtime Manager",
      "e2e.overtime.manager@peopleops.test",
      [managerRole!.id],
    );
    const employeeUserId = await createUser(
      "E2E Overtime Staff",
      "e2e.overtime.staff@peopleops.test",
      [employeeRole!.id],
    );
    const outsiderUserId = await createUser(
      "E2E Overtime Outsider",
      "e2e.overtime.outsider@peopleops.test",
      [employeeRole!.id],
    );

    managerToken = await login("e2e.overtime.manager@peopleops.test", PASSWORD);
    employeeToken = await login("e2e.overtime.staff@peopleops.test", PASSWORD);
    outsiderToken = await login("e2e.overtime.outsider@peopleops.test", PASSWORD);

    const branch = await request(server)
      .post("/api/v1/branches")
      .set(auth(adminToken))
      .send({ name: "E2E Overtime Branch", code: "E2E-OT-BR" })
      .expect(201);
    branchId = branch.body.id as string;

    const department = await request(server)
      .post("/api/v1/departments")
      .set(auth(adminToken))
      .send({ name: "E2E Overtime Ops", code: "E2E-OT-DEPT", branchId })
      .expect(201);
    departmentId = department.body.id as string;

    const position = await request(server)
      .post("/api/v1/positions")
      .set(auth(adminToken))
      .send({ title: "E2E Overtime Officer", code: "E2E-OT-POS", departmentId })
      .expect(201);
    positionId = position.body.id as string;

    managerEmployeeId = await createEmployee({
      employeeNumber: "E2E-OT-MGR",
      firstName: "Maya",
      lastName: "Manager",
      personalEmail: "e2e.overtime.mgr@example.com",
    });
    await request(server)
      .patch(`/api/v1/employees/${managerEmployeeId}/user`)
      .set(auth(adminToken))
      .send({ userId: managerUserId })
      .expect(200);

    employeeId = await createEmployee({
      employeeNumber: "E2E-OT-EMP",
      firstName: "Rina",
      lastName: "Staff",
      personalEmail: "e2e.overtime.emp@example.com",
      managerId: managerEmployeeId,
    });
    await request(server)
      .patch(`/api/v1/employees/${employeeId}/user`)
      .set(auth(adminToken))
      .send({ userId: employeeUserId })
      .expect(200);

    outsiderEmployeeId = await createEmployee({
      employeeNumber: "E2E-OT-OUT",
      firstName: "Oka",
      lastName: "Outsider",
      personalEmail: "e2e.overtime.out@example.com",
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
        name: "E2E Overtime Standard",
        code: "E2E-OT-WS",
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
        .send({
          workScheduleId: scheduleId,
          effectiveFrom: yearStart,
          changeReason: "E2E overtime",
        })
        .expect(201);
    }

    const policy = await request(server)
      .post("/api/v1/overtime/policies")
      .set(auth(adminToken))
      .send({
        name: "E2E Standard Overtime",
        code: "E2E-OT-STD",
        status: "ACTIVE",
        effectiveFrom: yearStart,
        minMinutes: 30,
        maxMinutes: 240,
        roundingStrategy: "NONE",
        roundingMinutes: 15,
        approvalMode: "MANAGER_AND_HR",
        requiresAttachment: false,
        allowWeekend: true,
        allowHoliday: true,
        eligibleEmploymentStatuses: ["ACTIVE", "PROBATION"],
      });
    expect(policy.status).toBe(201);
    policyId = (policy.body as OvertimePolicy).id;

    const assignment = await request(server)
      .post("/api/v1/overtime/assignments")
      .set(auth(adminToken))
      .send({ policyId, employeeId, effectiveFrom: yearStart })
      .expect(201);
    assignmentId = (assignment.body as OvertimePolicyAssignment).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it("creates and submits a draft for the signed-in employee", async () => {
    const earlyDraft = await createDraft(today, "00:30", "02:00");
    expect(earlyDraft.workDate).toBe(today);

    const draft = await createDraft(today, "18:00", "19:00");
    expect(draft).toMatchObject({
      status: "DRAFT",
      employeeId,
      requestedMinutes: 60,
      category: "WEEKDAY",
      policy: { id: policyId },
    });

    const submitted = await submit(draft.id);
    expect(submitted.status).toBe("PENDING_MANAGER_APPROVAL");
    expect(submitted.approvalStage).toBe("MANAGER");

    const mine = await request(server)
      .get("/api/v1/overtime/requests/me?pageSize=10")
      .set(auth(employeeToken))
      .expect(200);
    expect(mine.body.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: draft.id })]),
    );
    expect(mine.body.items[0]).not.toHaveProperty("approvals");

    const search = await request(server)
      .get("/api/v1/overtime/requests?search=Rina&pageSize=50")
      .set(auth(managerToken))
      .expect(200);
    expect(search.body.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: draft.id })]),
    );

    const pending = await request(server)
      .get(
        "/api/v1/overtime/requests?statuses=PENDING_MANAGER_APPROVAL,PENDING_HR_APPROVAL&pageSize=50",
      )
      .set(auth(managerToken))
      .expect(200);
    expect(pending.body.items.length).toBeGreaterThan(0);
    expect(
      pending.body.items.every((item: OvertimeRequest) => item.status.startsWith("PENDING")),
    ).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: {
        entityType: "overtime_request",
        entityId: draft.id,
        action: "overtime_request.submitted",
      },
    });
    expect(audit).not.toBeNull();
  });

  it("runs manager then HR approval, actual recording, verification, and correction", async () => {
    const draft = await createDraft(today, "19:00", "21:00");
    await submit(draft.id);

    const managerApproved = await request(server)
      .post(`/api/v1/overtime/requests/${draft.id}/approve`)
      .set(auth(managerToken))
      .send({ comment: "Manager approved" })
      .expect(201);
    expect(managerApproved.body).toMatchObject({
      status: "PENDING_HR_APPROVAL",
      approvalStage: "HR",
    });

    const hrApproved = await request(server)
      .post(`/api/v1/overtime/requests/${draft.id}/approve`)
      .set(auth(adminToken))
      .send({ comment: "HR approved" })
      .expect(201);
    expect(hrApproved.body).toMatchObject({
      status: "APPROVED",
      approvalStage: null,
      approvedMinutes: 120,
    });

    const completed = await request(server)
      .post(`/api/v1/overtime/requests/${draft.id}/complete`)
      .set(auth(employeeToken))
      .send({
        actualStartAt: instant(today, "19:00"),
        actualEndAt: instant(today, "20:30"),
        actualBreakMinutes: 0,
      })
      .expect(201);
    expect(completed.body).toMatchObject({
      status: "PENDING_VERIFICATION",
      actualMinutes: 90,
    });

    const verified = await request(server)
      .post(`/api/v1/overtime/requests/${draft.id}/verify`)
      .set(auth(adminToken))
      .send({})
      .expect(201);
    expect(verified.body).toMatchObject({ status: "VERIFIED", verifiedMinutes: 90 });

    const corrected = await request(server)
      .post(`/api/v1/overtime/requests/${draft.id}/correct`)
      .set(auth(adminToken))
      .send({ correctedMinutes: 75, reason: "Adjusted to the approved evidence" })
      .expect(201);
    expect(corrected.body.verifiedMinutes).toBe(75);
    expect(corrected.body.corrections).toEqual(
      expect.arrayContaining([expect.objectContaining({ previousValue: 90, correctedValue: 75 })]),
    );

    const summary = await request(server)
      .get(`/api/v1/overtime/summary?from=${today}&to=${today}`)
      .set(auth(adminToken))
      .expect(200);
    expect(summary.body.verifiedMinutes).toBe(75);
    expect(summary.body.verifiedCount).toBe(1);

    await request(server)
      .post(`/api/v1/overtime/requests/${draft.id}/cancel`)
      .set(auth(adminToken))
      .send({ reason: "E2E cancellation after verification" })
      .expect(201);

    const afterCancel = await request(server)
      .get(`/api/v1/overtime/summary?from=${today}&to=${today}`)
      .set(auth(adminToken))
      .expect(200);
    expect(afterCancel.body.verifiedMinutes).toBe(0);
    expect(afterCancel.body.verifiedCount).toBe(0);
  });

  it("lets HR override a manager-stage approval and finalize it", async () => {
    const draft = await createDraft(today, "16:00", "17:00");
    await submit(draft.id);

    const overridden = await request(server)
      .post(`/api/v1/overtime/requests/${draft.id}/approve`)
      .set(auth(adminToken))
      .send({ comment: "HR override", override: true })
      .expect(201);

    expect(overridden.body).toMatchObject({
      status: "APPROVED",
      approvalStage: null,
      approvedMinutes: 60,
    });
    expect(overridden.body.approvals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: "MANAGER", decision: "APPROVED", isOverride: true }),
      ]),
    );
  });

  it("rejects a request and allows the employee to withdraw another", async () => {
    const rejectedDraft = await createDraft(today, "21:30", "22:30");
    await submit(rejectedDraft.id);
    const rejected = await request(server)
      .post(`/api/v1/overtime/requests/${rejectedDraft.id}/reject`)
      .set(auth(managerToken))
      .send({ comment: "Insufficient operational need" })
      .expect(201);
    expect(rejected.body.status).toBe("REJECTED");

    const withdrawnDraft = await createDraft(today, "22:30", "23:30");
    await submit(withdrawnDraft.id);
    const withdrawn = await request(server)
      .post(`/api/v1/overtime/requests/${withdrawnDraft.id}/withdraw`)
      .set(auth(employeeToken))
      .expect(201);
    expect(withdrawn.body.status).toBe("WITHDRAWN");
    expect(withdrawn.body.approvalStage).toBeNull();
  });

  it("prevents duplicate client submissions and concurrent double submission", async () => {
    const clientRequestId = `e2e-${Date.now()}`;
    await createDraft(tomorrow, "18:00", "19:00", clientRequestId);

    const duplicate = await request(server)
      .post("/api/v1/overtime/requests")
      .set(auth(employeeToken))
      .send({
        workDate: tomorrow,
        reason: "Duplicate submission attempt",
        plannedStartAt: instant(tomorrow, "19:00"),
        plannedEndAt: instant(tomorrow, "20:00"),
        plannedBreakMinutes: 0,
        clientRequestId,
      })
      .expect(409);
    expect(duplicate.body.code).toBe("OVERTIME_REQUEST_DUPLICATE");

    const concurrentDraft = await createDraft(tomorrow, "20:00", "21:00");
    const results = await Promise.all([
      request(server)
        .post(`/api/v1/overtime/requests/${concurrentDraft.id}/submit`)
        .set(auth(employeeToken)),
      request(server)
        .post(`/api/v1/overtime/requests/${concurrentDraft.id}/submit`)
        .set(auth(employeeToken)),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
  });

  it("denies out-of-scope access and approval without permission", async () => {
    const draft = await createDraft(tomorrow, "22:00", "23:00");
    await submit(draft.id);

    const outsiderRead = await request(server)
      .get(`/api/v1/overtime/requests/${draft.id}`)
      .set(auth(outsiderToken))
      .expect(403);
    expect(outsiderRead.body.code).toBe("OVERTIME_OUT_OF_SCOPE");

    await request(server)
      .post(`/api/v1/overtime/requests/${draft.id}/approve`)
      .set(auth(employeeToken))
      .send({ comment: "Self approval" })
      .expect(403);

    const managerList = await request(server)
      .get("/api/v1/overtime/requests?pageSize=50")
      .set(auth(managerToken))
      .expect(200);
    expect(managerList.body.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: draft.id })]),
    );

    expect(assignmentId).toBeTruthy();
  });
});
