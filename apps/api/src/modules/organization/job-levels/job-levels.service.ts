import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import type { JobLevel, MasterStatus } from "@peopleops/shared-types";
import { AuditService } from "../../audit/audit.service";
import { PrismaService } from "../../../prisma/prisma.service";
import type { RequestMeta } from "../../../common/http/request-meta";
import type { CreateJobLevelDto, UpdateJobLevelDto } from "./dto/job-level.dto";

interface ActorContext {
  actorUserId: string;
  actorEmail: string;
  meta: RequestMeta;
}

const jobLevelInclude = {
  _count: { select: { positions: true, employees: true } },
} satisfies Prisma.JobLevelInclude;

type JobLevelRow = Prisma.JobLevelGetPayload<{ include: typeof jobLevelInclude }>;

function toJobLevel(row: JobLevelRow): JobLevel {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    displayOrder: row.displayOrder,
    status: row.status,
    positionCount: row._count.positions,
    employeeCount: row._count.employees,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const NOT_FOUND = () =>
  new NotFoundException({ code: "JOB_LEVEL_NOT_FOUND", message: "Job level not found" });

@Injectable()
export class JobLevelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(search?: string, status?: MasterStatus): Promise<JobLevel[]> {
    const rows = await this.prisma.jobLevel.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: jobLevelInclude,
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
    return rows.map(toJobLevel);
  }

  async create(dto: CreateJobLevelDto, actor: ActorContext): Promise<JobLevel> {
    const code = dto.code.trim().toUpperCase();
    const duplicate = await this.prisma.jobLevel.findUnique({ where: { code }, select: { id: true } });
    if (duplicate) {
      throw new ConflictException({
        code: "JOB_LEVEL_CODE_TAKEN",
        message: "Job level code is already used",
      });
    }

    const row = await this.prisma.jobLevel.create({
      data: {
        name: dto.name.trim(),
        code,
        description: dto.description ?? null,
        displayOrder: dto.displayOrder ?? 0,
        status: dto.status ?? "ACTIVE",
      },
      include: jobLevelInclude,
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "job_level.created",
      entityType: "job_level",
      entityId: row.id,
      metadata: { code: row.code, name: row.name, displayOrder: row.displayOrder },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toJobLevel(row);
  }

  async update(id: string, dto: UpdateJobLevelDto, actor: ActorContext): Promise<JobLevel> {
    const current = await this.prisma.jobLevel.findUnique({ where: { id }, include: jobLevelInclude });
    if (!current) throw NOT_FOUND();

    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      const duplicate = await this.prisma.jobLevel.findFirst({
        where: { code, id: { not: id } },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException({
          code: "JOB_LEVEL_CODE_TAKEN",
          message: "Job level code is already used",
        });
      }
    }

    const row = await this.prisma.jobLevel.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: jobLevelInclude,
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "job_level.updated",
      entityType: "job_level",
      entityId: id,
      metadata: { before: toJobLevel(current), after: toJobLevel(row) } as unknown as Prisma.InputJsonValue,
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toJobLevel(row);
  }

  async remove(id: string, actor: ActorContext): Promise<void> {
    const current = await this.prisma.jobLevel.findUnique({ where: { id }, include: jobLevelInclude });
    if (!current) throw NOT_FOUND();

    if (current._count.positions > 0 || current._count.employees > 0) {
      throw new ConflictException({
        code: "JOB_LEVEL_IN_USE",
        message: "Job level is assigned to positions or employees",
        details: { positions: current._count.positions, employees: current._count.employees },
      });
    }

    await this.prisma.jobLevel.delete({ where: { id } });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "job_level.deleted",
      entityType: "job_level",
      entityId: id,
      metadata: { code: current.code, name: current.name },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
  }
}
