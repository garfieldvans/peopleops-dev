import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import type {
  OnboardingTaskTemplate,
  OnboardingTemplate,
  PaginatedResponse,
} from "@peopleops/shared-types";
import { toPageMeta } from "../../common/dto/page-query.dto";
import { dateKeyOf } from "../../common/time/zoned-time";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { EmployeesService } from "../employee/employees.service";
import type {
  CompleteOnboardingDto,
  CreateOnboardingRecordDto,
  CreateOnboardingTemplateDto,
  ListOnboardingQueryDto,
  ListOnboardingTemplatesQueryDto,
  UpdateOnboardingRecordDto,
  UpdateOnboardingTaskDto,
  UpdateOnboardingTemplateDto,
} from "./dto/onboarding.dto";
import {
  onboardingInclude,
  toOnboarding,
  toOnboardingDetail,
  type OnboardingRow,
} from "./onboarding.mapper";
import { addDays, dateKey, isoDate } from "./onboarding.utils";

type ActorMeta = { ip: string | null; userAgent: string | null };

function templateTask(row: {
  id: string;
  title: string;
  description: string | null;
  category: OnboardingTaskTemplate["category"];
  assignedRole: string | null;
  dueOffsetDays: number;
  isRequired: boolean;
  sortOrder: number;
}): OnboardingTaskTemplate {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    assignedRole: row.assignedRole,
    dueOffsetDays: row.dueOffsetDays,
    isRequired: row.isRequired,
    sortOrder: row.sortOrder,
  };
}

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly employees: EmployeesService,
  ) {}

  private async today(): Promise<string> {
    const company = await this.prisma.company.findFirst({ select: { timezone: true } });
    return dateKeyOf(new Date(), company?.timezone ?? "Asia/Jakarta");
  }

  async listTemplates(
    query: ListOnboardingTemplatesQueryDto,
  ): Promise<PaginatedResponse<OnboardingTemplate>> {
    const where: Prisma.OnboardingTemplateWhereInput = {
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.onboardingTemplate.count({ where }),
      this.prisma.onboardingTemplate.findMany({
        where,
        include: { tasks: { orderBy: { sortOrder: "asc" } }, _count: { select: { records: true } } },
        orderBy: { name: "asc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        isActive: row.isActive,
        tasks: row.tasks.map(templateTask),
        recordCount: row._count.records,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      ...toPageMeta(query.page, query.pageSize, total),
    };
  }

  async createTemplate(
    dto: CreateOnboardingTemplateDto,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ): Promise<OnboardingTemplate> {
    const row = await this.prisma.onboardingTemplate.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        isActive: dto.isActive ?? true,
        tasks: {
          create: dto.tasks.map((task, index) => ({
            title: task.title,
            description: task.description ?? null,
            category: task.category ?? "OTHER",
            assignedRole: task.assignedRole ?? null,
            dueOffsetDays: task.dueOffsetDays ?? 0,
            isRequired: task.isRequired ?? true,
            sortOrder: task.sortOrder ?? index,
          })),
        },
      },
      include: { tasks: { orderBy: { sortOrder: "asc" } }, _count: { select: { records: true } } },
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "onboarding.template_created",
      entityType: "onboarding_template",
      entityId: row.id,
      metadata: { name: row.name, taskCount: row.tasks.length },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      isActive: row.isActive,
      tasks: row.tasks.map(templateTask),
      recordCount: row._count.records,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateTemplate(
    id: string,
    dto: UpdateOnboardingTemplateDto,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ): Promise<OnboardingTemplate> {
    await this.findTemplate(id);
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.tasks) {
        await tx.onboardingTaskTemplate.deleteMany({ where: { templateId: id } });
      }
      return tx.onboardingTemplate.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.tasks
            ? {
                tasks: {
                  create: dto.tasks.map((task, index) => ({
                    title: task.title,
                    description: task.description ?? null,
                    category: task.category ?? "OTHER",
                    assignedRole: task.assignedRole ?? null,
                    dueOffsetDays: task.dueOffsetDays ?? 0,
                    isRequired: task.isRequired ?? true,
                    sortOrder: task.sortOrder ?? index,
                  })),
                },
              }
            : {}),
        },
        include: { tasks: { orderBy: { sortOrder: "asc" } }, _count: { select: { records: true } } },
      });
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "onboarding.template_updated",
      entityType: "onboarding_template",
      entityId: id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      isActive: row.isActive,
      tasks: row.tasks.map(templateTask),
      recordCount: row._count.records,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async list(
    query: ListOnboardingQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<ReturnType<typeof toOnboarding>>> {
    const where = await this.scopedWhere(query, user);
    const today = await this.today();
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.employeeOnboarding.count({ where }),
      this.prisma.employeeOnboarding.findMany({
        where,
        include: onboardingInclude,
        orderBy: [{ createdAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: rows.map((row) => toOnboarding(row, today)),
      ...toPageMeta(query.page, query.pageSize, total),
    };
  }

  async get(id: string, user: AuthenticatedUser) {
    const row = await this.findRow(id);
    await this.employees.assertEmployeeInScope(row.employeeId, user);
    return toOnboardingDetail(row, await this.today());
  }

  async create(
    dto: CreateOnboardingRecordDto,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ) {
    const template = await this.findTemplate(dto.templateId);
    if (!template.isActive) {
      throw new BadRequestException({
        code: "ONBOARDING_TEMPLATE_INACTIVE",
        message: "The selected onboarding template is inactive",
      });
    }
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
      select: { id: true, employeeNumber: true, firstName: true, middleName: true, lastName: true },
    });
    if (!employee) {
      throw new NotFoundException({ code: "EMPLOYEE_NOT_FOUND", message: "Employee not found" });
    }
    const active = await this.prisma.employeeOnboarding.findFirst({
      where: {
        employeeId: dto.employeeId,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      select: { id: true },
    });
    if (active) {
      throw new ConflictException({
        code: "ONBOARDING_ALREADY_ACTIVE",
        message: "This employee already has an active onboarding record",
      });
    }

    const start = dateKey(dto.startDate);
    const maxOffset = Math.max(...template.tasks.map((task) => task.dueOffsetDays), 0);
    const row = await this.prisma.employeeOnboarding.create({
      data: {
        employeeId: dto.employeeId,
        templateId: dto.templateId,
        startDate: start,
        expectedCompletionDate: dto.expectedCompletionDate
          ? dateKey(dto.expectedCompletionDate)
          : addDays(start, maxOffset || 30),
        notes: dto.notes ?? null,
        status: template.tasks.length > 0 ? "IN_PROGRESS" : "NOT_STARTED",
        createdById: user.id,
        tasks: {
          create: template.tasks.map((task) => ({
            title: task.title,
            description: task.description,
            category: task.category,
            dueDate: addDays(start, task.dueOffsetDays),
            isRequired: task.isRequired,
            sortOrder: task.sortOrder,
          })),
        },
      },
      include: onboardingInclude,
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "onboarding.created",
      entityType: "employee_onboarding",
      entityId: row.id,
      metadata: { employeeNumber: employee.employeeNumber, templateId: dto.templateId },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toOnboardingDetail(row, await this.today());
  }

  async update(
    id: string,
    dto: UpdateOnboardingRecordDto,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ) {
    const current = await this.findRow(id);
    await this.employees.assertEmployeeInScope(current.employeeId, user);
    if (current.status === "COMPLETED" && dto.status !== undefined) {
      throw new ConflictException({
        code: "ONBOARDING_COMPLETED",
        message: "A completed onboarding record cannot change status",
      });
    }
    const row = await this.prisma.employeeOnboarding.update({
      where: { id },
      data: {
        ...(dto.expectedCompletionDate !== undefined
          ? {
              expectedCompletionDate: dto.expectedCompletionDate
                ? dateKey(dto.expectedCompletionDate)
                : null,
            }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: onboardingInclude,
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "onboarding.updated",
      entityType: "employee_onboarding",
      entityId: id,
      metadata: { fields: Object.keys(dto) },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toOnboardingDetail(row, await this.today());
  }

  async complete(
    id: string,
    dto: CompleteOnboardingDto,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ) {
    const row = await this.findRow(id);
    await this.employees.assertEmployeeInScope(row.employeeId, user);
    if (row.status === "COMPLETED") {
      throw new ConflictException({
        code: "ONBOARDING_COMPLETED",
        message: "This onboarding record is already completed",
      });
    }
    const incomplete = row.tasks.filter(
      (task) => task.isRequired && task.status !== "COMPLETED",
    );
    if (incomplete.length > 0) {
      throw new ConflictException({
        code: "ONBOARDING_TASKS_INCOMPLETE",
        message: "All required onboarding tasks must be completed first",
        details: { taskIds: incomplete.map((task) => task.id) },
      });
    }
    const updated = await this.prisma.employeeOnboarding.update({
      where: { id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        ...(dto.comment ? { notes: dto.comment } : {}),
      },
      include: onboardingInclude,
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "onboarding.completed",
      entityType: "employee_onboarding",
      entityId: id,
      metadata: { employeeId: row.employeeId },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toOnboardingDetail(updated, await this.today());
  }

  async updateTask(
    id: string,
    dto: UpdateOnboardingTaskDto,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ) {
    const task = await this.prisma.onboardingTask.findUnique({
      where: { id },
      include: { onboarding: true },
    });
    if (!task) {
      throw new NotFoundException({
        code: "ONBOARDING_TASK_NOT_FOUND",
        message: "Onboarding task not found",
      });
    }
    await this.employees.assertEmployeeInScope(task.onboarding.employeeId, user);
    if (task.onboarding.status === "COMPLETED") {
      throw new ConflictException({
        code: "ONBOARDING_COMPLETED",
        message: "A completed onboarding record cannot be edited",
      });
    }
    if (dto.assignedToId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.assignedToId },
        select: { id: true },
      });
      if (!assignee) {
        throw new BadRequestException({
          code: "ONBOARDING_ASSIGNEE_NOT_FOUND",
          message: "The assigned user does not exist",
        });
      }
    }
    const status = dto.status ?? task.status;
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.onboardingTask.update({
        where: { id },
        data: {
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.assignedToId !== undefined ? { assignedToId: dto.assignedToId } : {}),
          ...(dto.dueDate !== undefined ? { dueDate: dto.dueDate ? dateKey(dto.dueDate) : null } : {}),
          completedAt: status === "COMPLETED" ? task.completedAt ?? new Date() : null,
        },
      });
      if (task.onboarding.status === "NOT_STARTED") {
        await tx.employeeOnboarding.update({
          where: { id: task.onboardingId },
          data: { status: "IN_PROGRESS" },
        });
      }
      return next;
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "onboarding.task_updated",
      entityType: "onboarding_task",
      entityId: id,
      metadata: { status: updated.status, onboardingId: task.onboardingId },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return {
      id: updated.id,
      status: updated.status,
      notes: updated.notes,
      assignedToId: updated.assignedToId,
      dueDate: isoDate(updated.dueDate),
      completedAt: updated.completedAt?.toISOString() ?? null,
    };
  }

  private async scopedWhere(
    query: ListOnboardingQueryDto,
    user: AuthenticatedUser,
  ): Promise<Prisma.EmployeeOnboardingWhereInput> {
    const scope = await this.employees.resolveScope(user);
    const where: Prisma.EmployeeOnboardingWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.search
        ? {
            OR: [
              { employee: { firstName: { contains: query.search, mode: "insensitive" } } },
              { employee: { lastName: { contains: query.search, mode: "insensitive" } } },
              { employee: { employeeNumber: { contains: query.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    if (scope.readAll) return where;
    if (scope.readTeam && scope.employeeId) {
      return { ...where, employeeId: { in: await this.employees.scopedEmployeeIds(scope) } };
    }
    if (scope.employeeId) return { ...where, employeeId: scope.employeeId };
    return { ...where, employeeId: { in: [] } };
  }

  private async findTemplate(id: string) {
    const row = await this.prisma.onboardingTemplate.findUnique({
      where: { id },
      include: { tasks: { orderBy: { sortOrder: "asc" } } },
    });
    if (!row) {
      throw new NotFoundException({
        code: "ONBOARDING_TEMPLATE_NOT_FOUND",
        message: "Onboarding template not found",
      });
    }
    return row;
  }

  private async findRow(id: string): Promise<OnboardingRow> {
    const row = await this.prisma.employeeOnboarding.findUnique({
      where: { id },
      include: onboardingInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: "ONBOARDING_NOT_FOUND",
        message: "Onboarding record not found",
      });
    }
    return row;
  }
}
