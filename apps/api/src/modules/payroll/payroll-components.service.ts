import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import type { PayrollComponent, PaginatedResponse } from "@peopleops/shared-types";
import { toPageMeta } from "../../common/dto/page-query.dto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type {
  CreatePayrollComponentDto,
  ListPayrollComponentsQueryDto,
  UpdatePayrollComponentDto,
} from "./dto/payroll.dto";
import {
  payrollComponentInclude,
  toPayrollComponent,
  type PayrollComponentRow,
} from "./payroll.mapper";
import { dateKey, decimal, type PayrollActor } from "./payroll.utils";

@Injectable()
export class PayrollComponentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListPayrollComponentsQueryDto): Promise<PaginatedResponse<PayrollComponent>> {
    const where: Prisma.PayrollComponentWhereInput = {
      ...(query.componentType ? { componentType: query.componentType } : {}),
      ...(query.calculationType ? { calculationType: query.calculationType } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: "insensitive" } },
              { name: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.payrollComponent.count({ where }),
      this.prisma.payrollComponent.findMany({
        where,
        include: payrollComponentInclude,
        orderBy: [{ isActive: "desc" }, { code: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toPayrollComponent), ...toPageMeta(query.page, query.pageSize, total) };
  }

  async listActive(): Promise<PayrollComponent[]> {
    const rows = await this.prisma.payrollComponent.findMany({
      where: { isActive: true },
      include: payrollComponentInclude,
      orderBy: { code: "asc" },
    });
    return rows.map(toPayrollComponent);
  }

  async getById(id: string): Promise<PayrollComponent> {
    return toPayrollComponent(await this.findRow(id));
  }

  async create(dto: CreatePayrollComponentDto, actor: PayrollActor): Promise<PayrollComponent> {
    const code = dto.code.trim().toUpperCase();
    const duplicate = await this.prisma.payrollComponent.findUnique({ where: { code } });
    if (duplicate) {
      throw new ConflictException({
        code: "PAYROLL_COMPONENT_CODE_TAKEN",
        message: "Payroll component code is already used",
      });
    }
    this.validate(dto);
    const row = await this.prisma.payrollComponent.create({
      data: {
        code,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        componentType: dto.componentType,
        calculationType: dto.calculationType,
        defaultAmount: decimal(dto.defaultAmount ?? "0").toFixed(2),
        percentage: dto.percentage ? decimal(dto.percentage).toFixed(4) : null,
        rateMultiplier: dto.rateMultiplier ? decimal(dto.rateMultiplier).toFixed(4) : null,
        sourceType: dto.calculationType === "SOURCE_BASED" ? (dto.sourceType ?? null) : null,
        isTaxable: dto.isTaxable ?? false,
        isRecurring: dto.isRecurring ?? true,
        isActive: dto.isActive ?? true,
        effectiveFrom: dateKey(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? dateKey(dto.effectiveTo) : null,
      },
      include: payrollComponentInclude,
    });
    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "payroll.component_created",
      entityType: "payroll_component",
      entityId: row.id,
      metadata: { code: row.code },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return toPayrollComponent(row);
  }

  async update(
    id: string,
    dto: UpdatePayrollComponentDto,
    actor: PayrollActor,
  ): Promise<PayrollComponent> {
    const existing = await this.findRow(id);
    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      const duplicate = await this.prisma.payrollComponent.findUnique({ where: { code } });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException({
          code: "PAYROLL_COMPONENT_CODE_TAKEN",
          message: "Payroll component code is already used",
        });
      }
    }
    this.validate(dto, existing);
    const calculationType = dto.calculationType ?? existing.calculationType;
    const row = await this.prisma.payrollComponent.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() ?? null }
          : {}),
        ...(dto.componentType !== undefined ? { componentType: dto.componentType } : {}),
        ...(dto.calculationType !== undefined ? { calculationType: dto.calculationType } : {}),
        ...(dto.defaultAmount !== undefined
          ? { defaultAmount: decimal(dto.defaultAmount).toFixed(2) }
          : {}),
        ...(dto.percentage !== undefined
          ? { percentage: dto.percentage ? decimal(dto.percentage).toFixed(4) : null }
          : {}),
        ...(dto.rateMultiplier !== undefined
          ? {
              rateMultiplier: dto.rateMultiplier
                ? decimal(dto.rateMultiplier).toFixed(4)
                : null,
            }
          : {}),
        ...(dto.sourceType !== undefined || dto.calculationType !== undefined
          ? {
              sourceType:
                calculationType === "SOURCE_BASED" ? (dto.sourceType ?? existing.sourceType) : null,
            }
          : {}),
        ...(dto.isTaxable !== undefined ? { isTaxable: dto.isTaxable } : {}),
        ...(dto.isRecurring !== undefined ? { isRecurring: dto.isRecurring } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.effectiveFrom !== undefined ? { effectiveFrom: dateKey(dto.effectiveFrom) } : {}),
        ...(dto.effectiveTo !== undefined
          ? { effectiveTo: dto.effectiveTo ? dateKey(dto.effectiveTo) : null }
          : {}),
      },
      include: payrollComponentInclude,
    });
    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "payroll.component_updated",
      entityType: "payroll_component",
      entityId: id,
      metadata: { fields: Object.keys(dto) },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return toPayrollComponent(row);
  }

  async deactivate(id: string, actor: PayrollActor): Promise<PayrollComponent> {
    await this.findRow(id);
    const row = await this.prisma.payrollComponent.update({
      where: { id },
      data: { isActive: false },
      include: payrollComponentInclude,
    });
    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "payroll.component_deactivated",
      entityType: "payroll_component",
      entityId: id,
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return toPayrollComponent(row);
  }

  private async findRow(id: string): Promise<PayrollComponentRow> {
    const row = await this.prisma.payrollComponent.findUnique({
      where: { id },
      include: payrollComponentInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: "PAYROLL_COMPONENT_NOT_FOUND",
        message: "Payroll component not found",
      });
    }
    return row;
  }

  private validate(
    dto: UpdatePayrollComponentDto | CreatePayrollComponentDto,
    existing?: {
      calculationType: string;
      sourceType: string | null;
      percentage: Prisma.Decimal | null;
      effectiveFrom: Date;
      effectiveTo: Date | null;
    },
  ): void {
    const calculationType = dto.calculationType ?? existing?.calculationType;
    const sourceType = dto.sourceType ?? existing?.sourceType ?? null;
    if (calculationType === "SOURCE_BASED" && !sourceType) {
      throw new BadRequestException({
        code: "PAYROLL_COMPONENT_SOURCE_REQUIRED",
        message: "SOURCE_BASED components require a source type",
      });
    }
    if (calculationType !== "SOURCE_BASED" && dto.sourceType) {
      throw new BadRequestException({
        code: "PAYROLL_COMPONENT_SOURCE_UNEXPECTED",
        message: "Only SOURCE_BASED components may declare a source type",
      });
    }
    if (calculationType === "PERCENTAGE" && !(dto.percentage ?? existing?.percentage)) {
      throw new BadRequestException({
        code: "PAYROLL_COMPONENT_PERCENTAGE_REQUIRED",
        message: "PERCENTAGE components require a percentage",
      });
    }
    const from = dto.effectiveFrom ?? existing?.effectiveFrom.toISOString().slice(0, 10);
    const to =
      dto.effectiveTo === undefined
        ? (existing?.effectiveTo?.toISOString().slice(0, 10) ?? null)
        : dto.effectiveTo;
    if (from && to && to < from) {
      throw new BadRequestException({
        code: "PAYROLL_COMPONENT_RANGE",
        message: "effectiveTo must not be before effectiveFrom",
      });
    }
  }
}
