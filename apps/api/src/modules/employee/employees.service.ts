import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import {
  PERMISSIONS,
  type EmployeeDetail,
  type EmployeeListItem,
  type EmploymentHistoryEntry,
  type PaginatedResponse,
} from "@peopleops/shared-types";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { toPageMeta } from "../../common/dto/page-query.dto";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
  employeeInclude,
  historyInclude,
  toEmployeeDetail,
  toEmployeeListItem,
  toHistoryEntry,
  type EmployeeRow,
} from "./employee.mapper";
import type {
  CreateEmployeeDto,
  DeactivateEmployeeDto,
  LinkEmployeeUserDto,
  ListEmployeesQueryDto,
  UpdateEmployeeProfileDto,
  UpdateSelfEmployeeDto,
} from "./dto/employee.dto";

export interface ActorContext {
  actorUserId: string;
  actorEmail: string;
  meta: RequestMeta;
}

export interface EmployeeScope {
  readAll: boolean;
  readTeam: boolean;
  employeeId: string | null;
}

const EMPLOYMENT_FIELDS = [
  "branchId",
  "departmentId",
  "positionId",
  "jobLevelId",
  "managerId",
  "employmentType",
  "employmentStatus",
] as const;

type EmploymentField = (typeof EMPLOYMENT_FIELDS)[number];

