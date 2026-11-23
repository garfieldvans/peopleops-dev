import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import type { PaginatedResponse, Shift } from "@peopleops/shared-types";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { toPageMeta } from "../../common/dto/page-query.dto";
import type { RequestMeta } from "../../common/http/request-meta";
import { shiftDurationMinutes } from "../../common/time/zoned-time";
import { shiftInclude, toShift } from "./attendance.mapper";
import type { CreateShiftDto, ListShiftsQueryDto, UpdateShiftDto } from "./dto/shift.dto";

interface ActorContext {
  actorUserId: string;
  actorEmail: string;
  meta: RequestMeta;
}

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListShiftsQueryDto): Promise<PaginatedResponse<Shift>> {
    const where: Prisma.ShiftWhereInput = {
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
      this.prisma.shift.count({ where }),
      this.prisma.shift.findMany({
        where,
        include: shiftInclude,
        orderBy: [{ startTime: "asc" }, { name: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const meta = toPageMeta(query.page, query.pageSize, total);
    return { items: rows.map(toShift), ...meta };
  }

  async getById(id: string): Promise<Shift> {
    const row = await this.prisma.shift.findUnique({ where: { id }, include: shiftInclude });
    if (!row) {
      throw new NotFoundException({ code: "SHIFT_NOT_FOUND", message: "Shift not found" });
    }
    return toShift(row);
  }

  async create(dto: CreateShiftDto, actor: ActorContext): Promise<Shift> {
    this.validateTimes(dto.startTime, dto.endTime, dto.breakMinutes ?? 0);
    const code = dto.code.trim().toUpperCase();
    const duplicate = await this.prisma.shift.findUnique({ where: { code } });
    if (duplicate) {
      throw new ConflictException({
        code: "SHIFT_CODE_TAKEN",
        message: "Shift code is already used",
      });
    }

    const row = await this.prisma.shift.create({
      data: {
        name: dto.name.trim(),
        code,
        description: dto.description?.trim() ?? null,
        startTime: dto.startTime,
        endTime: dto.endTime,
        breakMinutes: dto.breakMinutes ?? 0,
        graceLateMinutes: dto.graceLateMinutes ?? 0,
        graceEarlyMinutes: dto.graceEarlyMinutes ?? 0,
        status: dto.status ?? "ACTIVE",
      },
      include: shiftInclude,
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "shift.created",
      entityType: "shift",
      entityId: row.id,
      metadata: { code: row.code, overnight: row.endTime <= row.startTime },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toShift(row);
  }

  async update(id: string, dto: UpdateShiftDto, actor: ActorContext): Promise<Shift> {
    const existing = await this.prisma.shift.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: "SHIFT_NOT_FOUND", message: "Shift not found" });
    }

    this.validateTimes(
      dto.startTime ?? existing.startTime,
      dto.endTime ?? existing.endTime,
      dto.breakMinutes ?? existing.breakMinutes,
    );

    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      const duplicate = await this.prisma.shift.findUnique({ where: { code } });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException({
          code: "SHIFT_CODE_TAKEN",
          message: "Shift code is already used",
        });
      }
    }

    const row = await this.prisma.shift.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() ?? null }
          : {}),
        ...(dto.startTime !== undefined ? { startTime: dto.startTime } : {}),
        ...(dto.endTime !== undefined ? { endTime: dto.endTime } : {}),
        ...(dto.breakMinutes !== undefined ? { breakMinutes: dto.breakMinutes } : {}),
        ...(dto.graceLateMinutes !== undefined
          ? { graceLateMinutes: dto.graceLateMinutes }
          : {}),
        ...(dto.graceEarlyMinutes !== undefined
          ? { graceEarlyMinutes: dto.graceEarlyMinutes }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: shiftInclude,
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "shift.updated",
      entityType: "shift",
      entityId: id,
      metadata: { fields: Object.keys(dto) },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toShift(row);
  }

  async deactivate(id: string, actor: ActorContext): Promise<Shift> {
    const existing = await this.prisma.shift.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: "SHIFT_NOT_FOUND", message: "Shift not found" });
    }

    const row = await this.prisma.shift.update({
      where: { id },
      data: { status: "INACTIVE" },
      include: shiftInclude,
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "shift.deactivated",
      entityType: "shift",
      entityId: id,
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toShift(row);
  }

  private validateTimes(startTime: string, endTime: string, breakMinutes: number): void {
    if (startTime === endTime) {
      throw new BadRequestException({
        code: "INVALID_SHIFT_TIMES",
        message: "Shift start and end time must differ",
      });
    }
    if (breakMinutes >= shiftDurationMinutes(startTime, endTime)) {
      throw new BadRequestException({
        code: "BREAK_EXCEEDS_SHIFT",
        message: "Break duration must be shorter than the shift",
      });
    }
  }
}
