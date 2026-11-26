import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import type {
  PaginatedResponse,
  PerformanceCycle,
  PerformanceGoal,
  PerformanceGoalDetail,
  PerformanceReview,
} from "@peopleops/shared-types";
import { PERMISSIONS } from "@peopleops/shared-types";
import Decimal from "decimal.js";
import { toPageMeta } from "../../common/dto/page-query.dto";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { EmployeesService } from "../employee/employees.service";
import { dateKey } from "../onboarding/onboarding.utils";
import type {
  AddGoalUpdateDto,
  CreatePerformanceCycleDto,
  CreatePerformanceGoalDto,
  CreatePerformanceReviewDto,
  ListPerformanceCyclesQueryDto,
  ListPerformanceGoalsQueryDto,
  ListPerformanceReviewsQueryDto,
  TransitionPerformanceCycleDto,
  UpdatePerformanceCycleDto,
  UpdatePerformanceGoalDto,
  UpdatePerformanceReviewDto,
} from "./dto/performance.dto";
import {
  performanceGoalInclude,
  performanceReviewInclude,
  toCycle,
  toGoal,
  toGoalDetail,
  toReview,
  type PerformanceGoalRow,
  type PerformanceReviewRow,
} from "./performance.mapper";

type ActorMeta = { ip: string | null; userAgent: string | null };

