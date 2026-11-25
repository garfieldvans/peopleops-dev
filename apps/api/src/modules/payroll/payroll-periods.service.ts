import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import type { PaginatedResponse, PayrollPeriod } from "@peopleops/shared-types";
import { toPageMeta } from "../../common/dto/page-query.dto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type {
  CreatePayrollPeriodDto,
  ListPayrollPeriodsQueryDto,
  UpdatePayrollPeriodDto,
} from "./dto/payroll.dto";
import { payrollPeriodInclude, toPayrollPeriod, type PayrollPeriodRow } from "./payroll.mapper";
import { dateKey, type PayrollActor } from "./payroll.utils";

@Injectable()
export class PayrollPeriodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListPayrollPeriodsQueryDto): Promise<PaginatedResponse<PayrollPeriod>> {
    const where: Prisma.PayrollPeriodWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.payrollPeriod.count({ where }),
      this.prisma.payrollPeriod.findMany({
        where,
        include: payrollPeriodInclude,
        orderBy: { startDate: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toPayrollPeriod), ...toPageMeta(query.page, query.pageSize, total) };
  }

  async getById(id: string): Promise<PayrollPeriod> {
    return toPayrollPeriod(await this.findRow(id));
  }

  async create(dto: CreatePayrollPeriodDto, actor: PayrollActor): Promise<PayrollPeriod> {
    this.validate(dto.startDate, dto.endDate, dto.paymentDate);
    await this.assertNoOverlap(dto.startDate, dto.endDate);
    const row = await this.prisma.payrollPeriod.create({
      data: {
        name: dto.name.trim(),
        startDate: dateKey(dto.startDate),
        endDate: dateKey(dto.endDate),
        paymentDate: dateKey(dto.paymentDate),
        notes: dto.notes?.trim() ?? null,
        createdById: actor.actorUserId,
      },
      include: payrollPeriodInclude,
    });
    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "payroll.period_created",
      entityType: "payroll_period",
      entityId: row.id,
      metadata: { name: row.name, startDate: dto.startDate, endDate: dto.endDate },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return toPayrollPeriod(row);
  }

  async update(
    id: string,
    dto: UpdatePayrollPeriodDto,
    actor: PayrollActor,
  ): Promise<PayrollPeriod> {
    const existing = await this.findRow(id);
    const start = dto.startDate ?? existing.startDate.toISOString().slice(0, 10);
    const end = dto.endDate ?? existing.endDate.toISOString().slice(0, 10);
    const payment = dto.paymentDate ?? existing.paymentDate.toISOString().slice(0, 10);
    this.validate(start, end, payment);
    if (dto.startDate !== undefined || dto.endDate !== undefined) {
      await this.assertNoOverlap(start, end, id);
    }
    const row = await this.prisma.payrollPeriod.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.startDate !== undefined ? { startDate: dateKey(start) } : {}),
        ...(dto.endDate !== undefined ? { endDate: dateKey(end) } : {}),
        ...(dto.paymentDate !== undefined ? { paymentDate: dateKey(payment) } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() ?? null } : {}),
      },
      include: payrollPeriodInclude,
    });
    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "payroll.period_updated",
      entityType: "payroll_period",
      entityId: id,
      metadata: { fields: Object.keys(dto) },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return toPayrollPeriod(row);
  }

  private async findRow(id: string): Promise<PayrollPeriodRow> {
    const row = await this.prisma.payrollPeriod.findUnique({
      where: { id },
      include: payrollPeriodInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: "PAYROLL_PERIOD_NOT_FOUND",
        message: "Payroll period not found",
      });
    }
    return row;
  }

  private validate(start: string, end: string, payment: string): void {
    if (end < start) {
      throw new BadRequestException({
        code: "PAYROLL_PERIOD_RANGE",
        message: "endDate must not be before startDate",
      });
    }
    if (payment < end) {
      throw new BadRequestException({
        code: "PAYROLL_PERIOD_PAYMENT_DATE",
        message: "paymentDate must not be before endDate",
      });
    }
  }

  private async assertNoOverlap(start: string, end: string, excludeId?: string): Promise<void> {
    const overlap = await this.prisma.payrollPeriod.findFirst({
      where: {
        ...(excludeId ? { id: { not: excludeId } } : {}),
        startDate: { lte: dateKey(end) },
        endDate: { gte: dateKey(start) },
      },
      select: { id: true },
    });
    if (overlap) {
      throw new ConflictException({
        code: "PAYROLL_PERIOD_OVERLAP",
        message: "This payroll period overlaps another period",
      });
    }
  }
}
