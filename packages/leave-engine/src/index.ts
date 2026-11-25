import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@peopleops/database";

/**
 * Shared leave domain engine.
 *
 * The API uses these functions for transactional request/ledger operations and
 * the worker uses the same code for scheduled accrual, carry-over and expiry.
 * Keeping the rules here prevents the API and worker from drifting apart.
 */

export type LeaveDatabase = PrismaClient | Prisma.TransactionClient;

export interface PeriodWindow {
  start: string;
  end: string;
}

export interface PeriodTotals {
  entitled: number;
  used: number;
  reserved: number;
  available: number;
}

export interface LeaveJobResult {
  periodsEnsured: number;
  accrualsCreated: number;
  carryOversCreated: number;
  expirationsCreated: number;
}

const ONE_DAY_MS = 86_400_000;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function dateKeyOf(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function addDays(dateKey: string, days: number): string {
  return dateKeyOf(new Date(dateOnly(dateKey).getTime() + days * ONE_DAY_MS));
}

export function startOfMonth(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

export function addMonths(dateKey: string, months: number): string {
  const value = dateOnly(startOfMonth(dateKey));
  value.setUTCMonth(value.getUTCMonth() + months);
  return dateKeyOf(value);
}

export function monthsInclusive(fromKey: string, toKey: string): number {
  const from = dateOnly(startOfMonth(fromKey));
  const to = dateOnly(startOfMonth(toKey));
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth()) + 1
  );
}

