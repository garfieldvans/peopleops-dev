import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import argon2 from "argon2";
import { Prisma } from "@peopleops/database";
import { ROLE_CODES, type PaginatedResponse, type UserSummary } from "@peopleops/shared-types";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestMeta } from "../../common/http/request-meta";
import { toUserSummary } from "./user.mapper";
import { hasRole, userWithRolesInclude, type UserWithRoles } from "./users.types";
import type { ListUsersQueryDto } from "./dto/list-users-query.dto";
import type { CreateUserDto } from "./dto/create-user.dto";
import type { UpdateUserDto } from "./dto/update-user.dto";
import type { SetUserRolesDto } from "./dto/set-user-roles.dto";
import type { UpdateUserStatusDto } from "./dto/update-user-status.dto";
import { toPageMeta } from "../../common/dto/page-query.dto";

interface ActorContext {
  actorUserId: string;
  actorEmail: string;
  meta: RequestMeta;
}

const USER_NOT_FOUND = () => new NotFoundException({ code: "USER_NOT_FOUND", message: "User not found" });

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListUsersQueryDto): Promise<PaginatedResponse<UserSummary>> {
    const where: Prisma.UserWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: userWithRolesInclude,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items: users.map(toUserSummary),
      ...toPageMeta(query.page, query.pageSize, total),
    };
  }

  async getById(id: string): Promise<UserSummary> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: userWithRolesInclude,
    });

    if (!user) {
      throw USER_NOT_FOUND();
    }

    return toUserSummary(user);
  }

  async findWithAccessById(id: string): Promise<UserWithRoles | null> {
    return this.prisma.user.findUnique({ where: { id }, include: userWithRolesInclude });
  }

  async findCredentialsByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, name: true, email: true, passwordHash: true, status: true },
    });
  }

  async create(dto: CreateUserDto, actor: ActorContext): Promise<UserSummary> {
    const email = dto.email.trim().toLowerCase();
    const roleIds = [...new Set(dto.roleIds ?? [])];

    await this.assertRolesExist(roleIds);

    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw new ConflictException({
        code: "EMAIL_TAKEN",
        message: "A user with this email already exists",
      });
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    let user: UserWithRoles;
    try {
      user = await this.prisma.user.create({
        data: {
          name: dto.name.trim(),
          email,
          passwordHash,
          roles: { create: roleIds.map((roleId) => ({ roleId })) },
        },
        include: userWithRolesInclude,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "EMAIL_TAKEN",
          message: "A user with this email already exists",
        });
      }
      throw error;
    }

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "user.created",
      entityType: "user",
      entityId: user.id,
      metadata: { email: user.email, roleIds },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toUserSummary(user);
  }

  async update(id: string, dto: UpdateUserDto, actor: ActorContext): Promise<UserSummary> {
    const current = await this.prisma.user.findUnique({
      where: { id },
      include: userWithRolesInclude,
    });
    if (!current) {
      throw USER_NOT_FOUND();
    }

    const email = dto.email.trim().toLowerCase();
    if (email !== current.email) {
      const duplicate = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (duplicate) {
        throw new ConflictException({
          code: "EMAIL_TAKEN",
          message: "A user with this email already exists",
        });
      }
    }

    const updated = await this.prisma.user
      .update({
        where: { id },
        data: { name: dto.name.trim(), email },
        include: userWithRolesInclude,
      })
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new ConflictException({
            code: "EMAIL_TAKEN",
            message: "A user with this email already exists",
          });
        }
        throw error;
      });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "user.updated",
      entityType: "user",
      entityId: id,
      metadata: {
        before: { name: current.name, email: current.email },
        after: { name: updated.name, email: updated.email },
      },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toUserSummary(updated);
  }

  async updateStatus(
    id: string,
    dto: UpdateUserStatusDto,
    actor: ActorContext,
  ): Promise<UserSummary> {
    const current = await this.prisma.user.findUnique({
      where: { id },
      include: userWithRolesInclude,
    });
    if (!current) {
      throw USER_NOT_FOUND();
    }

    if (current.status === dto.status) {
      return toUserSummary(current);
    }

    const isTargetSuperAdmin = hasRole(current, ROLE_CODES.SUPER_ADMIN);
    const deactivating = dto.status !== "ACTIVE";

    if (deactivating && isTargetSuperAdmin && current.status === "ACTIVE") {
      const activeSuperAdmins = await this.countActiveSuperAdmins();
      if (activeSuperAdmins <= 1) {
        throw new ConflictException({
          code: "LAST_SUPER_ADMIN",
          message: "Cannot deactivate the last active SUPER_ADMIN account",
        });
      }
    }

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { status: dto.status } }),
      ...(deactivating
        ? [
            this.prisma.userSession.updateMany({
              where: { userId: id, revokedAt: null },
              data: { revokedAt: new Date() },
            }),
          ]
        : []),
    ]);

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: deactivating ? "user.deactivated" : "user.activated",
      entityType: "user",
      entityId: id,
      metadata: { before: current.status, after: dto.status },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toUserSummary({
      ...current,
      status: dto.status,
    });
  }

  async setRoles(id: string, dto: SetUserRolesDto, actor: ActorContext): Promise<UserSummary> {
    const current = await this.prisma.user.findUnique({
      where: { id },
      include: userWithRolesInclude,
    });
    if (!current) {
      throw USER_NOT_FOUND();
    }

    const roleIds = [...new Set(dto.roleIds)];
    const roles = await this.assertRolesExist(roleIds);
    const keepsSuperAdmin = roles.some((role) => role.code === ROLE_CODES.SUPER_ADMIN);
    const currentlySuperAdmin = hasRole(current, ROLE_CODES.SUPER_ADMIN);

    if (currentlySuperAdmin && current.status === "ACTIVE" && !keepsSuperAdmin) {
      const activeSuperAdmins = await this.countActiveSuperAdmins();
      if (activeSuperAdmins <= 1) {
        throw new ConflictException({
          code: "LAST_SUPER_ADMIN",
          message: "Cannot remove the SUPER_ADMIN role from the last active administrator",
        });
      }
    }

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: id } }),
      this.prisma.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId: id, roleId })),
        skipDuplicates: true,
      }),
    ]);

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "user.roles_updated",
      entityType: "user",
      entityId: id,
      metadata: {
        before: current.roles.map((userRole) => userRole.role.code),
        after: roles.map((role) => role.code),
      },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    const updated = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: userWithRolesInclude,
    });

    return toUserSummary(updated);
  }

  async touchLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  async countActiveSuperAdmins(): Promise<number> {
    return this.prisma.user.count({
      where: {
        status: "ACTIVE",
        roles: { some: { role: { code: ROLE_CODES.SUPER_ADMIN } } },
      },
    });
  }

  private async assertRolesExist(roleIds: string[]): Promise<{ id: string; code: string }[]> {
    if (roleIds.length === 0) {
      return [];
    }

    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true, code: true },
    });

    if (roles.length !== roleIds.length) {
      const found = new Set(roles.map((role) => role.id));
      throw new BadRequestException({
        code: "UNKNOWN_ROLE",
        message: "One or more roles do not exist",
        details: { missing: roleIds.filter((roleId) => !found.has(roleId)) },
      });
    }

    return roles;
  }
}
