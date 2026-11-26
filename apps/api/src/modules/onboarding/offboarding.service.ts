import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import type {
  OffboardingTaskTemplate,
  OffboardingTemplate,
  PaginatedResponse,
} from "@peopleops/shared-types";
import { PERMISSIONS } from "@peopleops/shared-types";
import { toPageMeta } from "../../common/dto/page-query.dto";
import { dateKeyOf } from "../../common/time/zoned-time";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { EmployeesService } from "../employee/employees.service";
import type {
  CompleteOffboardingDto,
  CreateOffboardingRecordDto,
  CreateOffboardingTemplateDto,
  ListOffboardingQueryDto,
  UpdateOffboardingRecordDto,
  UpdateOffboardingTaskDto,
  UpdateOffboardingTemplateDto,
} from "./dto/onboarding.dto";
import {
  offboardingInclude,
  toOffboarding,
  toOffboardingDetail,
  type OffboardingRow,
} from "./onboarding.mapper";
import { addDays, dateKey, isoDate } from "./onboarding.utils";

type ActorMeta = { ip: string | null; userAgent: string | null };

function templateTask(row: {
  id: string;
  title: string;
  description: string | null;
  category: OffboardingTaskTemplate["category"];
  assignedRole: string | null;
  dueOffsetDays: number;
  isRequired: boolean;
  sortOrder: number;
}): OffboardingTaskTemplate {
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
export class OffboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly employees: EmployeesService,
  ) {}

  private async today(): Promise<string> {
    const company = await this.prisma.company.findFirst({ select: { timezone: true } });
    return dateKeyOf(new Date(), company?.timezone ?? "Asia/Jakarta");
  }

  async listTemplates(query: {
    page: number;
    pageSize: number;
    search?: string;
    isActive?: boolean;
  }): Promise<PaginatedResponse<OffboardingTemplate>> {
    const where: Prisma.OffboardingTemplateWhereInput = {
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.offboardingTemplate.count({ where }),
      this.prisma.offboardingTemplate.findMany({
        where,
        include: { tasks: { orderBy: { sortOrder: "asc" } } },
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
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      ...toPageMeta(query.page, query.pageSize, total),
    };
  }

  async createTemplate(
    dto: CreateOffboardingTemplateDto,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ): Promise<OffboardingTemplate> {
    const row = await this.prisma.offboardingTemplate.create({
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
      include: { tasks: { orderBy: { sortOrder: "asc" } } },
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "offboarding.template_created",
      entityType: "offboarding_template",
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
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateTemplate(
    id: string,
    dto: UpdateOffboardingTemplateDto,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ): Promise<OffboardingTemplate> {
    await this.findTemplate(id);
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.tasks) {
        await tx.offboardingTaskTemplate.deleteMany({ where: { templateId: id } });
      }
      return tx.offboardingTemplate.update({
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
        include: { tasks: { orderBy: { sortOrder: "asc" } } },
      });
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "offboarding.template_updated",
      entityType: "offboarding_template",
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
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async list(query: ListOffboardingQueryDto, user: AuthenticatedUser) {
    const scope = await this.employees.resolveScope(user);
    const where: Prisma.EmployeeOffboardingWhereInput = {
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
    if (!scope.readAll) {
      where.employeeId = scope.employeeId ?? "__none__";
    }
    const today = await this.today();
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.employeeOffboarding.count({ where }),
      this.prisma.employeeOffboarding.findMany({
        where,
        include: offboardingInclude,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: rows.map((row) => toOffboarding(row, today)),
      ...toPageMeta(query.page, query.pageSize, total),
    };
  }

  async get(id: string, user: AuthenticatedUser) {
    const row = await this.findRow(id);
    await this.employees.assertEmployeeInScope(row.employeeId, user);
    const sensitive = user.permissions.includes(PERMISSIONS.OFFBOARDING_SENSITIVE_READ);
    return toOffboardingDetail(
      row,
      await this.today(),
      sensitive,
      await this.integrationNotes(row),
    );
  }

  async create(
    dto: CreateOffboardingRecordDto,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ) {
    this.assertSensitiveInput(dto, user);
    const resignation = dateKey(dto.resignationDate);
    const lastWorking = dateKey(dto.lastWorkingDate);
    if (lastWorking < resignation) {
      throw new BadRequestException({
        code: "OFFBOARDING_DATE_ORDER",
        message: "Last working date cannot be before the resignation date",
      });
    }
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
      select: { id: true, employeeNumber: true },
    });
    if (!employee) {
      throw new NotFoundException({ code: "EMPLOYEE_NOT_FOUND", message: "Employee not found" });
    }
    const active = await this.prisma.employeeOffboarding.findFirst({
      where: { employeeId: dto.employeeId, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      select: { id: true },
    });
    if (active) {
      throw new ConflictException({
        code: "OFFBOARDING_ALREADY_ACTIVE",
        message: "This employee already has an active offboarding record",
      });
    }
    const template = dto.templateId ? await this.findTemplate(dto.templateId) : null;
    const row = await this.prisma.employeeOffboarding.create({
      data: {
        employeeId: dto.employeeId,
        templateId: template?.id ?? null,
        resignationDate: resignation,
        lastWorkingDate: lastWorking,
        reasonCategory: dto.reasonCategory ?? "RESIGNATION",
        reason: dto.reason ?? null,
        status: template && template.tasks.length > 0 ? "IN_PROGRESS" : "INITIATED",
        initiatedById: user.id,
        exitInterviewNotes: dto.exitInterviewNotes ?? null,
        equipmentReturnNotes: dto.equipmentReturnNotes ?? null,
        accessReviewNotes: dto.accessReviewNotes ?? null,
        tasks: template
          ? {
              create: template.tasks.map((task) => ({
                title: task.title,
                description: task.description,
                category: task.category,
                dueDate: addDays(lastWorking, task.dueOffsetDays),
                isRequired: task.isRequired,
                sortOrder: task.sortOrder,
              })),
            }
          : undefined,
      },
      include: offboardingInclude,
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "offboarding.created",
      entityType: "employee_offboarding",
      entityId: row.id,
      metadata: { employeeNumber: employee.employeeNumber },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toOffboardingDetail(
      row,
      await this.today(),
      user.permissions.includes(PERMISSIONS.OFFBOARDING_SENSITIVE_READ),
      await this.integrationNotes(row),
    );
  }

  async update(
    id: string,
    dto: UpdateOffboardingRecordDto,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ) {
    this.assertSensitiveInput(dto, user);
    const current = await this.findRow(id);
    await this.employees.assertEmployeeInScope(current.employeeId, user);
    if (current.status === "COMPLETED") {
      throw new ConflictException({
        code: "OFFBOARDING_COMPLETED",
        message: "A completed offboarding record cannot be edited",
      });
    }
    const resignation = dto.resignationDate ? dateKey(dto.resignationDate) : current.resignationDate;
    const lastWorking = dto.lastWorkingDate ? dateKey(dto.lastWorkingDate) : current.lastWorkingDate;
    if (lastWorking < resignation) {
      throw new BadRequestException({
        code: "OFFBOARDING_DATE_ORDER",
        message: "Last working date cannot be before the resignation date",
      });
    }
    const row = await this.prisma.employeeOffboarding.update({
      where: { id },
      data: {
        ...(dto.resignationDate !== undefined ? { resignationDate: resignation } : {}),
        ...(dto.lastWorkingDate !== undefined ? { lastWorkingDate: lastWorking } : {}),
        ...(dto.reasonCategory !== undefined ? { reasonCategory: dto.reasonCategory } : {}),
        ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.exitInterviewNotes !== undefined
          ? { exitInterviewNotes: dto.exitInterviewNotes }
          : {}),
        ...(dto.equipmentReturnNotes !== undefined
          ? { equipmentReturnNotes: dto.equipmentReturnNotes }
          : {}),
        ...(dto.accessReviewNotes !== undefined ? { accessReviewNotes: dto.accessReviewNotes } : {}),
      },
      include: offboardingInclude,
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "offboarding.updated",
      entityType: "employee_offboarding",
      entityId: id,
      metadata: { fields: Object.keys(dto) },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toOffboardingDetail(
      row,
      await this.today(),
      user.permissions.includes(PERMISSIONS.OFFBOARDING_SENSITIVE_READ),
      await this.integrationNotes(row),
    );
  }

  async complete(
    id: string,
    dto: CompleteOffboardingDto,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ) {
    const row = await this.findRow(id);
    await this.employees.assertEmployeeInScope(row.employeeId, user);
    if (row.status === "COMPLETED") {
      throw new ConflictException({
        code: "OFFBOARDING_COMPLETED",
        message: "This offboarding record is already completed",
      });
    }
    const incomplete = row.tasks.filter(
      (task) => task.isRequired && task.status !== "COMPLETED",
    );
    if (incomplete.length > 0) {
      throw new ConflictException({
        code: "OFFBOARDING_TASKS_INCOMPLETE",
        message: "All required offboarding tasks must be completed first",
        details: { taskIds: incomplete.map((task) => task.id) },
      });
    }
    await this.employees.update(
      row.employeeId,
      {
        employmentStatus: row.reasonCategory === "TERMINATION" ? "TERMINATED" : "RESIGNED",
        effectiveDate: isoDate(row.lastWorkingDate)!,
        changeReason: "Offboarding completed",
        notes: dto.comment ?? null,
      },
      { actorUserId: user.id, actorEmail: user.email, meta },
    );
    const updated = await this.prisma.employeeOffboarding.update({
      where: { id },
      data: { status: "COMPLETED", completedAt: new Date() },
      include: offboardingInclude,
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "offboarding.completed",
      entityType: "employee_offboarding",
      entityId: id,
      metadata: { employeeId: row.employeeId, lastWorkingDate: isoDate(row.lastWorkingDate) },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toOffboardingDetail(
      updated,
      await this.today(),
      user.permissions.includes(PERMISSIONS.OFFBOARDING_SENSITIVE_READ),
      await this.integrationNotes(updated),
    );
  }

  async updateTask(
    id: string,
    dto: UpdateOffboardingTaskDto,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ) {
    const task = await this.prisma.offboardingTask.findUnique({
      where: { id },
      include: { offboarding: true },
    });
    if (!task) {
      throw new NotFoundException({
        code: "OFFBOARDING_TASK_NOT_FOUND",
        message: "Offboarding task not found",
      });
    }
    await this.employees.assertEmployeeInScope(task.offboarding.employeeId, user);
    if (task.offboarding.status === "COMPLETED") {
      throw new ConflictException({
        code: "OFFBOARDING_COMPLETED",
        message: "A completed offboarding record cannot be edited",
      });
    }
    if (dto.assignedToId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.assignedToId },
        select: { id: true },
      });
      if (!assignee) {
        throw new BadRequestException({
          code: "OFFBOARDING_ASSIGNEE_NOT_FOUND",
          message: "The assigned user does not exist",
        });
      }
    }
    const status = dto.status ?? task.status;
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.offboardingTask.update({
        where: { id },
        data: {
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.assignedToId !== undefined ? { assignedToId: dto.assignedToId } : {}),
          ...(dto.dueDate !== undefined ? { dueDate: dto.dueDate ? dateKey(dto.dueDate) : null } : {}),
          completedAt: status === "COMPLETED" ? task.completedAt ?? new Date() : null,
        },
      });
      if (task.offboarding.status === "INITIATED") {
        await tx.employeeOffboarding.update({
          where: { id: task.offboardingId },
          data: { status: "IN_PROGRESS" },
        });
      }
      return next;
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "offboarding.task_updated",
      entityType: "offboarding_task",
      entityId: id,
      metadata: { status: updated.status, offboardingId: task.offboardingId },
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

  private assertSensitiveInput(
    dto: {
      exitInterviewNotes?: string | null;
      equipmentReturnNotes?: string | null;
      accessReviewNotes?: string | null;
    },
    user: AuthenticatedUser,
  ) {
    const hasSensitive = [dto.exitInterviewNotes, dto.equipmentReturnNotes, dto.accessReviewNotes]
      .some((value) => value !== undefined && value !== null && value !== "");
    if (hasSensitive && !user.permissions.includes(PERMISSIONS.OFFBOARDING_SENSITIVE_READ)) {
      throw new ForbiddenException({
        code: "OFFBOARDING_SENSITIVE_FORBIDDEN",
        message: "You do not have permission to edit sensitive offboarding notes",
      });
    }
  }

  private async integrationNotes(row: OffboardingRow): Promise<string[]> {
    const [attendanceAfter, periods, linkedUser] = await Promise.all([
      this.prisma.attendanceRecord.count({
        where: { employeeId: row.employeeId, workDate: { gt: row.lastWorkingDate } },
      }),
      this.prisma.payrollPeriod.count({
        where: {
          startDate: { lte: row.lastWorkingDate },
          endDate: { gte: row.lastWorkingDate },
        },
      }),
      this.prisma.employee.findUnique({
        where: { id: row.employeeId },
        select: { userId: true },
      }),
    ]);
    const notes: string[] = [];
    if (attendanceAfter > 0) {
      notes.push(
        `${attendanceAfter} attendance record(s) exist after the last working date; review them without rewriting history.`,
      );
    }
    if (periods > 0) {
      notes.push(
        "A payroll period overlaps the last working date. Payroll records are not modified automatically.",
      );
    }
    if (linkedUser?.userId) {
      notes.push(
        "This employee has a linked user account. Revoke access through user management; no account is deleted automatically.",
      );
    }
    return notes;
  }

  private async findTemplate(id: string) {
    const row = await this.prisma.offboardingTemplate.findUnique({
      where: { id },
      include: { tasks: { orderBy: { sortOrder: "asc" } } },
    });
    if (!row) {
      throw new NotFoundException({
        code: "OFFBOARDING_TEMPLATE_NOT_FOUND",
        message: "Offboarding template not found",
      });
    }
    return row;
  }

  private async findRow(id: string): Promise<OffboardingRow> {
    const row = await this.prisma.employeeOffboarding.findUnique({
      where: { id },
      include: offboardingInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: "OFFBOARDING_NOT_FOUND",
        message: "Offboarding record not found",
      });
    }
    return row;
  }
}
