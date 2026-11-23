import type { INestApplication } from "@nestjs/common";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import type {
  EmployeeDetail,
  EmployeeDocument,
  EmploymentHistoryEntry,
  PaginatedResponse,
  RoleDetail,
} from "@peopleops/shared-types";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "./test-env";

interface LoginBody {
  accessToken: string;
  user: { id: string; email: string; permissions: string[] };
}

const PASSWORD = "EmployeePass123";

describe("Employee management (e2e)", () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication["getHttpServer"]>;
  let adminToken: string;
  let managerToken: string;
  let employeeToken: string;
  let outsiderToken: string;

  let branchId: string;
  let departmentId: string;
  let positionOneId: string;
  let positionTwoId: string;
  let managerEmployeeId: string;
  let employeeId: string;
  let otherEmployeeId: string;
  let managerUserId: string;
  let employeeUserId: string;
  let documentId: string;

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

    managerUserId = await createUser("E2E Manager User", "e2e.manager@peopleops.test", [
      managerRole!.id,
    ]);
    employeeUserId = await createUser("E2E Employee User", "e2e.staff.employee@peopleops.test", [
      employeeRole!.id,
    ]);
    await createUser("E2E Outsider User", "e2e.outsider@peopleops.test", [employeeRole!.id]);
    await createUser("E2E No Employee", "e2e.nouser@peopleops.test", [employeeRole!.id]);

    managerToken = await login("e2e.manager@peopleops.test", PASSWORD);
    employeeToken = await login("e2e.staff.employee@peopleops.test", PASSWORD);
    outsiderToken = await login("e2e.outsider@peopleops.test", PASSWORD);

    const branch = await request(server)
      .post("/api/v1/branches")
      .set(auth(adminToken))
      .send({ name: "E2E Jakarta Branch", code: "E2E-BR" })
      .expect(201);
    branchId = branch.body.id as string;

    const department = await request(server)
      .post("/api/v1/departments")
      .set(auth(adminToken))
      .send({ name: "E2E Engineering", code: "E2E-ENG", branchId })
      .expect(201);
    departmentId = department.body.id as string;

    const positionOne = await request(server)
      .post("/api/v1/positions")
      .set(auth(adminToken))
      .send({ title: "E2E Engineer", code: "E2E-POS1", departmentId })
      .expect(201);
    positionOneId = positionOne.body.id as string;

    const positionTwo = await request(server)
      .post("/api/v1/positions")
      .set(auth(adminToken))
      .send({ title: "E2E Senior Engineer", code: "E2E-POS2", departmentId })
      .expect(201);
    positionTwoId = positionTwo.body.id as string;
  });

  afterAll(async () => {
    await app.close();
  });

  function employeePayload(overrides: Record<string, unknown>) {
    return {
      employmentType: "PERMANENT",
      joinDate: "2025-01-06",
      personalEmail: "e2e.person@example.com",
      ...overrides,
    };
  }

  it("creates employees with a consistent branch, department and position", async () => {
    const manager = await request(server)
      .post("/api/v1/employees")
      .set(auth(adminToken))
      .send(
        employeePayload({
          employeeNumber: "E2E-MGR",
          firstName: "Maya",
          lastName: "Manager",
          personalEmail: "maya.manager@example.com",
          branchId,
          departmentId,
          positionId: positionOneId,
        }),
      )
      .expect(201);

    managerEmployeeId = (manager.body as EmployeeDetail).id;
    await request(server)
      .patch(`/api/v1/employees/${managerEmployeeId}/user`)
      .set(auth(adminToken))
      .send({ userId: managerUserId })
      .expect(200);
    expect((manager.body as EmployeeDetail).branch?.id).toBe(branchId);
    expect((manager.body as EmployeeDetail).department?.id).toBe(departmentId);
    expect((manager.body as EmployeeDetail).position?.id).toBe(positionOneId);

    const employee = await request(server)
      .post("/api/v1/employees")
      .set(auth(adminToken))
      .send(
        employeePayload({
          employeeNumber: "E2E-EMP",
          firstName: "Rina",
          lastName: "Staff",
          personalEmail: "rina.staff@example.com",
          branchId,
          departmentId,
          positionId: positionOneId,
          managerId: managerEmployeeId,
        }),
      )
      .expect(201);
    employeeId = (employee.body as EmployeeDetail).id;
    await request(server)
      .patch(`/api/v1/employees/${employeeId}/user`)
      .set(auth(adminToken))
      .send({ userId: employeeUserId })
      .expect(200);
    expect((employee.body as EmployeeDetail).manager?.id).toBe(managerEmployeeId);

    const other = await request(server)
      .post("/api/v1/employees")
      .set(auth(adminToken))
      .send(
        employeePayload({
          employeeNumber: "E2E-OTHER",
          firstName: "Oscar",
          lastName: "Outside",
          personalEmail: "oscar.outside@example.com",
          branchId,
          departmentId,
          positionId: positionOneId,
        }),
      )
      .expect(201);
    otherEmployeeId = (other.body as EmployeeDetail).id;

    const mismatch = await request(server)
      .post("/api/v1/employees")
      .set(auth(adminToken))
      .send(
        employeePayload({
          employeeNumber: "E2E-BAD",
          firstName: "Bad",
          lastName: "Position",
          personalEmail: "bad.position@example.com",
          branchId,
          departmentId: "00000000-0000-4000-8000-000000000000",
          positionId: positionOneId,
        }),
      )
      .expect(400);
    expect(mismatch.body.code).toBe("POSITION_DEPARTMENT_MISMATCH");

    const history = await request(server)
      .get(`/api/v1/employees/${employeeId}/history`)
      .set(auth(adminToken))
      .expect(200);
    expect(history.body as EmploymentHistoryEntry[]).toHaveLength(1);
    expect((history.body as EmploymentHistoryEntry[])[0]!.employmentType).toBe("PERMANENT");
  });

  it("records a transactional employment history entry when the position changes", async () => {
    await request(server)
      .patch(`/api/v1/employees/${employeeId}`)
      .set(auth(adminToken))
      .send({ positionId: positionTwoId, effectiveDate: "2025-06-01", changeReason: "Promotion" })
      .expect(200);

    const history = await request(server)
      .get(`/api/v1/employees/${employeeId}/history`)
      .set(auth(adminToken))
      .expect(200);
    const entries = history.body as EmploymentHistoryEntry[];

    expect(entries).toHaveLength(2);
    expect(entries[0]!.effectiveFrom).toBe("2025-06-01");
    expect(entries[0]!.position?.id).toBe(positionTwoId);
    expect(entries[0]!.changeReason).toBe("Promotion");
    expect(entries[1]!.effectiveTo).toBe("2025-05-31");
    expect(entries[1]!.position?.id).toBe(positionOneId);

    const overlap = await request(server)
      .patch(`/api/v1/employees/${employeeId}`)
      .set(auth(adminToken))
      .send({ positionId: positionOneId, effectiveDate: "2025-06-01" })
      .expect(400);
    expect(overlap.body.code).toBe("EFFECTIVE_DATE_OVERLAP");
  });

  it("rejects self-management and circular reporting lines", async () => {
    const self = await request(server)
      .patch(`/api/v1/employees/${managerEmployeeId}`)
      .set(auth(adminToken))
      .send({ managerId: managerEmployeeId });
    expect(self.status).toBe(400);
    expect(self.body.code).toBe("MANAGER_CYCLE");

    const circular = await request(server)
      .patch(`/api/v1/employees/${managerEmployeeId}`)
      .set(auth(adminToken))
      .send({ managerId: employeeId })
      .expect(400);
    expect(circular.body.code).toBe("MANAGER_CYCLE");
  });

  it("limits a manager to their own reporting line", async () => {
    const list = await request(server)
      .get("/api/v1/employees?pageSize=100")
      .set(auth(managerToken))
      .expect(200);
    const items = (list.body as PaginatedResponse<EmployeeDetail>).items;
    const ids = items.map((item) => item.id);

    expect(ids).toEqual(expect.arrayContaining([managerEmployeeId, employeeId]));
    expect(ids).not.toContain(otherEmployeeId);

    await request(server)
      .get(`/api/v1/employees/${employeeId}`)
      .set(auth(managerToken))
      .expect(200);

    const outside = await request(server)
      .get(`/api/v1/employees/${otherEmployeeId}`)
      .set(auth(managerToken))
      .expect(403);
    expect(outside.body.code).toBe("EMPLOYEE_OUT_OF_SCOPE");
  });

  it("keeps employment fields out of employee self-service", async () => {
    const forbidden = await request(server)
      .patch(`/api/v1/employees/${employeeId}`)
      .set(auth(employeeToken))
      .send({ branchId })
      .expect(403);
    expect(forbidden.body.code).toBe("FORBIDDEN");

    const selfService = await request(server)
      .patch("/api/v1/employees/me")
      .set(auth(employeeToken))
      .send({ phone: "+62 812 0000 1111" })
      .expect(200);
    expect((selfService.body as EmployeeDetail).phone).toBe("+62 812 0000 1111");
    expect((selfService.body as EmployeeDetail).position?.id).toBe(positionTwoId);

    const rejected = await request(server)
      .patch("/api/v1/employees/me")
      .set(auth(employeeToken))
      .send({ employmentStatus: "RESIGNED" })
      .expect(400);
    expect(rejected.body.code).toBeDefined();
  });

  it("stores documents privately and enforces document permissions", async () => {
    const upload = await request(server)
      .post(`/api/v1/employees/${employeeId}/documents`)
      .set(auth(adminToken))
      .field("title", "Employment contract")
      .field("category", "CONTRACT")
      .attach("file", Buffer.from("%PDF-1.4 e2e contract"), "contract.pdf")
      .expect(201);
    documentId = (upload.body as EmployeeDocument).id;
    expect((upload.body as EmployeeDocument).mimeType).toBe("application/pdf");

    const download = await request(server)
      .get(`/api/v1/employees/${employeeId}/documents/${documentId}/download`)
      .set(auth(adminToken))
      .expect(200);
    expect(download.headers["content-disposition"]).toContain("attachment");

    const ownDownload = await request(server)
      .get(`/api/v1/employees/${employeeId}/documents/${documentId}/download`)
      .set(auth(employeeToken))
      .expect(200);
    expect(ownDownload.body.length).toBeGreaterThan(0);

    const denied = await request(server)
      .get(`/api/v1/employees/${employeeId}/documents/${documentId}/download`)
      .set(auth(outsiderToken))
      .expect(403);
    expect(denied.body.code).toBe("EMPLOYEE_OUT_OF_SCOPE");

    const noDelete = await request(server)
      .delete(`/api/v1/employees/${employeeId}/documents/${documentId}`)
      .set(auth(employeeToken))
      .expect(403);

    await request(server)
      .post(`/api/v1/employees/${employeeId}/documents`)
      .set(auth(adminToken))
      .field("title", "Executable")
      .attach("file", Buffer.from("MZ"), "malware.exe")
      .expect(400);

    await request(server)
      .delete(`/api/v1/employees/${employeeId}/documents/${documentId}`)
      .set(auth(adminToken))
      .expect(204);
  });

  it("returns no employee data for an account without an employee record", async () => {
    const noUserToken = await login("e2e.nouser@peopleops.test", PASSWORD);

    const me = await request(server)
      .get("/api/v1/employees/me")
      .set(auth(noUserToken))
      .expect(404);
    expect(me.body.code).toBe("EMPLOYEE_NOT_LINKED");

    const list = await request(server)
      .get("/api/v1/employees")
      .set(auth(noUserToken))
      .expect(200);
    expect((list.body as PaginatedResponse<EmployeeDetail>).items).toHaveLength(0);
  });
});
