import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import type {
  Department,
  DepartmentTreeNode,
  PaginatedResponse,
} from "@peopleops/shared-types";
import { AuditService } from "../../audit/audit.service";
import { PrismaService } from "../../../prisma/prisma.service";
import type { RequestMeta } from "../../../common/http/request-meta";
import { toPageMeta } from "../../../common/dto/page-query.dto";
import type {
  CreateDepartmentDto,
  ListDepartmentsQueryDto,
  UpdateDepartmentDto,
} from "./dto/department.dto";

interface ActorContext {
  actorUserId: string;
  actorEmail: string;
  meta: RequestMeta;
}

const departmentInclude = {
  branch: { select: { id: true, name: true } },
  parent: { select: { id: true, name: true } },
  head: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
  _count: { select: { positions: true, employees: true } },
} satisfies Prisma.DepartmentInclude;

type DepartmentRow = Prisma.DepartmentGetPayload<{ include: typeof departmentInclude }>;

function headName(head: DepartmentRow["head"]): string | null {
  if (!head) return null;
  return head.preferredName?.trim() || `${head.firstName} ${head.lastName}`.trim();
}

export function toDepartment(row: DepartmentRow): Department {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    status: row.status,
    branchId: row.branchId,
    parentId: row.parentId,
    headEmployeeId: row.headEmployeeId,
    branch: row.branch,
    parent: row.parent,
    head: row.head ? { id: row.head.id, name: headName(row.head) ?? "" } : null,
    positionCount: row._count.positions,
    employeeCount: row._count.employees,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const NOT_FOUND = () =>
  new NotFoundException({ code: "DEPARTMENT_NOT_FOUND", message: "Department not found" });

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListDepartmentsQueryDto): Promise<PaginatedResponse<Department>> {
    const where: Prisma.DepartmentWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.parentId ? { parentId: query.parentId } : {}),
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
      this.prisma.department.count({ where }),
      this.prisma.department.findMany({
        where,
        include: departmentInclude,
        orderBy: [{ name: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return { items: rows.map(toDepartment), ...toPageMeta(query.page, query.pageSize, total) };
  }

  /** Whole tree in one query, assembled in memory. */
  async tree(): Promise<DepartmentTreeNode[]> {
    const rows = await this.prisma.department.findMany({
      include: departmentInclude,
      orderBy: [{ name: "asc" }],
    });

    const nodes = new Map<string, DepartmentTreeNode>(
      rows.map((row) => [row.id, { ...toDepartment(row), children: [] }]),
    );
    const roots: DepartmentTreeNode[] = [];

    for (const node of nodes.values()) {
      const parent = node.parentId ? nodes.get(node.parentId) : undefined;
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async getById(id: string): Promise<Department> {
    const row = await this.prisma.department.findUnique({ where: { id }, include: departmentInclude });
    if (!row) throw NOT_FOUND();
    return toDepartment(row);
  }

  async create(dto: CreateDepartmentDto, actor: ActorContext): Promise<Department> {
    const code = dto.code.trim().toUpperCase();
    const duplicate = await this.prisma.department.findUnique({ where: { code }, select: { id: true } });
    if (duplicate) {
      throw new ConflictException({
        code: "DEPARTMENT_CODE_TAKEN",
        message: "Department code is already used",
      });
    }

    await this.assertReferences(dto.branchId ?? null, dto.headEmployeeId ?? null);
    await this.assertParent(null, dto.parentId ?? null);

    const row = await this.prisma.department.create({
      data: {
        name: dto.name.trim(),
        code,
        description: dto.description ?? null,
        branchId: dto.branchId ?? null,
        parentId: dto.parentId ?? null,
        headEmployeeId: dto.headEmployeeId ?? null,
        status: dto.status ?? "ACTIVE",
      },
      include: departmentInclude,
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "department.created",
      entityType: "department",
      entityId: row.id,
      metadata: { code: row.code, name: row.name, parentId: row.parentId },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toDepartment(row);
  }

  async update(id: string, dto: UpdateDepartmentDto, actor: ActorContext): Promise<Department> {
    const current = await this.prisma.department.findUnique({
      where: { id },
      include: departmentInclude,
    });
    if (!current) throw NOT_FOUND();

    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      const duplicate = await this.prisma.department.findFirst({
        where: { code, id: { not: id } },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException({
          code: "DEPARTMENT_CODE_TAKEN",
          message: "Department code is already used",
        });
      }
    }

    if (dto.branchId !== undefined || dto.headEmployeeId !== undefined) {
      await this.assertReferences(
        dto.branchId !== undefined ? dto.branchId : current.branchId,
        dto.headEmployeeId !== undefined ? dto.headEmployeeId : current.headEmployeeId,
      );
    }

    if (dto.parentId !== undefined) {
      await this.assertParent(id, dto.parentId);
    }

    const row = await this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
        ...(dto.headEmployeeId !== undefined ? { headEmployeeId: dto.headEmployeeId } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: departmentInclude,
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "department.updated",
      entityType: "department",
      entityId: id,
      metadata: { before: toDepartment(current), after: toDepartment(row) } as unknown as Prisma.InputJsonValue,
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toDepartment(row);
  }

  async remove(id: string, actor: ActorContext): Promise<void> {
    const current = await this.prisma.department.findUnique({
      where: { id },
      include: departmentInclude,
    });
    if (!current) throw NOT_FOUND();

    const childCount = await this.prisma.department.count({ where: { parentId: id } });
    if (childCount > 0 || current._count.positions > 0 || current._count.employees > 0) {
      throw new ConflictException({
        code: "DEPARTMENT_IN_USE",
        message: "Move or delete the department's sub-departments, positions and employees first",
        details: {
          childDepartments: childCount,
          positions: current._count.positions,
          employees: current._count.employees,
        },
      });
    }

    await this.prisma.department.delete({ where: { id } });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "department.deleted",
      entityType: "department",
      entityId: id,
      metadata: { code: current.code, name: current.name },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
  }

  private async assertReferences(branchId: string | null, headEmployeeId: string | null): Promise<void> {
    if (branchId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } });
      if (!branch) {
        throw new BadRequestException({ code: "BRANCH_NOT_FOUND", message: "Branch does not exist" });
      }
    }

    if (headEmployeeId) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: headEmployeeId },
        select: { id: true },
      });
      if (!employee) {
        throw new BadRequestException({
          code: "HEAD_EMPLOYEE_NOT_FOUND",
          message: "Head employee does not exist",
        });
      }
    }
  }

  /**
   * A department can never become its own ancestor: walk up from the proposed
   * parent and reject the move if the edited department appears in that chain.
   */
  private async assertParent(id: string | null, parentId: string | null): Promise<void> {
    if (!parentId) return;

    if (id && parentId === id) {
      throw new BadRequestException({
        code: "DEPARTMENT_SELF_PARENT",
        message: "A department cannot be its own parent",
      });
    }

    const parent = await this.prisma.department.findUnique({
      where: { id: parentId },
      select: { id: true },
    });
    if (!parent) {
      throw new BadRequestException({
        code: "PARENT_DEPARTMENT_NOT_FOUND",
        message: "Parent department does not exist",
      });
    }

    if (!id) return;

    let cursor: string | null = parentId;
    const visited = new Set<string>();
    while (cursor) {
      if (cursor === id) {
        throw new BadRequestException({
          code: "DEPARTMENT_CYCLE",
          message: "This move would create a cycle in the department hierarchy",
        });
      }
      if (visited.has(cursor)) break;
      visited.add(cursor);
      const node: { parentId: string | null } | null = await this.prisma.department.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = node?.parentId ?? null;
    }
  }
}
