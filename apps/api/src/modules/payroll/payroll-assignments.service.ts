import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import type { EmployeePayrollAssignment, PaginatedResponse } from "@peopleops/shared-types";
import { toPageMeta } from "../../common/dto/page-query.dto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type {
  CreatePayrollAssignmentDto,
  ListPayrollAssignmentsQueryDto,
  UpdatePayrollAssignmentDto,
} from "./dto/payroll.dto";
import {
  payrollAssignmentInclude,
  toPayrollAssignment,
  type PayrollAssignmentRow,
} from "./payroll.mapper";
import { dateKey, decimal, type PayrollActor } from "./payroll.utils";

function isOverlapError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    String(error.message).includes("employee_payroll_assignments_no_overlap")
  );
}

@Injectable()
export class PayrollAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    query: ListPayrollAssignmentsQueryDto,
  ): Promise<PaginatedResponse<EmployeePayrollAssignment>> {
    const where: Prisma.EmployeePayrollAssignmentWhereInput = {
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.componentId ? { componentId: query.componentId } : {}),
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
      this.prisma.employeePayrollAssignment.count({ where }),
      this.prisma.employeePayrollAssignment.findMany({
        where,
        include: payrollAssignmentInclude,
        orderBy: [{ employee: { firstName: "asc" } }, { effectiveFrom: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toPayrollAssignment), ...toPageMeta(query.page, query.pageSize, total) };
  }

  async create(
    dto: CreatePayrollAssignmentDto,
    actor: PayrollActor,
  ): Promise<EmployeePayrollAssignment> {
    await this.assertEmployee(dto.employeeId);
    await this.assertComponent(dto.componentId);
    const from = dateKey(dto.effectiveFrom);
    const to = dto.effectiveTo ? dateKey(dto.effectiveTo) : null;
    this.assertRange(from, to);
    await this.assertNoOverlap(dto.employeeId, dto.componentId, from, to);

    try {
      const row = await this.prisma.employeePayrollAssignment.create({
        data: {
          employeeId: dto.employeeId,
          componentId: dto.componentId,
          amountOverride: dto.amountOverride ? decimal(dto.amountOverride).toFixed(2) : null,
          effectiveFrom: from,
          effectiveTo: to,
          status: dto.status ?? "ACTIVE",
          notes: dto.notes?.trim() ?? null,
          createdById: actor.actorUserId,
        },
        include: payrollAssignmentInclude,
      });
      await this.audit.record({
        actorUserId: actor.actorUserId,
        actorEmail: actor.actorEmail,
        action: "payroll.assignment_created",
        entityType: "employee_payroll_assignment",
        entityId: row.id,
        metadata: {
          employeeId: dto.employeeId,
          componentId: dto.componentId,
          effectiveFrom: dto.effectiveFrom,
        },
        ip: actor.meta.ip,
        userAgent: actor.meta.userAgent,
      });
      return toPayrollAssignment(row);
    } catch (error) {
      if (isOverlapError(error)) {
        throw new ConflictException({
          code: "PAYROLL_ASSIGNMENT_OVERLAP",
          message: "An active assignment already covers part of this date range",
        });
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdatePayrollAssignmentDto,
    actor: PayrollActor,
  ): Promise<EmployeePayrollAssignment> {
    const existing = await this.findRow(id);
    const from = dto.effectiveFrom ? dateKey(dto.effectiveFrom) : existing.effectiveFrom;
    const to =
      dto.effectiveTo === undefined
        ? existing.effectiveTo
        : dto.effectiveTo
          ? dateKey(dto.effectiveTo)
          : null;
    this.assertRange(from, to);
    const status = dto.status ?? existing.status;
    if (status === "ACTIVE") {
      await this.assertNoOverlap(existing.employeeId, existing.componentId, from, to, id);
    }

    try {
      const row = await this.prisma.employeePayrollAssignment.update({
        where: { id },
        data: {
          ...(dto.amountOverride !== undefined
            ? {
                amountOverride: dto.amountOverride
                  ? decimal(dto.amountOverride).toFixed(2)
                  : null,
              }
            : {}),
          ...(dto.effectiveFrom !== undefined ? { effectiveFrom: from } : {}),
          ...(dto.effectiveTo !== undefined ? { effectiveTo: to } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes?.trim() ?? null } : {}),
        },
        include: payrollAssignmentInclude,
      });
      await this.audit.record({
        actorUserId: actor.actorUserId,
        actorEmail: actor.actorEmail,
        action: "payroll.assignment_updated",
        entityType: "employee_payroll_assignment",
        entityId: id,
        metadata: { fields: Object.keys(dto) },
        ip: actor.meta.ip,
        userAgent: actor.meta.userAgent,
      });
      return toPayrollAssignment(row);
    } catch (error) {
      if (isOverlapError(error)) {
        throw new ConflictException({
          code: "PAYROLL_ASSIGNMENT_OVERLAP",
          message: "An active assignment already covers part of this date range",
        });
      }
      throw error;
    }
  }

  async deactivate(id: string, actor: PayrollActor): Promise<EmployeePayrollAssignment> {
    await this.findRow(id);
    const row = await this.prisma.employeePayrollAssignment.update({
      where: { id },
      data: { status: "INACTIVE" },
      include: payrollAssignmentInclude,
    });
    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "payroll.assignment_deactivated",
      entityType: "employee_payroll_assignment",
      entityId: id,
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return toPayrollAssignment(row);
  }

  private async findRow(id: string): Promise<PayrollAssignmentRow> {
    const row = await this.prisma.employeePayrollAssignment.findUnique({
      where: { id },
      include: payrollAssignmentInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: "PAYROLL_ASSIGNMENT_NOT_FOUND",
        message: "Payroll assignment not found",
      });
    }
    return row;
  }

  private async assertEmployee(employeeId: string): Promise<void> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { employmentStatus: true },
    });
    if (!employee) {
      throw new BadRequestException({
        code: "PAYROLL_EMPLOYEE_NOT_FOUND",
        message: "The selected employee does not exist",
      });
    }
    if (employee.employmentStatus !== "ACTIVE" && employee.employmentStatus !== "PROBATION") {
      throw new BadRequestException({
        code: "PAYROLL_EMPLOYEE_INACTIVE",
        message: "Payroll assignments require an active or probation employee",
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
        message: "Only active payroll components can be assigned",
      });
    }
  }

  private assertRange(from: Date, to: Date | null): void {
    if (to && to < from) {
      throw new BadRequestException({
        code: "PAYROLL_ASSIGNMENT_RANGE",
        message: "effectiveTo must not be before effectiveFrom",
      });
    }
  }

  private async assertNoOverlap(
    employeeId: string,
    componentId: string,
    from: Date,
    to: Date | null,
    excludeId?: string,
  ): Promise<void> {
    const overlap = await this.prisma.employeePayrollAssignment.findFirst({
      where: {
        ...(excludeId ? { id: { not: excludeId } } : {}),
        employeeId,
        componentId,
        status: "ACTIVE",
        effectiveFrom: { lte: to ?? new Date("9999-12-31T00:00:00.000Z") },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
      },
      select: { id: true },
    });
    if (overlap) {
      throw new ConflictException({
        code: "PAYROLL_ASSIGNMENT_OVERLAP",
        message: "An active assignment already covers part of this date range",
      });
    }
  }
}
