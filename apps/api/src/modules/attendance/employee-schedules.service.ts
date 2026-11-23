import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import type {
  BulkAssignmentResult,
  EmployeeScheduleAssignment,
  PaginatedResponse,
} from "@peopleops/shared-types";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { toPageMeta } from "../../common/dto/page-query.dto";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { addDaysToDateKey } from "../../common/time/zoned-time";
import { EmployeesService, type ActorContext } from "../employee/employees.service";
import {
  assignmentInclude,
  toAssignment,
} from "./attendance.mapper";
import type {
  BulkEmployeeScheduleDto,
  CreateEmployeeScheduleDto,
  ListEmployeeSchedulesQueryDto,
  UpdateEmployeeScheduleDto,
} from "./dto/employee-schedule.dto";

function dateKeyToUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function utcToDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

@Injectable()
export class EmployeeSchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly employees: EmployeesService,
  ) {}

  async list(
    query: ListEmployeeSchedulesQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<EmployeeScheduleAssignment>> {
    const scope = await this.employees.resolveScope(user);
    let employeeFilter: Prisma.EmployeeWhereInput = {};

    if (!scope.readAll) {
      const ids = scope.readTeam ? await this.employees.scopedEmployeeIds(scope) : [];
      employeeFilter = { id: { in: ids } };
      if (query.employeeId && !ids.includes(query.employeeId)) {
        throw new ForbiddenException({
          code: "EMPLOYEE_OUT_OF_SCOPE",
          message: "You can only access schedules inside your reporting line",
        });
      }
    }

    const activeOn = query.activeOn ? dateKeyToUtc(query.activeOn) : null;
    const where: Prisma.EmployeeScheduleAssignmentWhereInput = {
      employee: {
        ...employeeFilter,
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      },
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(activeOn
        ? {
            effectiveFrom: { lte: activeOn },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: activeOn } }],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.employeeScheduleAssignment.count({ where }),
      this.prisma.employeeScheduleAssignment.findMany({
        where,
        include: assignmentInclude,
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const meta = toPageMeta(query.page, query.pageSize, total);
    return { items: rows.map(toAssignment), ...meta };
  }

  async listForEmployee(
    employeeId: string,
    query: ListEmployeeSchedulesQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<EmployeeScheduleAssignment>> {
    await this.employees.assertCanReadEmployee(employeeId, user);
    return this.list({ ...query, employeeId }, {
      ...user,
      permissions: [...user.permissions, "employee.read"],
    });
  }

  async createForEmployee(
    employeeId: string,
    dto: CreateEmployeeScheduleDto,
    actor: ActorContext,
  ): Promise<EmployeeScheduleAssignment> {
    const created = await this.prisma.$transaction((tx) =>
      this.createInternal(tx, employeeId, dto),
    );
    const row = await this.findRow(created.id);

    await this.auditAssignment("employee_schedule.created", row, actor, {
      workScheduleId: created.workScheduleId,
      effectiveFrom: utcToDateKey(created.effectiveFrom),
    });

    return row;
  }

  async update(
    id: string,
    dto: UpdateEmployeeScheduleDto,
    actor: ActorContext,
  ): Promise<EmployeeScheduleAssignment> {
    const existing = await this.prisma.employeeScheduleAssignment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: "EMPLOYEE_SCHEDULE_NOT_FOUND",
        message: "Schedule assignment not found",
      });
    }

    const effectiveFrom = dto.effectiveFrom
      ? dateKeyToUtc(dto.effectiveFrom)
      : existing.effectiveFrom;
    const effectiveTo =
      dto.effectiveTo === undefined
        ? existing.effectiveTo
        : dto.effectiveTo === null
          ? null
          : dateKeyToUtc(dto.effectiveTo);

    this.assertDateRange(effectiveFrom, effectiveTo);

    if (dto.workScheduleId) {
      const schedule = await this.prisma.workSchedule.findUnique({
        where: { id: dto.workScheduleId },
      });
      if (!schedule) {
        throw new BadRequestException({
          code: "WORK_SCHEDULE_NOT_FOUND",
          message: "Work schedule not found",
        });
      }
      if (schedule.status !== "ACTIVE") {
        throw new BadRequestException({
          code: "WORK_SCHEDULE_INACTIVE",
          message: "Inactive work schedules cannot be assigned",
        });
      }
    }

    if (dto.shiftId) {
      const shift = await this.prisma.shift.findUnique({ where: { id: dto.shiftId } });
      if (!shift) {
        throw new BadRequestException({ code: "SHIFT_NOT_FOUND", message: "Shift not found" });
      }
      if (shift.status !== "ACTIVE") {
        throw new BadRequestException({
          code: "SHIFT_INACTIVE",
          message: "Inactive shifts cannot be assigned",
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const overlap = await tx.employeeScheduleAssignment.findFirst({
        where: {
          employeeId: existing.employeeId,
          id: { not: id },
          effectiveFrom: { lte: effectiveTo ?? new Date("9999-12-31T00:00:00.000Z") },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
        },
      });
      if (overlap) {
        throw new ConflictException({
          code: "SCHEDULE_ASSIGNMENT_OVERLAP",
          message: "This employee already has a schedule assignment in that period",
        });
      }

      await tx.employeeScheduleAssignment.update({
        where: { id },
        data: {
          ...(dto.workScheduleId !== undefined ? { workScheduleId: dto.workScheduleId } : {}),
          ...(dto.shiftId !== undefined ? { shiftId: dto.shiftId } : {}),
          effectiveFrom,
          effectiveTo,
          ...(dto.changeReason !== undefined
            ? { changeReason: dto.changeReason?.trim() ?? null }
            : {}),
        },
      });
    });

    const row = await this.findRow(id);
    await this.auditAssignment("employee_schedule.updated", row, actor, {
      fields: Object.keys(dto),
    });
    return row;
  }

  async bulk(
    dto: BulkEmployeeScheduleDto,
    actor: ActorContext,
  ): Promise<BulkAssignmentResult> {
    const employeeIds = await this.resolveTargetEmployees(dto);
    if (employeeIds.length === 0) {
      throw new BadRequestException({
        code: "NO_TARGET_EMPLOYEES",
        message: "No active employees matched the selected target",
      });
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (const employeeId of employeeIds) {
        const row = await this.createInternal(tx, employeeId, dto);
        ids.push(row.id);
      }
      return ids;
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "employee_schedule.bulk_created",
      entityType: "employee_schedule",
      entityId: null,
      metadata: {
        workScheduleId: dto.workScheduleId,
        effectiveFrom: dto.effectiveFrom,
        employeeIds,
      },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return { assigned: created.length, employeeIds };
  }

  private async createInternal(
    tx: Prisma.TransactionClient,
    employeeId: string,
    dto: CreateEmployeeScheduleDto,
  ): Promise<{ id: string; workScheduleId: string; effectiveFrom: Date }> {
    const employee = await tx.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, employmentStatus: true },
    });
    if (!employee) {
      throw new NotFoundException({
        code: "EMPLOYEE_NOT_FOUND",
        message: "Employee not found",
      });
    }
    if (employee.employmentStatus !== "ACTIVE" && employee.employmentStatus !== "PROBATION") {
      throw new BadRequestException({
        code: "EMPLOYEE_NOT_ACTIVE",
        message: "Schedules can only be assigned to active or probation employees",
      });
    }

    const schedule = await tx.workSchedule.findUnique({ where: { id: dto.workScheduleId } });
    if (!schedule) {
      throw new BadRequestException({
        code: "WORK_SCHEDULE_NOT_FOUND",
        message: "Work schedule not found",
      });
    }
    if (schedule.status !== "ACTIVE") {
      throw new BadRequestException({
        code: "WORK_SCHEDULE_INACTIVE",
        message: "Inactive work schedules cannot be assigned",
      });
    }

    if (dto.shiftId) {
      const shift = await tx.shift.findUnique({ where: { id: dto.shiftId } });
      if (!shift) {
        throw new BadRequestException({ code: "SHIFT_NOT_FOUND", message: "Shift not found" });
      }
      if (shift.status !== "ACTIVE") {
        throw new BadRequestException({
          code: "SHIFT_INACTIVE",
          message: "Inactive shifts cannot be assigned",
        });
      }
    }

    const effectiveFrom = dateKeyToUtc(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? dateKeyToUtc(dto.effectiveTo) : null;
    this.assertDateRange(effectiveFrom, effectiveTo);

    const sameStart = await tx.employeeScheduleAssignment.findFirst({
      where: { employeeId, effectiveFrom },
    });
    if (sameStart) {
      throw new ConflictException({
        code: "SCHEDULE_ASSIGNMENT_EXISTS",
        message: "A schedule assignment already starts on that date",
      });
    }

    if (dto.closePrevious !== false) {
      const open = await tx.employeeScheduleAssignment.findFirst({
        where: { employeeId, effectiveTo: null, effectiveFrom: { lt: effectiveFrom } },
        orderBy: { effectiveFrom: "desc" },
      });
      if (open) {
        await tx.employeeScheduleAssignment.update({
          where: { id: open.id },
          data: {
            effectiveTo: dateKeyToUtc(addDaysToDateKey(utcToDateKey(effectiveFrom), -1)),
          },
        });
      }
    }

    const overlap = await tx.employeeScheduleAssignment.findFirst({
      where: {
        employeeId,
        effectiveFrom: { lte: effectiveTo ?? new Date("9999-12-31T00:00:00.000Z") },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
      },
    });
    if (overlap) {
      throw new ConflictException({
        code: "SCHEDULE_ASSIGNMENT_OVERLAP",
        message: "This employee already has a schedule assignment in that period",
      });
    }

    return tx.employeeScheduleAssignment.create({
      data: {
        employeeId,
        workScheduleId: dto.workScheduleId,
        shiftId: dto.shiftId ?? null,
        effectiveFrom,
        effectiveTo,
        changeReason: dto.changeReason?.trim() ?? null,
      },
      select: { id: true, workScheduleId: true, effectiveFrom: true },
    });
  }

  private async resolveTargetEmployees(dto: BulkEmployeeScheduleDto): Promise<string[]> {
    if (dto.employeeIds && dto.employeeIds.length > 0) {
      return [...new Set(dto.employeeIds)];
    }
    if (!dto.branchId && !dto.departmentId) {
      throw new BadRequestException({
        code: "ASSIGNMENT_TARGET_REQUIRED",
        message: "Choose a branch, a department, or specific employees",
      });
    }

    const rows = await this.prisma.employee.findMany({
      where: {
        employmentStatus: { in: ["ACTIVE", "PROBATION"] },
        ...(dto.branchId ? { branchId: dto.branchId } : {}),
        ...(dto.departmentId ? { departmentId: dto.departmentId } : {}),
      },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  private assertDateRange(effectiveFrom: Date, effectiveTo: Date | null): void {
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException({
        code: "INVALID_EFFECTIVE_RANGE",
        message: "Effective end date must not be before the start date",
      });
    }
  }

  private async findRow(id: string): Promise<EmployeeScheduleAssignment> {
    const row = await this.prisma.employeeScheduleAssignment.findUnique({
      where: { id },
      include: assignmentInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: "EMPLOYEE_SCHEDULE_NOT_FOUND",
        message: "Schedule assignment not found",
      });
    }
    return toAssignment(row);
  }

  private async auditAssignment(
    action: string,
    row: EmployeeScheduleAssignment,
    actor: ActorContext,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action,
      entityType: "employee_schedule",
      entityId: row.id,
      metadata: { employeeId: row.employeeId, ...metadata },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
  }
}
