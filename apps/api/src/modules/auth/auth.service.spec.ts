import { jest } from "@jest/globals";
import { UnauthorizedException } from "@nestjs/common";
import argon2 from "argon2";
import type { JwtService } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import type { UsersService } from "../users";
import type { AuditService } from "../audit/audit.service";
import type { ServerEnv } from "../../config/env";

const meta = { ip: "127.0.0.1", userAgent: "jest" };

const env = {
  JWT_ACCESS_SECRET: "test-secret-value-with-more-than-32-characters",
  JWT_ACCESS_TTL_SECONDS: 900,
  REFRESH_TOKEN_TTL_DAYS: 1,
} as ServerEnv;

function createService() {
  const prisma = {
    userSession: {
      findUnique: jest.fn<() => Promise<unknown>>(),
      create: jest.fn<() => Promise<unknown>>(),
      update: jest.fn<() => Promise<unknown>>(),
      updateMany: jest.fn<() => Promise<unknown>>(),
    },
    $transaction: jest.fn<() => Promise<unknown>>(),
  };
  const users = {
    findCredentialsByEmail: jest.fn<() => Promise<unknown>>(),
    findWithAccessById: jest.fn<() => Promise<unknown>>(),
    touchLastLogin: jest.fn<() => Promise<void>>(),
    updatePasswordHash: jest.fn<() => Promise<void>>(),
  };
  const jwt = {
    signAsync: jest.fn<() => Promise<string>>().mockResolvedValue("access-token"),
    verifyAsync: jest.fn<() => Promise<unknown>>(),
  };
  const audit = { record: jest.fn<() => Promise<void>>() };

  const service = new AuthService(
    prisma as never,
    users as unknown as UsersService,
    jwt as unknown as JwtService,
    audit as unknown as AuditService,
    env,
  );

  return { service, prisma, users, jwt, audit };
}

const userRecord = {
  id: "6f9619ff-8b86-d011-b42d-00cf4fc964ff",
  name: "Administrator",
  email: "admin@example.com",
  status: "ACTIVE",
  passwordHash: "",
  lastLoginAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  roles: [],
};

describe("AuthService", () => {
  it("issues an access token and session for valid credentials", async () => {
    const { service, prisma, users, jwt } = createService();
    const passwordHash = await argon2.hash("CorrectPassword123", { type: argon2.argon2id });

    users.findCredentialsByEmail.mockResolvedValue({
      id: userRecord.id,
      email: userRecord.email,
      passwordHash,
      status: "ACTIVE",
    });
    users.findWithAccessById.mockResolvedValue(userRecord);
    prisma.userSession.create.mockResolvedValue({
      id: "session-id",
      userId: userRecord.id,
      familyId: "family-id",
      expiresAt: new Date(Date.now() + 86_400_000),
      createdAt: new Date(),
    });

    const result = await service.login(
      { email: "ADMIN@example.com", password: "CorrectPassword123" },
      meta,
    );

    expect(users.findCredentialsByEmail).toHaveBeenCalledWith("admin@example.com");
    expect(prisma.userSession.create).toHaveBeenCalledTimes(1);
    expect(result.response.accessToken).toBe("access-token");
    expect(result.refreshToken.length).toBeGreaterThan(20);
    expect(jwt.signAsync).toHaveBeenCalledTimes(1);
  });

  it("rejects unknown emails without revealing whether the account exists", async () => {
    const { service, users, audit } = createService();
    users.findCredentialsByEmail.mockResolvedValue(null);

    await expect(
      service.login({ email: "nobody@example.com", password: "Whatever123456" }, meta),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "auth.login.failed" }),
    );
  });

  it("revokes the whole token family when a rotated refresh token is reused", async () => {
    const { service, prisma } = createService();
    prisma.userSession.findUnique.mockResolvedValue({
      id: "old-session",
      userId: userRecord.id,
      familyId: "family-1",
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    await expect(service.refresh("stale-token", meta)).rejects.toMatchObject({
      response: { code: "REFRESH_TOKEN_REUSED" },
    });

    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { familyId: "family-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
