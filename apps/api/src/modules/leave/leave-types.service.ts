import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import type { LeaveType, PaginatedResponse } from "@peopleops/shared-types";
import { toPageMeta } from "../../common/dto/page-query.dto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type {
  CreateLeaveTypeDto,
  ListLeaveTypesQueryDto,
  UpdateLeaveTypeDto,
} from "./dto/leave.dto";
import { leaveTypeInclude, toLeaveType } from "./leave.mapper";
import type { LeaveActor } from "./leave.types";

@Injectable()
export class LeaveTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListLeaveTypesQueryDto): Promise<PaginatedResponse<LeaveType>> {
    const where: Prisma.LeaveTypeWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { code: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.leaveType.count({ where }),
      this.prisma.leaveType.findMany({
        where,
        include: leaveTypeInclude,
        orderBy: [{ status: "asc" }, { name: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toLeaveType), ...toPageMeta(query.page, query.pageSize, total) };
  }

  async listActive(): Promise<LeaveType[]> {
    const rows = await this.prisma.leaveType.findMany({
      where: { status: "ACTIVE" },
      include: leaveTypeInclude,
      orderBy: { name: "asc" },
    });
    return rows.map(toLeaveType);
  }

  async getById(id: string): Promise<LeaveType> {
    const row = await this.prisma.leaveType.findUnique({
      where: { id },
      include: leaveTypeInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: "LEAVE_TYPE_NOT_FOUND",
        message: "Leave type not found",
      });
    }
    return toLeaveType(row);
  }

  async create(dto: CreateLeaveTypeDto, actor: LeaveActor): Promise<LeaveType> {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.leaveType.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException({
        code: "LEAVE_TYPE_CODE_TAKEN",
        message: "Leave type code is already used",
      });
    }
    const row = await this.prisma.leaveType.create({
      data: {
        name: dto.name.trim(),
        code,
        description: dto.description?.trim() ?? null,
        isPaid: dto.isPaid ?? true,
        requiresApproval: dto.requiresApproval ?? true,
        requiresAttachment: dto.requiresAttachment ?? false,
        allowHalfDay: dto.allowHalfDay ?? false,
        allowPastDates: dto.allowPastDates ?? false,
        allowFutureDates: dto.allowFutureDates ?? true,
        requiresBalance: dto.requiresBalance ?? true,
        status: dto.status ?? "ACTIVE",
      },
      include: leaveTypeInclude,
    });
    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "leave_type.created",
      entityType: "leave_type",
      entityId: row.id,
      metadata: { code: row.code },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return toLeaveType(row);
  }

  async update(id: string, dto: UpdateLeaveTypeDto, actor: LeaveActor): Promise<LeaveType> {
    await this.getById(id);
    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      const duplicate = await this.prisma.leaveType.findUnique({ where: { code } });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException({
          code: "LEAVE_TYPE_CODE_TAKEN",
          message: "Leave type code is already used",
        });
      }
    }
    const row = await this.prisma.leaveType.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() ?? null } : {}),
        ...(dto.isPaid !== undefined ? { isPaid: dto.isPaid } : {}),
        ...(dto.requiresApproval !== undefined ? { requiresApproval: dto.requiresApproval } : {}),
        ...(dto.requiresAttachment !== undefined
          ? { requiresAttachment: dto.requiresAttachment }
          : {}),
        ...(dto.allowHalfDay !== undefined ? { allowHalfDay: dto.allowHalfDay } : {}),
        ...(dto.allowPastDates !== undefined ? { allowPastDates: dto.allowPastDates } : {}),
        ...(dto.allowFutureDates !== undefined ? { allowFutureDates: dto.allowFutureDates } : {}),
        ...(dto.requiresBalance !== undefined ? { requiresBalance: dto.requiresBalance } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: leaveTypeInclude,
    });
    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "leave_type.updated",
      entityType: "leave_type",
      entityId: id,
      metadata: { fields: Object.keys(dto) },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return toLeaveType(row);
  }

  async deactivate(id: string, actor: LeaveActor): Promise<LeaveType> {
    await this.getById(id);
    const row = await this.prisma.leaveType.update({
      where: { id },
      data: { status: "INACTIVE" },
      include: leaveTypeInclude,
    });
    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "leave_type.deactivated",
      entityType: "leave_type",
      entityId: id,
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return toLeaveType(row);
  }
}
