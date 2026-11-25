import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import {
  calculatePeriodTotals,
  createCredit,
  createDebit,
  dateKeyOf,
  ensureEntitlementPeriod,
  roundAmount,
  todayKey,
} from "@peopleops/leave-engine";
import { PERMISSIONS } from "@peopleops/shared-types";
import type { LeaveBalance, LeaveTransaction, PaginatedResponse } from "@peopleops/shared-types";
import { toPageMeta } from "../../common/dto/page-query.dto";
import { PrismaService } from "../../prisma/prisma.service";
import { AttendanceService } from "../attendance/attendance.service";
import { AuditService } from "../audit/audit.service";
import { EmployeesService } from "../employee/employees.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import type {
  AdjustLeaveBalanceDto,
  ListLeaveBalancesQueryDto,
  ListLeaveTransactionsQueryDto,
} from "./dto/leave.dto";
import { displayName, leaveTransactionInclude, toLeaveTransaction } from "./leave.mapper";
import type { LeaveActor } from "./leave.types";

interface EmployeeRef {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  branchId: string | null;
  joinDate: Date;
}

export interface ResolvedPeriod {
  assignment: {
    id: string;
    employeeId: string;
    leaveTypeId: string;
    policyId: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
  };
  period: {
    id: string;
    periodStart: Date;
    periodEnd: Date;
    entitlementUnit: "DAY" | "HOUR";
    policyId: string;
  };
  leaveType: {
    id: string;
    name: string;
    code: string;
    isPaid: boolean;
    requiresBalance: boolean;
    requiresAttachment: boolean;
    allowHalfDay: boolean;
    allowPastDates: boolean;
    allowFutureDates: boolean;
    status: "ACTIVE" | "INACTIVE";
  };
  policy: {
    id: string;
    name: string;
    code: string;
    entitlementAmount: Prisma.Decimal;
    accrualMethod: string;
    maxBalance: Prisma.Decimal | null;
    carryOverEnabled: boolean;
    maxCarryOverAmount: Prisma.Decimal | null;
    carryOverExpirationMonths: number | null;
    minRequestDuration: Prisma.Decimal | null;
    maxRequestDuration: Prisma.Decimal | null;
    minAdvanceNoticeDays: number;
    allowNegativeBalance: boolean;
    allowHalfDay: boolean;
    approvalMode: string;
    leaveYearStartMonth: number;
    cancellationCutoffDays: number;
    eligibilityMonths: number;
  };
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

@Injectable()
export class LeaveEntitlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly employees: EmployeesService,
    private readonly attendance: AttendanceService,
  ) {}

  async getLinkedEmployee(userId: string): Promise<EmployeeRef> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        branchId: true,
        joinDate: true,
      },
    });
    if (!employee) {
      throw new NotFoundException({
        code: "EMPLOYEE_NOT_LINKED",
        message: "No employee record is linked to your account",
      });
    }
    return employee;
  }

  async assertEmployeeAccess(employeeId: string, user: AuthenticatedUser): Promise<void> {
    await this.employees.assertCanReadEmployee(employeeId, user);
  }

  async accessibleEmployeeIds(user: AuthenticatedUser): Promise<string[] | null> {
    const permissions = new Set(user.permissions);
    if (
      permissions.has(PERMISSIONS.LEAVE_REQUEST_READ_ALL) ||
      permissions.has(PERMISSIONS.LEAVE_BALANCE_READ_ALL) ||
      permissions.has(PERMISSIONS.LEAVE_TRANSACTION_READ_ALL)
    ) {
      return null;
    }
    if (
      permissions.has(PERMISSIONS.LEAVE_REQUEST_READ_TEAM) ||
      permissions.has(PERMISSIONS.LEAVE_BALANCE_READ_ALL)
    ) {
      const scope = await this.employees.resolveScope(user);
      return this.employees.scopedEmployeeIds(scope);
    }
    const employee = await this.getLinkedEmployee(user.id);
    return [employee.id];
  }

  async resolvePeriod(
    employeeId: string,
    leaveTypeId: string,
    asOf: string,
  ): Promise<ResolvedPeriod | null> {
    const assignment = await this.prisma.leavePolicyAssignment.findFirst({
      where: {
        employeeId,
        leaveTypeId,
        status: "ACTIVE",
        effectiveFrom: { lte: new Date(`${asOf}T00:00:00.000Z`) },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date(`${asOf}T00:00:00.000Z`) } }],
      },
      include: { policy: true, leaveType: true },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!assignment) return null;
    const period = await ensureEntitlementPeriod(this.prisma, assignment.id, asOf);
    if (!period) return null;
    const periodRow = await this.prisma.leaveEntitlementPeriod.findUnique({
      where: { id: period.id },
    });
    if (!periodRow) return null;
    return {
      assignment,
      period: {
        id: periodRow.id,
        periodStart: periodRow.periodStart,
        periodEnd: periodRow.periodEnd,
        entitlementUnit: periodRow.entitlementUnit,
        policyId: periodRow.policyId,
      },
      leaveType: {
        id: assignment.leaveType.id,
        name: assignment.leaveType.name,
        code: assignment.leaveType.code,
        isPaid: assignment.leaveType.isPaid,
        requiresBalance: assignment.leaveType.requiresBalance,
        requiresAttachment: assignment.leaveType.requiresAttachment,
        allowHalfDay: assignment.leaveType.allowHalfDay,
        allowPastDates: assignment.leaveType.allowPastDates,
        allowFutureDates: assignment.leaveType.allowFutureDates,
        status: assignment.leaveType.status,
      },
      policy: {
        id: assignment.policy.id,
        name: assignment.policy.name,
        code: assignment.policy.code,
        entitlementAmount: assignment.policy.entitlementAmount,
        accrualMethod: assignment.policy.accrualMethod,
        maxBalance: assignment.policy.maxBalance,
        carryOverEnabled: assignment.policy.carryOverEnabled,
        maxCarryOverAmount: assignment.policy.maxCarryOverAmount,
        carryOverExpirationMonths: assignment.policy.carryOverExpirationMonths,
        minRequestDuration: assignment.policy.minRequestDuration,
        maxRequestDuration: assignment.policy.maxRequestDuration,
        minAdvanceNoticeDays: assignment.policy.minAdvanceNoticeDays,
        allowNegativeBalance: assignment.policy.allowNegativeBalance,
        allowHalfDay: assignment.policy.allowHalfDay,
        approvalMode: assignment.policy.approvalMode,
        leaveYearStartMonth: assignment.policy.leaveYearStartMonth,
        cancellationCutoffDays: assignment.policy.cancellationCutoffDays,
        eligibilityMonths: assignment.policy.eligibilityMonths,
      },
    };
  }

  async getBalance(
    employeeId: string,
    leaveTypeId: string,
    asOf: string,
  ): Promise<LeaveBalance | null> {
    const resolved = await this.resolvePeriod(employeeId, leaveTypeId, asOf);
    if (!resolved) return null;
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        preferredName: true,
      },
    });
    if (!employee) return null;
    const totals = await calculatePeriodTotals(this.prisma, resolved.period.id);
    return {
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber,
      employeeName: displayName(employee),
      leaveType: {
        id: resolved.leaveType.id,
        name: resolved.leaveType.name,
        code: resolved.leaveType.code,
        isPaid: resolved.leaveType.isPaid,
      },
      periodStart: dateKeyOf(resolved.period.periodStart),
      periodEnd: dateKeyOf(resolved.period.periodEnd),
      ...totals,
      unit: resolved.period.entitlementUnit,
      policy: {
        id: resolved.policy.id,
        name: resolved.policy.name,
        code: resolved.policy.code,
      },
    };
  }

  async myBalances(user: AuthenticatedUser, asOf?: string): Promise<LeaveBalance[]> {
    const employee = await this.getLinkedEmployee(user.id);
    return this.balancesForEmployee(employee.id, asOf);
  }

  async balancesForEmployee(employeeId: string, asOf?: string): Promise<LeaveBalance[]> {
    const date = asOf ?? (await this.companyToday());
    const assignments = await this.prisma.leavePolicyAssignment.findMany({
      where: {
        employeeId,
        status: "ACTIVE",
        effectiveFrom: { lte: new Date(`${date}T00:00:00.000Z`) },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date(`${date}T00:00:00.000Z`) } }],
      },
      select: { leaveTypeId: true },
      orderBy: { effectiveFrom: "desc" },
    });
    const typeIds = unique(assignments.map((assignment) => assignment.leaveTypeId));
    const balances: LeaveBalance[] = [];
    for (const leaveTypeId of typeIds) {
      const balance = await this.getBalance(employeeId, leaveTypeId, date);
      if (balance) balances.push(balance);
    }
    return balances;
  }

  private async companyToday(): Promise<string> {
    return todayKey(await this.attendance.getCompanyTimezone());
  }

  async listBalances(
    query: ListLeaveBalancesQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<LeaveBalance>> {
    const ids = await this.accessibleEmployeeIds(user);
    const asOf = query.asOf ?? (await this.companyToday());
    const where: Prisma.LeavePolicyAssignmentWhereInput = {
      status: "ACTIVE",
      effectiveFrom: { lte: new Date(`${asOf}T00:00:00.000Z`) },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date(`${asOf}T00:00:00.000Z`) } }],
      ...(ids ? { employeeId: { in: ids } } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.leaveTypeId ? { leaveTypeId: query.leaveTypeId } : {}),
      ...(query.branchId || query.departmentId
        ? {
            employee: {
              ...(query.branchId ? { branchId: query.branchId } : {}),
              ...(query.departmentId ? { departmentId: query.departmentId } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            employee: {
              ...(query.branchId ? { branchId: query.branchId } : {}),
              ...(query.departmentId ? { departmentId: query.departmentId } : {}),
              OR: [
                { employeeNumber: { contains: query.search, mode: "insensitive" } },
                { firstName: { contains: query.search, mode: "insensitive" } },
                { lastName: { contains: query.search, mode: "insensitive" } },
                { preferredName: { contains: query.search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.leavePolicyAssignment.count({ where }),
      this.prisma.leavePolicyAssignment.findMany({
        where,
        include: { employee: true },
        orderBy: [{ employee: { firstName: "asc" } }, { effectiveFrom: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    const balances: LeaveBalance[] = [];
    for (const row of rows) {
      const balance = await this.getBalance(row.employeeId, row.leaveTypeId, asOf);
      if (balance) balances.push(balance);
    }
    return { items: balances, ...toPageMeta(query.page, query.pageSize, total) };
  }

  async listTransactions(
    query: ListLeaveTransactionsQueryDto,
    user: AuthenticatedUser,
    mineOnly = false,
  ): Promise<PaginatedResponse<LeaveTransaction>> {
    const linked = mineOnly ? await this.getLinkedEmployee(user.id) : null;
    const ids = mineOnly ? [linked!.id] : await this.accessibleEmployeeIds(user);
    const where: Prisma.LeaveTransactionWhereInput = {
      ...(ids ? { employeeId: { in: ids } } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.leaveTypeId ? { leaveTypeId: query.leaveTypeId } : {}),
      ...(query.from || query.to
        ? {
            transactionDate: {
              ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
              ...(query.to ? { lte: new Date(`${query.to}T00:00:00.000Z`) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { description: { contains: query.search, mode: "insensitive" } },
              { sourceRef: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.leaveTransaction.count({ where }),
      this.prisma.leaveTransaction.findMany({
        where,
        include: leaveTransactionInclude,
        orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: rows.map(toLeaveTransaction),
      ...toPageMeta(query.page, query.pageSize, total),
    };
  }

  async adjust(
    employeeId: string,
    dto: AdjustLeaveBalanceDto,
    actor: LeaveActor,
  ): Promise<LeaveBalance> {
    if (dto.amount === 0) {
      throw new BadRequestException({
        code: "INVALID_ADJUSTMENT_AMOUNT",
        message: "The adjustment amount must not be zero",
      });
    }
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException({ code: "EMPLOYEE_NOT_FOUND", message: "Employee not found" });
    }
    const resolved = await this.resolvePeriod(employeeId, dto.leaveTypeId, dto.transactionDate);
    if (!resolved) {
      throw new BadRequestException({
        code: "NO_LEAVE_POLICY",
        message: "The employee has no active policy for this leave type",
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await this.lockBalance(tx, employeeId, dto.leaveTypeId);
      const totals = await calculatePeriodTotals(tx, resolved.period.id);
      const amount = roundAmount(Math.abs(dto.amount));
      if (dto.amount > 0) {
        const max = resolved.policy.maxBalance ? Number(resolved.policy.maxBalance) : null;
        if (max !== null && roundAmount(totals.entitled + amount) > max) {
          throw new ConflictException({
            code: "LEAVE_BALANCE_MAX_EXCEEDED",
            message: "The adjustment would exceed the policy maximum balance",
          });
        }
        await createCredit(tx, {
          employeeId,
          leaveTypeId: dto.leaveTypeId,
          entitlementPeriodId: resolved.period.id,
          type: "ADJUSTMENT",
          amount,
          transactionDate: dto.transactionDate,
          sourceType: "ADJUSTMENT",
          sourceRef: `adjustment:${randomUUID()}`,
          description: dto.reason.trim(),
          createdById: actor.actorUserId,
        });
      } else {
        if (!resolved.policy.allowNegativeBalance && amount > totals.available) {
          throw new ConflictException({
            code: "INSUFFICIENT_LEAVE_BALANCE",
            message: "The adjustment would make the balance negative",
            details: { available: totals.available },
          });
        }
        await createDebit(tx, {
          employeeId,
          leaveTypeId: dto.leaveTypeId,
          entitlementPeriodId: resolved.period.id,
          type: "ADJUSTMENT",
          amount,
          transactionDate: dto.transactionDate,
          sourceType: "ADJUSTMENT",
          sourceRef: `adjustment:${randomUUID()}`,
          description: dto.reason.trim(),
          createdById: actor.actorUserId,
        });
      }
    });
    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "leave_balance.adjusted",
      entityType: "leave_balance",
      entityId: resolved.period.id,
      metadata: {
        employeeId,
        leaveTypeId: dto.leaveTypeId,
        amount: dto.amount,
        reason: dto.reason,
      },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    const balance = await this.getBalance(employeeId, dto.leaveTypeId, dto.transactionDate);
    if (!balance) {
      throw new NotFoundException({
        code: "LEAVE_BALANCE_NOT_FOUND",
        message: "Leave balance not found after adjustment",
      });
    }
    return balance;
  }

  async lockBalance(
    tx: Prisma.TransactionClient,
    employeeId: string,
    leaveTypeId: string,
  ): Promise<void> {
    const key = `${employeeId}:${leaveTypeId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  }

  async assertCanReadEmployee(employeeId: string, user: AuthenticatedUser): Promise<void> {
    const ids = await this.accessibleEmployeeIds(user);
    if (ids && !ids.includes(employeeId)) {
      throw new ForbiddenException({
        code: "LEAVE_OUT_OF_SCOPE",
        message: "You can only access leave data inside your reporting line",
      });
    }
  }
}
