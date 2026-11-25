import type { INestApplication } from "@nestjs/common";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { createPrismaClient, type PrismaClient } from "@peopleops/database";
import type {
  EmployeeCompensation,
  PayrollAdjustment,
  PayrollComponent,
  PayrollPeriod,
  PayrollPayslip,
  PayrollPayslipDetail,
  PayrollRunDetail,
  RoleDetail,
} from "@peopleops/shared-types";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, TEST_DATABASE_URL } from "./test-env";

interface LoginBody {
  accessToken: string;
  user: { id: string; email: string; permissions: string[] };
}

const PASSWORD = "PayrollPass123";
const PERIOD_START = "2026-02-01";
const PERIOD_END = "2026-02-28";
const PAYMENT_DATE = "2026-02-28";

describe("Payroll management (e2e)", () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication["getHttpServer"]>;
  let adminToken: string;
  let employeeToken: string;
  let outsiderToken: string;
  let prisma: PrismaClient;

  let branchId: string;
  let departmentId: string;
  let positionId: string;
  let employeeId: string;
  let outsiderEmployeeId: string;
  let periodId: string;
  let runId: string;
  let allowanceId: string;
  let deductionId: string;
  let payslipId: string;

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

  async function payslipForRun(employee: string): Promise<PayrollPayslip> {
    const response = await request(server)
      .get(`/api/v1/payroll/payslips?runId=${runId}&employeeId=${employee}&pageSize=100`)
      .set(auth(adminToken))
      .expect(200);
    const items = response.body.items as PayrollPayslip[];
    const payslip = items.find((item) => item.employeeId === employee);
    if (!payslip) throw new Error("Expected a payslip for the employee");
    return payslip;
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
    const employeeRole = roleItems.find((role) => role.code === "EMPLOYEE");
    if (!employeeRole) throw new Error("EMPLOYEE role is required");

    const employeeUserId = await createUser(
      "E2E Payroll Employee",
      "e2e.payroll.employee@peopleops.test",
      [employeeRole.id],
    );
    const outsiderUserId = await createUser(
      "E2E Payroll Outsider",
      "e2e.payroll.outsider@peopleops.test",
      [employeeRole.id],
    );
    employeeToken = await login("e2e.payroll.employee@peopleops.test", PASSWORD);
    outsiderToken = await login("e2e.payroll.outsider@peopleops.test", PASSWORD);

    const branch = await request(server)
      .post("/api/v1/branches")
      .set(auth(adminToken))
      .send({ name: "E2E Payroll Branch", code: "E2E-PAY-BR" })
      .expect(201);
    branchId = branch.body.id as string;

    const department = await request(server)
      .post("/api/v1/departments")
      .set(auth(adminToken))
      .send({ name: "E2E Payroll Finance", code: "E2E-PAY-DEPT", branchId })
      .expect(201);
    departmentId = department.body.id as string;

    const position = await request(server)
      .post("/api/v1/positions")
      .set(auth(adminToken))
      .send({ title: "E2E Payroll Specialist", code: "E2E-PAY-POS", departmentId })
      .expect(201);
    positionId = position.body.id as string;

    employeeId = await createEmployee({
      employeeNumber: "E2E-PAY-EMP",
      firstName: "Prita",
      lastName: "Payroll",
      personalEmail: "e2e.payroll.emp@example.com",
    });
    await request(server)
      .patch(`/api/v1/employees/${employeeId}/user`)
      .set(auth(adminToken))
      .send({ userId: employeeUserId })
      .expect(200);

    outsiderEmployeeId = await createEmployee({
      employeeNumber: "E2E-PAY-OUT",
      firstName: "Oscar",
      lastName: "Outsider",
      personalEmail: "e2e.payroll.out@example.com",
    });
    await request(server)
      .patch(`/api/v1/employees/${outsiderEmployeeId}/user`)
      .set(auth(adminToken))
      .send({ userId: outsiderUserId })
      .expect(200);

    await request(server)
      .post("/api/v1/payroll/compensation")
      .set(auth(adminToken))
      .send({
        employeeId,
        baseSalary: "10000000",
        currency: "IDR",
        paymentFrequency: "MONTHLY",
        effectiveFrom: "2025-01-01",
      })
      .expect(201)
      .then((response) => response.body as EmployeeCompensation);

    const allowance = await request(server)
      .post("/api/v1/payroll/components")
      .set(auth(adminToken))
      .send({
        code: "E2E_PAY_ALLOWANCE",
        name: "E2E payroll allowance",
        componentType: "EARNING",
        calculationType: "FIXED_AMOUNT",
        defaultAmount: "1000000",
        effectiveFrom: "2025-01-01",
      })
      .expect(201);
    allowanceId = (allowance.body as PayrollComponent).id;

    const deduction = await request(server)
      .post("/api/v1/payroll/components")
      .set(auth(adminToken))
      .send({
        code: "E2E_PAY_DEDUCTION",
        name: "E2E payroll deduction",
        componentType: "DEDUCTION",
        calculationType: "FIXED_AMOUNT",
        defaultAmount: "250000",
        effectiveFrom: "2025-01-01",
      })
      .expect(201);
    deductionId = (deduction.body as PayrollComponent).id;

    await request(server)
      .post("/api/v1/payroll/assignments")
      .set(auth(adminToken))
      .send({
        employeeId,
        componentId: allowanceId,
        effectiveFrom: "2025-01-01",
      })
      .expect(201);

    const period = await request(server)
      .post("/api/v1/payroll/periods")
      .set(auth(adminToken))
      .send({
        name: "E2E February 2026",
        startDate: PERIOD_START,
        endDate: PERIOD_END,
        paymentDate: PAYMENT_DATE,
      })
      .expect(201);
    periodId = (period.body as PayrollPeriod).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it("creates one active run per period and rejects duplicates", async () => {
    const created = await request(server)
      .post("/api/v1/payroll/runs")
      .set(auth(adminToken))
      .send({ periodId })
      .expect(201);
    runId = (created.body as PayrollRunDetail).id;
    expect(created.body.status).toBe("DRAFT");

    await request(server)
      .post("/api/v1/payroll/runs")
      .set(auth(adminToken))
      .send({ periodId })
      .expect(409);
  });

  it("calculates base salary and assigned fixed earnings", async () => {
    const calculated = await request(server)
      .post(`/api/v1/payroll/runs/${runId}/calculate`)
      .set(auth(adminToken))
      .expect(201);
    expect(calculated.body.status).toBe("CALCULATED");
    expect(calculated.body.calculationVersion).toBe(1);

    const payslip = await payslipForRun(employeeId);
    payslipId = payslip.id;
    expect(payslip.baseSalary).toBe("10000000");
    expect(payslip.grossPay).toBe("11000000");
    expect(payslip.netPay).toBe("11000000");
  });

  it("applies only approved adjustments on recalculation", async () => {
    const adjustment = await request(server)
      .post("/api/v1/payroll/adjustments")
      .set(auth(adminToken))
      .send({
        periodId,
        employeeId,
        componentId: deductionId,
        amount: "250000",
        reason: "E2E approved deduction",
      })
      .expect(201);
    const adjustmentId = (adjustment.body as PayrollAdjustment).id;

    await request(server)
      .post(`/api/v1/payroll/runs/${runId}/calculate`)
      .set(auth(adminToken))
      .expect(201);
    const beforeApproval = await payslipForRun(employeeId);
    expect(beforeApproval.netPay).toBe("11000000");

    await request(server)
      .post(`/api/v1/payroll/adjustments/${adjustmentId}/review`)
      .set(auth(adminToken))
      .send({ status: "APPROVED", comment: "Approved in e2e" })
      .expect(201);

    const recalculated = await request(server)
      .post(`/api/v1/payroll/runs/${runId}/calculate`)
      .set(auth(adminToken))
      .expect(201);
    expect(recalculated.body.calculationVersion).toBe(3);
    const afterApproval = await payslipForRun(employeeId);
    payslipId = afterApproval.id;
    expect(afterApproval.totalDeductions).toBe("250000");
    expect(afterApproval.netPay).toBe("10750000");
  });

  it("moves through review, approval, and publication", async () => {
    await request(server)
      .post(`/api/v1/payroll/runs/${runId}/submit-review`)
      .set(auth(adminToken))
      .send({ comment: "Ready for review" })
      .expect(201);
    await request(server)
      .post(`/api/v1/payroll/runs/${runId}/approve`)
      .set(auth(adminToken))
      .send({ comment: "Approved" })
      .expect(201);
    const published = await request(server)
      .post(`/api/v1/payroll/runs/${runId}/publish`)
      .set(auth(adminToken))
      .send({ comment: "Published" })
      .expect(201);
    expect(published.body.status).toBe("PUBLISHED");
    expect(published.body.approvals.length).toBeGreaterThanOrEqual(4);
  });

  it("protects published snapshots from later compensation changes", async () => {
    await request(server)
      .patch(`/api/v1/payroll/compensation/${(
        await request(server)
          .get(`/api/v1/payroll/compensation?employeeId=${employeeId}`)
          .set(auth(adminToken))
          .expect(200)
      ).body.items[0].id}`)
      .set(auth(adminToken))
      .send({ baseSalary: "12000000" })
      .expect(200);

    const detail = await request(server)
      .get(`/api/v1/payroll/payslips/${payslipId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(detail.body.baseSalary).toBe("10000000");
    expect(detail.body.netPay).toBe("10750000");
  });

  it("consumes attendance, approved unpaid leave, and verified overtime sources", async () => {
    const period = await request(server)
      .post("/api/v1/payroll/periods")
      .set(auth(adminToken))
      .send({
        name: "E2E March 2026",
        startDate: "2026-03-01",
        endDate: "2026-03-31",
        paymentDate: "2026-03-31",
      })
      .expect(201);
    const sourcePeriodId = (period.body as PayrollPeriod).id;

    await request(server)
      .post("/api/v1/payroll/compensation")
      .set(auth(adminToken))
      .send({
        employeeId: outsiderEmployeeId,
        baseSalary: "22000000",
        currency: "IDR",
        paymentFrequency: "MONTHLY",
        effectiveFrom: "2026-03-01",
      })
      .expect(201);

    const sourceComponents = await Promise.all(
      [
        {
          code: "E2E_ABSENCE_DEDUCTION",
          name: "E2E absence deduction",
          componentType: "DEDUCTION",
          sourceType: "ABSENCE",
        },
        {
          code: "E2E_UNPAID_LEAVE_DEDUCTION",
          name: "E2E unpaid leave deduction",
          componentType: "DEDUCTION",
          sourceType: "UNPAID_LEAVE",
        },
        {
          code: "E2E_OVERTIME_PAY",
          name: "E2E overtime pay",
          componentType: "EARNING",
          sourceType: "OVERTIME",
          rateMultiplier: "1.5",
        },
      ].map((body) =>
        request(server)
          .post("/api/v1/payroll/components")
          .set(auth(adminToken))
          .send({
            calculationType: "SOURCE_BASED",
            rateMultiplier: "1",
            effectiveFrom: "2025-01-01",
            ...body,
          })
          .expect(201),
      ),
    );

    for (const component of sourceComponents) {
      await request(server)
        .post("/api/v1/payroll/assignments")
        .set(auth(adminToken))
        .send({
          employeeId: outsiderEmployeeId,
          componentId: (component.body as PayrollComponent).id,
          effectiveFrom: "2026-03-01",
        })
        .expect(201);
    }

    const percentage = await request(server)
      .post("/api/v1/payroll/components")
      .set(auth(adminToken))
      .send({
        code: "E2E_PERCENTAGE_EARNING",
        name: "E2E percentage earning",
        componentType: "EARNING",
        calculationType: "PERCENTAGE",
        percentage: "10",
        effectiveFrom: "2025-01-01",
      })
      .expect(201);
    const employerContribution = await request(server)
      .post("/api/v1/payroll/components")
      .set(auth(adminToken))
      .send({
        code: "E2E_EMPLOYER_CONTRIBUTION",
        name: "E2E employer contribution",
        componentType: "EMPLOYER_CONTRIBUTION",
        calculationType: "FIXED_AMOUNT",
        defaultAmount: "500000",
        effectiveFrom: "2025-01-01",
      })
      .expect(201);
    for (const component of [percentage, employerContribution]) {
      await request(server)
        .post("/api/v1/payroll/assignments")
        .set(auth(adminToken))
        .send({
          employeeId: outsiderEmployeeId,
          componentId: (component.body as PayrollComponent).id,
          effectiveFrom: "2026-03-01",
        })
        .expect(201);
    }

    await prisma.attendanceRecord.create({
      data: {
        employeeId: outsiderEmployeeId,
        workDate: new Date("2026-03-04T00:00:00.000Z"),
        timezone: "Asia/Jakarta",
        scheduledStartAt: new Date("2026-03-04T01:00:00.000Z"),
        scheduledEndAt: new Date("2026-03-04T10:00:00.000Z"),
        status: "ABSENT",
      },
    });

    const leaveType = await prisma.leaveType.create({
      data: { name: "E2E Unpaid Leave", code: "E2E-UNPAID", isPaid: false },
    });
    const leavePolicy = await prisma.leavePolicy.create({
      data: {
        name: "E2E Unpaid Leave Policy",
        code: "E2E-UNPAID-POLICY",
        leaveTypeId: leaveType.id,
        effectiveFrom: new Date("2025-01-01T00:00:00.000Z"),
        allowUnpaidLeave: true,
      },
    });
    const entitlement = await prisma.leaveEntitlementPeriod.create({
      data: {
        employeeId: outsiderEmployeeId,
        leaveTypeId: leaveType.id,
        policyId: leavePolicy.id,
        periodStart: new Date("2026-01-01T00:00:00.000Z"),
        periodEnd: new Date("2026-12-31T00:00:00.000Z"),
        entitlementAmount: "0",
        policySnapshot: { code: leavePolicy.code },
      },
    });
    const leave = await prisma.leaveRequest.create({
      data: {
        employeeId: outsiderEmployeeId,
        leaveTypeId: leaveType.id,
        entitlementPeriodId: entitlement.id,
        startDate: new Date("2026-03-09T00:00:00.000Z"),
        endDate: new Date("2026-03-10T00:00:00.000Z"),
        duration: "2",
        reason: "E2E unpaid leave",
        status: "APPROVED",
      },
    });
    await prisma.leaveRequestDay.createMany({
      data: [
        { requestId: leave.id, date: new Date("2026-03-09T00:00:00.000Z"), duration: "1" },
        { requestId: leave.id, date: new Date("2026-03-10T00:00:00.000Z"), duration: "1" },
      ],
    });

    const overtimePolicy = await prisma.overtimePolicy.create({
      data: {
        name: "E2E Overtime Policy",
        code: "E2E-OT-POLICY",
        effectiveFrom: new Date("2025-01-01T00:00:00.000Z"),
      },
    });
    await prisma.overtimeRequest.create({
      data: {
        employeeId: outsiderEmployeeId,
        policyId: overtimePolicy.id,
        workDate: new Date("2026-03-12T00:00:00.000Z"),
        category: "WEEKDAY",
        reason: "E2E verified overtime",
        plannedStartAt: new Date("2026-03-12T10:00:00.000Z"),
        plannedEndAt: new Date("2026-03-12T12:00:00.000Z"),
        actualStartAt: new Date("2026-03-12T10:00:00.000Z"),
        actualEndAt: new Date("2026-03-12T12:00:00.000Z"),
        requestedMinutes: 120,
        actualMinutes: 120,
        verifiedMinutes: 120,
        approvedMinutes: 120,
        status: "VERIFIED",
        verifiedAt: new Date(),
        policySnapshot: { code: overtimePolicy.code },
      },
    });

    const createdRun = await request(server)
      .post("/api/v1/payroll/runs")
      .set(auth(adminToken))
      .send({ periodId: sourcePeriodId })
      .expect(201);
    const sourceRunId = (createdRun.body as PayrollRunDetail).id;
    await request(server)
      .post(`/api/v1/payroll/runs/${sourceRunId}/calculate`)
      .set(auth(adminToken))
      .expect(201);

    const list = await request(server)
      .get(`/api/v1/payroll/payslips?runId=${sourceRunId}&employeeId=${outsiderEmployeeId}`)
      .set(auth(adminToken))
      .expect(200);
    const payslip = (list.body.items as PayrollPayslip[])[0];
    if (!payslip) throw new Error("Expected a source-based payslip");
    expect(payslip.grossPay).toBe("24581502.89");
    expect(payslip.totalDeductions).toBe("3000000");
    expect(payslip.employerContributions).toBe("500000");
    expect(payslip.netPay).toBe("21581502.89");

    const detail = await request(server)
      .get(`/api/v1/payroll/payslips/${payslip.id}`)
      .set(auth(adminToken))
      .expect(200);
    const sources = (detail.body as PayrollPayslipDetail).sources;
    expect(sources.map((source) => source.kind).sort()).toEqual([
      "ATTENDANCE",
      "LEAVE",
      "OVERTIME",
    ]);
  });

  it("paginates the payroll register while totals cover every row", async () => {
    const runs = await request(server)
      .get("/api/v1/payroll/runs?pageSize=100")
      .set(auth(adminToken))
      .expect(200);
    const sourceRun = (runs.body.items as PayrollRunDetail[]).find(
      (run) => run.period.name === "E2E March 2026",
    );
    if (!sourceRun) throw new Error("Expected the March payroll run");

    await request(server)
      .post(`/api/v1/payroll/runs/${sourceRun.id}/submit-review`)
      .set(auth(adminToken))
      .send({ comment: "Ready" })
      .expect(201);
    await request(server)
      .post(`/api/v1/payroll/runs/${sourceRun.id}/approve`)
      .set(auth(adminToken))
      .send({ comment: "Approved" })
      .expect(201);
    await request(server)
      .post(`/api/v1/payroll/runs/${sourceRun.id}/publish`)
      .set(auth(adminToken))
      .send({ comment: "Published" })
      .expect(201);

    const first = await request(server)
      .get("/api/v1/payroll/reports/register?from=2026-03-01&to=2026-03-31&page=1&pageSize=1")
      .set(auth(adminToken))
      .expect(200);
    expect(first.body.total).toBe(2);
    expect(first.body.totalPages).toBe(2);
    expect(first.body.rows).toHaveLength(1);
    expect(first.body.totals).toEqual({
      grossPay: "37581502.89",
      totalDeductions: "3000000.00",
      netPay: "34581502.89",
      employerContributions: "500000.00",
    });

    const second = await request(server)
      .get("/api/v1/payroll/reports/register?from=2026-03-01&to=2026-03-31&page=2&pageSize=1")
      .set(auth(adminToken))
      .expect(200);
    expect(second.body.rows).toHaveLength(1);
    expect(second.body.rows[0].payslipId).not.toBe(first.body.rows[0].payslipId);
    expect(second.body.totals).toEqual(first.body.totals);
  });

  it("lets employees read and download only their own published payslip", async () => {
    await request(server)
      .get(`/api/v1/payroll/payslips/${payslipId}`)
      .set(auth(employeeToken))
      .expect(200);
    await request(server)
      .get(`/api/v1/payroll/payslips/${payslipId}`)
      .set(auth(outsiderToken))
      .expect(403);
    const pdf = await request(server)
      .get(`/api/v1/payroll/payslips/${payslipId}/pdf`)
      .set(auth(employeeToken))
      .expect(200);
    expect(pdf.headers["content-type"]).toContain("application/pdf");
    expect(pdf.body.length).toBeGreaterThan(1000);
  });
});
