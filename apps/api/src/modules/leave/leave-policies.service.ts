import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import type {
  LeaveAccrualFrequency,
  LeavePolicy,
  PaginatedResponse,
} from "@peopleops/shared-types";
import { toPageMeta } from "../../common/dto/page-query.dto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type {
  CreateLeavePolicyDto,
  ListLeavePoliciesQueryDto,
  UpdateLeavePolicyDto,
} from "./dto/leave.dto";
import { leavePolicyInclude, toLeavePolicy } from "./leave.mapper";
import type { LeaveActor } from "./leave.types";

function dateKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function frequencyFor(method: string): LeaveAccrualFrequency {
  if (method === "MONTHLY_ACCRUAL") return "MONTHLY";
  if (method === "ANNUAL_ACCRUAL") return "ANNUAL";
  return "ONE_TIME";
}

@Injectable()
export class LeavePoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListLeavePoliciesQueryDto): Promise<PaginatedResponse<LeavePolicy>> {
    const where: Prisma.LeavePolicyWhereInput = {
      ...(query.leaveTypeId ? { leaveTypeId: query.leaveTypeId } : {}),
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
      this.prisma.leavePolicy.count({ where }),
      this.prisma.leavePolicy.findMany({
        where,
        include: leavePolicyInclude,
        orderBy: [{ status: "asc" }, { name: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toLeavePolicy), ...toPageMeta(query.page, query.pageSize, total) };
  }

  async listActive(): Promise<LeavePolicy[]> {
    const rows = await this.prisma.leavePolicy.findMany({
      where: { status: "ACTIVE" },
      include: leavePolicyInclude,
      orderBy: { name: "asc" },
    });
    return rows.map(toLeavePolicy);
  }

  async getById(id: string): Promise<LeavePolicy> {
    const row = await this.prisma.leavePolicy.findUnique({
      where: { id },
      include: leavePolicyInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: "LEAVE_POLICY_NOT_FOUND",
        message: "Leave policy not found",
      });
    }
    return toLeavePolicy(row);
  }

  async create(dto: CreateLeavePolicyDto, actor: LeaveActor): Promise<LeavePolicy> {
    const code = dto.code.trim().toUpperCase();
    const duplicate = await this.prisma.leavePolicy.findUnique({ where: { code } });
    if (duplicate) {
      throw new ConflictException({
        code: "LEAVE_POLICY_CODE_TAKEN",
        message: "Leave policy code is already used",
      });
    }
    const leaveType = await this.prisma.leaveType.findUnique({
      where: { id: dto.leaveTypeId },
    });
    if (!leaveType) {
      throw new BadRequestException({
        code: "LEAVE_TYPE_NOT_FOUND",
        message: "The selected leave type does not exist",
      });
    }

    const accrualMethod = dto.accrualMethod ?? "GRANTED_UPFRONT";
    const entitlementUnit = dto.entitlementUnit ?? "DAY";
    if (entitlementUnit === "HOUR") {
      throw new BadRequestException({
        code: "HOURLY_LEAVE_NOT_SUPPORTED",
        message: "Hourly leave policies are not supported in Phase 5",
      });
    }
    if (dto.allowHalfDay && !leaveType.allowHalfDay) {
      throw new BadRequestException({
        code: "LEAVE_TYPE_HALF_DAY_DISABLED",
        message: "The leave type does not allow half-day requests",
      });
    }
    this.validateConfiguration(dto);

    const row = await this.prisma.leavePolicy.create({
      data: {
        name: dto.name.trim(),
        code,
        description: dto.description?.trim() ?? null,
        leaveTypeId: dto.leaveTypeId,
        entitlementAmount: dto.entitlementAmount ?? 0,
        entitlementUnit,
        accrualMethod,
        accrualFrequency: dto.accrualFrequency ?? frequencyFor(accrualMethod),
        accrualStartRule: dto.accrualStartRule ?? "PERIOD_START",
        eligibilityMonths: dto.eligibilityMonths ?? 0,
        maxBalance: dto.maxBalance ?? null,
        carryOverEnabled: dto.carryOverEnabled ?? false,
        maxCarryOverAmount: dto.maxCarryOverAmount ?? null,
        carryOverExpirationMonths: dto.carryOverExpirationMonths ?? null,
        minRequestDuration: dto.minRequestDuration ?? null,
        maxRequestDuration: dto.maxRequestDuration ?? null,
        minAdvanceNoticeDays: dto.minAdvanceNoticeDays ?? 0,
        allowNegativeBalance: dto.allowNegativeBalance ?? false,
        allowHalfDay: dto.allowHalfDay ?? false,
        allowUnpaidLeave: dto.allowUnpaidLeave ?? true,
        approvalMode: dto.approvalMode ?? "MANAGER",
        leaveYearStartMonth: dto.leaveYearStartMonth ?? 1,
        cancellationCutoffDays: dto.cancellationCutoffDays ?? 0,
        effectiveFrom: dateKey(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? dateKey(dto.effectiveTo) : null,
        status: dto.status ?? "ACTIVE",
      },
      include: leavePolicyInclude,
    });
    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "leave_policy.created",
      entityType: "leave_policy",
      entityId: row.id,
      metadata: { code: row.code, leaveTypeId: row.leaveTypeId },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return toLeavePolicy(row);
  }

  async update(id: string, dto: UpdateLeavePolicyDto, actor: LeaveActor): Promise<LeavePolicy> {
    const existing = await this.prisma.leavePolicy.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: "LEAVE_POLICY_NOT_FOUND",
        message: "Leave policy not found",
      });
    }
    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      const duplicate = await this.prisma.leavePolicy.findUnique({ where: { code } });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException({
          code: "LEAVE_POLICY_CODE_TAKEN",
          message: "Leave policy code is already used",
        });
      }
    }
    if (dto.leaveTypeId && dto.leaveTypeId !== existing.leaveTypeId) {
      const leaveType = await this.prisma.leaveType.findUnique({
        where: { id: dto.leaveTypeId },
      });
      if (!leaveType) {
        throw new BadRequestException({
          code: "LEAVE_TYPE_NOT_FOUND",
          message: "The selected leave type does not exist",
        });
      }
    }
    const effectiveFrom = dto.effectiveFrom ?? existing.effectiveFrom.toISOString().slice(0, 10);
    const effectiveTo =
      dto.effectiveTo === undefined
        ? (existing.effectiveTo?.toISOString().slice(0, 10) ?? null)
        : dto.effectiveTo;
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException({
        code: "INVALID_POLICY_EFFECTIVE_RANGE",
        message: "effectiveTo must not be before effectiveFrom",
      });
    }
    if (dto.entitlementUnit === "HOUR") {
      throw new BadRequestException({
        code: "HOURLY_LEAVE_NOT_SUPPORTED",
        message: "Hourly leave policies are not supported in Phase 5",
      });
    }
    this.validateConfiguration(dto);

    const row = await this.prisma.leavePolicy.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() ?? null } : {}),
        ...(dto.leaveTypeId !== undefined ? { leaveTypeId: dto.leaveTypeId } : {}),
        ...(dto.entitlementAmount !== undefined
          ? { entitlementAmount: dto.entitlementAmount }
          : {}),
        ...(dto.entitlementUnit !== undefined ? { entitlementUnit: dto.entitlementUnit } : {}),
        ...(dto.accrualMethod !== undefined
          ? {
              accrualMethod: dto.accrualMethod,
              accrualFrequency: dto.accrualFrequency ?? frequencyFor(dto.accrualMethod),
            }
          : dto.accrualFrequency !== undefined
            ? { accrualFrequency: dto.accrualFrequency }
            : {}),
        ...(dto.accrualStartRule !== undefined ? { accrualStartRule: dto.accrualStartRule } : {}),
        ...(dto.eligibilityMonths !== undefined
          ? { eligibilityMonths: dto.eligibilityMonths }
          : {}),
        ...(dto.maxBalance !== undefined ? { maxBalance: dto.maxBalance } : {}),
        ...(dto.carryOverEnabled !== undefined ? { carryOverEnabled: dto.carryOverEnabled } : {}),
        ...(dto.maxCarryOverAmount !== undefined
          ? { maxCarryOverAmount: dto.maxCarryOverAmount }
          : {}),
        ...(dto.carryOverExpirationMonths !== undefined
          ? { carryOverExpirationMonths: dto.carryOverExpirationMonths }
          : {}),
        ...(dto.minRequestDuration !== undefined
          ? { minRequestDuration: dto.minRequestDuration }
          : {}),
        ...(dto.maxRequestDuration !== undefined
          ? { maxRequestDuration: dto.maxRequestDuration }
          : {}),
        ...(dto.minAdvanceNoticeDays !== undefined
          ? { minAdvanceNoticeDays: dto.minAdvanceNoticeDays }
          : {}),
        ...(dto.allowNegativeBalance !== undefined
          ? { allowNegativeBalance: dto.allowNegativeBalance }
          : {}),
        ...(dto.allowHalfDay !== undefined ? { allowHalfDay: dto.allowHalfDay } : {}),
        ...(dto.allowUnpaidLeave !== undefined ? { allowUnpaidLeave: dto.allowUnpaidLeave } : {}),
        ...(dto.approvalMode !== undefined ? { approvalMode: dto.approvalMode } : {}),
        ...(dto.leaveYearStartMonth !== undefined
          ? { leaveYearStartMonth: dto.leaveYearStartMonth }
          : {}),
        ...(dto.cancellationCutoffDays !== undefined
          ? { cancellationCutoffDays: dto.cancellationCutoffDays }
          : {}),
        ...(dto.effectiveFrom !== undefined ? { effectiveFrom: dateKey(dto.effectiveFrom) } : {}),
        ...(dto.effectiveTo !== undefined
          ? { effectiveTo: dto.effectiveTo ? dateKey(dto.effectiveTo) : null }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: leavePolicyInclude,
    });
    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "leave_policy.updated",
      entityType: "leave_policy",
      entityId: id,
      metadata: { fields: Object.keys(dto) },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return toLeavePolicy(row);
  }

  async deactivate(id: string, actor: LeaveActor): Promise<LeavePolicy> {
    await this.getById(id);
    const row = await this.prisma.leavePolicy.update({
      where: { id },
      data: { status: "INACTIVE" },
      include: leavePolicyInclude,
    });
    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "leave_policy.deactivated",
      entityType: "leave_policy",
      entityId: id,
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return toLeavePolicy(row);
  }

  private validateConfiguration(dto: UpdateLeavePolicyDto | CreateLeavePolicyDto): void {
    if (
      dto.minRequestDuration !== undefined &&
      dto.maxRequestDuration !== undefined &&
      dto.minRequestDuration !== null &&
      dto.maxRequestDuration !== null &&
      dto.minRequestDuration > dto.maxRequestDuration
    ) {
      throw new BadRequestException({
        code: "INVALID_REQUEST_DURATION_RANGE",
        message: "minRequestDuration must not exceed maxRequestDuration",
      });
    }
    if (
      dto.maxCarryOverAmount !== undefined &&
      dto.maxCarryOverAmount !== null &&
      dto.carryOverEnabled === false
    ) {
      throw new BadRequestException({
        code: "CARRY_OVER_DISABLED",
        message: "A carry-over amount requires carryOverEnabled",
      });
    }
    if (
      dto.carryOverExpirationMonths !== undefined &&
      dto.carryOverExpirationMonths !== null &&
      dto.carryOverEnabled === false
    ) {
      throw new BadRequestException({
        code: "CARRY_OVER_DISABLED",
        message: "Carry-over expiry requires carryOverEnabled",
      });
    }
  }
}
