import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import type { PaginatedResponse, RoleDetail } from "@peopleops/shared-types";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { toPageMeta } from "../../common/dto/page-query.dto";
import type { RequestMeta } from "../../common/http/request-meta";
import { toRoleDetail } from "./role.mapper";
import { roleWithPermissionsInclude } from "./roles.types";
import type { CreateRoleDto } from "./dto/create-role.dto";
import type { ListRolesQueryDto } from "./dto/list-roles-query.dto";
import type { SetRolePermissionsDto } from "./dto/set-role-permissions.dto";
import type { UpdateRoleDto } from "./dto/update-role.dto";

interface ActorContext {
  actorUserId: string;
  actorEmail: string;
  meta: RequestMeta;
}

const ROLE_NOT_FOUND = () =>
  new NotFoundException({ code: "ROLE_NOT_FOUND", message: "Role not found" });

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListRolesQueryDto): Promise<PaginatedResponse<RoleDetail>> {
    const where: Prisma.RoleWhereInput = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { code: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {};

    const [total, roles] = await this.prisma.$transaction([
      this.prisma.role.count({ where }),
      this.prisma.role.findMany({
        where,
        include: roleWithPermissionsInclude,
        orderBy: [{ isSystem: "desc" }, { name: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items: roles.map(toRoleDetail),
      ...toPageMeta(query.page, query.pageSize, total),
    };
  }

  async getById(id: string): Promise<RoleDetail> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: roleWithPermissionsInclude,
    });

    if (!role) {
      throw ROLE_NOT_FOUND();
    }

    return toRoleDetail(role);
  }

  async create(dto: CreateRoleDto, actor: ActorContext): Promise<RoleDetail> {
    const code = dto.code.trim().toUpperCase();
    const permissionIds = [...new Set(dto.permissionIds ?? [])];

    await this.assertPermissionsExist(permissionIds);

    const existing = await this.prisma.role.findUnique({ where: { code }, select: { id: true } });
    if (existing) {
      throw new ConflictException({
        code: "ROLE_CODE_TAKEN",
        message: "A role with this code already exists",
      });
    }

    const role = await this.prisma.role
      .create({
        data: {
          name: dto.name.trim(),
          code,
          description: dto.description?.trim() || null,
          permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
        },
        include: roleWithPermissionsInclude,
      })
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new ConflictException({
            code: "ROLE_CODE_TAKEN",
            message: "A role with this code already exists",
          });
        }
        throw error;
      });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "role.created",
      entityType: "role",
      entityId: role.id,
      metadata: { code: role.code, permissionIds },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toRoleDetail(role);
  }

  async update(id: string, dto: UpdateRoleDto, actor: ActorContext): Promise<RoleDetail> {
    const current = await this.prisma.role.findUnique({
      where: { id },
      include: roleWithPermissionsInclude,
    });
    if (!current) {
      throw ROLE_NOT_FOUND();
    }

    const role = await this.prisma.role.update({
      where: { id },
      data: { name: dto.name.trim(), description: dto.description?.trim() || null },
      include: roleWithPermissionsInclude,
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "role.updated",
      entityType: "role",
      entityId: id,
      metadata: {
        before: { name: current.name, description: current.description },
        after: { name: role.name, description: role.description },
      },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toRoleDetail(role);
  }

  async delete(id: string, actor: ActorContext): Promise<void> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: roleWithPermissionsInclude,
    });
    if (!role) {
      throw ROLE_NOT_FOUND();
    }

    if (role.isSystem) {
      throw new ForbiddenException({
        code: "SYSTEM_ROLE",
        message: "System roles cannot be deleted",
      });
    }

    if (role._count.users > 0) {
      throw new ConflictException({
        code: "ROLE_IN_USE",
        message: "Role is still assigned to users",
        details: { userCount: role._count.users },
      });
    }

    await this.prisma.role.delete({ where: { id } });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "role.deleted",
      entityType: "role",
      entityId: id,
      metadata: { code: role.code, name: role.name },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
  }

  async setPermissions(
    id: string,
    dto: SetRolePermissionsDto,
    actor: ActorContext,
  ): Promise<RoleDetail> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: roleWithPermissionsInclude,
    });
    if (!role) {
      throw ROLE_NOT_FOUND();
    }

    if (role.isSystem) {
      throw new ForbiddenException({
        code: "SYSTEM_ROLE_PERMISSIONS",
        message: "Permissions of a protected system role cannot be changed",
      });
    }

    const permissionIds = [...new Set(dto.permissionIds)];
    await this.assertPermissionsExist(permissionIds);

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
        skipDuplicates: true,
      }),
    ]);

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "role.permissions_updated",
      entityType: "role",
      entityId: id,
      metadata: {
        before: role.permissions.map((rolePermission) => rolePermission.permission.code),
        after: permissionIds.length,
        permissionIds,
      },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    const updated = await this.prisma.role.findUniqueOrThrow({
      where: { id },
      include: roleWithPermissionsInclude,
    });

    return toRoleDetail(updated);
  }

  private async assertPermissionsExist(permissionIds: string[]): Promise<void> {
    if (permissionIds.length === 0) {
      return;
    }

    const found = await this.prisma.permission.findMany({
      where: { id: { in: permissionIds } },
      select: { id: true },
    });

    if (found.length !== permissionIds.length) {
      const known = new Set(found.map((permission) => permission.id));
      throw new BadRequestException({
        code: "UNKNOWN_PERMISSION",
        message: "One or more permissions do not exist",
        details: { missing: permissionIds.filter((permissionId) => !known.has(permissionId)) },
      });
    }
  }
}
