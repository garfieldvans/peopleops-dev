import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import argon2 from "argon2";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { CurrentUser, LoginResponse } from "@peopleops/shared-types";
import type { UserSession } from "@peopleops/database";
import { ENV, type ServerEnv } from "../../config/env";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { AuditService } from "../audit/audit.service";
import { effectivePermissions, toCurrentUser, toUserSummary, UsersService } from "../users";
import type { AccessTokenPayload } from "./auth.constants";
import type { ChangePasswordDto } from "./dto/change-password.dto";
import type { LoginDto } from "./dto/login.dto";

export interface AuthResult {
  response: LoginResponse;
  refreshToken: string;
  refreshExpiresAt: Date;
}

const INVALID_CREDENTIALS = () =>
  new UnauthorizedException({
    code: "INVALID_CREDENTIALS",
    message: "Invalid email or password",
  });

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: ServerEnv,
  ) {}

  async login(dto: LoginDto, meta: RequestMeta): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();
    const credentials = await this.users.findCredentialsByEmail(email);

    if (!credentials) {
      await this.audit.record({
        actorEmail: email,
        action: "auth.login.failed",
        entityType: "user",
        metadata: { reason: "unknown_email" },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw INVALID_CREDENTIALS();
    }

    const valid = await argon2.verify(credentials.passwordHash, dto.password).catch(() => false);

    if (!valid) {
      await this.audit.record({
        actorUserId: credentials.id,
        actorEmail: credentials.email,
        action: "auth.login.failed",
        entityType: "user",
        entityId: credentials.id,
        metadata: { reason: "invalid_password" },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw INVALID_CREDENTIALS();
    }

    if (credentials.status !== "ACTIVE") {
      await this.audit.record({
        actorUserId: credentials.id,
        actorEmail: credentials.email,
        action: "auth.login.blocked",
        entityType: "user",
        entityId: credentials.id,
        metadata: { status: credentials.status },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new ForbiddenException({
        code: "ACCOUNT_INACTIVE",
        message: "This account is not active",
      });
    }

    const { session, rawToken } = await this.createSession(credentials.id, randomUUID(), meta);
    await this.users.touchLastLogin(credentials.id);

    const user = await this.users.findWithAccessById(credentials.id);
    if (!user) {
      throw INVALID_CREDENTIALS();
    }

    const accessToken = await this.signAccessToken(user.id, session.id);

    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "auth.login.succeeded",
      entityType: "user",
      entityId: user.id,
      metadata: { sessionId: session.id },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      response: {
        accessToken,
        expiresIn: this.env.JWT_ACCESS_TTL_SECONDS,
        user: toCurrentUser(user, session),
      },
      refreshToken: rawToken,
      refreshExpiresAt: session.expiresAt,
    };
  }

  async refresh(rawToken: string | undefined, meta: RequestMeta): Promise<AuthResult> {
    if (!rawToken) {
      throw new UnauthorizedException({
        code: "NO_REFRESH_TOKEN",
        message: "A refresh token is required",
      });
    }

    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: hashToken(rawToken) },
    });

    if (!session) {
      throw new UnauthorizedException({
        code: "INVALID_REFRESH_TOKEN",
        message: "The refresh token is not valid",
      });
    }

    if (session.revokedAt) {
      // Reuse of a rotated token: assume theft and kill the whole family.
      await this.revokeFamily(session.familyId);
      await this.audit.record({
        actorUserId: session.userId,
        action: "auth.refresh.reuse_detected",
        entityType: "user_session",
        entityId: session.id,
        metadata: { familyId: session.familyId },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException({
        code: "REFRESH_TOKEN_REUSED",
        message: "This session was revoked; please sign in again",
      });
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        code: "REFRESH_TOKEN_EXPIRED",
        message: "The session has expired; please sign in again",
      });
    }

    const user = await this.users.findWithAccessById(session.userId);
    if (!user || user.status !== "ACTIVE") {
      await this.prisma.userSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new ForbiddenException({
        code: "ACCOUNT_INACTIVE",
        message: "This account is not active",
      });
    }

    const { rotated, rawToken: newRawToken } = await this.rotateSession(session, meta);
    const accessToken = await this.signAccessToken(user.id, rotated.id);

    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "auth.refresh.succeeded",
      entityType: "user_session",
      entityId: rotated.id,
      metadata: { previousSessionId: session.id },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      response: {
        accessToken,
        expiresIn: this.env.JWT_ACCESS_TTL_SECONDS,
        user: toCurrentUser(user, rotated),
      },
      refreshToken: newRawToken,
      refreshExpiresAt: rotated.expiresAt,
    };
  }

  async logout(rawToken: string | undefined, meta: RequestMeta): Promise<void> {
    if (!rawToken) {
      return;
    }

    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: hashToken(rawToken) },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!session || session.revokedAt) {
      return;
    }

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    await this.audit.record({
      actorUserId: session.user.id,
      actorEmail: session.user.email,
      action: "auth.logout",
      entityType: "user_session",
      entityId: session.id,
      metadata: { familyId: session.familyId },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  async currentUser(user: AuthenticatedUser): Promise<CurrentUser> {
    const record = await this.users.findWithAccessById(user.id);
    if (!record) {
      throw new UnauthorizedException({
        code: "USER_NOT_FOUND",
        message: "The authenticated user no longer exists",
      });
    }

    return {
      ...toUserSummary(record),
      permissions: effectivePermissions(record),
      employeeId: record.employee?.id ?? null,
      session: {
        id: user.sessionId,
        expiresAt: user.sessionExpiresAt.toISOString(),
        createdAt: user.sessionCreatedAt.toISOString(),
      },
    };
  }

  async changePassword(
    user: AuthenticatedUser,
    dto: ChangePasswordDto,
    meta: RequestMeta,
  ): Promise<void> {
    const credentials = await this.users.findCredentialsByEmail(user.email);
    if (!credentials) {
      throw new UnauthorizedException({
        code: "USER_NOT_FOUND",
        message: "The authenticated user no longer exists",
      });
    }

    const currentValid = await argon2
      .verify(credentials.passwordHash, dto.currentPassword)
      .catch(() => false);

    if (!currentValid) {
      throw new BadRequestException({
        code: "INVALID_CURRENT_PASSWORD",
        message: "The current password is incorrect",
      });
    }

    const sameAsCurrent = await argon2
      .verify(credentials.passwordHash, dto.newPassword)
      .catch(() => false);

    if (sameAsCurrent) {
      throw new BadRequestException({
        code: "PASSWORD_UNCHANGED",
        message: "The new password must be different from the current password",
      });
    }

    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await this.users.updatePasswordHash(user.id, passwordHash);

    // Other devices are signed out; the current session keeps working.
    const revoked = await this.prisma.userSession.updateMany({
      where: { userId: user.id, id: { not: user.sessionId }, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "auth.password_changed",
      entityType: "user",
      entityId: user.id,
      metadata: { revokedSessions: revoked.count },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  async authenticate(accessToken: string): Promise<AuthenticatedUser> {
    let payload: AccessTokenPayload;

    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(accessToken, {
        secret: this.env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthorizedException({
        code: "INVALID_TOKEN",
        message: "Your session is not valid",
      });
    }

    if (payload.type !== "access" || !payload.sub || !payload.sid) {
      throw new UnauthorizedException({
        code: "INVALID_TOKEN",
        message: "Your session is not valid",
      });
    }

    const session = await this.prisma.userSession.findUnique({ where: { id: payload.sid } });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException({
        code: "SESSION_EXPIRED",
        message: "Your session has expired; please sign in again",
      });
    }

    const user = await this.users.findWithAccessById(payload.sub);

    if (!user) {
      throw new UnauthorizedException({
        code: "USER_NOT_FOUND",
        message: "The authenticated user no longer exists",
      });
    }

    if (user.status !== "ACTIVE") {
      throw new ForbiddenException({
        code: "ACCOUNT_INACTIVE",
        message: "This account is not active",
      });
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      roles: user.roles.map((userRole) => ({
        id: userRole.role.id,
        code: userRole.role.code,
        name: userRole.role.name,
      })),
      permissions: effectivePermissions(user),
      sessionId: session.id,
      sessionExpiresAt: session.expiresAt,
      sessionCreatedAt: session.createdAt,
    };
  }

  private async createSession(
    userId: string,
    familyId: string,
    meta: RequestMeta,
  ): Promise<{ session: UserSession; rawToken: string }> {
    const rawToken = randomBytes(32).toString("base64url");
    const expiresAt = this.refreshExpiry();

    const session = await this.prisma.userSession.create({
      data: {
        userId,
        familyId,
        refreshTokenHash: hashToken(rawToken),
        expiresAt,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    return { session, rawToken };
  }

  private async rotateSession(
    previous: UserSession,
    meta: RequestMeta,
  ): Promise<{ rotated: UserSession; rawToken: string }> {
    const rawToken = randomBytes(32).toString("base64url");

    const [, rotated] = await this.prisma.$transaction([
      this.prisma.userSession.update({
        where: { id: previous.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.userSession.create({
        data: {
          userId: previous.userId,
          familyId: previous.familyId,
          refreshTokenHash: hashToken(rawToken),
          expiresAt: this.refreshExpiry(),
          ipAddress: meta.ip,
          userAgent: meta.userAgent,
        },
      }),
    ]);

    return { rotated, rawToken };
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  }

  private signAccessToken(userId: string, sessionId: string): Promise<string> {
    const payload: AccessTokenPayload = { sub: userId, sid: sessionId, type: "access" };
    return this.jwt.signAsync(payload, {
      secret: this.env.JWT_ACCESS_SECRET,
      expiresIn: this.env.JWT_ACCESS_TTL_SECONDS,
    });
  }
}