function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function clean(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    query: ListEmployeesQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<EmployeeListItem>> {
    const scope = await this.resolveScope(user);
    let idFilter: Prisma.EmployeeWhereInput = {};

    if (!scope.readAll) {
      idFilter = { id: { in: await this.scopedEmployeeIds(scope) } };
    }

    const where: Prisma.EmployeeWhereInput = {
      ...idFilter,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.positionId ? { positionId: query.positionId } : {}),
      ...(query.employmentStatus ? { employmentStatus: query.employmentStatus } : {}),
      ...(query.search
        ? {
            OR: [
              { employeeNumber: { contains: query.search, mode: "insensitive" } },
              { firstName: { contains: query.search, mode: "insensitive" } },
              { lastName: { contains: query.search, mode: "insensitive" } },
              { preferredName: { contains: query.search, mode: "insensitive" } },
              { personalEmail: { contains: query.search, mode: "insensitive" } },
              { workEmail: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const sortBy = query.sortBy ?? "name";
    const sortDir = query.sortDir ?? "asc";
    const orderBy: Prisma.EmployeeOrderByWithRelationInput[] =
      sortBy === "employeeNumber"
        ? [{ employeeNumber: sortDir }]
        : sortBy === "joinDate"
          ? [{ joinDate: sortDir }]
          : [{ lastName: sortDir }, { firstName: sortDir }];

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({
        where,
        include: employeeInclude,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const showPersonalEmail = scope.readAll;
    const meta = toPageMeta(query.page, query.pageSize, total);
    return {
      items: rows.map((row) => toEmployeeListItem(row, showPersonalEmail)),
      ...meta,
    };
  }

  async getById(id: string, user: AuthenticatedUser): Promise<EmployeeDetail> {
    const row = await this.findRow(id);
    const includePersonal = await this.canReadPersonal(row, user);
    return toEmployeeDetail(row, includePersonal);
  }

  async getSelf(user: AuthenticatedUser): Promise<EmployeeDetail> {
    const linked = await this.prisma.employee.findUnique({
      where: { userId: user.id },
      include: employeeInclude,
    });
    if (!linked) {
      throw new NotFoundException({
        code: "EMPLOYEE_NOT_LINKED",
        message: "No employee record is linked to this account",
      });
    }
    return toEmployeeDetail(linked, true);
  }

  async create(dto: CreateEmployeeDto, actor: ActorContext): Promise<EmployeeDetail> {
    const created = await this.prisma.$transaction(async (tx) => {
      const assignment = await this.resolveAssignment(tx, {
        branchId: dto.branchId ?? null,
        departmentId: dto.departmentId ?? null,
        positionId: dto.positionId ?? null,
        jobLevelId: dto.jobLevelId ?? null,
      });

      if (dto.managerId) {
        await this.assertManagerChain(tx, null, dto.managerId);
      }

      const employeeNumber =
        clean(dto.employeeNumber) ?? (await this.generateEmployeeNumber(tx));

      const employee = await tx.employee.create({
        data: {
          employeeNumber,
          firstName: dto.firstName.trim(),
          middleName: clean(dto.middleName) ?? null,
          lastName: dto.lastName.trim(),
          preferredName: clean(dto.preferredName) ?? null,
          gender: dto.gender ?? null,
          birthDate: toDate(dto.birthDate ?? null) ?? null,
          placeOfBirth: clean(dto.placeOfBirth) ?? null,
          maritalStatus: dto.maritalStatus ?? null,
          nationality: clean(dto.nationality) ?? null,
          personalEmail: dto.personalEmail.trim().toLowerCase(),
          phone: clean(dto.phone) ?? null,
          addressLine: clean(dto.addressLine) ?? null,
          city: clean(dto.city) ?? null,
          province: clean(dto.province) ?? null,
          postalCode: clean(dto.postalCode) ?? null,
          country: clean(dto.country) ?? "Indonesia",
          photoUrl: clean(dto.photoUrl) ?? null,
          workEmail: clean(dto.workEmail) ?? null,
          employmentType: dto.employmentType,
          employmentStatus: "ACTIVE",
          joinDate: toDate(dto.joinDate)!,
          probationEndDate: toDate(dto.probationEndDate ?? null) ?? null,
          contractStartDate: toDate(dto.contractStartDate ?? null) ?? null,
          contractEndDate: toDate(dto.contractEndDate ?? null) ?? null,
          branchId: assignment.branchId,
          departmentId: assignment.departmentId,
          positionId: assignment.positionId,
          jobLevelId: assignment.jobLevelId,
          managerId: dto.managerId ?? null,
        },
        include: employeeInclude,
      });

      await tx.employmentHistory.create({
        data: {
          employeeId: employee.id,
          effectiveFrom: employee.joinDate,
          effectiveTo: null,
          employmentType: employee.employmentType,
          employmentStatus: employee.employmentStatus,
          branchId: employee.branchId,
          departmentId: employee.departmentId,
          positionId: employee.positionId,
          jobLevelId: employee.jobLevelId,
          managerId: employee.managerId,
          changeReason: "Initial employment",
          createdById: actor.actorUserId,
        },
      });

      return employee;
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "employee.created",
      entityType: "employee",
      entityId: created.id,
      metadata: { employeeNumber: created.employeeNumber },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toEmployeeDetail(created, true);
  }

  async update(
    id: string,
    dto: UpdateEmployeeProfileDto,
    actor: ActorContext,
    selfOnly = false,
  ): Promise<EmployeeDetail> {
    const current = await this.findRow(id);

    if (selfOnly) {
      return this.updateSelf(id, dto, actor);
    }

    const {
      branchId,
      departmentId,
      positionId,
      jobLevelId,
      managerId,
      employmentType,
      employmentStatus,
      effectiveDate,
      changeReason,
      notes,
      ...profile
    } = dto;

    const employmentChanges: Partial<Record<EmploymentField, unknown>> = {
      branchId,
      departmentId,
      positionId,
      jobLevelId,
      managerId,
      employmentType,
      employmentStatus,
    };
    const changedFields = EMPLOYMENT_FIELDS.filter(
      (field) => employmentChanges[field] !== undefined,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.update({
        where: { id },
        data: this.profileUpdateData(profile),
      });

      if (changedFields.length === 0) {
        return tx.employee.findUniqueOrThrow({ where: { id }, include: employeeInclude });
      }

      const nextAssignment = await this.resolveAssignment(tx, {
        branchId: branchId !== undefined ? branchId : current.branchId,
        departmentId: departmentId !== undefined ? departmentId : current.departmentId,
        positionId: positionId !== undefined ? positionId : current.positionId,
        jobLevelId: jobLevelId !== undefined ? jobLevelId : current.jobLevelId,
      });

      const nextManagerId = managerId !== undefined ? managerId : current.managerId;
      if (nextManagerId && nextManagerId !== current.managerId) {
        await this.assertManagerChain(tx, id, nextManagerId);
      }

      const open = await tx.employmentHistory.findFirst({
        where: { employeeId: id, effectiveTo: null },
        orderBy: { effectiveFrom: "desc" },
      });
      const effective = toDate(effectiveDate) ?? todayUtc();

      if (open && effective <= open.effectiveFrom) {
        throw new BadRequestException({
          code: "EFFECTIVE_DATE_OVERLAP",
          message: "Effective date must be after the current employment record start date",
          details: { effectiveFrom: open.effectiveFrom.toISOString().slice(0, 10) },
        });
      }

      const assignments = {
        branchId: nextAssignment.branchId,
        departmentId: nextAssignment.departmentId,
        positionId: nextAssignment.positionId,
        jobLevelId: nextAssignment.jobLevelId,
        managerId: nextManagerId,
        employmentType: employmentType ?? employee.employmentType,
        employmentStatus: employmentStatus ?? employee.employmentStatus,
      };

      const assignmentChanged =
        changedFields.length > 0 &&
        EMPLOYMENT_FIELDS.some((field) => {
          const key = field as keyof typeof assignments;
          return assignments[key] !== current[key as keyof EmployeeRow];
        });

      if (!assignmentChanged) {
        return tx.employee.findUniqueOrThrow({ where: { id }, include: employeeInclude });
      }

      if (open) {
        await tx.employmentHistory.update({
          where: { id: open.id },
          data: { effectiveTo: addDays(effective, -1) },
        });
      }

      await tx.employee.update({ where: { id }, data: assignments });

      await tx.employmentHistory.create({
        data: {
          employeeId: id,
          effectiveFrom: effective,
          employmentType: assignments.employmentType,
          employmentStatus: assignments.employmentStatus,
          branchId: assignments.branchId,
          departmentId: assignments.departmentId,
          positionId: assignments.positionId,
          jobLevelId: assignments.jobLevelId,
          managerId: assignments.managerId,
          changeReason: clean(changeReason) ?? "Employment update",
          notes: clean(notes),
          createdById: actor.actorUserId,
        },
      });

      return tx.employee.findUniqueOrThrow({ where: { id }, include: employeeInclude });
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "employee.updated",
      entityType: "employee",
      entityId: id,
      metadata: { fields: changedFields.length > 0 ? changedFields : Object.keys(profile) },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toEmployeeDetail(updated, true);
  }

  /** Self-service: only contact details and display preferences are writable. */
  async updateSelf(
    id: string,
    dto: UpdateSelfEmployeeDto,
    actor: ActorContext,
  ): Promise<EmployeeDetail> {
    const data: Prisma.EmployeeUpdateInput = {};
    if (dto.phone !== undefined) data.phone = clean(dto.phone);
    if (dto.addressLine !== undefined) data.addressLine = clean(dto.addressLine);
    if (dto.city !== undefined) data.city = clean(dto.city);
    if (dto.province !== undefined) data.province = clean(dto.province);
    if (dto.postalCode !== undefined) data.postalCode = clean(dto.postalCode);
    if (dto.country !== undefined) data.country = clean(dto.country) ?? "Indonesia";
    if (dto.preferredName !== undefined) data.preferredName = clean(dto.preferredName);
    if (dto.photoUrl !== undefined) data.photoUrl = clean(dto.photoUrl);

    const updated = await this.prisma.employee.update({
      where: { id },
      data,
      include: employeeInclude,
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "employee.self_updated",
      entityType: "employee",
      entityId: id,
      metadata: { fields: Object.keys(dto) },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toEmployeeDetail(updated, true);
  }

  async deactivate(
    id: string,
    dto: DeactivateEmployeeDto,
    actor: ActorContext,
  ): Promise<EmployeeDetail> {
    return this.update(
      id,
      {
        employmentStatus: "INACTIVE",
        effectiveDate: dto.effectiveDate,
        changeReason: clean(dto.reason) ?? "Employee deactivated",
      },
      actor,
    ).then(async (detail) => {
      await this.audit.record({
        actorUserId: actor.actorUserId,
        actorEmail: actor.actorEmail,
        action: "employee.deactivated",
        entityType: "employee",
        entityId: id,
        metadata: { reason: dto.reason ?? null },
        ip: actor.meta.ip,
        userAgent: actor.meta.userAgent,
      });
      return detail;
    });
  }

  async history(id: string, user: AuthenticatedUser): Promise<EmploymentHistoryEntry[]> {
    const row = await this.findRow(id);
    await this.canReadPersonal(row, user);
    const rows = await this.prisma.employmentHistory.findMany({
      where: { employeeId: id },
      include: historyInclude,
      orderBy: { effectiveFrom: "desc" },
    });
    return rows.map(toHistoryEntry);
  }

  async linkUser(id: string, dto: LinkEmployeeUserDto, actor: ActorContext): Promise<EmployeeDetail> {
    const userId = dto.userId ?? null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findUnique({ where: { id } });
      if (!employee) {
        throw new NotFoundException({ code: "EMPLOYEE_NOT_FOUND", message: "Employee not found" });
      }

      if (userId) {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) {
          throw new NotFoundException({ code: "USER_NOT_FOUND", message: "User not found" });
        }
        const linked = await tx.employee.findUnique({ where: { userId } });
        if (linked && linked.id !== id) {
          throw new ConflictException({
            code: "USER_ALREADY_LINKED",
            message: "This account is already linked to another employee",
          });
        }
      }

      return tx.employee.update({
        where: { id },
        data: { userId },
        include: employeeInclude,
      });
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: userId ? "employee.user_linked" : "employee.user_unlinked",
      entityType: "employee",
      entityId: id,
      metadata: { userId },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toEmployeeDetail(updated, true);
  }

  async assertCanReadEmployee(id: string, user: AuthenticatedUser): Promise<void> {
    const row = await this.findRow(id);
    await this.canReadPersonal(row, user);
  }

  async assertEmployeeInScope(id: string, user: AuthenticatedUser): Promise<void> {
    const row = await this.findRow(id);
    const scope = await this.resolveScope(user);
    if (scope.readAll || row.id === scope.employeeId) return;
    if (scope.readTeam) {
      const ids = await this.scopedEmployeeIds(scope);
      if (ids.includes(id)) return;
    }
    throw new ForbiddenException({
      code: "EMPLOYEE_OUT_OF_SCOPE",
      message: "You can only access employees inside your reporting line",
    });
  }

  private async findRow(id: string): Promise<EmployeeRow> {
    const row = await this.prisma.employee.findUnique({ where: { id }, include: employeeInclude });
    if (!row) {
      throw new NotFoundException({ code: "EMPLOYEE_NOT_FOUND", message: "Employee not found" });
    }
    return row;
  }

  private async canReadPersonal(row: EmployeeRow, user: AuthenticatedUser): Promise<boolean> {
    const permissions = new Set(user.permissions);
    if (permissions.has(PERMISSIONS.EMPLOYEE_READ) || permissions.has(PERMISSIONS.EMPLOYEE_READ_SENSITIVE)) {
      return true;
    }
    if (row.userId === user.id && permissions.has(PERMISSIONS.EMPLOYEE_READ_SELF)) {
      return true;
    }
    if (permissions.has(PERMISSIONS.EMPLOYEE_READ_TEAM)) {
      const scope = await this.resolveScope(user);
      const ids = await this.scopedEmployeeIds(scope);
      if (ids.includes(row.id)) return false;
    }
    throw new ForbiddenException({
      code: "EMPLOYEE_OUT_OF_SCOPE",
      message: "You can only access employees inside your reporting line",
    });
  }

  private async resolveScope(user: AuthenticatedUser): Promise<EmployeeScope> {
    const permissions = new Set(user.permissions);
    const linked = await this.prisma.employee.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    return {
      readAll:
        permissions.has(PERMISSIONS.EMPLOYEE_READ) ||
        permissions.has(PERMISSIONS.EMPLOYEE_READ_SENSITIVE),
      readTeam: permissions.has(PERMISSIONS.EMPLOYEE_READ_TEAM),
      employeeId: linked?.id ?? null,
    };
  }

  /** Walks the reporting line level by level; a person is their own first member. */
  private async scopedEmployeeIds(scope: EmployeeScope): Promise<string[]> {
    if (!scope.employeeId) return [];

    const ids = new Set<string>([scope.employeeId]);
    let frontier = [scope.employeeId];

    while (frontier.length > 0) {
      const reports = await this.prisma.employee.findMany({
        where: { managerId: { in: frontier } },
        select: { id: true },
      });
      const next = reports.map((report) => report.id).filter((id) => !ids.has(id));
      next.forEach((id) => ids.add(id));
      frontier = next;
    }

    return [...ids];
  }

  private async resolveAssignment(
    tx: Prisma.TransactionClient,
    input: {
      branchId: string | null;
      departmentId: string | null;
      positionId: string | null;
      jobLevelId: string | null;
    },
  ): Promise<{
    branchId: string | null;
    departmentId: string | null;
    positionId: string | null;
    jobLevelId: string | null;
  }> {
    let departmentId = input.departmentId;
    let branchId = input.branchId;

    if (input.positionId) {
      const position = await tx.position.findUnique({
        where: { id: input.positionId },
        include: { department: { select: { id: true, branchId: true } } },
      });
      if (!position) {
        throw new BadRequestException({ code: "POSITION_NOT_FOUND", message: "Position not found" });
      }
      if (departmentId && position.departmentId && position.departmentId !== departmentId) {
        throw new BadRequestException({
          code: "POSITION_DEPARTMENT_MISMATCH",
          message: "The selected position does not belong to the selected department",
        });
      }
      if (!departmentId) {
        departmentId = position.departmentId;
        branchId = branchId ?? position.department?.branchId ?? null;
      }
    }

    if (departmentId) {
      const department = await tx.department.findUnique({
        where: { id: departmentId },
        select: { id: true, branchId: true },
      });
      if (!department) {
        throw new BadRequestException({
          code: "DEPARTMENT_NOT_FOUND",
          message: "Department not found",
        });
      }
      if (branchId && department.branchId && department.branchId !== branchId) {
        throw new BadRequestException({
          code: "DEPARTMENT_BRANCH_MISMATCH",
          message: "The selected department does not belong to the selected branch",
        });
      }
      branchId = branchId ?? department.branchId;
    }

    if (branchId) {
      const branch = await tx.branch.findUnique({ where: { id: branchId }, select: { id: true } });
      if (!branch) {
        throw new BadRequestException({ code: "BRANCH_NOT_FOUND", message: "Branch not found" });
      }
    }

    if (input.jobLevelId) {
      const jobLevel = await tx.jobLevel.findUnique({
        where: { id: input.jobLevelId },
        select: { id: true },
      });
      if (!jobLevel) {
        throw new BadRequestException({ code: "JOB_LEVEL_NOT_FOUND", message: "Job level not found" });
      }
    }

    return {
      branchId,
      departmentId,
      positionId: input.positionId,
      jobLevelId: input.jobLevelId,
    };
  }

  private async assertManagerChain(
    tx: Prisma.TransactionClient,
    employeeId: string | null,
    managerId: string,
  ): Promise<void> {
    if (employeeId && managerId === employeeId) {
      throw new BadRequestException({
        code: "MANAGER_CYCLE",
        message: "An employee cannot be their own manager",
      });
    }

    let cursor: string | null = managerId;
    const visited = new Set<string>();
    while (cursor) {
      if (employeeId && cursor === employeeId) {
        throw new BadRequestException({
          code: "MANAGER_CYCLE",
          message: "This manager assignment would create a reporting cycle",
        });
      }
      if (visited.has(cursor)) {
        throw new BadRequestException({
          code: "MANAGER_CYCLE",
          message: "The existing reporting line already contains a cycle",
        });
      }
      visited.add(cursor);
      const manager: { id: string; managerId: string | null } | null =
        await tx.employee.findUnique({
          where: { id: cursor },
          select: { id: true, managerId: true },
        });
      if (!manager) {
        throw new BadRequestException({ code: "MANAGER_NOT_FOUND", message: "Manager not found" });
      }
      cursor = manager.managerId;
    }
  }

  private async generateEmployeeNumber(tx: Prisma.TransactionClient): Promise<string> {
    const last = await tx.employee.findFirst({
      where: { employeeNumber: { startsWith: "EMP-" } },
      orderBy: { employeeNumber: "desc" },
      select: { employeeNumber: true },
    });
    const lastSequence = last ? Number.parseInt(last.employeeNumber.slice(4), 10) : 0;
    let sequence = Number.isFinite(lastSequence) ? lastSequence + 1 : 1;

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const candidate = `EMP-${String(sequence).padStart(4, "0")}`;
      const exists = await tx.employee.findUnique({
        where: { employeeNumber: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
      sequence += 1;
    }

    throw new ConflictException({
      code: "EMPLOYEE_NUMBER_GENERATION_FAILED",
      message: "Could not allocate an employee number",
    });
  }

  private profileUpdateData(
    profile: Omit<
      UpdateEmployeeProfileDto,
      EmploymentField | "effectiveDate" | "changeReason" | "notes"
    >,
  ): Prisma.EmployeeUpdateInput {
    const data: Prisma.EmployeeUpdateInput = {};
    if (profile.firstName !== undefined) data.firstName = profile.firstName.trim();
    if (profile.lastName !== undefined) data.lastName = profile.lastName.trim();
    if (profile.middleName !== undefined) data.middleName = clean(profile.middleName);
    if (profile.preferredName !== undefined) data.preferredName = clean(profile.preferredName);
    if (profile.gender !== undefined) data.gender = profile.gender;
    if (profile.birthDate !== undefined) data.birthDate = toDate(profile.birthDate);
    if (profile.placeOfBirth !== undefined) data.placeOfBirth = clean(profile.placeOfBirth);
    if (profile.maritalStatus !== undefined) data.maritalStatus = profile.maritalStatus;
    if (profile.nationality !== undefined) data.nationality = clean(profile.nationality);
    if (profile.personalEmail !== undefined)
      data.personalEmail = profile.personalEmail.trim().toLowerCase();
    if (profile.phone !== undefined) data.phone = clean(profile.phone);
    if (profile.addressLine !== undefined) data.addressLine = clean(profile.addressLine);
    if (profile.city !== undefined) data.city = clean(profile.city);
    if (profile.province !== undefined) data.province = clean(profile.province);
    if (profile.postalCode !== undefined) data.postalCode = clean(profile.postalCode);
    if (profile.country !== undefined)
      data.country = clean(profile.country) ?? "Indonesia";
    if (profile.photoUrl !== undefined) data.photoUrl = clean(profile.photoUrl);
    if (profile.workEmail !== undefined) data.workEmail = clean(profile.workEmail);
    if (profile.probationEndDate !== undefined)
      data.probationEndDate = toDate(profile.probationEndDate);
    if (profile.contractEndDate !== undefined)
      data.contractEndDate = toDate(profile.contractEndDate);
    return data;
  }
}
