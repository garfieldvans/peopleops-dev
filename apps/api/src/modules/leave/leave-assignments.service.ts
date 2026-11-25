import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import { ensureEntitlementPeriod, todayKey } from "@peopleops/leave-engine";
import type { LeavePolicyAssignment, PaginatedResponse } from "@peopleops/shared-types";
import { toPageMeta } from "../../common/dto/page-query.dto";
import { PrismaService } from "../../prisma/prisma.service";
import { AttendanceService } from "../attendance/attendance.service";
import { AuditService } from "../audit/audit.service";
import type {
  CreateLeavePolicyAssignmentDto,
  ListLeaveAssignmentsQueryDto,
  UpdateLeavePolicyAssignmentDto,
} from "./dto/leave.dto";
import { leaveAssignmentInclude, toLeaveAssignment } from "./leave.mapper";
import type { LeaveActor } from "./leave.types";

function dateKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function addMonths(date: Date, months: number): Date {
  const value = new Date(date.getTime());
  value.setUTCMonth(value.getUTCMonth() + months);
  return value;
}

function isOverlapError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    String(error.message).includes("leave_policy_assignments_no_overlap")
  );
}

@Injectable()
export class LeaveAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly attendance: AttendanceService,
  ) {}

  async list(
    query: ListLeaveAssignmentsQueryDto,
  ): Promise<PaginatedResponse<LeavePolicyAssignment>> {
    const where: Prisma.LeavePolicyAssignmentWhereInput = {
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.policyId ? { policyId: query.policyId } : {}),
      ...(query.leaveTypeId ? { leaveTypeId: query.leaveTypeId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.leavePolicyAssignment.count({ where }),
      this.prisma.leavePolicyAssignment.findMany({
        where,
        include: leaveAssignmentInclude,
        orderBy: [{ status: "asc" }, { effectiveFrom: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toLeaveAssignment), ...toPageMeta(query.page, query.pageSize, total) };
  }

  async create(
    dto: CreateLeavePolicyAssignmentDto,
    actor: LeaveActor,
  ): Promise<{ assigned: number; employeeIds: string[] }> {
    const policy = await this.prisma.leavePolicy.findUnique({
      where: { id: dto.policyId },
    });
    if (!policy) {
      throw new BadRequestException({
        code: "LEAVE_POLICY_NOT_FOUND",
        message: "The selected leave policy does not exist",
      });
    }
    if (policy.status !== "ACTIVE") {
      throw new BadRequestException({
        code: "LEAVE_POLICY_INACTIVE",
        message: "Only active leave policies can be assigned",
      });
    }
    if (dto.effectiveFrom < policy.effectiveFrom.toISOString().slice(0, 10)) {
      throw new BadRequestException({
        code: "ASSIGNMENT_BEFORE_POLICY",
        message: "The assignment cannot start before the policy effective date",
      });
    }
    if (policy.effectiveTo && dto.effectiveFrom > policy.effectiveTo.toISOString().slice(0, 10)) {
      throw new BadRequestException({
        code: "ASSIGNMENT_AFTER_POLICY",
        message: "The assignment starts after the policy effective end date",
      });
    }
    if (dto.effectiveTo && dto.effectiveTo < dto.effectiveFrom) {
      throw new BadRequestException({
        code: "INVALID_ASSIGNMENT_RANGE",
        message: "effectiveTo must not be before effectiveFrom",
      });
    }

    const employeeIds = [...new Set(dto.employeeIds)];
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, joinDate: true, employmentStatus: true },
    });
    if (employees.length !== employeeIds.length) {
      throw new BadRequestException({
        code: "EMPLOYEE_NOT_FOUND",
        message: "One or more employees do not exist",
      });
    }
    for (const employee of employees) {
      if (employee.employmentStatus !== "ACTIVE" && employee.employmentStatus !== "PROBATION") {
        throw new BadRequestException({
          code: "EMPLOYEE_INACTIVE",
          message: "Leave policies can only be assigned to active employees",
          details: { employeeId: employee.id },
        });
      }
      const eligibleAt = addMonths(employee.joinDate, policy.eligibilityMonths);
      if (eligibleAt.toISOString().slice(0, 10) > dto.effectiveFrom) {
        throw new BadRequestException({
          code: "EMPLOYEE_NOT_ELIGIBLE",
          message: "The employee has not completed the policy eligibility period",
          details: { employeeId: employee.id },
        });
      }
    }

    const from = dateKey(dto.effectiveFrom);
    const to = dto.effectiveTo ? dateKey(dto.effectiveTo) : null;
    const openEnd = new Date("9999-12-31T00:00:00.000Z");
    const effectiveToFilter = to ?? openEnd;

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const ids: string[] = [];
        for (const employeeId of employeeIds) {
          const overlap = await tx.leavePolicyAssignment.findFirst({
            where: {
              employeeId,
              leaveTypeId: policy.leaveTypeId,
              status: "ACTIVE",
              effectiveFrom: { lte: effectiveToFilter },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
            },
            select: { id: true },
          });
          if (overlap) {
            throw new ConflictException({
              code: "LEAVE_ASSIGNMENT_OVERLAP",
              message: "The employee already has an active assignment for this leave type",
              details: { employeeId },
            });
          }
          const assignment = await tx.leavePolicyAssignment.create({
            data: {
              employeeId,
              leaveTypeId: policy.leaveTypeId,
              policyId: policy.id,
              effectiveFrom: from,
              effectiveTo: to,
              notes: dto.notes?.trim() ?? null,
              createdById: actor.actorUserId,
            },
            select: { id: true },
          });
          ids.push(assignment.id);
        }
        return ids;
      });

      // Generate the current period immediately so the employee sees a balance
      // without waiting for the next worker run.
      const today = await this.companyToday();
      for (const assignmentId of created) {
        await ensureEntitlementPeriod(this.prisma, assignmentId, today);
      }

      await this.audit.record({
        actorUserId: actor.actorUserId,
        actorEmail: actor.actorEmail,
        action: "leave_policy.assigned",
        entityType: "leave_policy",
        entityId: policy.id,
        metadata: { employeeIds, effectiveFrom: dto.effectiveFrom },
        ip: actor.meta.ip,
        userAgent: actor.meta.userAgent,
      });
      return { assigned: created.length, employeeIds };
    } catch (error) {
      if (isOverlapError(error)) {
        throw new ConflictException({
          code: "LEAVE_ASSIGNMENT_OVERLAP",
          message: "An active assignment already covers part of this date range",
        });
      }
      throw error;
    }
  }

  private async companyToday(): Promise<string> {
    return todayKey(await this.attendance.getCompanyTimezone());
  }

  async update(
    id: string,
    dto: UpdateLeavePolicyAssignmentDto,
    actor: LeaveActor,
  ): Promise<LeavePolicyAssignment> {
    const existing = await this.prisma.leavePolicyAssignment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: "LEAVE_ASSIGNMENT_NOT_FOUND",
        message: "Leave policy assignment not found",
      });
    }
    const from = dto.effectiveFrom ?? existing.effectiveFrom.toISOString().slice(0, 10);
    const to =
      dto.effectiveTo === undefined
        ? (existing.effectiveTo?.toISOString().slice(0, 10) ?? null)
        : dto.effectiveTo;
    if (to && to < from) {
      throw new BadRequestException({
        code: "INVALID_ASSIGNMENT_RANGE",
        message: "effectiveTo must not be before effectiveFrom",
      });
    }
    if (
      dto.status !== "INACTIVE" &&
      (dto.effectiveFrom !== undefined || dto.effectiveTo !== undefined)
    ) {
      const overlap = await this.prisma.leavePolicyAssignment.findFirst({
        where: {
          id: { not: id },
          employeeId: existing.employeeId,
          leaveTypeId: existing.leaveTypeId,
          status: "ACTIVE",
          effectiveFrom: { lte: dateKey(to ?? "9999-12-31") },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: dateKey(from) } }],
        },
        select: { id: true },
      });
      if (overlap) {
        throw new ConflictException({
          code: "LEAVE_ASSIGNMENT_OVERLAP",
          message: "The new date range overlaps another active assignment",
        });
      }
    }
    const row = await this.prisma.leavePolicyAssignment.update({
      where: { id },
      data: {
        ...(dto.effectiveFrom !== undefined ? { effectiveFrom: dateKey(dto.effectiveFrom) } : {}),
        ...(dto.effectiveTo !== undefined
          ? { effectiveTo: dto.effectiveTo ? dateKey(dto.effectiveTo) : null }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() ?? null } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: leaveAssignmentInclude,
    });
    if (row.status === "ACTIVE") {
      await ensureEntitlementPeriod(this.prisma, row.id, await this.companyToday());
    }
    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "leave_policy.assignment_updated",
      entityType: "leave_policy_assignment",
      entityId: id,
      metadata: { fields: Object.keys(dto) },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return toLeaveAssignment(row);
  }
}
