import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import type { Branch, PaginatedResponse } from "@peopleops/shared-types";
import { AuditService } from "../../audit/audit.service";
import { PrismaService } from "../../../prisma/prisma.service";
import type { RequestMeta } from "../../../common/http/request-meta";
import { toPageMeta } from "../../../common/dto/page-query.dto";
import type { CreateBranchDto, ListBranchesQueryDto, UpdateBranchDto } from "./dto/branch.dto";

interface ActorContext {
  actorUserId: string;
  actorEmail: string;
  meta: RequestMeta;
}

const branchInclude = {
  _count: { select: { departments: true, employees: true } },
} satisfies Prisma.BranchInclude;

type BranchRow = Prisma.BranchGetPayload<{ include: typeof branchInclude }>;

export function toBranch(row: BranchRow): Branch {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    address: row.address,
    city: row.city,
    province: row.province,
    postalCode: row.postalCode,
    phone: row.phone,
    email: row.email,
    status: row.status,
    departmentCount: row._count.departments,
    employeeCount: row._count.employees,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const BRANCH_NOT_FOUND = () =>
  new NotFoundException({ code: "BRANCH_NOT_FOUND", message: "Branch not found" });

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListBranchesQueryDto): Promise<PaginatedResponse<Branch>> {
    const where: Prisma.BranchWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { code: { contains: query.search, mode: "insensitive" } },
              { city: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.branch.count({ where }),
      this.prisma.branch.findMany({
        where,
        include: branchInclude,
        orderBy: { name: "asc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return { items: rows.map(toBranch), ...toPageMeta(query.page, query.pageSize, total) };
  }

  async getById(id: string): Promise<Branch> {
    const row = await this.prisma.branch.findUnique({ where: { id }, include: branchInclude });
    if (!row) throw BRANCH_NOT_FOUND();
    return toBranch(row);
  }

  async create(dto: CreateBranchDto, actor: ActorContext): Promise<Branch> {
    const code = dto.code.trim().toUpperCase();
    const duplicate = await this.prisma.branch.findUnique({ where: { code }, select: { id: true } });
    if (duplicate) {
      throw new ConflictException({ code: "BRANCH_CODE_TAKEN", message: "Branch code is already used" });
    }

    const row = await this.prisma.branch.create({
      data: {
        name: dto.name.trim(),
        code,
        address: dto.address ?? null,
        city: dto.city ?? null,
        province: dto.province ?? null,
        postalCode: dto.postalCode ?? null,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        status: dto.status ?? "ACTIVE",
      },
      include: branchInclude,
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "branch.created",
      entityType: "branch",
      entityId: row.id,
      metadata: { code: row.code, name: row.name },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toBranch(row);
  }

  async update(id: string, dto: UpdateBranchDto, actor: ActorContext): Promise<Branch> {
    const current = await this.prisma.branch.findUnique({ where: { id }, include: branchInclude });
    if (!current) throw BRANCH_NOT_FOUND();

    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      const duplicate = await this.prisma.branch.findFirst({
        where: { code, id: { not: id } },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException({ code: "BRANCH_CODE_TAKEN", message: "Branch code is already used" });
      }
    }

    const row = await this.prisma.branch.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.province !== undefined ? { province: dto.province } : {}),
        ...(dto.postalCode !== undefined ? { postalCode: dto.postalCode } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: branchInclude,
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "branch.updated",
      entityType: "branch",
      entityId: id,
      metadata: { before: toBranch(current), after: toBranch(row) } as unknown as Prisma.InputJsonValue,
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toBranch(row);
  }

  async remove(id: string, actor: ActorContext): Promise<void> {
    const current = await this.prisma.branch.findUnique({ where: { id }, include: branchInclude });
    if (!current) throw BRANCH_NOT_FOUND();

    if (current._count.departments > 0 || current._count.employees > 0) {
      throw new ConflictException({
        code: "BRANCH_IN_USE",
        message: "Move or delete the branch's departments and employees first",
        details: {
          departments: current._count.departments,
          employees: current._count.employees,
        },
      });
    }

    await this.prisma.branch.delete({ where: { id } });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "branch.deleted",
      entityType: "branch",
      entityId: id,
      metadata: { code: current.code, name: current.name },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
  }
}
