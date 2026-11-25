import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import { PERMISSIONS, type PaginatedResponse, type PayrollDashboard, type PayrollRun, type PayrollRunDetail } from "@peopleops/shared-types";
import { toPageMeta } from "../../common/dto/page-query.dto";
import { dateKeyOf } from "../../common/time/zoned-time";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type {
  CancelPayrollRunDto,
  CreatePayrollRunDto,
  ListPayrollRunsQueryDto,
  PayrollRunCommentDto,
} from "./dto/payroll.dto";
import { PayrollCalculationService } from "./payroll-calculation.service";
import { payrollRunInclude, toPayrollRun, toPayrollRunDetail, type PayrollRunRow } from "./payroll.mapper";
import { PayrollSettingsService } from "./payroll-settings.service";
import type { PayrollActor } from "./payroll.utils";

@Injectable()
export class PayrollRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly calculation: PayrollCalculationService,
    private readonly settings: PayrollSettingsService,
  ) {}

  async list(query: ListPayrollRunsQueryDto): Promise<PaginatedResponse<PayrollRun>> {
    const where: Prisma.PayrollRunWhereInput = {
      ...(query.periodId ? { periodId: query.periodId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.payrollRun.count({ where }),
      this.prisma.payrollRun.findMany({
        where,
        include: payrollRunInclude,
        orderBy: [{ createdAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toPayrollRun), ...toPageMeta(query.page, query.pageSize, total) };
  }

  async getById(id: string): Promise<PayrollRunDetail> {
    return toPayrollRunDetail(await this.findRow(id));
  }

  async create(dto: CreatePayrollRunDto, actor: PayrollActor): Promise<PayrollRunDetail> {
    const period = await this.prisma.payrollPeriod.findUnique({ where: { id: dto.periodId } });
    if (!period) {
      throw new BadRequestException({
        code: "PAYROLL_PERIOD_NOT_FOUND",
        message: "The selected payroll period does not exist",
      });
    }
    if (period.status === "CLOSED") {
      throw new BadRequestException({
        code: "PAYROLL_PERIOD_CLOSED",
        message: "A closed payroll period cannot start a new run",
      });
    }
    const active = await this.prisma.payrollRun.findFirst({
      where: { periodId: dto.periodId, status: { not: "CANCELLED" } },
      select: { id: true },
    });
    if (active) {
      throw new ConflictException({
        code: "PAYROLL_RUN_EXISTS",
        message: "This period already has an active payroll run",
      });
    }
    const max = await this.prisma.payrollRun.aggregate({
      where: { periodId: dto.periodId },
      _max: { runNumber: true },
    });
    const settings = await this.settings.ensureRow();
    const company = await this.prisma.company.findFirst({ select: { currency: true } });
    const row = await this.prisma.payrollRun.create({
      data: {
        periodId: dto.periodId,
        runNumber: (max._max.runNumber ?? 0) + 1,
        status: "DRAFT",
        currency: company?.currency ?? "IDR",
        standardMonthlyHours: settings.standardMonthlyHours,
        standardMonthlyDays: settings.standardMonthlyDays,
        roundingMode: settings.roundingMode,
        currencyScale: settings.currencyScale,
        createdById: actor.actorUserId,
      },
      include: payrollRunInclude,
    });
    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "payroll.run_created",
      entityType: "payroll_run",
      entityId: row.id,
      metadata: { periodId: row.periodId, runNumber: row.runNumber },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return toPayrollRunDetail(row);
  }

  async calculate(id: string, user: AuthenticatedUser): Promise<PayrollRunDetail> {
    await this.findRow(id);
    await this.calculation.calculate(id);
    const row = await this.findRow(id);
    await this.prisma.payrollRunApproval.create({
      data: {
        runId: id,
        action: "RECALCULATE",
        actorUserId: user.id,
        actorName: user.name,
        comment: "Payroll calculation executed",
      },
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "payroll.run_calculated",
      entityType: "payroll_run",
      entityId: id,
      metadata: { calculationVersion: row.calculationVersion, employeeCount: row._count.payslips },
    });
    return toPayrollRunDetail(row);
  }

  async submitReview(
    id: string,
    dto: PayrollRunCommentDto,
    user: AuthenticatedUser,
  ): Promise<PayrollRunDetail> {
    const row = await this.findRow(id);
    if (row.status !== "CALCULATED") {
      throw new ConflictException({
        code: "PAYROLL_RUN_NOT_CALCULATED",
        message: "Only calculated runs can be submitted for review",
      });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.payrollRun.updateMany({
        where: { id, status: "CALCULATED" },
        data: { status: "UNDER_REVIEW", reviewedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new ConflictException({
          code: "PAYROLL_RUN_ALREADY_MOVED",
          message: "The payroll run changed; reload and try again",
        });
      }
      await tx.payrollRunApproval.create({
        data: {
          runId: id,
          action: "SUBMIT_REVIEW",
          actorUserId: user.id,
          actorName: user.name,
          comment: dto.comment?.trim() ?? null,
        },
      });
      return tx.payrollRun.findUniqueOrThrow({ where: { id }, include: payrollRunInclude });
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "payroll.run_submitted_review",
      entityType: "payroll_run",
      entityId: id,
    });
    return toPayrollRunDetail(updated);
  }

  async approve(
    id: string,
    dto: PayrollRunCommentDto,
    user: AuthenticatedUser,
  ): Promise<PayrollRunDetail> {
    const row = await this.findRow(id);
    if (row.status !== "UNDER_REVIEW") {
      throw new ConflictException({
        code: "PAYROLL_RUN_NOT_REVIEWED",
        message: "Only runs under review can be approved",
      });
    }
    if (row.createdById === user.id && !user.permissions.includes(PERMISSIONS.PAYROLL_RUNS_OVERRIDE)) {
      throw new ForbiddenException({
        code: "PAYROLL_RUN_CREATOR_APPROVAL",
        message: "The creator cannot approve their own payroll run without override permission",
      });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.payrollRun.updateMany({
        where: { id, status: "UNDER_REVIEW" },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
          approvedById: user.id,
        },
      });
      if (claimed.count === 0) {
        throw new ConflictException({
          code: "PAYROLL_RUN_ALREADY_MOVED",
          message: "The payroll run changed; reload and try again",
        });
      }
      await tx.payrollRunApproval.create({
        data: {
          runId: id,
          action: "APPROVE",
          actorUserId: user.id,
          actorName: user.name,
          comment: dto.comment?.trim() ?? null,
        },
      });
      return tx.payrollRun.findUniqueOrThrow({ where: { id }, include: payrollRunInclude });
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "payroll.run_approved",
      entityType: "payroll_run",
      entityId: id,
    });
    return toPayrollRunDetail(updated);
  }

  async publish(
    id: string,
    dto: PayrollRunCommentDto,
    user: AuthenticatedUser,
  ): Promise<PayrollRunDetail> {
    const row = await this.findRow(id);
    if (row.status !== "APPROVED") {
      throw new ConflictException({
        code: "PAYROLL_RUN_NOT_APPROVED",
        message: "Only approved runs can be published",
      });
    }
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.payrollRun.updateMany({
        where: { id, status: "APPROVED" },
        data: { status: "PUBLISHED", publishedAt: now, publishedById: user.id },
      });
      if (claimed.count === 0) {
        throw new ConflictException({
          code: "PAYROLL_RUN_ALREADY_MOVED",
          message: "The payroll run changed; reload and try again",
        });
      }
      await tx.payrollPayslip.updateMany({
        where: { runId: id, publishedAt: null },
        data: { publishedAt: now },
      });
      await tx.payrollRunApproval.create({
        data: {
          runId: id,
          action: "PUBLISH",
          actorUserId: user.id,
          actorName: user.name,
          comment: dto.comment?.trim() ?? null,
        },
      });
      return tx.payrollRun.findUniqueOrThrow({ where: { id }, include: payrollRunInclude });
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "payroll.run_published",
      entityType: "payroll_run",
      entityId: id,
    });
    return toPayrollRunDetail(updated);
  }

  async cancel(
    id: string,
    dto: CancelPayrollRunDto,
    user: AuthenticatedUser,
  ): Promise<PayrollRunDetail> {
    const row = await this.findRow(id);
    if (row.status === "CANCELLED") {
      throw new ConflictException({
        code: "PAYROLL_RUN_ALREADY_CANCELLED",
        message: "This payroll run is already cancelled",
      });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.payrollRun.updateMany({
        where: { id, status: row.status },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: dto.reason.trim(),
        },
      });
      if (claimed.count === 0) {
        throw new ConflictException({
          code: "PAYROLL_RUN_ALREADY_MOVED",
          message: "The payroll run changed; reload and try again",
        });
      }
      await tx.payrollRunApproval.create({
        data: {
          runId: id,
          action: "CANCEL",
          actorUserId: user.id,
          actorName: user.name,
          comment: dto.reason.trim(),
        },
      });
      return tx.payrollRun.findUniqueOrThrow({ where: { id }, include: payrollRunInclude });
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "payroll.run_cancelled",
      entityType: "payroll_run",
      entityId: id,
      metadata: { reason: dto.reason, previousStatus: row.status },
    });
    return toPayrollRunDetail(updated);
  }

  async dashboard(): Promise<PayrollDashboard> {
    const company = await this.prisma.company.findFirst({ select: { timezone: true } });
    const today = dateKeyOf(new Date(), company?.timezone ?? "Asia/Jakarta");
    const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00.000Z`);
    const [openPeriods, activeRuns, pendingAdjustments, publishedRuns, publishedTotals, recent] =
      await Promise.all([
        this.prisma.payrollPeriod.count({ where: { status: "OPEN" } }),
        this.prisma.payrollRun.count({ where: { status: { notIn: ["CANCELLED", "PUBLISHED", "LOCKED"] } } }),
        this.prisma.payrollAdjustment.count({ where: { status: "PENDING" } }),
        this.prisma.payrollRun.count({
          where: { status: { in: ["PUBLISHED", "LOCKED"] }, publishedAt: { gte: monthStart } },
        }),
        this.prisma.payrollRun.aggregate({
          where: { status: { in: ["PUBLISHED", "LOCKED"] }, publishedAt: { gte: monthStart } },
          _sum: { netTotal: true },
        }),
        this.prisma.payrollRun.findMany({
          include: payrollRunInclude,
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
      ]);
    return {
      openPeriods,
      activeRuns,
      pendingAdjustments,
      publishedRunsThisMonth: publishedRuns,
      netPaidThisMonth: (publishedTotals._sum.netTotal ?? new Prisma.Decimal(0)).toString(),
      recentRuns: recent.map(toPayrollRun),
    };
  }

  private async findRow(id: string): Promise<PayrollRunRow> {
    const row = await this.prisma.payrollRun.findUnique({
      where: { id },
      include: payrollRunInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: "PAYROLL_RUN_NOT_FOUND",
        message: "Payroll run not found",
      });
    }
    return row;
  }
}
