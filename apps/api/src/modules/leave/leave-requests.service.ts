import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import {
  calculatePeriodTotals,
  createCredit,
  createDebit,
  todayKey,
} from "@peopleops/leave-engine";
import { PERMISSIONS } from "@peopleops/shared-types";
import type { LeaveDashboard, LeaveRequest, PaginatedResponse } from "@peopleops/shared-types";
import { toPageMeta } from "../../common/dto/page-query.dto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { EmployeesService } from "../employee/employees.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import type {
  CancelLeaveRequestDto,
  CreateLeaveRequestDto,
  LeavePreviewDto,
  ListLeaveRequestsQueryDto,
  ReviewLeaveRequestDto,
  UpdateLeaveRequestDto,
} from "./dto/leave.dto";
import { LeaveDurationService } from "./leave-duration.service";
import { LeaveEntitlementService } from "./leave-entitlement.service";
import { leaveRequestInclude, toLeaveRequest, type LeaveRequestRow } from "./leave.mapper";

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function isOverlapError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    String(error.message).includes("leave_requests_no_overlap")
  );
}

interface RequestScope {
  readAll: boolean;
  readTeam: boolean;
  employeeId: string | null;
  employeeIds: string[] | null;
}

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly employees: EmployeesService,
    private readonly entitlement: LeaveEntitlementService,
    private readonly duration: LeaveDurationService,
  ) {}

  async preview(dto: LeavePreviewDto, user: AuthenticatedUser) {
    const employee = await this.entitlement.getLinkedEmployee(user.id);
    return (await this.duration.preview(employee.id, dto)).preview;
  }

  async listMine(
    query: ListLeaveRequestsQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<LeaveRequest>> {
    const employee = await this.entitlement.getLinkedEmployee(user.id);
    return this.list({ ...query, employeeId: employee.id }, user);
  }

  async list(
    query: ListLeaveRequestsQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<LeaveRequest>> {
    const scope = await this.scope(user);
    if (!scope.readAll && !scope.readTeam && !scope.employeeId) {
      return { items: [], page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 };
    }
    if (query.employeeId && !scope.readAll && query.employeeId !== scope.employeeId) {
      if (!scope.readTeam || !(scope.employeeIds ?? []).includes(query.employeeId)) {
        throw new ForbiddenException({
          code: "LEAVE_OUT_OF_SCOPE",
          message: "You can only access leave requests inside your reporting line",
        });
      }
    }

    const where: Prisma.LeaveRequestWhereInput = {
      ...(scope.employeeIds ? { employeeId: { in: scope.employeeIds } } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.leaveTypeId ? { leaveTypeId: query.leaveTypeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            startDate: {
              ...(query.from ? { gte: dateOnly(query.from) } : {}),
              ...(query.to ? { lte: dateOnly(query.to) } : {}),
            },
          }
        : {}),
      ...(query.branchId || query.departmentId || query.search
        ? {
            employee: {
              ...(query.branchId ? { branchId: query.branchId } : {}),
              ...(query.departmentId ? { departmentId: query.departmentId } : {}),
              ...(query.search
                ? {
                    OR: [
                      { employeeNumber: { contains: query.search, mode: "insensitive" } },
                      { firstName: { contains: query.search, mode: "insensitive" } },
                      { lastName: { contains: query.search, mode: "insensitive" } },
                      { preferredName: { contains: query.search, mode: "insensitive" } },
                    ],
                  }
                : {}),
            },
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.leaveRequest.count({ where }),
      this.prisma.leaveRequest.findMany({
        where,
        include: leaveRequestInclude,
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toLeaveRequest), ...toPageMeta(query.page, query.pageSize, total) };
  }

  async getById(id: string, user: AuthenticatedUser): Promise<LeaveRequest> {
    const row = await this.findRow(id);
    await this.assertCanRead(row, user);
    return toLeaveRequest(row);
  }

  async create(dto: CreateLeaveRequestDto, user: AuthenticatedUser): Promise<LeaveRequest> {
    const employee = await this.entitlement.getLinkedEmployee(user.id);
    const calculated = await this.duration.preview(employee.id, dto);
    if (calculated.resolved.leaveType.status !== "ACTIVE") {
      throw new BadRequestException({
        code: "LEAVE_TYPE_INACTIVE",
        message: "This leave type is not active",
      });
    }
    if (dto.clientRequestId) {
      const duplicate = await this.prisma.leaveRequest.findUnique({
        where: {
          employeeId_clientRequestId: {
            employeeId: employee.id,
            clientRequestId: dto.clientRequestId,
          },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException({
          code: "LEAVE_REQUEST_DUPLICATE",
          message: "This leave request was already submitted",
        });
      }
    }
    try {
      const row = await this.prisma.leaveRequest.create({
        data: {
          employeeId: employee.id,
          leaveTypeId: dto.leaveTypeId,
          entitlementPeriodId: calculated.resolved.period.id,
          clientRequestId: dto.clientRequestId ?? null,
          startDate: dateOnly(dto.startDate),
          endDate: dateOnly(dto.endDate),
          duration: calculated.preview.duration,
          durationUnit: calculated.preview.durationUnit,
          requestMode: calculated.preview.requestMode,
          halfDayPeriod: calculated.preview.halfDayPeriod,
          reason: dto.reason.trim(),
          status: "DRAFT",
          days: {
            create: calculated.preview.days
              .filter((day) => day.isWorkingDay)
              .map((day) => ({
                date: dateOnly(day.date),
                duration: day.duration,
                halfDayPeriod: day.halfDayPeriod,
              })),
          },
        },
        include: leaveRequestInclude,
      });
      await this.audit.record({
        actorUserId: user.id,
        actorEmail: user.email,
        action: "leave_request.created",
        entityType: "leave_request",
        entityId: row.id,
        metadata: { employeeId: employee.id, leaveTypeId: dto.leaveTypeId },
      });
      return toLeaveRequest(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "LEAVE_REQUEST_DUPLICATE",
          message: "This leave request was already submitted",
        });
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateLeaveRequestDto,
    user: AuthenticatedUser,
  ): Promise<LeaveRequest> {
    const existing = await this.findRow(id);
    const employee = await this.entitlement.getLinkedEmployee(user.id);
    if (existing.employeeId !== employee.id) {
      throw new ForbiddenException({
        code: "LEAVE_REQUEST_NOT_OWNED",
        message: "You can only edit your own leave requests",
      });
    }
    if (existing.status !== "DRAFT") {
      throw new ConflictException({
        code: "LEAVE_REQUEST_NOT_DRAFT",
        message: "Only draft leave requests can be edited",
      });
    }
    const previewDto: LeavePreviewDto = {
      leaveTypeId: dto.leaveTypeId ?? existing.leaveTypeId,
      startDate: dto.startDate ?? existing.startDate.toISOString().slice(0, 10),
      endDate: dto.endDate ?? existing.endDate.toISOString().slice(0, 10),
      requestMode: dto.requestMode ?? existing.requestMode,
      halfDayPeriod:
        dto.halfDayPeriod === undefined
          ? (existing.halfDayPeriod ?? undefined)
          : (dto.halfDayPeriod ?? undefined),
    };
    const calculated = await this.duration.preview(employee.id, previewDto);
    if (calculated.resolved.leaveType.status !== "ACTIVE") {
      throw new BadRequestException({
        code: "LEAVE_TYPE_INACTIVE",
        message: "This leave type is not active",
      });
    }
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.leaveRequestDay.deleteMany({ where: { requestId: id } });
      return tx.leaveRequest.update({
        where: { id },
        data: {
          leaveTypeId: previewDto.leaveTypeId,
          entitlementPeriodId: calculated.resolved.period.id,
          startDate: dateOnly(previewDto.startDate),
          endDate: dateOnly(previewDto.endDate),
          duration: calculated.preview.duration,
          durationUnit: calculated.preview.durationUnit,
          requestMode: calculated.preview.requestMode,
          halfDayPeriod: calculated.preview.halfDayPeriod,
          ...(dto.reason !== undefined ? { reason: dto.reason.trim() } : {}),
          days: {
            create: calculated.preview.days
              .filter((day) => day.isWorkingDay)
              .map((day) => ({
                date: dateOnly(day.date),
                duration: day.duration,
                halfDayPeriod: day.halfDayPeriod,
              })),
          },
        },
        include: leaveRequestInclude,
      });
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "leave_request.updated",
      entityType: "leave_request",
      entityId: id,
      metadata: { fields: Object.keys(dto) },
    });
    return toLeaveRequest(row);
  }

  async submit(id: string, user: AuthenticatedUser): Promise<LeaveRequest> {
    const existing = await this.findRow(id);
    const employee = await this.entitlement.getLinkedEmployee(user.id);
    if (existing.employeeId !== employee.id) {
      throw new ForbiddenException({
        code: "LEAVE_REQUEST_NOT_OWNED",
        message: "You can only submit your own leave requests",
      });
    }
    if (existing.status !== "DRAFT") {
      throw new ConflictException({
        code: "LEAVE_REQUEST_NOT_DRAFT",
        message: "Only draft leave requests can be submitted",
      });
    }
    if (existing.leaveType.requiresAttachment && existing.attachments.length === 0) {
      throw new BadRequestException({
        code: "LEAVE_ATTACHMENT_REQUIRED",
        message: "This leave type requires a supporting document",
      });
    }

    const calculated = await this.duration.preview(employee.id, {
      leaveTypeId: existing.leaveTypeId,
      startDate: existing.startDate.toISOString().slice(0, 10),
      endDate: existing.endDate.toISOString().slice(0, 10),
      requestMode: existing.requestMode,
      halfDayPeriod: existing.halfDayPeriod ?? undefined,
    });
    if (existing.leaveType.requiresBalance && calculated.preview.duration > 0) {
      const totals = await calculatePeriodTotals(this.prisma, existing.entitlementPeriodId);
      if (
        !calculated.resolved.policy.allowNegativeBalance &&
        totals.available < calculated.preview.duration
      ) {
        throw new ConflictException({
          code: "INSUFFICIENT_LEAVE_BALANCE",
          message: "Your available leave balance is not sufficient",
          details: { available: totals.available, requested: calculated.preview.duration },
        });
      }
    }

    const employeeRow = await this.prisma.employee.findUnique({
      where: { id: employee.id },
      select: { managerId: true, firstName: true, lastName: true, preferredName: true },
    });
    if (!employeeRow) {
      throw new NotFoundException({ code: "EMPLOYEE_NOT_FOUND", message: "Employee not found" });
    }
    const requiresApproval = existing.leaveType.requiresApproval;
    const approvalMode = calculated.resolved.policy.approvalMode;
    const stage = !requiresApproval
      ? null
      : approvalMode === "HR"
        ? "HR"
        : employeeRow.managerId && employeeRow.managerId !== employee.id
          ? "MANAGER"
          : "HR";
    if (
      requiresApproval &&
      approvalMode === "MANAGER_AND_HR" &&
      stage === "HR" &&
      !employeeRow.managerId
    ) {
      // No manager: HR is the first and only practical stage.
    }

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        await this.entitlement.lockBalance(tx, employee.id, existing.leaveTypeId);
        const overlap = await tx.leaveRequest.findFirst({
          where: {
            employeeId: employee.id,
            id: { not: id },
            status: { in: ["PENDING", "APPROVED"] },
            startDate: { lte: existing.endDate },
            endDate: { gte: existing.startDate },
          },
          select: { id: true },
        });
        if (overlap) {
          throw new ConflictException({
            code: "LEAVE_REQUEST_OVERLAP",
            message: "Another active leave request already covers this date range",
          });
        }
        if (existing.leaveType.requiresBalance) {
          const totals = await calculatePeriodTotals(tx, existing.entitlementPeriodId);
          if (
            !calculated.resolved.policy.allowNegativeBalance &&
            totals.available < calculated.preview.duration
          ) {
            throw new ConflictException({
              code: "INSUFFICIENT_LEAVE_BALANCE",
              message: "Your available leave balance is not sufficient",
              details: { available: totals.available, requested: calculated.preview.duration },
            });
          }
          await tx.leaveBalanceReservation.create({
            data: {
              requestId: id,
              employeeId: employee.id,
              leaveTypeId: existing.leaveTypeId,
              entitlementPeriodId: existing.entitlementPeriodId,
              amount: calculated.preview.duration,
            },
          });
        }

        if (!requiresApproval) {
          await this.finalizeApproved(tx, existing, user, null, "Automatically approved by policy");
          return tx.leaveRequest.findUniqueOrThrow({ where: { id }, include: leaveRequestInclude });
        }

        const updated = await tx.leaveRequest.updateMany({
          where: { id, status: "DRAFT" },
          data: {
            status: "PENDING",
            approvalStage: stage,
            submittedAt: new Date(),
            duration: calculated.preview.duration,
            entitlementPeriodId: calculated.resolved.period.id,
          },
        });
        if (updated.count === 0) {
          throw new ConflictException({
            code: "LEAVE_REQUEST_ALREADY_SUBMITTED",
            message: "The leave request is no longer pending",
          });
        }
        return tx.leaveRequest.findUniqueOrThrow({ where: { id }, include: leaveRequestInclude });
      });
      await this.audit.record({
        actorUserId: user.id,
        actorEmail: user.email,
        action: "leave_request.submitted",
        entityType: "leave_request",
        entityId: id,
        metadata: { stage, autoApproved: !requiresApproval },
      });
      return toLeaveRequest(row);
    } catch (error) {
      if (isOverlapError(error)) {
        throw new ConflictException({
          code: "LEAVE_REQUEST_OVERLAP",
          message: "Another active leave request already covers this date range",
        });
      }
      throw error;
    }
  }

  async approve(
    id: string,
    dto: ReviewLeaveRequestDto,
    user: AuthenticatedUser,
  ): Promise<LeaveRequest> {
    const row = await this.findRow(id);
    await this.assertCanReview(row, user, dto.override ?? false);
    if (row.status !== "PENDING" || !row.approvalStage) {
      throw new ConflictException({
        code: "LEAVE_REQUEST_NOT_PENDING",
        message: "Only pending leave requests can be approved",
      });
    }

    const stage = row.approvalStage;
    const mode = row.entitlementPeriod.policy.approvalMode;
    const rowAfter = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.leaveRequest.updateMany({
        where: { id, status: "PENDING", approvalStage: stage },
        data: { updatedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new ConflictException({
          code: "LEAVE_REQUEST_ALREADY_REVIEWED",
          message: "Another reviewer already processed this request",
        });
      }
      await tx.leaveRequestApproval.create({
        data: {
          requestId: id,
          stage,
          decision: "APPROVED",
          actorUserId: user.id,
          actorName: user.name,
          comment: dto.comment?.trim() ?? null,
          isOverride: dto.override ?? false,
        },
      });

      if (stage === "MANAGER" && mode === "MANAGER_AND_HR") {
        await tx.leaveRequest.update({
          where: { id },
          data: {
            approvalStage: "HR",
            reviewedById: user.id,
            reviewedAt: new Date(),
            reviewComments: dto.comment?.trim() ?? null,
          },
        });
        return tx.leaveRequest.findUniqueOrThrow({ where: { id }, include: leaveRequestInclude });
      }

      await this.finalizeApproved(tx, row, user, dto.comment ?? null);
      return tx.leaveRequest.findUniqueOrThrow({ where: { id }, include: leaveRequestInclude });
    });

    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "leave_request.approved",
      entityType: "leave_request",
      entityId: id,
      metadata: { stage, override: dto.override ?? false, final: rowAfter.status === "APPROVED" },
    });
    return toLeaveRequest(rowAfter);
  }

  async reject(
    id: string,
    dto: ReviewLeaveRequestDto,
    user: AuthenticatedUser,
  ): Promise<LeaveRequest> {
    const row = await this.findRow(id);
    await this.assertCanReview(row, user, dto.override ?? false);
    if (row.status !== "PENDING" || !row.approvalStage) {
      throw new ConflictException({
        code: "LEAVE_REQUEST_NOT_PENDING",
        message: "Only pending leave requests can be rejected",
      });
    }
    const stage = row.approvalStage;
    const rowAfter = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.leaveRequest.updateMany({
        where: { id, status: "PENDING", approvalStage: stage },
        data: {
          status: "REJECTED",
          approvalStage: null,
          reviewedById: user.id,
          reviewedAt: new Date(),
          reviewComments: dto.comment?.trim() ?? null,
        },
      });
      if (claimed.count === 0) {
        throw new ConflictException({
          code: "LEAVE_REQUEST_ALREADY_REVIEWED",
          message: "Another reviewer already processed this request",
        });
      }
      await tx.leaveRequestApproval.create({
        data: {
          requestId: id,
          stage,
          decision: "REJECTED",
          actorUserId: user.id,
          actorName: user.name,
          comment: dto.comment?.trim() ?? null,
          isOverride: dto.override ?? false,
        },
      });
      await tx.leaveBalanceReservation.updateMany({
        where: { requestId: id, status: "PENDING" },
        data: { status: "RELEASED", releasedAt: new Date() },
      });
      return tx.leaveRequest.findUniqueOrThrow({ where: { id }, include: leaveRequestInclude });
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "leave_request.rejected",
      entityType: "leave_request",
      entityId: id,
      metadata: { stage, override: dto.override ?? false },
    });
    return toLeaveRequest(rowAfter);
  }

  async withdraw(id: string, user: AuthenticatedUser): Promise<LeaveRequest> {
    const row = await this.findRow(id);
    const employee = await this.entitlement.getLinkedEmployee(user.id);
    if (row.employeeId !== employee.id) {
      throw new ForbiddenException({
        code: "LEAVE_REQUEST_NOT_OWNED",
        message: "You can only withdraw your own leave requests",
      });
    }
    if (row.status !== "PENDING") {
      throw new ConflictException({
        code: "LEAVE_REQUEST_NOT_PENDING",
        message: "Only pending leave requests can be withdrawn",
      });
    }
    const rowAfter = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "WITHDRAWN", approvalStage: null, withdrawnAt: new Date() },
      });
      if (updated.count === 0) {
        throw new ConflictException({
          code: "LEAVE_REQUEST_ALREADY_PROCESSED",
          message: "The leave request was already processed",
        });
      }
      await tx.leaveBalanceReservation.updateMany({
        where: { requestId: id, status: "PENDING" },
        data: { status: "RELEASED", releasedAt: new Date() },
      });
      return tx.leaveRequest.findUniqueOrThrow({ where: { id }, include: leaveRequestInclude });
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "leave_request.withdrawn",
      entityType: "leave_request",
      entityId: id,
    });
    return toLeaveRequest(rowAfter);
  }

  async cancel(
    id: string,
    dto: CancelLeaveRequestDto,
    user: AuthenticatedUser,
  ): Promise<LeaveRequest> {
    const row = await this.findRow(id);
    const employee = await this.entitlement.getLinkedEmployee(user.id);
    const permissions = new Set(user.permissions);
    const isOwner = row.employeeId === employee.id;
    const isHr = permissions.has(PERMISSIONS.LEAVE_REQUEST_READ_ALL);
    if (!isOwner && !isHr) {
      throw new ForbiddenException({
        code: "LEAVE_REQUEST_CANCEL_FORBIDDEN",
        message: "You cannot cancel this leave request",
      });
    }
    if (row.status !== "APPROVED") {
      throw new ConflictException({
        code: "LEAVE_REQUEST_NOT_APPROVED",
        message: "Only approved leave requests can be cancelled",
      });
    }
    if (!isHr) {
      const cutoff = row.entitlementPeriod.policy.cancellationCutoffDays;
      const start = row.startDate.getTime();
      const latest = start - cutoff * 86_400_000;
      if (Date.now() > latest) {
        throw new BadRequestException({
          code: "LEAVE_CANCELLATION_CUTOFF",
          message: `Cancellation must be requested at least ${cutoff} day(s) before the leave starts`,
        });
      }
    }

    const rowAfter = await this.prisma.$transaction(async (tx) => {
      if (row.leaveType.requiresBalance) {
        await createCredit(tx, {
          employeeId: row.employeeId,
          leaveTypeId: row.leaveTypeId,
          entitlementPeriodId: row.entitlementPeriodId,
          type: "LEAVE_REVERSAL",
          amount: Number(row.duration),
          transactionDate: todayKey(),
          sourceType: "LEAVE_REVERSAL",
          sourceRef: `request:${row.id}:reversal`,
          description: `Cancellation: ${dto.reason.trim()}`,
          createdById: user.id,
        });
      }
      const updated = await tx.leaveRequest.updateMany({
        where: { id, status: "APPROVED" },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledById: user.id,
          cancellationReason: dto.reason.trim(),
        },
      });
      if (updated.count === 0) {
        throw new ConflictException({
          code: "LEAVE_REQUEST_ALREADY_PROCESSED",
          message: "The leave request was already processed",
        });
      }
      return tx.leaveRequest.findUniqueOrThrow({ where: { id }, include: leaveRequestInclude });
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "leave_request.cancelled",
      entityType: "leave_request",
      entityId: id,
      metadata: { reason: dto.reason, byHr: isHr },
    });
    return toLeaveRequest(rowAfter);
  }

  async dashboard(user: AuthenticatedUser): Promise<LeaveDashboard> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId: user.id },
      select: { id: true, managerId: true },
    });
    if (!employee) {
      throw new NotFoundException({
        code: "EMPLOYEE_NOT_LINKED",
        message: "No employee record is linked to your account",
      });
    }
    const today = todayKey();
    const monthStart = `${today.slice(0, 7)}-01`;
    const monthEnd = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0))
      .toISOString()
      .slice(0, 10);

    const [balances, pendingRequests, approvedThisMonth, upcoming, inboxCount] = await Promise.all([
      this.entitlement.myBalances(user),
      this.prisma.leaveRequest.count({
        where: { employeeId: employee.id, status: "PENDING" },
      }),
      this.prisma.leaveRequest.count({
        where: {
          employeeId: employee.id,
          status: "APPROVED",
          startDate: { gte: dateOnly(monthStart), lte: dateOnly(monthEnd) },
        },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          employeeId: employee.id,
          status: { in: ["PENDING", "APPROVED"] },
          startDate: { gte: dateOnly(today) },
        },
        include: leaveRequestInclude,
        orderBy: { startDate: "asc" },
        take: 5,
      }),
      new Set(user.permissions).has(PERMISSIONS.LEAVE_REQUEST_READ_ALL)
        ? this.prisma.leaveRequest.count({ where: { status: "PENDING" } })
        : employee.managerId
          ? this.prisma.leaveRequest.count({
              where: { status: "PENDING", employee: { managerId: employee.id } },
            })
          : 0,
    ]);
    return {
      date: today,
      balances,
      pendingRequests,
      approvedThisMonth,
      upcoming: upcoming.map(toLeaveRequest),
      inboxCount,
    };
  }

  private async findRow(id: string): Promise<LeaveRequestRow> {
    const row = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: leaveRequestInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: "LEAVE_REQUEST_NOT_FOUND",
        message: "Leave request not found",
      });
    }
    return row;
  }

  private async scope(user: AuthenticatedUser): Promise<RequestScope> {
    const permissions = new Set(user.permissions);
    const readAll = permissions.has(PERMISSIONS.LEAVE_REQUEST_READ_ALL);
    const readTeam = permissions.has(PERMISSIONS.LEAVE_REQUEST_READ_TEAM);
    const employee = await this.prisma.employee.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    let employeeIds: string[] | null = null;
    if (!readAll && readTeam) {
      const employeeScope = await this.employees.resolveScope(user);
      employeeIds = await this.employees.scopedEmployeeIds(employeeScope);
    }
    return {
      readAll,
      readTeam,
      employeeId: employee?.id ?? null,
      employeeIds: readAll ? null : (employeeIds ?? (employee ? [employee.id] : [])),
    };
  }

  private async assertCanRead(row: LeaveRequestRow, user: AuthenticatedUser): Promise<void> {
    const scope = await this.scope(user);
    if (scope.readAll) return;
    if (row.employeeId === scope.employeeId) return;
    if (scope.readTeam && (scope.employeeIds ?? []).includes(row.employeeId)) return;
    throw new ForbiddenException({
      code: "LEAVE_OUT_OF_SCOPE",
      message: "You can only access leave requests inside your reporting line",
    });
  }

  private async assertCanReview(
    row: LeaveRequestRow,
    user: AuthenticatedUser,
    override: boolean,
  ): Promise<void> {
    const permissions = new Set(user.permissions);
    if (!permissions.has(PERMISSIONS.LEAVE_REQUEST_APPROVE)) {
      throw new ForbiddenException({
        code: "LEAVE_APPROVE_FORBIDDEN",
        message: "You do not have permission to approve leave requests",
      });
    }
    const reviewer = await this.prisma.employee.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (reviewer?.id === row.employeeId) {
      throw new ForbiddenException({
        code: "LEAVE_SELF_APPROVAL",
        message: "You cannot review your own leave request",
      });
    }
    if (override) {
      if (!permissions.has(PERMISSIONS.LEAVE_REQUEST_OVERRIDE)) {
        throw new ForbiddenException({
          code: "LEAVE_OVERRIDE_FORBIDDEN",
          message: "You do not have permission to override the approval stage",
        });
      }
      if (row.approvalStage === "HR" || permissions.has(PERMISSIONS.LEAVE_REQUEST_READ_ALL)) {
        return;
      }
      throw new ForbiddenException({
        code: "LEAVE_OVERRIDE_FORBIDDEN",
        message: "Only HR can override a manager approval stage",
      });
    }
    if (row.approvalStage === "MANAGER") {
      if (!reviewer || row.employee.managerId !== reviewer.id) {
        throw new ForbiddenException({
          code: "LEAVE_NOT_YOUR_REPORT",
          message: "Only the direct manager can review this request",
        });
      }
      return;
    }
    if (row.approvalStage === "HR") {
      if (!permissions.has(PERMISSIONS.LEAVE_REQUEST_READ_ALL)) {
        throw new ForbiddenException({
          code: "LEAVE_HR_REVIEW_FORBIDDEN",
          message: "Only HR can review this request at the HR stage",
        });
      }
      return;
    }
    throw new ConflictException({
      code: "LEAVE_REQUEST_NOT_PENDING",
      message: "This request has no active approval stage",
    });
  }

  private async finalizeApproved(
    tx: Prisma.TransactionClient,
    row: LeaveRequestRow,
    user: AuthenticatedUser,
    comment: string | null,
    fallbackComment?: string,
  ): Promise<void> {
    if (row.leaveType.requiresBalance) {
      const reservation = await tx.leaveBalanceReservation.findUnique({
        where: { requestId: row.id },
      });
      const amount = reservation ? Number(reservation.amount) : Number(row.duration);
      await createDebit(tx, {
        employeeId: row.employeeId,
        leaveTypeId: row.leaveTypeId,
        entitlementPeriodId: row.entitlementPeriodId,
        type: "LEAVE_DEDUCTION",
        amount,
        transactionDate: row.startDate.toISOString().slice(0, 10),
        sourceType: "LEAVE_REQUEST",
        sourceRef: row.id,
        description: `Approved leave ${row.startDate.toISOString().slice(0, 10)} to ${row.endDate
          .toISOString()
          .slice(0, 10)}`,
        createdById: user.id,
      });
      if (reservation) {
        await tx.leaveBalanceReservation.update({
          where: { requestId: row.id },
          data: { status: "CONSUMED" },
        });
      }
    }
    await tx.leaveRequest.update({
      where: { id: row.id },
      data: {
        status: "APPROVED",
        approvalStage: null,
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewComments: comment?.trim() || fallbackComment || null,
      },
    });
  }
}
