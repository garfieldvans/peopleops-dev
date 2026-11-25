import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import {
  PERMISSIONS,
  type OvertimeDashboard,
  type OvertimePolicySnapshot,
  type OvertimeRequest,
  type OvertimeRequestListItem,
  type OvertimeStatus,
  type OvertimeSummary,
  type OvertimeSummaryRow,
  type PaginatedResponse,
} from "@peopleops/shared-types";
import { toPageMeta } from "../../common/dto/page-query.dto";
import { csvCell } from "../../common/export/csv-cell";
import { dateKeyOf, isoWeekday } from "../../common/time/zoned-time";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { AuditService } from "../audit/audit.service";
import { AttendanceService } from "../attendance/attendance.service";
import { EmployeesService, type EmployeeScope } from "../employee/employees.service";
import { LeaveIntegrationService } from "../leave/leave-integration.service";
import type {
  CancelOvertimeRequestDto,
  CompleteOvertimeRequestDto,
  CorrectOvertimeRequestDto,
  CreateOvertimeRequestDto,
  ListOvertimeRequestsQueryDto,
  OvertimeSummaryQueryDto,
  RejectOvertimeRequestDto,
  ReviewOvertimeRequestDto,
  UpdateOvertimeRequestDto,
  VerifyOvertimeRequestDto,
} from "./dto/overtime.dto";
import {
  calculateWindowMinutes,
  deriveActualWindow,
  deriveOvertimeCategory,
  roundOvertimeMinutes,
} from "./overtime-calculation";
import {
  displayName,
  overtimeRequestInclude,
  overtimeRequestListInclude,
  toOvertimeRequest,
  toOvertimeRequestListItem,
  type OvertimeRequestRow,
} from "./overtime.mapper";

interface OvertimeScope {
  readAll: boolean;
  readTeam: boolean;
  employeeId: string | null;
  employeeIds: string[] | null;
}

interface LinkedEmployee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  managerId: string | null;
  branchId: string | null;
  departmentId: string | null;
  employmentStatus: string;
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function emptyPage<T>(page: number, pageSize: number): PaginatedResponse<T> {
  return { items: [], page, pageSize, total: 0, totalPages: 0 };
}

