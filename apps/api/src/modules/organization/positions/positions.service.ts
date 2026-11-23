import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import type { PaginatedResponse, Position } from "@peopleops/shared-types";
import { AuditService } from "../../audit/audit.service";
import { PrismaService } from "../../../prisma/prisma.service";
import type { RequestMeta } from "../../../common/http/request-meta";
import { toPageMeta } from "../../../common/dto/page-query.dto";
import type {
  CreatePositionDto,
  ListPositionsQueryDto,
  UpdatePositionDto,
} from "./dto/position.dto";

interface ActorContext {
  actorUserId: string;
  actorEmail: string;
  meta: RequestMeta;
}

const positionInclude = {
  department: { select: { id: true, name: true } },
  jobLevel: { select: { id: true, name: true } },
  _count: { select: { employees: true } },
} satisfies Prisma.PositionInclude;

type PositionRow = Prisma.PositionGetPayload<{ include: typeof positionInclude }>;

function toPosition(row: PositionRow): Position {
  return {
    id: row.id,
    title: row.title,
    code: row.code,
    description: row.description,
    status: row.status,
    departmentId: row.departmentId,
    jobLevelId: row.jobLevelId,
    department: row.department,
    jobLevel: row.jobLevel,
    employeeCount: row._count.employees,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const NOT_FOUND = () =>
  new NotFoundException({ code: "POSITION_NOT_FOUND", message: "Position not found" });

@Injectable()
export class PositionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListPositionsQueryDto): Promise<PaginatedResponse<Position>> {
    const where: Prisma.PositionWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.jobLevelId ? { jobLevelId: query.jobLevelId } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { code: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.position.count({ where }),
      this.prisma.position.findMany({
        where,
        include: positionInclude,
        orderBy: [{ title: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return { items: rows.map(toPosition), ...toPageMeta(query.page, query.pageSize, total) };
  }

  async getById(id: string): Promise<Position> {
    const row = await this.prisma.position.findUnique({ where: { id }, include: positionInclude });
    if (!row) throw NOT_FOUND();
    return toPosition(row);
  }

  async create(dto: CreatePositionDto, actor: ActorContext): Promise<Position> {
    const code = dto.code.trim().toUpperCase();
    await this.assertCodeFree(code);
    await this.assertReferences(dto.departmentId, dto.jobLevelId ?? null);

    const row = await this.prisma.position.create({
      data: {
        title: dto.title.trim(),
        code,
        description: dto.description ?? null,
        departmentId: dto.departmentId,
        jobLevelId: dto.jobLevelId ?? null,
        status: dto.status ?? "ACTIVE",
      },
      include: positionInclude,
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "position.created",
      entityType: "position",
      entityId: row.id,
      metadata: {
        code: row.code,
        title: row.title,
        departmentId: row.departmentId,
        jobLevelId: row.jobLevelId,
      },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toPosition(row);
  }

  async update(id: string, dto: UpdatePositionDto, actor: ActorContext): Promise<Position> {
    const current = await this.prisma.position.findUnique({ where: { id }, include: positionInclude });
    if (!current) throw NOT_FOUND();

    if (dto.code) {
      await this.assertCodeFree(dto.code.trim().toUpperCase(), id);
    }
    await this.assertReferences(
      dto.departmentId ?? current.departmentId,
      dto.jobLevelId !== undefined ? dto.jobLevelId : current.jobLevelId,
    );

    const row = await this.prisma.position.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}),
        ...(dto.jobLevelId !== undefined ? { jobLevelId: dto.jobLevelId } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: positionInclude,
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "position.updated",
      entityType: "position",
      entityId: id,
      metadata: { before: toPosition(current), after: toPosition(row) } as unknown as Prisma.InputJsonValue,
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toPosition(row);
  }

  async remove(id: string, actor: ActorContext): Promise<void> {
    const current = await this.prisma.position.findUnique({ where: { id }, include: positionInclude });
    if (!current) throw NOT_FOUND();

    if (current._count.employees > 0) {
      throw new ConflictException({
        code: "POSITION_IN_USE",
        message: "Reassign the position's employees first",
        details: { employees: current._count.employees },
      });
    }

    await this.prisma.position.delete({ where: { id } });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "position.deleted",
      entityType: "position",
      entityId: id,
      metadata: { code: current.code, title: current.title },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
  }

  private async assertCodeFree(code: string, exceptId?: string): Promise<void> {
    const duplicate = await this.prisma.position.findFirst({
      where: { code, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException({
        code: "POSITION_CODE_TAKEN",
        message: "Position code is already used",
      });
    }
  }

  private async assertReferences(departmentId: string, jobLevelId: string | null): Promise<void> {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true },
    });
    if (!department) {
      throw new BadRequestException({
        code: "DEPARTMENT_NOT_FOUND",
        message: "Department does not exist",
      });
    }

    if (jobLevelId) {
      const jobLevel = await this.prisma.jobLevel.findUnique({
        where: { id: jobLevelId },
        select: { id: true },
      });
      if (!jobLevel) {
        throw new BadRequestException({
          code: "JOB_LEVEL_NOT_FOUND",
          message: "Job level does not exist",
        });
      }
    }
  }
}