@Injectable()
export class PerformanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly employees: EmployeesService,
  ) {}

  async listCycles(
    query: ListPerformanceCyclesQueryDto,
  ): Promise<PaginatedResponse<PerformanceCycle>> {
    const where: Prisma.PerformanceCycleWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.performanceCycle.count({ where }),
      this.prisma.performanceCycle.findMany({
        where,
        include: { _count: { select: { goals: true, reviews: true } } },
        orderBy: { startDate: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toCycle), ...toPageMeta(query.page, query.pageSize, total) };
  }

  async getCycle(id: string): Promise<PerformanceCycle> {
    const row = await this.prisma.performanceCycle.findUnique({
      where: { id },
      include: { _count: { select: { goals: true, reviews: true } } },
    });
    if (!row) {
      throw new NotFoundException({
        code: "PERFORMANCE_CYCLE_NOT_FOUND",
        message: "Performance cycle not found",
      });
    }
    return toCycle(row);
  }

  async createCycle(
    dto: CreatePerformanceCycleDto,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ): Promise<PerformanceCycle> {
    this.validateCycleDates(dto);
    const row = await this.prisma.performanceCycle.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        startDate: dateKey(dto.startDate),
        endDate: dateKey(dto.endDate),
        reviewStartDate: dateKey(dto.reviewStartDate),
        reviewEndDate: dateKey(dto.reviewEndDate),
        createdById: user.id,
      },
      include: { _count: { select: { goals: true, reviews: true } } },
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "performance.cycle_created",
      entityType: "performance_cycle",
      entityId: row.id,
      metadata: { name: row.name },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toCycle(row);
  }

  async updateCycle(
    id: string,
    dto: UpdatePerformanceCycleDto,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ): Promise<PerformanceCycle> {
    const current = await this.getCycleRow(id);
    if (current.status !== "DRAFT") {
      throw new ConflictException({
        code: "PERFORMANCE_CYCLE_LOCKED",
        message: "Only draft cycles can be edited",
      });
    }
    const dates = {
      startDate: dto.startDate ?? current.startDate.toISOString().slice(0, 10),
      endDate: dto.endDate ?? current.endDate.toISOString().slice(0, 10),
      reviewStartDate:
        dto.reviewStartDate ?? current.reviewStartDate.toISOString().slice(0, 10),
      reviewEndDate: dto.reviewEndDate ?? current.reviewEndDate.toISOString().slice(0, 10),
    };
    this.validateCycleDates(dates);
    const row = await this.prisma.performanceCycle.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        startDate: dateKey(dates.startDate),
        endDate: dateKey(dates.endDate),
        reviewStartDate: dateKey(dates.reviewStartDate),
        reviewEndDate: dateKey(dates.reviewEndDate),
      },
      include: { _count: { select: { goals: true, reviews: true } } },
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "performance.cycle_updated",
      entityType: "performance_cycle",
      entityId: id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toCycle(row);
  }

  async transitionCycle(
    id: string,
    dto: TransitionPerformanceCycleDto,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ): Promise<PerformanceCycle> {
    const current = await this.getCycleRow(id);
    const allowed: Record<string, string[]> = {
      ACTIVE: ["DRAFT"],
      REVIEW_IN_PROGRESS: ["ACTIVE"],
      COMPLETED: ["REVIEW_IN_PROGRESS"],
      CANCELLED: ["DRAFT", "ACTIVE", "REVIEW_IN_PROGRESS"],
    };
    if (!allowed[dto.status]?.includes(current.status)) {
      throw new ConflictException({
        code: "PERFORMANCE_CYCLE_TRANSITION",
        message: `Cannot move a ${current.status} cycle to ${dto.status}`,
      });
    }
    const row = await this.prisma.performanceCycle.update({
      where: { id },
      data: { status: dto.status },
      include: { _count: { select: { goals: true, reviews: true } } },
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "performance.cycle_transitioned",
      entityType: "performance_cycle",
      entityId: id,
      metadata: { from: current.status, to: dto.status, comment: dto.comment ?? null },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toCycle(row);
  }

  async listGoals(
    query: ListPerformanceGoalsQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<PerformanceGoal>> {
    const employeeIds = await this.goalScope(user);
    const where: Prisma.PerformanceGoalWhereInput = {
      ...(query.cycleId ? { cycleId: query.cycleId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(employeeIds === "all" ? {} : { employeeId: { in: employeeIds } }),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.performanceGoal.count({ where }),
      this.prisma.performanceGoal.findMany({
        where,
        include: performanceGoalInclude,
        orderBy: [{ createdAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: rows.map(toGoal),
      ...toPageMeta(query.page, query.pageSize, total),
    };
  }

  async getGoal(id: string, user: AuthenticatedUser): Promise<PerformanceGoalDetail> {
    const row = await this.findGoal(id);
    await this.assertGoalReadable(row, user);
    return toGoalDetail(row);
  }

  async createGoal(
    dto: CreatePerformanceGoalDto,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ): Promise<PerformanceGoal> {
    await this.assertGoalWritable(dto.employeeId, user);
    const cycle = await this.getCycleRow(dto.cycleId);
    if (cycle.status === "COMPLETED" || cycle.status === "CANCELLED") {
      throw new ConflictException({
        code: "PERFORMANCE_CYCLE_LOCKED",
        message: "Goals cannot be added to a completed or cancelled cycle",
      });
    }
    const weight = new Decimal(dto.weight);
    if (weight.lte(0) || weight.gt(100)) {
      throw new BadRequestException({
        code: "PERFORMANCE_GOAL_WEIGHT",
        message: "Goal weight must be greater than 0 and at most 100",
      });
    }
    await this.assertWeightTotal(dto.employeeId, dto.cycleId, weight);
    const row = await this.prisma.performanceGoal.create({
      data: {
        employeeId: dto.employeeId,
        cycleId: dto.cycleId,
        title: dto.title,
        description: dto.description ?? null,
        category: dto.category ?? "OTHER",
        measurementType: dto.measurementType ?? "QUALITATIVE",
        targetValue: dto.targetValue ?? null,
        currentValue: dto.currentValue ?? null,
        weight: weight.toFixed(2),
        status: dto.status ?? "DRAFT",
        createdById: user.id,
      },
      include: performanceGoalInclude,
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "performance.goal_created",
      entityType: "performance_goal",
      entityId: row.id,
      metadata: { employeeId: dto.employeeId, cycleId: dto.cycleId },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toGoal(row);
  }

  async updateGoal(
    id: string,
    dto: UpdatePerformanceGoalDto,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ): Promise<PerformanceGoal> {
    const current = await this.findGoal(id);
    await this.assertGoalWritable(current.employeeId, user);
    if (current.status === "CANCELLED") {
      throw new ConflictException({
        code: "PERFORMANCE_GOAL_CANCELLED",
        message: "A cancelled goal cannot be edited",
      });
    }
    if (dto.weight !== undefined) {
      const weight = new Decimal(dto.weight);
      if (weight.lte(0) || weight.gt(100)) {
        throw new BadRequestException({
          code: "PERFORMANCE_GOAL_WEIGHT",
          message: "Goal weight must be greater than 0 and at most 100",
        });
      }
      await this.assertWeightTotal(current.employeeId, current.cycleId, weight, id);
    }
    const row = await this.prisma.performanceGoal.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.measurementType !== undefined ? { measurementType: dto.measurementType } : {}),
        ...(dto.targetValue !== undefined ? { targetValue: dto.targetValue } : {}),
        ...(dto.currentValue !== undefined ? { currentValue: dto.currentValue } : {}),
        ...(dto.weight !== undefined ? { weight: new Decimal(dto.weight).toFixed(2) } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: performanceGoalInclude,
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "performance.goal_updated",
      entityType: "performance_goal",
      entityId: id,
      metadata: { fields: Object.keys(dto) },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toGoal(row);
  }

  async addGoalUpdate(
    id: string,
    dto: AddGoalUpdateDto,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ) {
    const goal = await this.findGoal(id);
    await this.assertGoalWritable(goal.employeeId, user);
    const row = await this.prisma.$transaction(async (tx) => {
      const update = await tx.performanceGoalUpdate.create({
        data: {
          goalId: id,
          previousValue: goal.currentValue,
          newValue: dto.newValue ?? null,
          comment: dto.comment ?? null,
          updatedById: user.id,
        },
      });
      if (dto.newValue !== undefined) {
        await tx.performanceGoal.update({
          where: { id },
          data: { currentValue: dto.newValue },
        });
      }
      return update;
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "performance.goal_progress_updated",
      entityType: "performance_goal",
      entityId: id,
      metadata: { newValue: dto.newValue ?? null },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return {
      id: row.id,
      previousValue: row.previousValue?.toFixed(2) ?? null,
      newValue: row.newValue?.toFixed(2) ?? null,
      comment: row.comment,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async listReviews(
    query: ListPerformanceReviewsQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<PerformanceReview>> {
    const scope = await this.reviewScope(user);
    const where: Prisma.PerformanceReviewWhereInput = {
      ...(query.cycleId ? { cycleId: query.cycleId } : {}),
      ...(query.reviewType ? { reviewType: query.reviewType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(scope === "all" ? {} : { employeeId: { in: scope } }),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.performanceReview.count({ where }),
      this.prisma.performanceReview.findMany({
        where,
        include: performanceReviewInclude,
        orderBy: [{ createdAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    const internal = user.permissions.includes(PERMISSIONS.PERFORMANCE_REVIEWS_INTERNAL_NOTES_READ);
    return {
      items: rows.map((row) => toReview(row, internal)),
      ...toPageMeta(query.page, query.pageSize, total),
    };
  }

  async getReview(id: string, user: AuthenticatedUser): Promise<PerformanceReview> {
    const row = await this.findReview(id);
    await this.assertReviewReadable(row.employeeId, user);
    return toReview(
      row,
      user.permissions.includes(PERMISSIONS.PERFORMANCE_REVIEWS_INTERNAL_NOTES_READ),
    );
  }

  async createReview(
    dto: CreatePerformanceReviewDto,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ): Promise<PerformanceReview> {
    await this.assertReviewWritable(dto.employeeId, dto.reviewType, user);
    this.assertInternalNotes(dto.internalNotes, user);
    const cycle = await this.getCycleRow(dto.cycleId);
    if (cycle.status !== "REVIEW_IN_PROGRESS") {
      throw new ConflictException({
        code: "PERFORMANCE_REVIEW_WINDOW",
        message: "Reviews can only be created while the cycle is in review",
      });
    }
    if (dto.overallRating !== undefined && dto.overallRating !== null) {
      this.assertRating(dto.overallRating);
    }
    const existing = await this.prisma.performanceReview.findUnique({
      where: {
        cycleId_employeeId_reviewType: {
          cycleId: dto.cycleId,
          employeeId: dto.employeeId,
          reviewType: dto.reviewType,
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: "PERFORMANCE_REVIEW_EXISTS",
        message: "This review already exists for the employee and cycle",
      });
    }
    const items = dto.items ?? [];
    await this.validateReviewItems(dto.cycleId, dto.employeeId, items);
    const row = await this.prisma.performanceReview.create({
      data: {
        cycleId: dto.cycleId,
        employeeId: dto.employeeId,
        reviewerId: dto.reviewerId ?? user.id,
        reviewType: dto.reviewType,
        overallRating: dto.overallRating ?? null,
        summary: dto.summary ?? null,
        internalNotes: dto.internalNotes ?? null,
        createdById: user.id,
        items: { create: items },
      },
      include: performanceReviewInclude,
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "performance.review_created",
      entityType: "performance_review",
      entityId: row.id,
      metadata: { employeeId: dto.employeeId, type: dto.reviewType },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toReview(
      row,
      user.permissions.includes(PERMISSIONS.PERFORMANCE_REVIEWS_INTERNAL_NOTES_READ),
    );
  }

  async updateReview(
    id: string,
    dto: UpdatePerformanceReviewDto,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ): Promise<PerformanceReview> {
    const current = await this.findReview(id);
    await this.assertReviewWritable(current.employeeId, current.reviewType, user);
    this.assertInternalNotes(dto.internalNotes, user);
    if (current.status !== "DRAFT") {
      throw new ConflictException({
        code: "PERFORMANCE_REVIEW_SUBMITTED",
        message: "A submitted review cannot be edited",
      });
    }
    if (dto.overallRating !== undefined && dto.overallRating !== null) {
      this.assertRating(dto.overallRating);
    }
    if (dto.items) {
      await this.validateReviewItems(current.cycleId, current.employeeId, dto.items);
    }
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.performanceReviewItem.deleteMany({ where: { reviewId: id } });
      }
      return tx.performanceReview.update({
        where: { id },
        data: {
          ...(dto.overallRating !== undefined ? { overallRating: dto.overallRating } : {}),
          ...(dto.summary !== undefined ? { summary: dto.summary } : {}),
          ...(dto.internalNotes !== undefined ? { internalNotes: dto.internalNotes } : {}),
          ...(dto.items ? { items: { create: dto.items } } : {}),
        },
        include: performanceReviewInclude,
      });
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "performance.review_updated",
      entityType: "performance_review",
      entityId: id,
      metadata: { fields: Object.keys(dto) },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toReview(
      row,
      user.permissions.includes(PERMISSIONS.PERFORMANCE_REVIEWS_INTERNAL_NOTES_READ),
    );
  }

  async submitReview(
    id: string,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ): Promise<PerformanceReview> {
    const current = await this.findReview(id);
    await this.assertReviewWritable(current.employeeId, current.reviewType, user);
    if (current.status !== "DRAFT") {
      throw new ConflictException({
        code: "PERFORMANCE_REVIEW_SUBMITTED",
        message: "Only a draft review can be submitted",
      });
    }
    await this.assertReviewWeights(current.employeeId, current.cycleId);
    const row = await this.prisma.performanceReview.update({
      where: { id },
      data: { status: "SUBMITTED", submittedAt: new Date() },
      include: performanceReviewInclude,
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "performance.review_submitted",
      entityType: "performance_review",
      entityId: id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toReview(
      row,
      user.permissions.includes(PERMISSIONS.PERFORMANCE_REVIEWS_INTERNAL_NOTES_READ),
    );
  }

  async completeReview(
    id: string,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ): Promise<PerformanceReview> {
    const current = await this.findReview(id);
    if (current.status !== "SUBMITTED") {
      throw new ConflictException({
        code: "PERFORMANCE_REVIEW_TRANSITION",
        message: "Only a submitted review can be completed",
      });
    }
    const row = await this.prisma.performanceReview.update({
      where: { id },
      data: { status: "COMPLETED", completedAt: new Date() },
      include: performanceReviewInclude,
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "performance.review_completed",
      entityType: "performance_review",
      entityId: id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toReview(
      row,
      user.permissions.includes(PERMISSIONS.PERFORMANCE_REVIEWS_INTERNAL_NOTES_READ),
    );
  }

  private validateCycleDates(dto: {
    startDate: string;
    endDate: string;
    reviewStartDate: string;
    reviewEndDate: string;
  }) {
    if (dto.startDate > dto.endDate) {
      throw new BadRequestException({
        code: "PERFORMANCE_CYCLE_DATE_ORDER",
        message: "Cycle start date must not be after the end date",
      });
    }
    if (dto.reviewStartDate > dto.reviewEndDate) {
      throw new BadRequestException({
        code: "PERFORMANCE_REVIEW_DATE_ORDER",
        message: "Review start date must not be after the review end date",
      });
    }
    if (dto.reviewStartDate < dto.startDate || dto.reviewEndDate > dto.endDate) {
      throw new BadRequestException({
        code: "PERFORMANCE_REVIEW_WINDOW",
        message: "The review window must fall inside the cycle dates",
      });
    }
  }

  private assertRating(value: string) {
    const rating = new Decimal(value);
    if (rating.lt(0) || rating.gt(5)) {
      throw new BadRequestException({
        code: "PERFORMANCE_RATING_RANGE",
        message: "Overall rating must be between 0 and 5",
      });
    }
  }

  private assertInternalNotes(value: string | null | undefined, user: AuthenticatedUser) {
    if (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      !user.permissions.includes(PERMISSIONS.PERFORMANCE_REVIEWS_INTERNAL_NOTES_READ)
    ) {
      throw new ForbiddenException({
        code: "PERFORMANCE_INTERNAL_NOTES_FORBIDDEN",
        message: "You do not have permission to edit internal review notes",
      });
    }
  }

  private async assertWeightTotal(
    employeeId: string,
    cycleId: string,
    weight: Decimal,
    excludeId?: string,
  ) {
    const rows = await this.prisma.performanceGoal.findMany({
      where: {
        employeeId,
        cycleId,
        status: { notIn: ["CANCELLED"] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { weight: true },
    });
    const total = rows.reduce((sum, row) => sum.plus(row.weight), new Decimal(0)).plus(weight);
    if (total.gt(100)) {
      throw new ConflictException({
        code: "PERFORMANCE_GOAL_WEIGHT_TOTAL",
        message: "Active goal weights cannot exceed 100 for an employee and cycle",
        details: { total: total.toFixed(2) },
      });
    }
  }

  private async assertReviewWeights(employeeId: string, cycleId: string) {
    const rows = await this.prisma.performanceGoal.findMany({
      where: { employeeId, cycleId, status: { notIn: ["CANCELLED", "DRAFT"] } },
      select: { weight: true },
    });
    if (rows.length === 0) return;
    const total = rows.reduce((sum, row) => sum.plus(row.weight), new Decimal(0));
    if (!total.eq(100)) {
      throw new ConflictException({
        code: "PERFORMANCE_GOAL_WEIGHT_TOTAL",
        message: "Active goal weights must total 100 before submitting a review",
        details: { total: total.toFixed(2) },
      });
    }
  }

  private async validateReviewItems(
    cycleId: string,
    employeeId: string,
    items: { goalId?: string | null; rating?: string | null }[],
  ) {
    const goalIds = items.map((item) => item.goalId).filter((id): id is string => Boolean(id));
    if (goalIds.length !== new Set(goalIds).size) {
      throw new BadRequestException({
        code: "PERFORMANCE_REVIEW_DUPLICATE_GOAL",
        message: "A goal can only appear once in a review",
      });
    }
    if (goalIds.length > 0) {
      const goals = await this.prisma.performanceGoal.findMany({
        where: { id: { in: goalIds }, cycleId, employeeId },
        select: { id: true },
      });
      if (goals.length !== goalIds.length) {
        throw new BadRequestException({
          code: "PERFORMANCE_REVIEW_GOAL_SCOPE",
          message: "Review items must reference goals from the same employee and cycle",
        });
      }
    }
    for (const item of items) {
      if (item.rating !== undefined && item.rating !== null) this.assertRating(item.rating);
    }
  }

  private async goalScope(user: AuthenticatedUser): Promise<"all" | string[]> {
    if (user.permissions.includes(PERMISSIONS.PERFORMANCE_REVIEWS_READ_ALL)) return "all";
    const scope = await this.employees.resolveScope(user);
    if (scope.readAll) return "all";
    if (scope.readTeam && scope.employeeId) return this.employees.scopedEmployeeIds(scope);
    return scope.employeeId ? [scope.employeeId] : [];
  }

  private async reviewScope(user: AuthenticatedUser): Promise<"all" | string[]> {
    if (user.permissions.includes(PERMISSIONS.PERFORMANCE_REVIEWS_READ_ALL)) return "all";
    if (user.permissions.includes(PERMISSIONS.PERFORMANCE_REVIEWS_READ_TEAM)) {
      const scope = await this.employees.resolveScope(user);
      return scope.employeeId ? this.employees.scopedEmployeeIds(scope) : [];
    }
    const scope = await this.employees.resolveScope(user);
    return scope.employeeId ? [scope.employeeId] : [];
  }

  private async assertGoalReadable(row: PerformanceGoalRow, user: AuthenticatedUser) {
    const scope = await this.goalScope(user);
    if (scope === "all" || scope.includes(row.employeeId)) return;
    throw new ForbiddenException({
      code: "PERFORMANCE_GOAL_FORBIDDEN",
      message: "You can only access goals inside your performance scope",
    });
  }

  private async assertGoalWritable(employeeId: string, user: AuthenticatedUser) {
    if (user.permissions.includes(PERMISSIONS.PERFORMANCE_CYCLES_MANAGE)) return;
    const scope = await this.employees.resolveScope(user);
    if (scope.readTeam && scope.employeeId) {
      const ids = await this.employees.scopedEmployeeIds(scope);
      if (ids.includes(employeeId)) return;
    }
    throw new ForbiddenException({
      code: "PERFORMANCE_GOAL_FORBIDDEN",
      message: "You can only manage goals inside your reporting line",
    });
  }

  private async assertReviewReadable(employeeId: string, user: AuthenticatedUser) {
    const scope = await this.reviewScope(user);
    if (scope === "all" || scope.includes(employeeId)) return;
    throw new ForbiddenException({
      code: "PERFORMANCE_REVIEW_FORBIDDEN",
      message: "You can only access reviews inside your performance scope",
    });
  }

  private async assertReviewWritable(
    employeeId: string,
    reviewType: string,
    user: AuthenticatedUser,
  ) {
    if (reviewType === "SELF_REVIEW") {
      const scope = await this.employees.resolveScope(user);
      if (scope.employeeId === employeeId) return;
    } else if (reviewType === "MANAGER_REVIEW") {
      const scope = await this.employees.resolveScope(user);
      if (scope.readTeam && scope.employeeId) {
        const ids = await this.employees.scopedEmployeeIds(scope);
        if (ids.includes(employeeId)) return;
      }
    } else if (user.permissions.includes(PERMISSIONS.PERFORMANCE_REVIEWS_MANAGE)) {
      return;
    }
    throw new ForbiddenException({
      code: "PERFORMANCE_REVIEW_FORBIDDEN",
      message: "You cannot write this review",
    });
  }

  private async getCycleRow(id: string) {
    const row = await this.prisma.performanceCycle.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({
        code: "PERFORMANCE_CYCLE_NOT_FOUND",
        message: "Performance cycle not found",
      });
    }
    return row;
  }

  private async findGoal(id: string): Promise<PerformanceGoalRow> {
    const row = await this.prisma.performanceGoal.findUnique({
      where: { id },
      include: performanceGoalInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: "PERFORMANCE_GOAL_NOT_FOUND",
        message: "Performance goal not found",
      });
    }
    return row;
  }

  private async findReview(id: string): Promise<PerformanceReviewRow> {
    const row = await this.prisma.performanceReview.findUnique({
      where: { id },
      include: performanceReviewInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: "PERFORMANCE_REVIEW_NOT_FOUND",
        message: "Performance review not found",
      });
    }
    return row;
  }
}
