import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import type { EmployeeCompensation, PaginatedResponse } from "@peopleops/shared-types";
import { toPageMeta } from "../../common/dto/page-query.dto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type {
  CreateCompensationDto,
  ListCompensationQueryDto,
  UpdateCompensationDto,
} from "./dto/payroll.dto";
import { compensationInclude, toCompensation } from "./payroll.mapper";
import { dateKey, decimal, type PayrollActor } from "./payroll.utils";

function isOverlapError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    String(error.message).includes("employee_compensations_no_overlap")
  );
}

@Injectable()
export class PayrollCompensationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListCompensationQueryDto): Promise<PaginatedResponse<EmployeeCompensation>> {
    const where: Prisma.EmployeeCompensationWhereInput = {
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            employee: {
              OR: [
                { employeeNumber: { contains: query.search, mode: "insensitive" } },
                { firstName: { contains: query.search, mode: "insensitive" } },
                { lastName: { contains: query.search, mode: "insensitive" } },
                { preferredName: { contains: query.search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.employeeCompensation.count({ where }),
      this.prisma.employeeCompensation.findMany({
        where,
        include: compensationInclude,
        orderBy: [{ employee: { firstName: "asc" } }, { effectiveFrom: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toCompensation), ...toPageMeta(query.page, query.pageSize, total) };
  }

  async history(employeeId: string): Promise<EmployeeCompensation[]> {
    const rows = await this.prisma.employeeCompensation.findMany({
      where: { employeeId },
      include: compensationInclude,
      orderBy: { effectiveFrom: "desc" },
    });
    return rows.map(toCompensation);
  }

  async create(dto: CreateCompensationDto, actor: PayrollActor): Promise<EmployeeCompensation> {
    await this.assertEmployee(dto.employeeId);
    this.assertRange(dto.effectiveFrom, dto.effectiveTo ?? null);
    const overlap = await this.prisma.employeeCompensation.findFirst({
      where: {
        employeeId: dto.employeeId,
        status: "ACTIVE",
        effectiveFrom: { lte: dateKey(dto.effectiveTo ?? "9999-12-31") },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: dateKey(dto.effectiveFrom) } }],
      },
      select: { id: true },
    });
    if (overlap) {
      throw new ConflictException({
        code: "PAYROLL_COMPENSATION_OVERLAP",
        message: "An active compensation row already covers part of this date range",
      });
    }

    try {
      const row = await this.prisma.employeeCompensation.create({
        data: {
          employeeId: dto.employeeId,
          baseSalary: decimal(dto.baseSalary).toFixed(2),
          currency: (dto.currency ?? "IDR").trim().toUpperCase(),
          paymentFrequency: dto.paymentFrequency ?? "MONTHLY",
          effectiveFrom: dateKey(dto.effectiveFrom),
          effectiveTo: dto.effectiveTo ? dateKey(dto.effectiveTo) : null,
          status: dto.status ?? "ACTIVE",
          notes: dto.notes?.trim() ?? null,
          createdById: actor.actorUserId,
        },
        include: compensationInclude,
      });
      await this.audit.record({
        actorUserId: actor.actorUserId,
        actorEmail: actor.actorEmail,
        action: "payroll.compensation_created",
        entityType: "employee_compensation",
        entityId: row.id,
        metadata: { employeeId: row.employeeId, effectiveFrom: dto.effectiveFrom },
        ip: actor.meta.ip,
        userAgent: actor.meta.userAgent,
      });
      return toCompensation(row);
    } catch (error) {
      if (isOverlapError(error)) {
        throw new ConflictException({
          code: "PAYROLL_COMPENSATION_OVERLAP",
          message: "An active compensation row already covers part of this date range",
        });
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateCompensationDto,
    actor: PayrollActor,
  ): Promise<EmployeeCompensation> {
    const existing = await this.prisma.employeeCompensation.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: "PAYROLL_COMPENSATION_NOT_FOUND",
        message: "Compensation row not found",
      });
    }
    const from = dto.effectiveFrom ?? existing.effectiveFrom.toISOString().slice(0, 10);
    const to =
      dto.effectiveTo === undefined
        ? (existing.effectiveTo?.toISOString().slice(0, 10) ?? null)
        : dto.effectiveTo;
    this.assertRange(from, to);
    const status = dto.status ?? existing.status;
    if (status === "ACTIVE") {
      const overlap = await this.prisma.employeeCompensation.findFirst({
        where: {
          id: { not: id },
          employeeId: existing.employeeId,
          status: "ACTIVE",
          effectiveFrom: { lte: dateKey(to ?? "9999-12-31") },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: dateKey(from) } }],
        },
        select: { id: true },
      });
      if (overlap) {
        throw new ConflictException({
          code: "PAYROLL_COMPENSATION_OVERLAP",
          message: "An active compensation row already covers part of this date range",
        });
      }
    }

    try {
      const row = await this.prisma.employeeCompensation.update({
        where: { id },
        data: {
          ...(dto.baseSalary !== undefined
            ? { baseSalary: decimal(dto.baseSalary).toFixed(2) }
            : {}),
          ...(dto.currency !== undefined ? { currency: dto.currency.trim().toUpperCase() } : {}),
          ...(dto.paymentFrequency !== undefined
            ? { paymentFrequency: dto.paymentFrequency }
            : {}),
          ...(dto.effectiveFrom !== undefined ? { effectiveFrom: dateKey(dto.effectiveFrom) } : {}),
          ...(dto.effectiveTo !== undefined
            ? { effectiveTo: dto.effectiveTo ? dateKey(dto.effectiveTo) : null }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes?.trim() ?? null } : {}),
        },
        include: compensationInclude,
      });
      await this.audit.record({
        actorUserId: actor.actorUserId,
        actorEmail: actor.actorEmail,
        action: "payroll.compensation_updated",
        entityType: "employee_compensation",
        entityId: id,
        metadata: { fields: Object.keys(dto) },
        ip: actor.meta.ip,
        userAgent: actor.meta.userAgent,
      });
      return toCompensation(row);
    } catch (error) {
      if (isOverlapError(error)) {
        throw new ConflictException({
          code: "PAYROLL_COMPENSATION_OVERLAP",
          message: "An active compensation row already covers part of this date range",
        });
      }
      throw error;
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

  private assertRange(from: string, to: string | null): void {
    if (to && to < from) {
      throw new BadRequestException({
        code: "PAYROLL_COMPENSATION_RANGE",
        message: "effectiveTo must not be before effectiveFrom",
      });
    }
  }
}
