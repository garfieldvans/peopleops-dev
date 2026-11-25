import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import type { OvertimePolicyAssignment, PaginatedResponse } from "@peopleops/shared-types";
import { toPageMeta } from "../../common/dto/page-query.dto";
import { addDaysToDateKey, dateKeyOf } from "../../common/time/zoned-time";
import { PrismaService } from "../../prisma/prisma.service";
import { AttendanceService } from "../attendance/attendance.service";
import { AuditService } from "../audit/audit.service";
import type {
  CreateOvertimeAssignmentDto,
  ListOvertimeAssignmentsQueryDto,
  UpdateOvertimeAssignmentDto,
} from "./dto/overtime.dto";
import { overtimeAssignmentInclude, toOvertimeAssignment } from "./overtime.mapper";
import type { OvertimeActor } from "./overtime.types";

function dateKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

interface ScopeFilter {
  employeeId?: string;
  departmentId?: string;
  branchId?: string;
}

@Injectable()
export class OvertimeAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly attendance: AttendanceService,
  ) {}

  async list(
    query: ListOvertimeAssignmentsQueryDto,
  ): Promise<PaginatedResponse<OvertimePolicyAssignment>> {
    const where: Prisma.OvertimePolicyAssignmentWhereInput = {
      ...(query.policyId ? { policyId: query.policyId } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.overtimePolicyAssignment.count({ where }),
      this.prisma.overtimePolicyAssignment.findMany({
        where,
        include: overtimeAssignmentInclude,
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: rows.map(toOvertimeAssignment),
      ...toPageMeta(query.page, query.pageSize, total),
    };
  }

  async create(
    dto: CreateOvertimeAssignmentDto,
    actor: OvertimeActor,
  ): Promise<OvertimePolicyAssignment> {
    const scope = this.scopeOf(dto);
    const policy = await this.prisma.overtimePolicy.findUnique({ where: { id: dto.policyId } });
    if (!policy) {
      throw new BadRequestException({
        code: "OVERTIME_POLICY_NOT_FOUND",
        message: "The selected overtime policy does not exist",
      });
    }
    if (policy.status !== "ACTIVE") {
      throw new BadRequestException({
        code: "OVERTIME_POLICY_INACTIVE",
        message: "Only active overtime policies can be assigned",
      });
    }
    const from = dateKey(dto.effectiveFrom);
    const to = dto.effectiveTo ? dateKey(dto.effectiveTo) : null;
    this.assertRange(from, to);
    this.assertWithinPolicy(policy, from);
    await this.assertScopeExists(scope);
    await this.assertNoOverlap(scope, from, to);

    const row = await this.prisma.overtimePolicyAssignment.create({
      data: {
        policyId: dto.policyId,
        ...scope,
        effectiveFrom: from,
        effectiveTo: to,
        notes: dto.notes?.trim() ?? null,
        createdById: actor.actorUserId,
      },
      include: overtimeAssignmentInclude,
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "overtime_policy.assigned",
      entityType: "overtime_policy_assignment",
      entityId: row.id,
      metadata: { policyId: dto.policyId, ...scope, effectiveFrom: dto.effectiveFrom },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return toOvertimeAssignment(row);
  }

  async update(
    id: string,
    dto: UpdateOvertimeAssignmentDto,
    actor: OvertimeActor,
  ): Promise<OvertimePolicyAssignment> {
    const existing = await this.prisma.overtimePolicyAssignment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: "OVERTIME_ASSIGNMENT_NOT_FOUND",
        message: "Overtime policy assignment not found",
      });
    }
    const from = dto.effectiveFrom ? dateKey(dto.effectiveFrom) : existing.effectiveFrom;
    const to =
      dto.effectiveTo === undefined
        ? existing.effectiveTo
        : dto.effectiveTo
          ? dateKey(dto.effectiveTo)
          : null;
    this.assertRange(from, to);
    const policy = await this.prisma.overtimePolicy.findUnique({
      where: { id: existing.policyId },
      select: { effectiveFrom: true, effectiveTo: true },
    });
    if (!policy) {
      throw new BadRequestException({
        code: "OVERTIME_POLICY_NOT_FOUND",
        message: "The selected overtime policy does not exist",
      });
    }
    this.assertWithinPolicy(policy, from);
    await this.assertNoOverlap(
      this.scopeOf({
        employeeId: existing.employeeId ?? undefined,
        departmentId: existing.departmentId ?? undefined,
        branchId: existing.branchId ?? undefined,
      }),
      from,
      to,
      id,
    );

    const row = await this.prisma.overtimePolicyAssignment.update({
      where: { id },
      data: {
        ...(dto.effectiveFrom !== undefined ? { effectiveFrom: from } : {}),
        ...(dto.effectiveTo !== undefined ? { effectiveTo: to } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() ?? null } : {}),
      },
      include: overtimeAssignmentInclude,
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "overtime_policy.assignment_updated",
      entityType: "overtime_policy_assignment",
      entityId: id,
      metadata: { fields: Object.keys(dto) },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return toOvertimeAssignment(row);
  }

  /** Deactivation closes the effective range instead of deleting history. */
  async deactivate(id: string, actor: OvertimeActor): Promise<OvertimePolicyAssignment> {
    const existing = await this.prisma.overtimePolicyAssignment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: "OVERTIME_ASSIGNMENT_NOT_FOUND",
        message: "Overtime policy assignment not found",
      });
    }
    const today = dateKeyOf(new Date(), await this.attendance.getCompanyTimezone());
    const row = await this.prisma.overtimePolicyAssignment.update({
      where: { id },
      data: {
        effectiveTo: existing.effectiveTo ?? dateKey(addDaysToDateKey(today, -1)),
      },
      include: overtimeAssignmentInclude,
    });
    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "overtime_policy.assignment_deactivated",
      entityType: "overtime_policy_assignment",
      entityId: id,
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return toOvertimeAssignment(row);
  }

  private scopeOf(input: ScopeFilter): ScopeFilter {
    const scopes = [input.employeeId, input.departmentId, input.branchId].filter(Boolean);
    if (scopes.length !== 1) {
      throw new BadRequestException({
        code: "OVERTIME_ASSIGNMENT_SCOPE_REQUIRED",
        message: "Choose exactly one scope: employee, department, or branch",
      });
    }
    return {
      ...(input.employeeId ? { employeeId: input.employeeId } : {}),
      ...(input.departmentId ? { departmentId: input.departmentId } : {}),
      ...(input.branchId ? { branchId: input.branchId } : {}),
    };
  }

  private assertRange(from: Date, to: Date | null): void {
    if (to && to < from) {
      throw new BadRequestException({
        code: "INVALID_OVERTIME_ASSIGNMENT_RANGE",
        message: "effectiveTo must not be before effectiveFrom",
      });
    }
  }

  private assertWithinPolicy(
    policy: { effectiveFrom: Date; effectiveTo: Date | null },
    from: Date,
  ): void {
    if (from < policy.effectiveFrom) {
      throw new BadRequestException({
        code: "OVERTIME_ASSIGNMENT_BEFORE_POLICY",
        message: "The assignment cannot start before the policy effective date",
      });
    }
    if (policy.effectiveTo && from > policy.effectiveTo) {
      throw new BadRequestException({
        code: "OVERTIME_ASSIGNMENT_AFTER_POLICY",
        message: "The assignment starts after the policy effective end date",
      });
    }
  }

  private async assertScopeExists(scope: ScopeFilter): Promise<void> {
    if (scope.employeeId) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: scope.employeeId },
        select: { employmentStatus: true },
      });
      if (!employee) {
        throw new BadRequestException({
          code: "EMPLOYEE_NOT_FOUND",
          message: "The selected employee does not exist",
        });
      }
      if (employee.employmentStatus !== "ACTIVE" && employee.employmentStatus !== "PROBATION") {
        throw new BadRequestException({
          code: "EMPLOYEE_INACTIVE",
          message: "Overtime policies can only be assigned to active employees",
        });
      }
    }
    if (scope.departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: scope.departmentId },
        select: { id: true },
      });
      if (!department) {
        throw new BadRequestException({
          code: "DEPARTMENT_NOT_FOUND",
          message: "The selected department does not exist",
        });
      }
    }
    if (scope.branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: scope.branchId },
        select: { id: true },
      });
      if (!branch) {
        throw new BadRequestException({
          code: "BRANCH_NOT_FOUND",
          message: "The selected branch does not exist",
        });
      }
    }
  }

  private async assertNoOverlap(
    scope: ScopeFilter,
    from: Date,
    to: Date | null,
    excludeId?: string,
  ): Promise<void> {
    const overlap = await this.prisma.overtimePolicyAssignment.findFirst({
      where: {
        ...(excludeId ? { id: { not: excludeId } } : {}),
        ...scope,
        effectiveFrom: { lte: to ?? new Date("9999-12-31T00:00:00.000Z") },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
      },
      select: { id: true },
    });
    if (overlap) {
      throw new ConflictException({
        code: "OVERTIME_ASSIGNMENT_OVERLAP",
        message: "An active assignment already covers part of this date range for this scope",
      });
    }
  }
}
