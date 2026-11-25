import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import type { OvertimePolicy, PaginatedResponse } from "@peopleops/shared-types";
import { toPageMeta } from "../../common/dto/page-query.dto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type {
  CreateOvertimePolicyDto,
  ListOvertimePoliciesQueryDto,
  UpdateOvertimePolicyDto,
} from "./dto/overtime.dto";
import { overtimePolicyInclude, toOvertimePolicy } from "./overtime.mapper";
import type { OvertimeActor } from "./overtime.types";

function dateKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

@Injectable()
export class OvertimePoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListOvertimePoliciesQueryDto): Promise<PaginatedResponse<OvertimePolicy>> {
    const where: Prisma.OvertimePolicyWhereInput = {
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
      this.prisma.overtimePolicy.count({ where }),
      this.prisma.overtimePolicy.findMany({
        where,
        include: overtimePolicyInclude,
        orderBy: [{ status: "asc" }, { name: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toOvertimePolicy), ...toPageMeta(query.page, query.pageSize, total) };
  }

  async listActive(): Promise<OvertimePolicy[]> {
    const rows = await this.prisma.overtimePolicy.findMany({
      where: { status: "ACTIVE" },
      include: overtimePolicyInclude,
      orderBy: { name: "asc" },
    });
    return rows.map(toOvertimePolicy);
  }

  async getById(id: string): Promise<OvertimePolicy> {
    const row = await this.prisma.overtimePolicy.findUnique({
      where: { id },
      include: overtimePolicyInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: "OVERTIME_POLICY_NOT_FOUND",
        message: "Overtime policy not found",
      });
    }
    return toOvertimePolicy(row);
  }

  async create(dto: CreateOvertimePolicyDto, actor: OvertimeActor): Promise<OvertimePolicy> {
    const code = dto.code.trim().toUpperCase();
    const duplicate = await this.prisma.overtimePolicy.findUnique({ where: { code } });
    if (duplicate) {
      throw new ConflictException({
        code: "OVERTIME_POLICY_CODE_TAKEN",
        message: "Overtime policy code is already used",
      });
    }
    this.validateConfiguration(dto);

    const row = await this.prisma.overtimePolicy.create({
      data: {
        name: dto.name.trim(),
        code,
        description: dto.description?.trim() ?? null,
        status: dto.status ?? "ACTIVE",
        effectiveFrom: dateKey(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? dateKey(dto.effectiveTo) : null,
        minMinutes: dto.minMinutes ?? 30,
        maxMinutes: dto.maxMinutes ?? 240,
        roundingStrategy: dto.roundingStrategy ?? "NONE",
        roundingMinutes: dto.roundingMinutes ?? 15,
        approvalMode: dto.approvalMode ?? "MANAGER",
        requiresAttachment: dto.requiresAttachment ?? false,
        allowWeekend: dto.allowWeekend ?? false,
        allowHoliday: dto.allowHoliday ?? false,
        eligibleEmploymentStatuses: dto.eligibleEmploymentStatuses ?? [],
      },
      include: overtimePolicyInclude,
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "overtime_policy.created",
      entityType: "overtime_policy",
      entityId: row.id,
      metadata: { code: row.code },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return toOvertimePolicy(row);
  }

  async update(
    id: string,
    dto: UpdateOvertimePolicyDto,
    actor: OvertimeActor,
  ): Promise<OvertimePolicy> {
    const existing = await this.prisma.overtimePolicy.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: "OVERTIME_POLICY_NOT_FOUND",
        message: "Overtime policy not found",
      });
    }
    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      const duplicate = await this.prisma.overtimePolicy.findUnique({ where: { code } });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException({
          code: "OVERTIME_POLICY_CODE_TAKEN",
          message: "Overtime policy code is already used",
        });
      }
    }
    this.validateConfiguration(dto, existing);

    const row = await this.prisma.overtimePolicy.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() ?? null } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.effectiveFrom !== undefined ? { effectiveFrom: dateKey(dto.effectiveFrom) } : {}),
        ...(dto.effectiveTo !== undefined
          ? { effectiveTo: dto.effectiveTo ? dateKey(dto.effectiveTo) : null }
          : {}),
        ...(dto.minMinutes !== undefined ? { minMinutes: dto.minMinutes } : {}),
        ...(dto.maxMinutes !== undefined ? { maxMinutes: dto.maxMinutes } : {}),
        ...(dto.roundingStrategy !== undefined ? { roundingStrategy: dto.roundingStrategy } : {}),
        ...(dto.roundingMinutes !== undefined ? { roundingMinutes: dto.roundingMinutes } : {}),
        ...(dto.approvalMode !== undefined ? { approvalMode: dto.approvalMode } : {}),
        ...(dto.requiresAttachment !== undefined
          ? { requiresAttachment: dto.requiresAttachment }
          : {}),
        ...(dto.allowWeekend !== undefined ? { allowWeekend: dto.allowWeekend } : {}),
        ...(dto.allowHoliday !== undefined ? { allowHoliday: dto.allowHoliday } : {}),
        ...(dto.eligibleEmploymentStatuses !== undefined
          ? { eligibleEmploymentStatuses: dto.eligibleEmploymentStatuses }
          : {}),
      },
      include: overtimePolicyInclude,
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "overtime_policy.updated",
      entityType: "overtime_policy",
      entityId: id,
      metadata: { fields: Object.keys(dto) },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return toOvertimePolicy(row);
  }

  async deactivate(id: string, actor: OvertimeActor): Promise<OvertimePolicy> {
    await this.getById(id);
    const row = await this.prisma.overtimePolicy.update({
      where: { id },
      data: { status: "INACTIVE" },
      include: overtimePolicyInclude,
    });
    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "overtime_policy.deactivated",
      entityType: "overtime_policy",
      entityId: id,
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return toOvertimePolicy(row);
  }

  private validateConfiguration(
    dto: UpdateOvertimePolicyDto | CreateOvertimePolicyDto,
    existing?: {
      effectiveFrom: Date;
      effectiveTo: Date | null;
      minMinutes: number;
      maxMinutes: number;
      roundingStrategy: string;
      roundingMinutes: number;
    },
  ): void {
    const from = dto.effectiveFrom ?? existing?.effectiveFrom.toISOString().slice(0, 10);
    const to =
      dto.effectiveTo === undefined
        ? (existing?.effectiveTo?.toISOString().slice(0, 10) ?? null)
        : dto.effectiveTo;
    if (to && from && to < from) {
      throw new BadRequestException({
        code: "INVALID_OVERTIME_POLICY_RANGE",
        message: "effectiveTo must not be before effectiveFrom",
      });
    }
    const min = dto.minMinutes ?? existing?.minMinutes ?? 30;
    const max = dto.maxMinutes ?? existing?.maxMinutes ?? 240;
    if (min > max) {
      throw new BadRequestException({
        code: "INVALID_OVERTIME_DURATION_RANGE",
        message: "minMinutes must not exceed maxMinutes",
      });
    }
    const roundingStrategy = dto.roundingStrategy ?? existing?.roundingStrategy ?? "NONE";
    const roundingMinutes = dto.roundingMinutes ?? existing?.roundingMinutes ?? 15;
    if (roundingStrategy !== "NONE" && roundingMinutes < 1) {
      throw new BadRequestException({
        code: "INVALID_OVERTIME_ROUNDING",
        message: "roundingMinutes must be at least 1",
      });
    }
  }
}