@Injectable()
export class OvertimeRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly employees: EmployeesService,
    private readonly attendance: AttendanceService,
    private readonly leaveIntegration: LeaveIntegrationService,
  ) {}

  async list(
    query: ListOvertimeRequestsQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<OvertimeRequestListItem>> {
    const scope = await this.resolveScope(user);
    if (!scope.readAll && (!scope.employeeIds || scope.employeeIds.length === 0)) {
      return emptyPage(query.page, query.pageSize);
    }
    if (query.employeeId) {
      await this.assertEmployeeInScope(query.employeeId, scope);
    }

    const where: Prisma.OvertimeRequestWhereInput = {
      ...(scope.employeeIds ? { employeeId: { in: scope.employeeIds } } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.from || query.to
        ? {
            workDate: {
              ...(query.from ? { gte: dateOnly(query.from) } : {}),
              ...(query.to ? { lte: dateOnly(query.to) } : {}),
            },
          }
        : {}),
      ...(query.departmentId || query.branchId
        ? {
            employee: {
              ...(query.departmentId ? { departmentId: query.departmentId } : {}),
              ...(query.branchId ? { branchId: query.branchId } : {}),
            },
          }
        : {}),
      ...(query.statuses?.length
        ? { status: { in: query.statuses } }
        : query.status
          ? { status: query.status }
          : {}),
      ...(query.search
        ? {
            OR: [
              { reason: { contains: query.search, mode: "insensitive" } },
              {
                employee: {
                  OR: [
                    { employeeNumber: { contains: query.search, mode: "insensitive" } },
                    { firstName: { contains: query.search, mode: "insensitive" } },
                    { lastName: { contains: query.search, mode: "insensitive" } },
                    { preferredName: { contains: query.search, mode: "insensitive" } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const sortBy = query.sortBy ?? "workDate";
    const sortDir = query.sortDir ?? "desc";
    const orderBy: Prisma.OvertimeRequestOrderByWithRelationInput[] =
      sortBy === "createdAt"
        ? [{ createdAt: sortDir }]
        : sortBy === "status"
          ? [{ status: sortDir }, { workDate: "desc" }]
          : [{ workDate: sortDir }, { createdAt: "desc" }];

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.overtimeRequest.count({ where }),
      this.prisma.overtimeRequest.findMany({
        where,
        include: overtimeRequestListInclude,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: rows.map(toOvertimeRequestListItem),
      ...toPageMeta(query.page, query.pageSize, total),
    };
  }

  async listMine(
    query: ListOvertimeRequestsQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<OvertimeRequestListItem>> {
    const employee = await this.getLinkedEmployee(user.id);
    return this.list({ ...query, employeeId: employee.id }, user);
  }

  async getById(id: string, user: AuthenticatedUser): Promise<OvertimeRequest> {
    const row = await this.getRowForUser(id, user);
    return toOvertimeRequest(row);
  }

  async getRowForUser(id: string, user: AuthenticatedUser): Promise<OvertimeRequestRow> {
    const row = await this.findRow(id);
    await this.assertCanReadRow(row, user);
    return row;
  }

  async create(dto: CreateOvertimeRequestDto, user: AuthenticatedUser) {
    const employee = await this.getLinkedEmployee(user.id);
    this.assertEmployeeActive(employee);
    const startAt = this.parseInstant(dto.plannedStartAt, "plannedStartAt");
    const endAt = this.parseInstant(dto.plannedEndAt, "plannedEndAt");
    const breakMinutes = dto.plannedBreakMinutes ?? 0;
    const timezone = await this.attendance.getCompanyTimezone();
    this.assertWindow(startAt, endAt, breakMinutes, dto.workDate, timezone);

    const resolved = await this.resolvePolicy(employee, dto.workDate);
    const requestedMinutes = this.requestedMinutes(resolved.policy, startAt, endAt, breakMinutes);
    const attendanceRecord = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_workDate: { employeeId: employee.id, workDate: dateOnly(dto.workDate) } },
      select: { id: true },
    });
    await this.assertNoLeaveConflict(employee.id, dto.workDate);
    await this.assertNoOverlap(employee.id, startAt, endAt);

    if (dto.clientRequestId) {
      const duplicate = await this.prisma.overtimeRequest.findUnique({
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
          code: "OVERTIME_REQUEST_DUPLICATE",
          message: "This overtime request was already submitted",
        });
      }
    }

    let row: OvertimeRequestRow;
    try {
      row = await this.prisma.overtimeRequest.create({
        data: {
          employeeId: employee.id,
          policyId: resolved.policy.id,
          attendanceRecordId: attendanceRecord?.id ?? null,
          clientRequestId: dto.clientRequestId ?? null,
          workDate: dateOnly(dto.workDate),
          category: resolved.category,
          reason: dto.reason.trim(),
          plannedStartAt: startAt,
          plannedEndAt: endAt,
          plannedBreakMinutes: breakMinutes,
          requestedMinutes,
          status: "DRAFT",
          policySnapshot: this.snapshotOf(resolved.policy) as unknown as Prisma.InputJsonValue,
        },
        include: overtimeRequestInclude,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "OVERTIME_REQUEST_DUPLICATE",
          message: "This overtime request was already submitted",
        });
      }
      throw error;
    }

    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "overtime_request.created",
      entityType: "overtime_request",
      entityId: row.id,
      metadata: { employeeId: employee.id, workDate: dto.workDate },
    });
    return toOvertimeRequest(row);
  }

  async update(
    id: string,
    dto: UpdateOvertimeRequestDto,
    user: AuthenticatedUser,
  ): Promise<OvertimeRequest> {
    const existing = await this.findRow(id);
    const employee = await this.getLinkedEmployee(user.id);
    if (existing.employeeId !== employee.id) {
      throw new ForbiddenException({
        code: "OVERTIME_REQUEST_NOT_OWNED",
        message: "You can only edit your own overtime requests",
      });
    }
    if (existing.status !== "DRAFT") {
      throw new ConflictException({
        code: "OVERTIME_REQUEST_NOT_DRAFT",
        message: "Only draft overtime requests can be edited",
      });
    }

    const workDate = dto.workDate ?? isoDate(existing.workDate);
    const startAt = dto.plannedStartAt
      ? this.parseInstant(dto.plannedStartAt, "plannedStartAt")
      : existing.plannedStartAt;
    const endAt = dto.plannedEndAt
      ? this.parseInstant(dto.plannedEndAt, "plannedEndAt")
      : existing.plannedEndAt;
    const breakMinutes = dto.plannedBreakMinutes ?? existing.plannedBreakMinutes;
    const timezone = await this.attendance.getCompanyTimezone();
    this.assertWindow(startAt, endAt, breakMinutes, workDate, timezone);

    const resolved = await this.resolvePolicy(employee, workDate);
    const requestedMinutes = this.requestedMinutes(resolved.policy, startAt, endAt, breakMinutes);
    await this.assertNoLeaveConflict(employee.id, workDate);
    await this.assertNoOverlap(employee.id, startAt, endAt, id);

    const attendanceRecord = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_workDate: { employeeId: employee.id, workDate: dateOnly(workDate) } },
      select: { id: true },
    });
    const row = await this.prisma.overtimeRequest.update({
      where: { id },
      data: {
        policyId: resolved.policy.id,
        attendanceRecordId: attendanceRecord?.id ?? null,
        workDate: dateOnly(workDate),
        category: resolved.category,
        ...(dto.reason !== undefined ? { reason: dto.reason.trim() } : {}),
        plannedStartAt: startAt,
        plannedEndAt: endAt,
        plannedBreakMinutes: breakMinutes,
        requestedMinutes,
        policySnapshot: this.snapshotOf(resolved.policy) as unknown as Prisma.InputJsonValue,
      },
      include: overtimeRequestInclude,
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "overtime_request.updated",
      entityType: "overtime_request",
      entityId: id,
      metadata: { fields: Object.keys(dto) },
    });
    return toOvertimeRequest(row);
  }

  async submit(id: string, user: AuthenticatedUser): Promise<OvertimeRequest> {
    const existing = await this.findRow(id);
    const employee = await this.getLinkedEmployee(user.id);
    if (existing.employeeId !== employee.id) {
      throw new ForbiddenException({
        code: "OVERTIME_REQUEST_NOT_OWNED",
        message: "You can only submit your own overtime requests",
      });
    }
    if (existing.status !== "DRAFT") {
      throw new ConflictException({
        code: "OVERTIME_REQUEST_NOT_DRAFT",
        message: "Only draft overtime requests can be submitted",
      });
    }
    const resolved = await this.resolvePolicy(employee, isoDate(existing.workDate));
    if (resolved.policy.requiresAttachment && existing.attachments.length === 0) {
      throw new BadRequestException({
        code: "OVERTIME_ATTACHMENT_REQUIRED",
        message: "This overtime policy requires a supporting document",
      });
    }
    await this.assertNoLeaveConflict(employee.id, isoDate(existing.workDate));
    await this.assertNoOverlap(
      employee.id,
      existing.plannedStartAt,
      existing.plannedEndAt,
      existing.id,
    );

    const requestedMinutes = this.requestedMinutes(
      resolved.policy,
      existing.plannedStartAt,
      existing.plannedEndAt,
      existing.plannedBreakMinutes,
    );
    const stage = this.initialStage(resolved.policy, employee);
    const status: OvertimeStatus =
      stage === "MANAGER" ? "PENDING_MANAGER_APPROVAL" : "PENDING_HR_APPROVAL";

    const updated = await this.prisma.overtimeRequest.updateMany({
      where: { id, status: "DRAFT" },
      data: {
        policyId: resolved.policy.id,
        category: resolved.category,
        requestedMinutes,
        policySnapshot: this.snapshotOf(resolved.policy) as unknown as Prisma.InputJsonValue,
        status,
        approvalStage: stage,
        submittedAt: new Date(),
      },
    });
    if (updated.count === 0) {
      throw new ConflictException({
        code: "OVERTIME_REQUEST_ALREADY_SUBMITTED",
        message: "The overtime request is no longer a draft",
      });
    }
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "overtime_request.submitted",
      entityType: "overtime_request",
      entityId: id,
      metadata: { stage, requestedMinutes },
    });
    return toOvertimeRequest(await this.findRow(id));
  }

  async approve(
    id: string,
    dto: ReviewOvertimeRequestDto,
    user: AuthenticatedUser,
  ): Promise<OvertimeRequest> {
    const row = await this.findRow(id);
    await this.assertCanReview(row, user, dto.override ?? false);
    if (!this.isPending(row.status) || !row.approvalStage) {
      throw new ConflictException({
        code: "OVERTIME_REQUEST_NOT_PENDING",
        message: "Only pending overtime requests can be approved",
      });
    }
    const stage = row.approvalStage;
    const snapshot = row.policySnapshot as unknown as OvertimePolicySnapshot;
    const finalStage = !(
      stage === "MANAGER" &&
      snapshot.approvalMode === "MANAGER_AND_HR" &&
      !(dto.override ?? false)
    );

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.overtimeRequest.updateMany({
        where: { id, status: row.status, approvalStage: stage },
        data: { updatedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new ConflictException({
          code: "OVERTIME_REQUEST_ALREADY_REVIEWED",
          message: "Another reviewer already processed this request",
        });
      }
      await tx.overtimeApproval.create({
        data: {
          requestId: id,
          stage,
          decision: "APPROVED",
          approverUserId: user.id,
          approverName: user.name,
          comment: dto.comment?.trim() ?? null,
          isOverride: dto.override ?? false,
        },
      });
      await tx.overtimeRequest.update({
        where: { id },
        data: finalStage
          ? {
              status: "APPROVED",
              approvalStage: null,
              approvedMinutes: row.requestedMinutes,
            }
          : { status: "PENDING_HR_APPROVAL", approvalStage: "HR" },
      });
    });

    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "overtime_request.approved",
      entityType: "overtime_request",
      entityId: id,
      metadata: { stage, override: dto.override ?? false, final: finalStage },
    });
    return toOvertimeRequest(await this.findRow(id));
  }

  async reject(
    id: string,
    dto: RejectOvertimeRequestDto,
    user: AuthenticatedUser,
  ): Promise<OvertimeRequest> {
    const row = await this.findRow(id);
    await this.assertCanReview(row, user, dto.override ?? false);
    if (!this.isPending(row.status) || !row.approvalStage) {
      throw new ConflictException({
        code: "OVERTIME_REQUEST_NOT_PENDING",
        message: "Only pending overtime requests can be rejected",
      });
    }
    const stage = row.approvalStage;
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.overtimeRequest.updateMany({
        where: { id, status: row.status, approvalStage: stage },
        data: { status: "REJECTED", approvalStage: null },
      });
      if (claimed.count === 0) {
        throw new ConflictException({
          code: "OVERTIME_REQUEST_ALREADY_REVIEWED",
          message: "Another reviewer already processed this request",
        });
      }
      await tx.overtimeApproval.create({
        data: {
          requestId: id,
          stage,
          decision: "REJECTED",
          approverUserId: user.id,
          approverName: user.name,
          comment: dto.comment.trim(),
          isOverride: dto.override ?? false,
        },
      });
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "overtime_request.rejected",
      entityType: "overtime_request",
      entityId: id,
      metadata: { stage, override: dto.override ?? false },
    });
    return toOvertimeRequest(await this.findRow(id));
  }

  async withdraw(id: string, user: AuthenticatedUser): Promise<OvertimeRequest> {
    const row = await this.findRow(id);
    const employee = await this.getLinkedEmployee(user.id);
    if (row.employeeId !== employee.id) {
      throw new ForbiddenException({
        code: "OVERTIME_REQUEST_NOT_OWNED",
        message: "You can only withdraw your own overtime requests",
      });
    }
    if (!this.isPending(row.status)) {
      throw new ConflictException({
        code: "OVERTIME_REQUEST_NOT_PENDING",
        message: "Only pending overtime requests can be withdrawn",
      });
    }
    const updated = await this.prisma.overtimeRequest.updateMany({
      where: { id, status: row.status },
      data: { status: "WITHDRAWN", approvalStage: null },
    });
    if (updated.count === 0) {
      throw new ConflictException({
        code: "OVERTIME_REQUEST_ALREADY_PROCESSED",
        message: "The overtime request was already processed",
      });
    }
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "overtime_request.withdrawn",
      entityType: "overtime_request",
      entityId: id,
    });
    return toOvertimeRequest(await this.findRow(id));
  }

  async cancel(
    id: string,
    dto: CancelOvertimeRequestDto,
    user: AuthenticatedUser,
  ): Promise<OvertimeRequest> {
    const row = await this.findRow(id);
    const scope = await this.resolveScope(user);
    const isOwner = scope.employeeId === row.employeeId;
    const canManage = scope.readAll && this.has(user, PERMISSIONS.OVERTIME_MANAGE);
    if (!isOwner && !canManage) {
      throw new ForbiddenException({
        code: "OVERTIME_REQUEST_CANCEL_FORBIDDEN",
        message: "You cannot cancel this overtime request",
      });
    }
    if (!["APPROVED", "PENDING_VERIFICATION", "VERIFIED"].includes(row.status)) {
      throw new ConflictException({
        code: "OVERTIME_REQUEST_NOT_CANCELLABLE",
        message: "Only approved, pending verification, or verified requests can be cancelled",
      });
    }
    const updated = await this.prisma.overtimeRequest.updateMany({
      where: { id, status: row.status },
      data: {
        status: "CANCELLED",
        approvalStage: null,
        cancelledAt: new Date(),
        cancelledById: user.id,
        cancellationReason: dto.reason.trim(),
      },
    });
    if (updated.count === 0) {
      throw new ConflictException({
        code: "OVERTIME_REQUEST_ALREADY_PROCESSED",
        message: "The overtime request was already processed",
      });
    }
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "overtime_request.cancelled",
      entityType: "overtime_request",
      entityId: id,
      metadata: { reason: dto.reason, byHr: canManage },
    });
    return toOvertimeRequest(await this.findRow(id));
  }

  async complete(
    id: string,
    dto: CompleteOvertimeRequestDto,
    user: AuthenticatedUser,
  ): Promise<OvertimeRequest> {
    const row = await this.findRow(id);
    const scope = await this.resolveScope(user);
    const isOwner = scope.employeeId === row.employeeId;
    if (!isOwner && !(scope.readAll && this.has(user, PERMISSIONS.OVERTIME_MANAGE))) {
      throw new ForbiddenException({
        code: "OVERTIME_REQUEST_COMPLETE_FORBIDDEN",
        message: "You cannot record actual overtime for this request",
      });
    }
    if (!["APPROVED", "PENDING_VERIFICATION"].includes(row.status)) {
      throw new ConflictException({
        code: "OVERTIME_REQUEST_NOT_COMPLETABLE",
        message: "Only approved or pending-verification requests can be completed",
      });
    }
    const timezone = await this.attendance.getCompanyTimezone();
    if (isoDate(row.workDate) > dateKeyOf(new Date(), timezone)) {
      throw new BadRequestException({
        code: "OVERTIME_WORK_DATE_IN_FUTURE",
        message: "Actual overtime cannot be recorded before the work date",
      });
    }
    if (Boolean(dto.actualStartAt) !== Boolean(dto.actualEndAt)) {
      throw new BadRequestException({
        code: "OVERTIME_ACTUAL_WINDOW_INCOMPLETE",
        message: "Provide both actualStartAt and actualEndAt, or neither",
      });
    }

    let startAt: Date;
    let endAt: Date;
    let breakMinutes = dto.actualBreakMinutes ?? row.plannedBreakMinutes;
    if (dto.actualStartAt && dto.actualEndAt) {
      startAt = this.parseInstant(dto.actualStartAt, "actualStartAt");
      endAt = this.parseInstant(dto.actualEndAt, "actualEndAt");
    } else {
      const attendance = row.attendanceRecordId
        ? await this.prisma.attendanceRecord.findUnique({
            where: { id: row.attendanceRecordId },
            select: { scheduledEndAt: true, clockOutAt: true },
          })
        : await this.prisma.attendanceRecord.findUnique({
            where: {
              employeeId_workDate: {
                employeeId: row.employeeId,
                workDate: row.workDate,
              },
            },
            select: { scheduledEndAt: true, clockOutAt: true },
          });
      const derived = deriveActualWindow({
        plannedStartAt: row.plannedStartAt,
        plannedEndAt: row.plannedEndAt,
        plannedBreakMinutes: row.plannedBreakMinutes,
        attendance,
      });
      if (!derived) {
        throw new BadRequestException({
          code: "OVERTIME_ACTUAL_EVIDENCE_REQUIRED",
          message: "No attendance clock-out is available; enter the actual times",
        });
      }
      startAt = derived.startAt;
      endAt = derived.endAt;
      breakMinutes = dto.actualBreakMinutes ?? derived.breakMinutes;
    }
    if (endAt <= startAt) {
      throw new BadRequestException({
        code: "INVALID_OVERTIME_ACTUAL_WINDOW",
        message: "Actual end must be later than actual start",
      });
    }
    const actualMinutes = calculateWindowMinutes(startAt, endAt, breakMinutes);
    if (actualMinutes <= 0) {
      throw new BadRequestException({
        code: "OVERTIME_ACTUAL_TOO_SHORT",
        message: "Actual overtime must be longer than the break",
      });
    }

    const updated = await this.prisma.overtimeRequest.updateMany({
      where: { id, status: row.status },
      data: {
        actualStartAt: startAt,
        actualEndAt: endAt,
        actualBreakMinutes: breakMinutes,
        actualMinutes,
        status: "PENDING_VERIFICATION",
        completedAt: new Date(),
      },
    });
    if (updated.count === 0) {
      throw new ConflictException({
        code: "OVERTIME_REQUEST_ALREADY_PROCESSED",
        message: "The overtime request was already processed",
      });
    }
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "overtime_request.completed",
      entityType: "overtime_request",
      entityId: id,
      metadata: { actualMinutes },
    });
    return toOvertimeRequest(await this.findRow(id));
  }

  async verify(
    id: string,
    dto: VerifyOvertimeRequestDto,
    user: AuthenticatedUser,
  ): Promise<OvertimeRequest> {
    const row = await this.findRow(id);
    const scope = await this.resolveScope(user);
    if (!scope.readAll) {
      throw new ForbiddenException({
        code: "OVERTIME_VERIFY_FORBIDDEN",
        message: "Overtime verification requires organization-wide access",
      });
    }
    if (row.status !== "PENDING_VERIFICATION" || row.actualMinutes === null) {
      throw new ConflictException({
        code: "OVERTIME_REQUEST_NOT_VERIFIABLE",
        message: "Only completed requests can be verified",
      });
    }
    const snapshot = row.policySnapshot as unknown as OvertimePolicySnapshot;
    const verifiedMinutes =
      dto.verifiedMinutes ??
      roundOvertimeMinutes(row.actualMinutes, snapshot.roundingStrategy, snapshot.roundingMinutes);
    if (verifiedMinutes > row.actualMinutes) {
      throw new BadRequestException({
        code: "OVERTIME_VERIFIED_EXCEEDS_ACTUAL",
        message: "Verified minutes cannot exceed actual minutes",
      });
    }
    if (verifiedMinutes !== row.actualMinutes && !dto.reason?.trim()) {
      throw new BadRequestException({
        code: "OVERTIME_VERIFICATION_REASON_REQUIRED",
        message: "Explain why the verified duration differs from actual",
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.overtimeRequest.updateMany({
        where: { id, status: "PENDING_VERIFICATION" },
        data: {
          status: "VERIFIED",
          verifiedMinutes,
          verifiedAt: new Date(),
          verifiedById: user.id,
        },
      });
      if (claimed.count === 0) {
        throw new ConflictException({
          code: "OVERTIME_REQUEST_ALREADY_VERIFIED",
          message: "The overtime request was already verified",
        });
      }
      if (verifiedMinutes !== row.actualMinutes) {
        await tx.overtimeCorrection.create({
          data: {
            requestId: id,
            previousValue: row.actualMinutes!,
            correctedValue: verifiedMinutes,
            reason: dto.reason!.trim(),
            correctedById: user.id,
          },
        });
      }
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "overtime_request.verified",
      entityType: "overtime_request",
      entityId: id,
      metadata: { actualMinutes: row.actualMinutes, verifiedMinutes },
    });
    return toOvertimeRequest(await this.findRow(id));
  }

  async correct(
    id: string,
    dto: CorrectOvertimeRequestDto,
    user: AuthenticatedUser,
  ): Promise<OvertimeRequest> {
    const row = await this.findRow(id);
    const scope = await this.resolveScope(user);
    if (!scope.readAll) {
      throw new ForbiddenException({
        code: "OVERTIME_CORRECT_FORBIDDEN",
        message: "Overtime correction requires organization-wide access",
      });
    }
    if (row.status !== "VERIFIED" || row.verifiedMinutes === null) {
      throw new ConflictException({
        code: "OVERTIME_REQUEST_NOT_VERIFIED",
        message: "Only verified requests can be corrected",
      });
    }
    if (row.actualMinutes !== null && dto.correctedMinutes > row.actualMinutes) {
      throw new BadRequestException({
        code: "OVERTIME_CORRECTED_EXCEEDS_ACTUAL",
        message: "Corrected minutes cannot exceed actual minutes",
      });
    }
    const previous = row.verifiedMinutes;
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.overtimeRequest.updateMany({
        where: { id, status: "VERIFIED", verifiedMinutes: previous },
        data: { verifiedMinutes: dto.correctedMinutes },
      });
      if (claimed.count === 0) {
        throw new ConflictException({
          code: "OVERTIME_REQUEST_ALREADY_CORRECTED",
          message: "The verified minutes changed; reload and try again",
        });
      }
      await tx.overtimeCorrection.create({
        data: {
          requestId: id,
          previousValue: previous,
          correctedValue: dto.correctedMinutes,
          reason: dto.reason.trim(),
          correctedById: user.id,
        },
      });
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "overtime_request.corrected",
      entityType: "overtime_request",
      entityId: id,
      metadata: { previous, corrected: dto.correctedMinutes, reason: dto.reason },
    });
    return toOvertimeRequest(await this.findRow(id));
  }

  async dashboard(user: AuthenticatedUser): Promise<OvertimeDashboard> {
    const employee = await this.getLinkedEmployee(user.id);
    const scope = await this.resolveScope(user);
    const timezone = await this.attendance.getCompanyTimezone();
    const today = dateKeyOf(new Date(), timezone);
    const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00.000Z`);

    const pendingStatuses: OvertimeStatus[] = ["PENDING_MANAGER_APPROVAL", "PENDING_HR_APPROVAL"];
    const pendingApprovalWhere: Prisma.OvertimeRequestWhereInput = {
      status: { in: pendingStatuses },
      ...(scope.readAll ? {} : { employeeId: { in: scope.employeeIds ?? [] } }),
    };

    const [
      myPending,
      myApproved,
      myPendingVerification,
      myVerifiedThisMonth,
      verifiedSum,
      pendingApprovals,
      pendingVerification,
      recent,
    ] = await Promise.all([
      this.prisma.overtimeRequest.count({
        where: { employeeId: employee.id, status: { in: pendingStatuses } },
      }),
      this.prisma.overtimeRequest.count({
        where: { employeeId: employee.id, status: "APPROVED" },
      }),
      this.prisma.overtimeRequest.count({
        where: { employeeId: employee.id, status: "PENDING_VERIFICATION" },
      }),
      this.prisma.overtimeRequest.count({
        where: {
          employeeId: employee.id,
          status: "VERIFIED",
          verifiedAt: { gte: monthStart },
        },
      }),
      this.prisma.overtimeRequest.aggregate({
        where: {
          employeeId: employee.id,
          status: "VERIFIED",
          verifiedAt: { gte: monthStart },
        },
        _sum: { verifiedMinutes: true },
      }),
      this.prisma.overtimeRequest.count({ where: pendingApprovalWhere }),
      scope.readAll
        ? this.prisma.overtimeRequest.count({ where: { status: "PENDING_VERIFICATION" } })
        : Promise.resolve(0),
      this.prisma.overtimeRequest.findMany({
        where: { employeeId: employee.id },
        include: overtimeRequestListInclude,
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return {
      date: today,
      employee: {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        fullName: displayName(employee),
      },
      myPending,
      myApproved,
      myPendingVerification,
      myVerifiedThisMonth,
      verifiedMinutesThisMonth: verifiedSum._sum.verifiedMinutes ?? 0,
      pendingApprovals,
      pendingVerification,
      recent: recent.map(toOvertimeRequestListItem),
    };
  }

  async summary(query: OvertimeSummaryQueryDto, user: AuthenticatedUser): Promise<OvertimeSummary> {
    const scope = await this.resolveScope(user);
    if (!scope.readAll && (!scope.employeeIds || scope.employeeIds.length === 0)) {
      const timezone = await this.attendance.getCompanyTimezone();
      const today = dateKeyOf(new Date(), timezone);
      return {
        from: query.from ?? `${today.slice(0, 7)}-01`,
        to: query.to ?? today,
        requestCount: 0,
        pendingApprovals: 0,
        pendingVerification: 0,
        verifiedCount: 0,
        requestedMinutes: 0,
        actualMinutes: 0,
        verifiedMinutes: 0,
        rows: [],
      };
    }
    const timezone = await this.attendance.getCompanyTimezone();
    const today = dateKeyOf(new Date(), timezone);
    const from = query.from ?? `${today.slice(0, 7)}-01`;
    const to = query.to ?? today;
    const where: Prisma.OvertimeRequestWhereInput = {
      workDate: { gte: dateOnly(from), lte: dateOnly(to) },
      ...(scope.employeeIds ? { employeeId: { in: scope.employeeIds } } : {}),
    };
    const [byStatus, byEmployee, verifiedByEmployee] = await Promise.all([
      this.prisma.overtimeRequest.groupBy({
        by: ["status"],
        where,
        _count: { id: true },
        _sum: { requestedMinutes: true, actualMinutes: true, verifiedMinutes: true },
      }),
      this.prisma.overtimeRequest.groupBy({
        by: ["employeeId"],
        where,
        _count: { id: true },
        _sum: { requestedMinutes: true, actualMinutes: true },
      }),
      this.prisma.overtimeRequest.groupBy({
        by: ["employeeId"],
        where: { ...where, status: "VERIFIED" },
        _sum: { verifiedMinutes: true },
      }),
    ]);

    let requestCount = 0;
    let pendingApprovals = 0;
    let pendingVerification = 0;
    let verifiedCount = 0;
    let requestedMinutes = 0;
    let actualMinutes = 0;
    let verifiedMinutes = 0;

    for (const group of byStatus) {
      requestCount += group._count.id;
      requestedMinutes += group._sum.requestedMinutes ?? 0;
      actualMinutes += group._sum.actualMinutes ?? 0;
      if (group.status === "VERIFIED") {
        verifiedMinutes += group._sum.verifiedMinutes ?? 0;
        verifiedCount += group._count.id;
      }
      if (this.isPending(group.status)) pendingApprovals += group._count.id;
      if (group.status === "PENDING_VERIFICATION") pendingVerification += group._count.id;
    }

    const employeeIds = byEmployee.map((group) => group.employeeId);
    const employees =
      employeeIds.length > 0
        ? await this.prisma.employee.findMany({
            where: { id: { in: employeeIds } },
            select: {
              id: true,
              employeeNumber: true,
              firstName: true,
              lastName: true,
              preferredName: true,
              department: { select: { name: true } },
              branch: { select: { name: true } },
            },
          })
        : [];
    const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
    const verifiedMap = new Map(
      verifiedByEmployee.map((group) => [group.employeeId, group._sum.verifiedMinutes ?? 0]),
    );

    const rows: OvertimeSummaryRow[] = byEmployee.flatMap((group) => {
      const employee = employeeMap.get(group.employeeId);
      if (!employee) return [];
      return [
        {
          employeeId: group.employeeId,
          employeeNumber: employee.employeeNumber,
          employeeName: displayName(employee),
          department: employee.department?.name ?? null,
          branch: employee.branch?.name ?? null,
          requestCount: group._count.id,
          requestedMinutes: group._sum.requestedMinutes ?? 0,
          actualMinutes: group._sum.actualMinutes ?? 0,
          verifiedMinutes: verifiedMap.get(group.employeeId) ?? 0,
        },
      ];
    });

    return {
      from,
      to,
      requestCount,
      pendingApprovals,
      pendingVerification,
      verifiedCount,
      requestedMinutes,
      actualMinutes,
      verifiedMinutes,
      rows: rows.sort((a, b) => b.verifiedMinutes - a.verifiedMinutes),
    };
  }

  async exportCsv(query: OvertimeSummaryQueryDto, user: AuthenticatedUser): Promise<string> {
    const summary = await this.summary(query, user);
    const header = [
      "employee_number",
      "employee_name",
      "department",
      "branch",
      "requests",
      "requested_minutes",
      "actual_minutes",
      "verified_minutes",
    ];
    const lines = summary.rows.map((row) =>
      [
        row.employeeNumber,
        row.employeeName,
        row.department ?? "",
        row.branch ?? "",
        String(row.requestCount),
        String(row.requestedMinutes),
        String(row.actualMinutes),
        String(row.verifiedMinutes),
      ]
        .map(csvCell)
        .join(","),
    );
    return `\uFEFF${[header.join(","), ...lines].join("\r\n")}`;
  }

  async resolveScope(user: AuthenticatedUser): Promise<OvertimeScope> {
    const permissions = new Set(user.permissions);
    const readAll =
      permissions.has(PERMISSIONS.OVERTIME_READ_ALL) ||
      permissions.has(PERMISSIONS.OVERTIME_MANAGE) ||
      permissions.has(PERMISSIONS.OVERTIME_VERIFY) ||
      permissions.has(PERMISSIONS.OVERTIME_CORRECT);
    const readTeam = permissions.has(PERMISSIONS.OVERTIME_READ_TEAM);
    const linked = await this.prisma.employee.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    const employeeId = linked?.id ?? null;
    let employeeIds: string[] | null = null;
    if (!readAll) {
      if (readTeam && employeeId) {
        const scope: EmployeeScope = { readAll: false, readTeam: true, employeeId };
        employeeIds = await this.employees.scopedEmployeeIds(scope);
      } else {
        employeeIds = employeeId ? [employeeId] : [];
      }
    }
    return { readAll, readTeam, employeeId, employeeIds };
  }

  private async findRow(id: string): Promise<OvertimeRequestRow> {
    const row = await this.prisma.overtimeRequest.findUnique({
      where: { id },
      include: overtimeRequestInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: "OVERTIME_REQUEST_NOT_FOUND",
        message: "Overtime request not found",
      });
    }
    return row;
  }

  private async assertCanReadRow(row: OvertimeRequestRow, user: AuthenticatedUser): Promise<void> {
    const scope = await this.resolveScope(user);
    if (scope.readAll || scope.employeeId === row.employeeId) return;
    if (scope.employeeIds?.includes(row.employeeId)) return;
    throw new ForbiddenException({
      code: "OVERTIME_OUT_OF_SCOPE",
      message: "You can only access overtime requests inside your reporting line",
    });
  }

  private async assertCanReview(
    row: OvertimeRequestRow,
    user: AuthenticatedUser,
    override: boolean,
  ): Promise<void> {
    const permissions = new Set(user.permissions);
    const scope = await this.resolveScope(user);
    if (scope.employeeId === row.employeeId) {
      throw new ForbiddenException({
        code: "OVERTIME_SELF_REVIEW_FORBIDDEN",
        message: "You cannot review your own overtime request",
      });
    }
    if (override) {
      if (!scope.readAll || !permissions.has(PERMISSIONS.OVERTIME_MANAGE)) {
        throw new ForbiddenException({
          code: "OVERTIME_OVERRIDE_FORBIDDEN",
          message: "HR override requires organization-wide overtime management access",
        });
      }
      return;
    }
    if (row.approvalStage === "HR") {
      if (scope.readAll) return;
      throw new ForbiddenException({
        code: "OVERTIME_HR_REVIEW_REQUIRED",
        message: "This stage can only be reviewed by HR",
      });
    }
    if (row.approvalStage === "MANAGER") {
      const isManager =
        (scope.employeeId !== null && row.employee.managerId === scope.employeeId) ||
        (scope.employeeIds?.includes(row.employeeId) ?? false);
      if (isManager) return;
      if (scope.readAll) {
        throw new ForbiddenException({
          code: "OVERTIME_OVERRIDE_REQUIRED",
          message: "Use HR override to decide a request outside your reporting line",
        });
      }
      throw new ForbiddenException({
        code: "OVERTIME_OUT_OF_SCOPE",
        message: "You can only review overtime inside your reporting line",
      });
    }
    throw new ForbiddenException({
      code: "OVERTIME_NO_ACTIVE_STAGE",
      message: "This request has no active approval stage",
    });
  }

  private async getLinkedEmployee(userId: string): Promise<LinkedEmployee> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        managerId: true,
        branchId: true,
        departmentId: true,
        employmentStatus: true,
      },
    });
    if (!employee) {
      throw new NotFoundException({
        code: "EMPLOYEE_NOT_LINKED",
        message: "No employee record is linked to this account",
      });
    }
    return employee;
  }

  private assertEmployeeActive(employee: LinkedEmployee): void {
    if (employee.employmentStatus !== "ACTIVE" && employee.employmentStatus !== "PROBATION") {
      throw new BadRequestException({
        code: "EMPLOYEE_INACTIVE",
        message: "Only active employees can request overtime",
      });
    }
  }

  private async resolvePolicy(
    employee: LinkedEmployee,
    workDate: string,
  ): Promise<{
    policy: Prisma.OvertimePolicyGetPayload<object>;
    category: "WEEKDAY" | "WEEKEND" | "HOLIDAY" | "REST_DAY";
  }> {
    const date = dateOnly(workDate);
    const or: Prisma.OvertimePolicyAssignmentWhereInput[] = [{ employeeId: employee.id }];
    if (employee.departmentId) or.push({ departmentId: employee.departmentId });
    if (employee.branchId) or.push({ branchId: employee.branchId });

    const assignments = await this.prisma.overtimePolicyAssignment.findMany({
      where: {
        AND: [
          { effectiveFrom: { lte: date } },
          { OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }] },
        ],
        OR: or,
      },
      include: { policy: true },
    });
    const active = assignments.filter(
      (entry) =>
        entry.policy.status === "ACTIVE" &&
        entry.policy.effectiveFrom <= date &&
        (!entry.policy.effectiveTo || entry.policy.effectiveTo >= date),
    );

    const employeeAssignments = active.filter((entry) => entry.employeeId === employee.id);
    const departmentAssignments = active.filter(
      (entry) => employee.departmentId && entry.departmentId === employee.departmentId,
    );
    const branchAssignments = active.filter(
      (entry) => employee.branchId && entry.branchId === employee.branchId,
    );
    const selected =
      employeeAssignments.length > 0
        ? this.singleAssignment(employeeAssignments, "employee")
        : departmentAssignments.length > 0
          ? this.singleAssignment(departmentAssignments, "department")
          : branchAssignments.length > 0
            ? this.singleAssignment(branchAssignments, "branch")
            : null;
    if (!selected) {
      throw new BadRequestException({
        code: "OVERTIME_POLICY_NOT_ASSIGNED",
        message: "No active overtime policy is assigned to this employee for the work date",
      });
    }
    if (
      selected.policy.eligibleEmploymentStatuses.length > 0 &&
      !selected.policy.eligibleEmploymentStatuses.includes(employee.employmentStatus as never)
    ) {
      throw new ForbiddenException({
        code: "OVERTIME_EMPLOYEE_NOT_ELIGIBLE",
        message: "The employee is not eligible under this overtime policy",
      });
    }

    const [schedule, holiday] = await Promise.all([
      this.attendance.resolveScheduleForEmployee(employee.id, workDate),
      this.attendance.findHoliday(workDate, employee.branchId),
    ]);
    const category = deriveOvertimeCategory({
      holiday: Boolean(holiday),
      hasSchedule: Boolean(schedule),
      isoWeekday: isoWeekday(workDate),
    });
    if (holiday && !selected.policy.allowHoliday) {
      throw new BadRequestException({
        code: "OVERTIME_HOLIDAY_NOT_ALLOWED",
        message: "This policy does not allow overtime on holidays",
      });
    }
    if (!schedule && !holiday && !selected.policy.allowWeekend) {
      throw new BadRequestException({
        code: "OVERTIME_NON_WORKING_DAY_NOT_ALLOWED",
        message: "This policy does not allow overtime on non-working days",
      });
    }
    return { policy: selected.policy, category };
  }

  private singleAssignment<T>(rows: T[], scope: string): T {
    if (rows.length > 1) {
      throw new ConflictException({
        code: "OVERTIME_POLICY_AMBIGUOUS",
        message: `Multiple overtime policies are assigned at ${scope} scope for this date`,
      });
    }
    return rows[0]!;
  }

  private requestedMinutes(
    policy: Prisma.OvertimePolicyGetPayload<object>,
    startAt: Date,
    endAt: Date,
    breakMinutes: number,
  ): number {
    const raw = calculateWindowMinutes(startAt, endAt, breakMinutes);
    const rounded = roundOvertimeMinutes(raw, policy.roundingStrategy, policy.roundingMinutes);
    if (rounded < policy.minMinutes) {
      throw new BadRequestException({
        code: "OVERTIME_BELOW_MINIMUM",
        message: `Overtime must be at least ${policy.minMinutes} minutes`,
      });
    }
    if (rounded > policy.maxMinutes) {
      throw new BadRequestException({
        code: "OVERTIME_ABOVE_MAXIMUM",
        message: `Overtime cannot exceed ${policy.maxMinutes} minutes`,
      });
    }
    return rounded;
  }

  private initialStage(
    policy: Prisma.OvertimePolicyGetPayload<object>,
    employee: LinkedEmployee,
  ): "MANAGER" | "HR" {
    if (policy.approvalMode === "HR") return "HR";
    if (employee.managerId && employee.managerId !== employee.id) return "MANAGER";
    return "HR";
  }

  private snapshotOf(policy: Prisma.OvertimePolicyGetPayload<object>): OvertimePolicySnapshot {
    return {
      policyId: policy.id,
      code: policy.code,
      name: policy.name,
      approvalMode: policy.approvalMode,
      minMinutes: policy.minMinutes,
      maxMinutes: policy.maxMinutes,
      roundingStrategy: policy.roundingStrategy,
      roundingMinutes: policy.roundingMinutes,
      requiresAttachment: policy.requiresAttachment,
    };
  }

  private parseInstant(value: string, field: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException({
        code: "INVALID_OVERTIME_INSTANT",
        message: `${field} must be a valid ISO date-time`,
      });
    }
    return date;
  }

  private assertWindow(
    startAt: Date,
    endAt: Date,
    breakMinutes: number,
    workDate: string,
    timezone: string,
  ): void {
    if (endAt <= startAt) {
      throw new BadRequestException({
        code: "INVALID_OVERTIME_WINDOW",
        message: "Planned end must be later than planned start",
      });
    }
    if (breakMinutes < 0) {
      throw new BadRequestException({
        code: "INVALID_OVERTIME_BREAK",
        message: "Break minutes cannot be negative",
      });
    }
    if (breakMinutes >= Math.trunc((endAt.getTime() - startAt.getTime()) / 60_000)) {
      throw new BadRequestException({
        code: "OVERTIME_BREAK_TOO_LONG",
        message: "Break must be shorter than the overtime window",
      });
    }
    if (dateKeyOf(startAt, timezone) !== workDate) {
      throw new BadRequestException({
        code: "OVERTIME_WORK_DATE_MISMATCH",
        message: "The planned start must fall on the selected work date",
      });
    }
  }

  private async assertNoLeaveConflict(employeeId: string, workDate: string): Promise<void> {
    const leave = await this.leaveIntegration.approvedDay(employeeId, workDate);
    if (leave) {
      throw new ConflictException({
        code: "OVERTIME_LEAVE_CONFLICT",
        message: "Approved leave already covers this work date",
        details: { requestId: leave.requestId, leaveType: leave.leaveType },
      });
    }
  }

  private async assertNoOverlap(
    employeeId: string,
    startAt: Date,
    endAt: Date,
    excludeId?: string,
  ): Promise<void> {
    const overlap = await this.prisma.overtimeRequest.findFirst({
      where: {
        ...(excludeId ? { id: { not: excludeId } } : {}),
        employeeId,
        status: { notIn: ["REJECTED", "WITHDRAWN", "CANCELLED"] },
        plannedStartAt: { lt: endAt },
        plannedEndAt: { gt: startAt },
      },
      select: { id: true },
    });
    if (overlap) {
      throw new ConflictException({
        code: "OVERTIME_REQUEST_OVERLAP",
        message: "Another active overtime request already covers this time range",
      });
    }
  }

  private async assertEmployeeInScope(employeeId: string, scope: OvertimeScope): Promise<void> {
    if (scope.readAll) return;
    if (scope.employeeId === employeeId || scope.employeeIds?.includes(employeeId)) return;
    throw new ForbiddenException({
      code: "OVERTIME_OUT_OF_SCOPE",
      message: "You can only access overtime inside your reporting line",
    });
  }

  private isPending(status: OvertimeStatus): boolean {
    return status === "PENDING_MANAGER_APPROVAL" || status === "PENDING_HR_APPROVAL";
  }

  private has(user: AuthenticatedUser, permission: string): boolean {
    return user.permissions.includes(permission);
  }

}
