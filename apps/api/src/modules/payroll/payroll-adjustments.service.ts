import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import type { PaginatedResponse, PayrollAdjustment } from "@peopleops/shared-types";
import { toPageMeta } from "../../common/dto/page-query.dto";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type {
  CreatePayrollAdjustmentDto,
  ListPayrollAdjustmentsQueryDto,
  ReviewPayrollAdjustmentDto,
  UpdatePayrollAdjustmentDto,
} from "./dto/payroll.dto";
import {
  payrollAdjustmentInclude,
  toPayrollAdjustment,
  type PayrollAdjustmentRow,
} from "./payroll.mapper";
import { decimal, type PayrollActor } from "./payroll.utils";

@Injectable()
export class PayrollAdjustmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListPayrollAdjustmentsQueryDto): Promise<PaginatedResponse<PayrollAdjustment>> {
    const where: Prisma.PayrollAdjustmentWhereInput = {
      ...(query.periodId ? { periodId: query.periodId } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.payrollAdjustment.count({ where }),
      this.prisma.payrollAdjustment.findMany({
        where,
        include: payrollAdjustmentInclude,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toPayrollAdjustment), ...toPageMeta(query.page, query.pageSize, total) };
  }

  async create(dto: CreatePayrollAdjustmentDto, actor: PayrollActor): Promise<PayrollAdjustment> {
    await this.assertPeriod(dto.periodId);
    await this.assertEmployee(dto.employeeId);
    await this.assertComponent(dto.componentId);
    const row = await this.prisma.payrollAdjustment.create({
      data: {
        periodId: dto.periodId,
        employeeId: dto.employeeId,
        componentId: dto.componentId,
        amount: decimal(dto.amount).toFixed(2),
        reason: dto.reason.trim(),
        createdById: actor.actorUserId,
      },
      include: payrollAdjustmentInclude,
    });
    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "payroll.adjustment_created",
      entityType: "payroll_adjustment",
      entityId: row.id,
      metadata: { periodId: dto.periodId, employeeId: dto.employeeId, amount: dto.amount },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return toPayrollAdjustment(row);
  }

  async update(
    id: string,
    dto: UpdatePayrollAdjustmentDto,
    actor: PayrollActor,
  ): Promise<PayrollAdjustment> {
    const existing = await this.findRow(id);
    if (existing.status !== "PENDING") {
      throw new ConflictException({
        code: "PAYROLL_ADJUSTMENT_LOCKED",
        message: "Only pending adjustments can be edited",
      });
    }
    const row = await this.prisma.payrollAdjustment.update({
      where: { id },
      data: {
        ...(dto.amount !== undefined ? { amount: decimal(dto.amount).toFixed(2) } : {}),
        ...(dto.reason !== undefined ? { reason: dto.reason.trim() } : {}),
      },
      include: payrollAdjustmentInclude,
    });
    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "payroll.adjustment_updated",
      entityType: "payroll_adjustment",
      entityId: id,
      metadata: { fields: Object.keys(dto) },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return toPayrollAdjustment(row);
  }

  async review(
    id: string,
    dto: ReviewPayrollAdjustmentDto,
    user: AuthenticatedUser,
  ): Promise<PayrollAdjustment> {
    const existing = await this.findRow(id);
    if (existing.status !== "PENDING") {
      throw new ConflictException({
        code: "PAYROLL_ADJUSTMENT_ALREADY_REVIEWED",
        message: "This adjustment has already been reviewed",
      });
    }
    const updated = await this.prisma.payrollAdjustment.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: dto.status,
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewComment: dto.comment?.trim() ?? null,
      },
    });
    if (updated.count === 0) {
      throw new ConflictException({
        code: "PAYROLL_ADJUSTMENT_ALREADY_REVIEWED",
        message: "Another reviewer already processed this adjustment",
      });
    }
    const row = await this.findRow(id);
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: `payroll.adjustment_${dto.status.toLowerCase()}`,
      entityType: "payroll_adjustment",
      entityId: id,
      metadata: { comment: dto.comment ?? null },
    });
    return toPayrollAdjustment(row);
  }

  private async findRow(id: string): Promise<PayrollAdjustmentRow> {
    const row = await this.prisma.payrollAdjustment.findUnique({
      where: { id },
      include: payrollAdjustmentInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: "PAYROLL_ADJUSTMENT_NOT_FOUND",
        message: "Payroll adjustment not found",
      });
    }
    return row;
  }

  private async assertPeriod(periodId: string): Promise<void> {
    const period = await this.prisma.payrollPeriod.findUnique({
      where: { id: periodId },
      select: { status: true },
    });
    if (!period) {
      throw new BadRequestException({
        code: "PAYROLL_PERIOD_NOT_FOUND",
        message: "The selected payroll period does not exist",
      });
    }
    if (period.status === "CLOSED") {
      throw new BadRequestException({
        code: "PAYROLL_PERIOD_CLOSED",
        message: "Adjustments cannot be added to a closed period",
      });
    }
  }

  private async assertEmployee(employeeId: string): Promise<void> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) {
      throw new BadRequestException({
        code: "PAYROLL_EMPLOYEE_NOT_FOUND",
        message: "The selected employee does not exist",
      });
    }
  }

  private async assertComponent(componentId: string): Promise<void> {
    const component = await this.prisma.payrollComponent.findUnique({
      where: { id: componentId },
      select: { isActive: true },
    });
    if (!component) {
      throw new BadRequestException({
        code: "PAYROLL_COMPONENT_NOT_FOUND",
        message: "The selected payroll component does not exist",
      });
    }
    if (!component.isActive) {
      throw new BadRequestException({
        code: "PAYROLL_COMPONENT_INACTIVE",
        message: "Only active payroll components can be used in adjustments",
      });
    }
  }
}