export function roundAmount(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Calendar leave year, with a configurable first month (1 = January). */
export function leavePeriodForDate(dateKey: string, startMonth: number): PeriodWindow {
  const month = Math.min(12, Math.max(1, Math.trunc(startMonth)));
  const value = dateOnly(dateKey);
  let year = value.getUTCFullYear();
  if (value.getUTCMonth() + 1 < month) year -= 1;
  const start = `${year}-${pad(month)}-01`;
  return { start, end: addDays(addMonths(start, 12), -1) };
}

export function todayKey(timeZone = "UTC"): string {
  if (timeZone === "UTC") return dateKeyOf(new Date());
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function policySnapshot(policy: {
  entitlementAmount: Prisma.Decimal | number;
  entitlementUnit: string;
  accrualMethod: string;
  accrualFrequency: string;
  accrualStartRule: string;
  eligibilityMonths: number;
  maxBalance: Prisma.Decimal | number | null;
  carryOverEnabled: boolean;
  maxCarryOverAmount: Prisma.Decimal | number | null;
  carryOverExpirationMonths: number | null;
  minRequestDuration: Prisma.Decimal | number | null;
  maxRequestDuration: Prisma.Decimal | number | null;
  minAdvanceNoticeDays: number;
  allowNegativeBalance: boolean;
  allowHalfDay: boolean;
  allowUnpaidLeave: boolean;
  approvalMode: string;
  leaveYearStartMonth: number;
  cancellationCutoffDays: number;
}): Prisma.InputJsonValue {
  return {
    entitlementAmount: Number(policy.entitlementAmount),
    entitlementUnit: policy.entitlementUnit,
    accrualMethod: policy.accrualMethod,
    accrualFrequency: policy.accrualFrequency,
    accrualStartRule: policy.accrualStartRule,
    eligibilityMonths: policy.eligibilityMonths,
    maxBalance: policy.maxBalance === null ? null : Number(policy.maxBalance),
    carryOverEnabled: policy.carryOverEnabled,
    maxCarryOverAmount:
      policy.maxCarryOverAmount === null ? null : Number(policy.maxCarryOverAmount),
    carryOverExpirationMonths: policy.carryOverExpirationMonths,
    minRequestDuration:
      policy.minRequestDuration === null ? null : Number(policy.minRequestDuration),
    maxRequestDuration:
      policy.maxRequestDuration === null ? null : Number(policy.maxRequestDuration),
    minAdvanceNoticeDays: policy.minAdvanceNoticeDays,
    allowNegativeBalance: policy.allowNegativeBalance,
    allowHalfDay: policy.allowHalfDay,
    allowUnpaidLeave: policy.allowUnpaidLeave,
    approvalMode: policy.approvalMode,
    leaveYearStartMonth: policy.leaveYearStartMonth,
    cancellationCutoffDays: policy.cancellationCutoffDays,
  };
}

interface SnapshotShape {
  entitlementAmount: number;
  accrualMethod: string;
  maxBalance: number | null;
  carryOverEnabled: boolean;
  maxCarryOverAmount: number | null;
  carryOverExpirationMonths: number | null;
}

function snapshotOf(period: { policySnapshot: Prisma.JsonValue }): SnapshotShape {
  return period.policySnapshot as unknown as SnapshotShape;
}

function initialEntitlement(
  annualAmount: number,
  period: PeriodWindow,
  assignmentEffectiveFrom: Date,
): number {
  const effective = dateKeyOf(assignmentEffectiveFrom);
  if (effective > period.end) return 0;
  let firstMonth = startOfMonth(effective > period.start ? effective : period.start);
  if (effective > period.start && Number(effective.slice(8, 10)) > 1) {
    firstMonth = addMonths(firstMonth, 1);
  }
  if (firstMonth > period.end) return 0;
  const remainingMonths = monthsInclusive(firstMonth, period.end);
  return roundAmount((annualAmount * remainingMonths) / 12);
}

export async function createCredit(
  db: LeaveDatabase,
  input: {
    employeeId: string;
    leaveTypeId: string;
    entitlementPeriodId: string;
    type:
      | "OPENING_BALANCE"
      | "ENTITLEMENT"
      | "ACCRUAL"
      | "CARRY_OVER"
      | "LEAVE_REVERSAL"
      | "ADJUSTMENT";
    amount: number;
    transactionDate: string;
    expiresAt?: string | null;
    sourceType: string;
    sourceRef: string;
    description?: string | null;
    createdById?: string | null;
  },
): Promise<{ id: string; created: boolean }> {
  const existing = await db.leaveTransaction.findUnique({
    where: {
      sourceType_sourceRef_type: {
        sourceType: input.sourceType,
        sourceRef: input.sourceRef,
        type: input.type,
      },
    },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const id = randomUUID();
  const inserted = await db.leaveTransaction.createMany({
    data: [
      {
        id,
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        entitlementPeriodId: input.entitlementPeriodId,
        type: input.type,
        amount: input.amount,
        transactionDate: dateOnly(input.transactionDate),
        expiresAt: input.expiresAt ? dateOnly(input.expiresAt) : null,
        sourceType: input.sourceType,
        sourceRef: input.sourceRef,
        description: input.description ?? null,
        createdById: input.createdById ?? null,
      },
    ],
    // The unique source key is the database-level idempotency guarantee.
    skipDuplicates: true,
  });
  if (inserted.count > 0) return { id, created: true };

  const winner = await db.leaveTransaction.findUnique({
    where: {
      sourceType_sourceRef_type: {
        sourceType: input.sourceType,
        sourceRef: input.sourceRef,
        type: input.type,
      },
    },
    select: { id: true },
  });
  if (!winner) throw new Error("Leave credit could not be persisted");
  return { id: winner.id, created: false };
}

interface RemainingSource {
  id: string;
  amount: number;
  remaining: number;
  expiresAt: Date | null;
  transactionDate: Date;
  createdAt: Date;
}

export async function remainingSources(
  db: LeaveDatabase,
  entitlementPeriodId: string,
): Promise<RemainingSource[]> {
  const credits = await db.leaveTransaction.findMany({
    where: { entitlementPeriodId, amount: { gt: 0 } },
    select: {
      id: true,
      amount: true,
      expiresAt: true,
      transactionDate: true,
      createdAt: true,
    },
  });
  if (credits.length === 0) return [];
  const allocations = await db.leaveTransactionAllocation.groupBy({
    by: ["sourceTransactionId"],
    where: { sourceTransactionId: { in: credits.map((credit) => credit.id) } },
    _sum: { amount: true },
  });
  const consumed = new Map(
    allocations.map((row) => [row.sourceTransactionId, Number(row._sum.amount ?? 0)]),
  );
  return credits
    .map((credit) => ({
      id: credit.id,
      amount: Number(credit.amount),
      remaining: roundAmount(Number(credit.amount) - (consumed.get(credit.id) ?? 0)),
      expiresAt: credit.expiresAt,
      transactionDate: credit.transactionDate,
      createdAt: credit.createdAt,
    }))
    .filter((credit) => credit.remaining > 0)
    .sort((left, right) => {
      const leftExpiry = left.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
      const rightExpiry = right.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
      if (leftExpiry !== rightExpiry) return leftExpiry - rightExpiry;
      if (left.transactionDate.getTime() !== right.transactionDate.getTime()) {
        return left.transactionDate.getTime() - right.transactionDate.getTime();
      }
      return left.createdAt.getTime() - right.createdAt.getTime();
    });
}

export async function createDebit(
  db: LeaveDatabase,
  input: {
    employeeId: string;
    leaveTypeId: string;
    entitlementPeriodId: string;
    type: "LEAVE_DEDUCTION" | "LEAVE_REVERSAL" | "CARRY_OVER" | "EXPIRATION" | "ADJUSTMENT";
    amount: number;
    transactionDate: string;
    sourceType: string;
    sourceRef: string;
    description?: string | null;
    createdById?: string | null;
    reversalOfId?: string | null;
    sourceTransactionId?: string | null;
  },
): Promise<{ id: string; created: boolean }> {
  const sources = await remainingSources(db, input.entitlementPeriodId);
  const available = roundAmount(sources.reduce((total, source) => total + source.remaining, 0));
  const debitAmount = roundAmount(Math.abs(input.amount));
  if (debitAmount > available + 0.0001) {
    throw new Error(`Insufficient leave balance: requested ${debitAmount}, available ${available}`);
  }

  const existing = await db.leaveTransaction.findUnique({
    where: {
      sourceType_sourceRef_type: {
        sourceType: input.sourceType,
        sourceRef: input.sourceRef,
        type: input.type,
      },
    },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const transactionId = randomUUID();
  const inserted = await db.leaveTransaction.createMany({
    data: [
      {
        id: transactionId,
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        entitlementPeriodId: input.entitlementPeriodId,
        type: input.type,
        amount: -debitAmount,
        transactionDate: dateOnly(input.transactionDate),
        sourceType: input.sourceType,
        sourceRef: input.sourceRef,
        description: input.description ?? null,
        createdById: input.createdById ?? null,
        reversalOfId: input.reversalOfId ?? null,
      },
    ],
    skipDuplicates: true,
  });
  if (inserted.count === 0) {
    const winner = await db.leaveTransaction.findUnique({
      where: {
        sourceType_sourceRef_type: {
          sourceType: input.sourceType,
          sourceRef: input.sourceRef,
          type: input.type,
        },
      },
      select: { id: true },
    });
    if (!winner) throw new Error("Leave debit could not be persisted");
    return { id: winner.id, created: false };
  }

  const allocationSources = input.sourceTransactionId
    ? sources.filter((source) => source.id === input.sourceTransactionId)
    : sources;
  let left = debitAmount;
  for (const source of allocationSources) {
    if (left <= 0) break;
    const allocated = roundAmount(Math.min(source.remaining, left));
    if (allocated <= 0) continue;
    await db.leaveTransactionAllocation.create({
      data: {
        transactionId,
        sourceTransactionId: source.id,
        amount: allocated,
      },
    });
    left = roundAmount(left - allocated);
  }
  if (left > 0.0001) {
    throw new Error("Leave allocation failed: the balance changed during the operation");
  }
  return { id: transactionId, created: true };
}

export async function calculatePeriodTotals(
  db: LeaveDatabase,
  entitlementPeriodId: string,
): Promise<PeriodTotals> {
  const [positive, negative, reversals, reserved] = await Promise.all([
    db.leaveTransaction.aggregate({
      where: {
        entitlementPeriodId,
        amount: { gt: 0 },
        // Reversals give used days back; they are not new entitlement.
        type: { not: "LEAVE_REVERSAL" },
      },
      _sum: { amount: true },
    }),
    db.leaveTransaction.aggregate({
      where: { entitlementPeriodId, amount: { lt: 0 } },
      _sum: { amount: true },
    }),
    db.leaveTransaction.aggregate({
      where: { entitlementPeriodId, amount: { gt: 0 }, type: "LEAVE_REVERSAL" },
      _sum: { amount: true },
    }),
    db.leaveBalanceReservation.aggregate({
      where: { entitlementPeriodId, status: "PENDING" },
      _sum: { amount: true },
    }),
  ]);
  const entitled = roundAmount(Number(positive._sum.amount ?? 0));
  const used = roundAmount(
    Math.max(0, Math.abs(Number(negative._sum.amount ?? 0)) - Number(reversals._sum.amount ?? 0)),
  );
  const reservedAmount = roundAmount(Number(reserved._sum.amount ?? 0));
  return {
    entitled,
    used,
    reserved: reservedAmount,
    available: roundAmount(entitled - used - reservedAmount),
  };
}

export async function ensureEntitlementPeriod(
  db: LeaveDatabase,
  assignmentId: string,
  asOfKey = todayKey(),
): Promise<{
  id: string;
  periodStart: Date;
  periodEnd: Date;
  createdTransactions: number;
} | null> {
  const assignment = await db.leavePolicyAssignment.findUnique({
    where: { id: assignmentId },
    include: { policy: true },
  });
  if (!assignment || assignment.status !== "ACTIVE") return null;

  const effectiveTo = assignment.effectiveTo ? dateKeyOf(assignment.effectiveTo) : null;
  if (dateKeyOf(assignment.effectiveFrom) > asOfKey) return null;
  if (effectiveTo && effectiveTo < asOfKey) return null;

  const window = leavePeriodForDate(asOfKey, assignment.policy.leaveYearStartMonth);
  const periodStart = dateOnly(window.start);
  const periodEnd = dateOnly(window.end);

  const period = await db.leaveEntitlementPeriod.upsert({
    where: {
      employeeId_leaveTypeId_periodStart_periodEnd: {
        employeeId: assignment.employeeId,
        leaveTypeId: assignment.leaveTypeId,
        periodStart,
        periodEnd,
      },
    },
    update: {},
    create: {
      employeeId: assignment.employeeId,
      leaveTypeId: assignment.leaveTypeId,
      policyId: assignment.policyId,
      assignmentId: assignment.id,
      periodStart,
      periodEnd,
      entitlementAmount: assignment.policy.entitlementAmount,
      entitlementUnit: assignment.policy.entitlementUnit,
      policySnapshot: policySnapshot(assignment.policy),
    },
    select: {
      id: true,
      employeeId: true,
      leaveTypeId: true,
      periodStart: true,
      periodEnd: true,
      policySnapshot: true,
    },
  });

  const createdTransactions = await generateEntitlement(
    db,
    period,
    assignment.effectiveFrom,
    asOfKey,
  );
  return {
    id: period.id,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    createdTransactions,
  };
}

async function generateEntitlement(
  db: LeaveDatabase,
  period: {
    id: string;
    employeeId: string;
    leaveTypeId: string;
    periodStart: Date;
    periodEnd: Date;
    policySnapshot: Prisma.JsonValue;
  },
  assignmentEffectiveFrom: Date,
  asOfKey: string,
): Promise<number> {
  const snapshot = snapshotOf(period);
  const periodWindow = {
    start: dateKeyOf(period.periodStart),
    end: dateKeyOf(period.periodEnd),
  };
  let created = 0;

  if (snapshot.accrualMethod === "GRANTED_UPFRONT" || snapshot.accrualMethod === "ANNUAL_ACCRUAL") {
    const amount = initialEntitlement(
      snapshot.entitlementAmount,
      periodWindow,
      assignmentEffectiveFrom,
    );
    if (amount > 0) {
      const result = await createCredit(db, {
        employeeId: period.employeeId,
        leaveTypeId: period.leaveTypeId,
        entitlementPeriodId: period.id,
        type: "ENTITLEMENT",
        amount,
        transactionDate: periodWindow.start,
        sourceType: "ENTITLEMENT",
        sourceRef: `period:${period.id}:initial`,
        description: "Initial leave entitlement",
      });
      if (result.created) created += 1;
    }
  }

  if (snapshot.accrualMethod === "MONTHLY_ACCRUAL") {
    const monthlyAmount = roundAmount(snapshot.entitlementAmount / 12);
    if (monthlyAmount > 0) {
      let firstMonth = startOfMonth(
        dateKeyOf(assignmentEffectiveFrom) > periodWindow.start
          ? dateKeyOf(assignmentEffectiveFrom)
          : periodWindow.start,
      );
      if (
        dateKeyOf(assignmentEffectiveFrom) > periodWindow.start &&
        Number(dateKeyOf(assignmentEffectiveFrom).slice(8, 10)) > 1
      ) {
        firstMonth = addMonths(firstMonth, 1);
      }
      const lastMonth = startOfMonth(asOfKey < periodWindow.end ? asOfKey : periodWindow.end);
      let cursor = firstMonth;
      while (cursor <= lastMonth) {
        const result = await createCredit(db, {
          employeeId: period.employeeId,
          leaveTypeId: period.leaveTypeId,
          entitlementPeriodId: period.id,
          type: "ACCRUAL",
          amount: monthlyAmount,
          transactionDate: cursor,
          sourceType: "ACCRUAL",
          sourceRef: `period:${period.id}:accrual:${cursor.slice(0, 7)}`,
          description: `Monthly accrual ${cursor.slice(0, 7)}`,
        });
        if (result.created) created += 1;
        cursor = addMonths(cursor, 1);
      }
    }
  }

  return created;
}

function carryOverExpiry(periodStart: Date, periodEnd: Date, months: number | null): string {
  if (!months || months <= 0) return dateKeyOf(periodEnd);
  return addDays(addMonths(dateKeyOf(periodStart), months), -1);
}

async function runCarryOver(
  db: LeaveDatabase,
  current: {
    id: string;
    employeeId: string;
    leaveTypeId: string;
    periodStart: Date;
    periodEnd: Date;
    policySnapshot: Prisma.JsonValue;
  },
): Promise<number> {
  const snapshot = snapshotOf(current);
  if (!snapshot.carryOverEnabled) return 0;
  const previous = await db.leaveEntitlementPeriod.findFirst({
    where: {
      employeeId: current.employeeId,
      leaveTypeId: current.leaveTypeId,
      periodEnd: { lt: current.periodStart },
      status: "OPEN",
    },
    orderBy: { periodEnd: "desc" },
    select: {
      id: true,
      employeeId: true,
      leaveTypeId: true,
      periodStart: true,
      periodEnd: true,
      policySnapshot: true,
    },
  });
  if (!previous) return 0;

  const sourceRef = `carryover:${previous.id}:${current.id}`;
  const existing = await db.leaveTransaction.findFirst({
    where: {
      OR: [
        { sourceType: "CARRY_OVER", sourceRef: `${sourceRef}:in` },
        { sourceType: "CARRY_OVER", sourceRef: `${sourceRef}:out` },
      ],
    },
    select: { id: true },
  });
  if (existing) return 0;

  const sources = await remainingSources(db, previous.id);
  const remaining = roundAmount(sources.reduce((total, source) => total + source.remaining, 0));
  if (remaining <= 0) {
    await db.leaveEntitlementPeriod.update({
      where: { id: previous.id },
      data: { status: "CLOSED" },
    });
    return 0;
  }
  const cap = snapshot.maxCarryOverAmount;
  const amount = cap === null ? remaining : Math.min(remaining, Math.max(0, cap));
  if (amount <= 0) return 0;

  await createDebit(db, {
    employeeId: previous.employeeId,
    leaveTypeId: previous.leaveTypeId,
    entitlementPeriodId: previous.id,
    type: "CARRY_OVER",
    amount,
    transactionDate: dateKeyOf(current.periodStart),
    sourceType: "CARRY_OVER",
    sourceRef: `${sourceRef}:out`,
    description: "Carry-over to the next leave period",
  });
  await createCredit(db, {
    employeeId: current.employeeId,
    leaveTypeId: current.leaveTypeId,
    entitlementPeriodId: current.id,
    type: "CARRY_OVER",
    amount,
    transactionDate: dateKeyOf(current.periodStart),
    expiresAt: carryOverExpiry(
      current.periodStart,
      current.periodEnd,
      snapshot.carryOverExpirationMonths,
    ),
    sourceType: "CARRY_OVER",
    sourceRef: `${sourceRef}:in`,
    description: "Carry-over from the previous leave period",
  });
  await db.leaveEntitlementPeriod.update({
    where: { id: previous.id },
    data: { status: "CLOSED" },
  });
  return 1;
}

async function runExpirations(
  db: LeaveDatabase,
  entitlementPeriodId: string,
  asOfKey: string,
): Promise<number> {
  const expired = await db.leaveTransaction.findMany({
    where: {
      entitlementPeriodId,
      amount: { gt: 0 },
      expiresAt: { not: null, lte: dateOnly(asOfKey) },
    },
    select: { id: true, expiresAt: true },
  });
  let created = 0;
  for (const source of expired) {
    const remaining = await remainingSources(db, entitlementPeriodId);
    const tranche = remaining.find((entry) => entry.id === source.id);
    if (!tranche || tranche.remaining <= 0) continue;
    const sourceRow = await db.leaveTransaction.findUnique({
      where: { id: source.id },
      select: { employeeId: true, leaveTypeId: true },
    });
    if (!sourceRow) continue;
    const result = await createDebit(db, {
      employeeId: sourceRow.employeeId,
      leaveTypeId: sourceRow.leaveTypeId,
      entitlementPeriodId,
      type: "EXPIRATION",
      amount: tranche.remaining,
      transactionDate: asOfKey,
      sourceType: "EXPIRATION",
      sourceRef: `expire:${source.id}`,
      description: "Expired leave balance",
      sourceTransactionId: source.id,
    });
    if (result.created) created += 1;
  }
  return created;
}

/**
 * Idempotent daily job. Safe to run on every worker instance: entitlement,
 * accrual, carry-over and expiry rows all have database unique source keys.
 */
export async function runLeaveJobs(
  prisma: PrismaClient,
  asOfKey = todayKey(),
): Promise<LeaveJobResult> {
  const assignments = await prisma.leavePolicyAssignment.findMany({
    where: {
      status: "ACTIVE",
      effectiveFrom: { lte: dateOnly(asOfKey) },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: dateOnly(asOfKey) } }],
    },
    select: { id: true },
  });

  const result: LeaveJobResult = {
    periodsEnsured: 0,
    accrualsCreated: 0,
    carryOversCreated: 0,
    expirationsCreated: 0,
  };

  for (const assignment of assignments) {
    await prisma.$transaction(async (tx) => {
      const period = await ensureEntitlementPeriod(tx, assignment.id, asOfKey);
      if (!period) return;
      result.periodsEnsured += 1;
      result.accrualsCreated += period.createdTransactions;
      const full = await tx.leaveEntitlementPeriod.findUnique({
        where: { id: period.id },
        select: {
          id: true,
          employeeId: true,
          leaveTypeId: true,
          periodStart: true,
          periodEnd: true,
          policySnapshot: true,
        },
      });
      if (!full) return;
      result.carryOversCreated += await runCarryOver(tx, full);
      result.expirationsCreated += await runExpirations(tx, full.id, asOfKey);
    });
  }

  return result;
}
