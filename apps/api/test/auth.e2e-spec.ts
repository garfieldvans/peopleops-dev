import type { INestApplication } from "@nestjs/common";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import type { RoleDetail, UserSummary } from "@peopleops/shared-types";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "./test-env";

interface LoginBody {
  accessToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    roles: { code: string }[];
    permissions: string[];
  };
}

interface RefreshCookie {
  name: string;
  value: string;
}

function refreshCookieFrom(response: request.Response): RefreshCookie {
  const header = response.headers["set-cookie"];
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) {
    throw new Error("Expected a refresh cookie in the login response");
  }
  const [pair] = raw.split(";");
  const index = pair.indexOf("=");
  return { name: pair.slice(0, index), value: pair.slice(index + 1) };
}

describe("Authentication & RBAC (e2e)", () => {
  let app: INestApplication;
  let admin: ReturnType<typeof request.agent>;
  let adminToken: string;
  let adminLoginResponse: request.Response;

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

    admin = request.agent(app.getHttpServer());
    adminLoginResponse = await admin
      .post("/api/v1/auth/login")
      .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });
    if (adminLoginResponse.status !== 200) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLoginResponse.body)}`);
    }
    adminToken = (adminLoginResponse.body as LoginBody).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it("keeps the health endpoint public", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/health").expect(200);
    expect(response.body.status).toBe("ok");
  });

  it("rejects protected routes without a token", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/users").expect(401);
    expect(response.body.code).toBe("UNAUTHENTICATED");
  });

  it("logs in an administrator and returns the current user", async () => {
    const body = adminLoginResponse.body as LoginBody;
    const cookie = refreshCookieFrom(adminLoginResponse);

    expect(body.expiresIn).toBeGreaterThan(0);
    expect(body.user.email).toBe(TEST_ADMIN_EMAIL);
    expect(body.user.roles.map((role) => role.code)).toContain("SUPER_ADMIN");
    expect(cookie.name.length).toBeGreaterThan(0);

    const me = await admin
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(me.body.email).toBe(TEST_ADMIN_EMAIL);
    expect(me.body.permissions).toContain("user.read");
  });

  it("rejects invalid credentials with a generic error", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: TEST_ADMIN_EMAIL, password: "definitely-wrong" })
      .expect(401);

    expect(response.body.code).toBe("INVALID_CREDENTIALS");
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
  });

  it("protects system roles and the last administrator", async () => {
    const roles = await admin
      .get("/api/v1/roles?pageSize=100")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const superAdmin = (roles.body.items as RoleDetail[]).find(
      (role) => role.code === "SUPER_ADMIN",
    );
    expect(superAdmin?.isSystem).toBe(true);

    const permissions = await admin
      .put(`/api/v1/roles/${superAdmin?.id}/permissions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ permissionIds: [] })
      .expect(403);
    expect(permissions.body.code).toBe("SYSTEM_ROLE_PERMISSIONS");

    await admin
      .delete(`/api/v1/roles/${superAdmin?.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(403);

    const deactivate = await admin
      .patch(`/api/v1/users/${(adminLoginResponse.body as LoginBody).user.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "INACTIVE" })
      .expect(409);
    expect(deactivate.body.code).toBe("LAST_SUPER_ADMIN");
  });

  it("enforces permissions for a user with the EMPLOYEE role", async () => {
    const roles = await admin
      .get("/api/v1/roles?pageSize=100")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const employeeRole = (roles.body.items as RoleDetail[]).find(
      (role) => role.code === "EMPLOYEE",
    );
    expect(employeeRole).toBeDefined();

    const created = await admin
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "E2E Employee",
        email: "e2e.employee@peopleops.test",
        password: "EmployeePass123",
        roleIds: [employeeRole?.id],
      })
      .expect(201);
    expect((created.body as UserSummary).roles[0]?.code).toBe("EMPLOYEE");

    const employee = request.agent(app.getHttpServer());
    const login = await employee
      .post("/api/v1/auth/login")
      .send({ email: "e2e.employee@peopleops.test", password: "EmployeePass123" })
      .expect(200);
    const employeeToken = (login.body as LoginBody).accessToken;
    expect(employeeToken).toBeTruthy();

    const forbidden = await employee
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${employeeToken}`)
      .expect(403);
    expect(forbidden.body.code).toBe("FORBIDDEN");
    expect(forbidden.body.message).toContain("permission");

    await employee
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${employeeToken}`)
      .expect(200);
    await employee.post("/api/v1/auth/logout").expect(204);
    await employee
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${employeeToken}`)
      .expect(401);
  });

  it("rotates refresh tokens and revokes the family on reuse", async () => {
    const staleCookie = refreshCookieFrom(adminLoginResponse);

    const rotated = await admin.post("/api/v1/auth/refresh").expect(200);
    const rotatedBody = rotated.body as LoginBody;
    expect(rotatedBody.accessToken).not.toBe((adminLoginResponse.body as LoginBody).accessToken);

    const reuse = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${staleCookie.name}=${staleCookie.value}`)
      .expect(401);
    expect(reuse.body.code).toBe("REFRESH_TOKEN_REUSED");

    const afterReuse = await admin.post("/api/v1/auth/refresh").expect(401);
    expect(afterReuse.body.code).toBe("REFRESH_TOKEN_REUSED");

    await admin
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(401);
  });
});
