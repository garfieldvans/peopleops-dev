import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import type { Holiday, PaginatedResponse } from "@peopleops/shared-types";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { toPageMeta } from "../../common/dto/page-query.dto";
import type { RequestMeta } from "../../common/http/request-meta";
import { holidayInclude, toHoliday } from "./attendance.mapper";
import type {
  CreateHolidayDto,
  ListHolidaysQueryDto,
  UpdateHolidayDto,
} from "./dto/holiday.dto";

interface ActorContext {
  actorUserId: string;
  actorEmail: string;
  meta: RequestMeta;
}

function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

@Injectable()
export class HolidaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListHolidaysQueryDto): Promise<PaginatedResponse<Holiday>> {
    const where: Prisma.HolidayWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: toUtcDate(query.from) } : {}),
              ...(query.to ? { lte: toUtcDate(query.to) } : {}),
            },
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.holiday.count({ where }),
      this.prisma.holiday.findMany({
        where,
        include: holidayInclude,
        orderBy: [{ date: "asc" }, { name: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const meta = toPageMeta(query.page, query.pageSize, total);
    return { items: rows.map(toHoliday), ...meta };
  }

  async getById(id: string): Promise<Holiday> {
    const row = await this.prisma.holiday.findUnique({ where: { id }, include: holidayInclude });
    if (!row) {
      throw new NotFoundException({ code: "HOLIDAY_NOT_FOUND", message: "Holiday not found" });
    }
    return toHoliday(row);
  }

  async create(dto: CreateHolidayDto, actor: ActorContext): Promise<Holiday> {
    const date = toUtcDate(dto.date);
    const branchId = dto.branchId ?? null;
    this.assertBranchScope(dto.type, branchId);
    await this.assertUnique(date, branchId, null);

    const row = await this.prisma.holiday.create({
      data: {
        name: dto.name.trim(),
        date,
        description: dto.description?.trim() ?? null,
        type: dto.type,
        branchId,
        status: dto.status ?? "ACTIVE",
      },
      include: holidayInclude,
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "holiday.created",
      entityType: "holiday",
      entityId: row.id,
      metadata: { date: dto.date, branchId },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toHoliday(row);
  }

  async update(id: string, dto: UpdateHolidayDto, actor: ActorContext): Promise<Holiday> {
    const existing = await this.prisma.holiday.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: "HOLIDAY_NOT_FOUND", message: "Holiday not found" });
    }

    const date = dto.date ? toUtcDate(dto.date) : existing.date;
    const branchId = dto.branchId !== undefined ? dto.branchId : existing.branchId;
    this.assertBranchScope(dto.type ?? existing.type, branchId);
    if (dto.date !== undefined || dto.branchId !== undefined) {
      await this.assertUnique(date, branchId, id);
    }

    const row = await this.prisma.holiday.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.date !== undefined ? { date } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() ?? null }
          : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: holidayInclude,
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "holiday.updated",
      entityType: "holiday",
      entityId: id,
      metadata: { fields: Object.keys(dto) },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toHoliday(row);
  }

  async deactivate(id: string, actor: ActorContext): Promise<Holiday> {
    const existing = await this.prisma.holiday.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: "HOLIDAY_NOT_FOUND", message: "Holiday not found" });
    }
    const row = await this.prisma.holiday.update({
      where: { id },
      data: { status: "INACTIVE" },
      include: holidayInclude,
    });
    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "holiday.deactivated",
      entityType: "holiday",
      entityId: id,
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return toHoliday(row);
  }

  private assertBranchScope(type: string, branchId: string | null): void {
    if (type === "BRANCH" && !branchId) {
      throw new BadRequestException({
        code: "BRANCH_REQUIRED",
        message: "A branch holiday requires a branch",
      });
    }
    if (type !== "BRANCH" && branchId) {
      throw new BadRequestException({
        code: "BRANCH_NOT_ALLOWED",
        message: "Only branch holidays can target a branch",
      });
    }
  }

  private async assertUnique(
    date: Date,
    branchId: string | null,
    excludeId: string | null,
  ): Promise<void> {
    const duplicate = await this.prisma.holiday.findFirst({
      where: {
        date,
        branchId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException({
        code: "HOLIDAY_ALREADY_EXISTS",
        message: "A holiday already exists for that date and scope",
      });
    }
  }
}
