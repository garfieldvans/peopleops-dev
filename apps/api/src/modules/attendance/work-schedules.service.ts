import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import type { PaginatedResponse, WorkSchedule } from "@peopleops/shared-types";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { toPageMeta } from "../../common/dto/page-query.dto";
import type { RequestMeta } from "../../common/http/request-meta";
import { shiftDurationMinutes } from "../../common/time/zoned-time";
import { toWorkSchedule, workScheduleInclude } from "./attendance.mapper";
import type {
  CreateWorkScheduleDto,
  ListWorkSchedulesQueryDto,
  UpdateWorkScheduleDto,
  WorkScheduleDayDto,
} from "./dto/work-schedule.dto";

interface ActorContext {
  actorUserId: string;
  actorEmail: string;
  meta: RequestMeta;
}

@Injectable()
export class WorkSchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListWorkSchedulesQueryDto): Promise<PaginatedResponse<WorkSchedule>> {
    const where: Prisma.WorkScheduleWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { code: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.workSchedule.count({ where }),
      this.prisma.workSchedule.findMany({
        where,
        include: workScheduleInclude,
        orderBy: { name: "asc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const meta = toPageMeta(query.page, query.pageSize, total);
    return { items: rows.map(toWorkSchedule), ...meta };
  }

  async getById(id: string): Promise<WorkSchedule> {
    const row = await this.prisma.workSchedule.findUnique({
      where: { id },
      include: workScheduleInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: "WORK_SCHEDULE_NOT_FOUND",
        message: "Work schedule not found",
      });
    }
    return toWorkSchedule(row);
  }

  async create(dto: CreateWorkScheduleDto, actor: ActorContext): Promise<WorkSchedule> {
    const days = this.validateDays(dto.days);
    const code = dto.code.trim().toUpperCase();

    const duplicate = await this.prisma.workSchedule.findUnique({ where: { code } });
    if (duplicate) {
      throw new ConflictException({
        code: "WORK_SCHEDULE_CODE_TAKEN",
        message: "Work schedule code is already used",
      });
    }

    const row = await this.prisma.workSchedule.create({
      data: {
        name: dto.name.trim(),
        code,
        description: dto.description?.trim() ?? null,
        graceLateMinutes: dto.graceLateMinutes ?? 0,
        graceEarlyMinutes: dto.graceEarlyMinutes ?? 0,
        status: dto.status ?? "ACTIVE",
        days: { create: days },
      },
      include: workScheduleInclude,
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "work_schedule.created",
      entityType: "work_schedule",
      entityId: row.id,
      metadata: { code: row.code },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toWorkSchedule(row);
  }

  async update(
    id: string,
    dto: UpdateWorkScheduleDto,
    actor: ActorContext,
  ): Promise<WorkSchedule> {
    const existing = await this.prisma.workSchedule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: "WORK_SCHEDULE_NOT_FOUND",
        message: "Work schedule not found",
      });
    }

    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      const duplicate = await this.prisma.workSchedule.findUnique({ where: { code } });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException({
          code: "WORK_SCHEDULE_CODE_TAKEN",
          message: "Work schedule code is already used",
        });
      }
    }

    const days = dto.days ? this.validateDays(dto.days) : null;

    const row = await this.prisma.$transaction(async (tx) => {
      if (days) {
        await tx.workScheduleDay.deleteMany({ where: { scheduleId: id } });
        await tx.workScheduleDay.createMany({
          data: days.map((day) => ({ ...day, scheduleId: id })),
        });
      }

      return tx.workSchedule.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() ?? null }
            : {}),
          ...(dto.graceLateMinutes !== undefined
            ? { graceLateMinutes: dto.graceLateMinutes }
            : {}),
          ...(dto.graceEarlyMinutes !== undefined
            ? { graceEarlyMinutes: dto.graceEarlyMinutes }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
        include: workScheduleInclude,
      });
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "work_schedule.updated",
      entityType: "work_schedule",
      entityId: id,
      metadata: { fields: Object.keys(dto) },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toWorkSchedule(row);
  }

  async deactivate(id: string, actor: ActorContext): Promise<WorkSchedule> {
    const existing = await this.prisma.workSchedule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: "WORK_SCHEDULE_NOT_FOUND",
        message: "Work schedule not found",
      });
    }

    const row = await this.prisma.workSchedule.update({
      where: { id },
      data: { status: "INACTIVE" },
      include: workScheduleInclude,
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "work_schedule.deactivated",
      entityType: "work_schedule",
      entityId: id,
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toWorkSchedule(row);
  }

  private validateDays(days: WorkScheduleDayDto[]): Prisma.WorkScheduleDayCreateWithoutScheduleInput[] {
    const seen = new Set<number>();
    return days.map((day) => {
      if (seen.has(day.dayOfWeek)) {
        throw new BadRequestException({
          code: "DUPLICATE_WORKING_DAY",
          message: "Each weekday may only appear once",
          details: { dayOfWeek: day.dayOfWeek },
        });
      }
      seen.add(day.dayOfWeek);

      if (!day.isWorkingDay) {
        return {
          dayOfWeek: day.dayOfWeek,
          isWorkingDay: false,
          startTime: null,
          endTime: null,
          breakMinutes: 0,
        };
      }

      if (!day.startTime || !day.endTime) {
        throw new BadRequestException({
          code: "WORKING_DAY_REQUIRES_HOURS",
          message: "A working day needs a start and end time",
          details: { dayOfWeek: day.dayOfWeek },
        });
      }

      if (day.startTime === day.endTime) {
        throw new BadRequestException({
          code: "INVALID_WORKING_HOURS",
          message: "A working day start and end time must differ",
          details: { dayOfWeek: day.dayOfWeek },
        });
      }

      const duration = shiftDurationMinutes(day.startTime, day.endTime);
      const breakMinutes = day.breakMinutes ?? 0;
      if (breakMinutes >= duration) {
        throw new BadRequestException({
          code: "BREAK_EXCEEDS_WORKING_DAY",
          message: "Break duration must be shorter than the working day",
          details: { dayOfWeek: day.dayOfWeek },
        });
      }

      return {
        dayOfWeek: day.dayOfWeek,
        isWorkingDay: true,
        startTime: day.startTime,
        endTime: day.endTime,
        breakMinutes,
      };
    });
  }
}
