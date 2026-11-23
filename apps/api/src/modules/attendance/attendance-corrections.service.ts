import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import type {
  AttendanceCorrection,
  PaginatedResponse,
} from "@peopleops/shared-types";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { toPageMeta } from "../../common/dto/page-query.dto";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
  addDaysToDateKey,
  zonedDateTimeToUtc,
} from "../../common/time/zoned-time";
import { calculateAttendance } from "./attendance-calculation";
import { AttendanceService, type AttendanceActor } from "./attendance.service";
import {
  correctionInclude,
  toCorrection,
  type CorrectionRow,
} from "./attendance.mapper";
import type {
  CreateCorrectionDto,
  ListCorrectionsQueryDto,
  ReviewCorrectionDto,
} from "./dto/attendance.dto";

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function keyOf(value: Date): string {
  return value.toISOString().slice(0, 10);
}

@Injectable()
export class AttendanceCorrectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly attendance: AttendanceService,
  ) {}

  async list(
    query: ListCorrectionsQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<AttendanceCorrection>> {
    const scope = await this.attendance.getScope(user);
    if (!scope.readAll) {
      if (query.employeeId) {
        await this.attendance.assertEmployeeAccess(query.employeeId, user);
      }
    }

    const employeeIds = await this.attendance.getAccessibleEmployeeIds(user);

    const where: Prisma.AttendanceCorrectionWhereInput = {
      ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            workDate: {
              ...(query.from ? { gte: dateOnly(query.from) } : {}),
              ...(query.to ? { lte: dateOnly(query.to) } : {}),
            },
          }
        : {}),
    };

    const [total, rows, timezone] = await Promise.all([
      this.prisma.attendanceCorrection.count({ where }),
      this.prisma.attendanceCorrection.findMany({
        where,
        include: correctionInclude,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.attendance.getCompanyTimezone(),
    ]);

    const meta = toPageMeta(query.page, query.pageSize, total);
    return { items: rows.map((row) => toCorrection(row, timezone)), ...meta };
  }

  async getById(id: string, user: AuthenticatedUser): Promise<AttendanceCorrection> {
    const row = await this.findRow(id);
    await this.attendance.assertEmployeeAccess(row.employeeId, user);
    return toCorrection(row, await this.attendance.getCompanyTimezone());
  }

  async create(
    dto: CreateCorrectionDto,
    user: AuthenticatedUser,
    actor: AttendanceActor,
  ): Promise<AttendanceCorrection> {
    const employee = await this.attendance.getLinkedEmployee(user.id);
    const timezone = await this.attendance.getCompanyTimezone();

    const record = dto.attendanceRecordId
      ? await this.prisma.attendanceRecord.findUnique({
          where: { id: dto.attendanceRecordId },
          include: { breaks: true },
        })
      : null;
    if (dto.attendanceRecordId && !record) {
      throw new NotFoundException({
        code: "ATTENDANCE_NOT_FOUND",
        message: "Attendance record not found",
      });
    }
    if (record && record.employeeId !== employee.id) {
      throw new ForbiddenException({
        code: "CORRECTION_NOT_OWNED",
        message: "You can only correct your own attendance",
      });
    }
    if (record && record.clockInAt && !record.clockOutAt) {
      throw new BadRequestException({
        code: "ATTENDANCE_STILL_OPEN",
        message: "Clock out before requesting a correction for an open session",
      });
    }

    const workDate = record
      ? keyOf(record.workDate)
      : dto.workDate;
    if (!workDate) {
      throw new BadRequestException({
        code: "WORK_DATE_REQUIRED",
        message: "Choose the work date for this correction",
      });
    }
    if (record && dto.workDate && dto.workDate !== workDate) {
      throw new BadRequestException({
        code: "WORK_DATE_MISMATCH",
        message: "The work date does not match the attendance record",
      });
    }

    if (dto.type === "CLOCK_IN" || dto.type === "BOTH") {
      if (!dto.requestedClockIn) {
        throw new BadRequestException({
          code: "REQUESTED_CLOCK_IN_REQUIRED",
          message: "Provide the corrected clock-in time",
        });
      }
    }
    if (dto.type === "CLOCK_OUT" || dto.type === "BOTH") {
      if (!dto.requestedClockOut) {
        throw new BadRequestException({
          code: "REQUESTED_CLOCK_OUT_REQUIRED",
          message: "Provide the corrected clock-out time",
        });
      }
    }

    const existingPending = await this.prisma.attendanceCorrection.findFirst({
      where: { employeeId: employee.id, workDate: dateOnly(workDate), status: "PENDING" },
      select: { id: true },
    });
    if (existingPending) {
      throw new ConflictException({
        code: "CORRECTION_ALREADY_PENDING",
        message: "A correction for this work date is already waiting for review",
      });
    }

    const requestedIn =
      dto.type !== "CLOCK_OUT" && dto.requestedClockIn
        ? zonedDateTimeToUtc(workDate, dto.requestedClockIn, record?.timezone ?? timezone)
        : null;
    let requestedOut =
      dto.type !== "CLOCK_IN" && dto.requestedClockOut
        ? zonedDateTimeToUtc(workDate, dto.requestedClockOut, record?.timezone ?? timezone)
        : null;

    const referenceIn = requestedIn ?? record?.clockInAt ?? null;
    if (requestedOut && referenceIn && requestedOut <= referenceIn) {
      requestedOut = zonedDateTimeToUtc(
        addDaysToDateKey(workDate, 1),
        dto.requestedClockOut!,
        record?.timezone ?? timezone,
      );
    }
    if (requestedIn && requestedOut && requestedOut <= requestedIn) {
      throw new BadRequestException({
        code: "INVALID_CORRECTION_RANGE",
        message: "Corrected clock-out must be later than clock-in",
      });
    }

    let correctionId: string;
    try {
      const created = await this.prisma.attendanceCorrection.create({
        data: {
          employeeId: employee.id,
          attendanceRecordId: record?.id ?? null,
          workDate: dateOnly(workDate),
          type: dto.type,
          requestedClockInAt: requestedIn,
          requestedClockOutAt: requestedOut,
          originalClockInAt: record?.clockInAt ?? null,
          originalClockOutAt: record?.clockOutAt ?? null,
          reason: dto.reason.trim(),
        },
        select: { id: true },
      });
      correctionId = created.id;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "CORRECTION_ALREADY_PENDING",
          message: "A correction for this record or work date is already pending",
        });
      }
      throw error;
    }

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "attendance_correction.created",
      entityType: "attendance_correction",
      entityId: correctionId,
      metadata: { employeeId: employee.id, workDate, type: dto.type },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return this.getById(correctionId, user);
  }

  async approve(
    id: string,
    dto: ReviewCorrectionDto,
    user: AuthenticatedUser,
    actor: AttendanceActor,
  ): Promise<AttendanceCorrection> {
    const correction = await this.findRow(id);
    await this.assertReviewable(correction, user);
    await this.assertNotSelfReview(correction, user);

    const workDate = keyOf(correction.workDate);
    const attendance = correction.attendanceRecordId
      ? await this.prisma.attendanceRecord.findUnique({
          where: { id: correction.attendanceRecordId },
          include: { breaks: true },
        })
      : null;
    if (attendance && attendance.clockInAt && !attendance.clockOutAt) {
      throw new BadRequestException({
        code: "ATTENDANCE_STILL_OPEN",
        message: "The attendance session is still open; clock out before approving",
      });
    }

    const timezone = attendance?.timezone ?? (await this.attendance.getCompanyTimezone());
    const schedule = attendance
      ? null
      : await this.attendance.resolveScheduleForEmployee(
          correction.employeeId,
          workDate,
          timezone,
        );
    if (!attendance && !schedule) {
      throw new BadRequestException({
        code: "NO_SCHEDULE_FOR_CORRECTION_DATE",
        message: "The employee has no schedule on the requested work date",
      });
    }

    const clockInAt =
      correction.type === "CLOCK_OUT"
        ? (attendance?.clockInAt ?? null)
        : correction.requestedClockInAt;
    const clockOutAt =
      correction.type === "CLOCK_IN"
        ? (attendance?.clockOutAt ?? null)
        : correction.requestedClockOutAt;

    if (clockInAt && clockOutAt && clockOutAt <= clockInAt) {
      throw new BadRequestException({
        code: "INVALID_CORRECTION_RANGE",
        message: "Corrected clock-out must be later than clock-in",
      });
    }

    const scheduledStartAt = attendance?.scheduledStartAt ?? schedule!.scheduledStartAt;
    const scheduledEndAt = attendance?.scheduledEndAt ?? schedule!.scheduledEndAt;
    const expectedBreakMinutes =
      attendance?.expectedBreakMinutes ?? schedule!.expectedBreakMinutes;
    const breaks = attendance?.breaks.filter((entry) => entry.endedAt) ?? [];
    const result = calculateAttendance({
      scheduledStartAt,
      scheduledEndAt,
      clockInAt,
      clockOutAt,
      graceLateMinutes: attendance?.graceLateMinutes ?? schedule!.graceLateMinutes,
      graceEarlyMinutes: attendance?.graceEarlyMinutes ?? schedule!.graceEarlyMinutes,
      expectedBreakMinutes,
      breaks,
    });

    await this.prisma.$transaction(async (tx) => {
      const record = attendance
        ? await tx.attendanceRecord.update({
            where: { id: attendance.id },
            data: {
              clockInAt,
              clockOutAt,
              status: result.status,
              lateMinutes: result.lateMinutes,
              earlyLeaveMinutes: result.earlyLeaveMinutes,
              workedMinutes: result.workedMinutes,
              breakMinutesTaken: result.breakMinutesTaken,
              isCorrected: true,
            },
          })
        : await tx.attendanceRecord.create({
            data: {
              employeeId: correction.employeeId,
              scheduleAssignmentId: schedule!.assignmentId,
              workScheduleId: schedule!.workSchedule.id,
              shiftId: schedule!.shift?.id ?? null,
              workDate: dateOnly(workDate),
              timezone,
              scheduledStartAt,
              scheduledEndAt,
              expectedBreakMinutes,
              graceLateMinutes: schedule!.graceLateMinutes,
              graceEarlyMinutes: schedule!.graceEarlyMinutes,
              clockInAt,
              clockOutAt,
              status: result.status,
              lateMinutes: result.lateMinutes,
              earlyLeaveMinutes: result.earlyLeaveMinutes,
              workedMinutes: result.workedMinutes,
              breakMinutesTaken: result.breakMinutesTaken,
              isCorrected: true,
            },
          });

      await tx.attendanceCorrection.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedById: user.id,
          reviewNotes: dto.reviewNotes?.trim() ?? null,
          reviewedAt: new Date(),
          attendanceRecordId: record.id,
        },
      });
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "attendance_correction.approved",
      entityType: "attendance_correction",
      entityId: id,
      metadata: { employeeId: correction.employeeId, workDate },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return this.getById(id, user);
  }

  async reject(
    id: string,
    dto: ReviewCorrectionDto,
    user: AuthenticatedUser,
    actor: AttendanceActor,
  ): Promise<AttendanceCorrection> {
    const correction = await this.findRow(id);
    await this.assertReviewable(correction, user);
    await this.assertNotSelfReview(correction, user);

    await this.prisma.attendanceCorrection.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedById: user.id,
        reviewNotes: dto.reviewNotes?.trim() ?? null,
        reviewedAt: new Date(),
      },
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "attendance_correction.rejected",
      entityType: "attendance_correction",
      entityId: id,
      metadata: { employeeId: correction.employeeId, notes: dto.reviewNotes ?? null },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return this.getById(id, user);
  }

  async cancel(
    id: string,
    reason: string | undefined,
    user: AuthenticatedUser,
    actor: AttendanceActor,
  ): Promise<AttendanceCorrection> {
    const correction = await this.findRow(id);
    const employee = await this.attendance.getLinkedEmployee(user.id);
    if (correction.employeeId !== employee.id) {
      throw new ForbiddenException({
        code: "CORRECTION_NOT_OWNED",
        message: "You can only cancel your own correction requests",
      });
    }
    if (correction.status !== "PENDING") {
      throw new ConflictException({
        code: "CORRECTION_NOT_PENDING",
        message: "Only pending corrections can be cancelled",
      });
    }

    await this.prisma.attendanceCorrection.update({
      where: { id },
      data: {
        status: "CANCELLED",
        reviewNotes: reason?.trim() ?? null,
        reviewedAt: new Date(),
      },
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "attendance_correction.cancelled",
      entityType: "attendance_correction",
      entityId: id,
      metadata: { reason: reason ?? null },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return this.getById(id, user);
  }

  private async assertNotSelfReview(
    correction: CorrectionRow,
    user: AuthenticatedUser,
  ): Promise<void> {
    const linked = await this.prisma.employee.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (linked?.id === correction.employeeId) {
      throw new ForbiddenException({
        code: "SELF_REVIEW_FORBIDDEN",
        message: "You cannot review your own attendance correction",
      });
    }
  }

  private async findRow(id: string): Promise<CorrectionRow> {
    const row = await this.prisma.attendanceCorrection.findUnique({
      where: { id },
      include: correctionInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: "ATTENDANCE_CORRECTION_NOT_FOUND",
        message: "Attendance correction not found",
      });
    }
    return row;
  }

  private async assertReviewable(
    correction: CorrectionRow,
    user: AuthenticatedUser,
  ): Promise<void> {
    await this.attendance.assertEmployeeAccess(correction.employeeId, user);
    if (correction.status !== "PENDING") {
      throw new ConflictException({
        code: "CORRECTION_NOT_PENDING",
        message: "This correction has already been reviewed",
      });
    }
  }
}
