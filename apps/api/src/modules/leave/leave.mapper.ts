import { Prisma } from "@peopleops/database";
import type {
  LeaveAttachment,
  LeavePolicy,
  LeavePolicyAssignment,
  LeaveRequest,
  LeaveRequestApproval,
  LeaveTransaction,
  LeaveType,
} from "@peopleops/shared-types";

export const leaveTypeInclude = {
  _count: { select: { policies: true, requests: true } },
} satisfies Prisma.LeaveTypeInclude;

export type LeaveTypeRow = Prisma.LeaveTypeGetPayload<{ include: typeof leaveTypeInclude }>;

export const leavePolicyInclude = {
  leaveType: { select: { id: true, name: true, code: true } },
  _count: { select: { assignments: true } },
} satisfies Prisma.LeavePolicyInclude;

export type LeavePolicyRow = Prisma.LeavePolicyGetPayload<{ include: typeof leavePolicyInclude }>;

export const leaveAssignmentInclude = {
  employee: {
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      preferredName: true,
    },
  },
  leaveType: { select: { id: true, name: true, code: true } },
  policy: { select: { id: true, name: true, code: true, entitlementAmount: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.LeavePolicyAssignmentInclude;

export type LeaveAssignmentRow = Prisma.LeavePolicyAssignmentGetPayload<{
  include: typeof leaveAssignmentInclude;
}>;

export const leaveRequestInclude = {
  employee: {
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      managerId: true,
      branch: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  },
  leaveType: {
    select: {
      id: true,
      name: true,
      code: true,
      isPaid: true,
      requiresAttachment: true,
      requiresApproval: true,
      requiresBalance: true,
    },
  },
  days: { orderBy: { date: "asc" } },
  approvals: {
    orderBy: { createdAt: "asc" },
    include: { actor: { select: { id: true, name: true } } },
  },
  attachments: {
    orderBy: { createdAt: "asc" },
    include: { uploadedBy: { select: { id: true, name: true } } },
  },
  reviewer: { select: { id: true, name: true } },
  cancelledBy: { select: { id: true, name: true } },
  entitlementPeriod: {
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      policy: {
        select: {
          id: true,
          approvalMode: true,
          cancellationCutoffDays: true,
          allowNegativeBalance: true,
          leaveYearStartMonth: true,
        },
      },
    },
  },
} satisfies Prisma.LeaveRequestInclude;

export type LeaveRequestRow = Prisma.LeaveRequestGetPayload<{
  include: typeof leaveRequestInclude;
}>;

export const leaveTransactionInclude = {
  employee: {
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      preferredName: true,
    },
  },
  leaveType: { select: { id: true, name: true, code: true } },
  period: { select: { periodStart: true, periodEnd: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.LeaveTransactionInclude;

export type LeaveTransactionRow = Prisma.LeaveTransactionGetPayload<{
  include: typeof leaveTransactionInclude;
}>;

export function displayName(row: {
  firstName: string;
  lastName: string;
  preferredName: string | null;
}): string {
  return row.preferredName?.trim() || `${row.firstName} ${row.lastName}`.trim();
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function decimal(value: Prisma.Decimal | number | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

export function toLeaveType(row: LeaveTypeRow): LeaveType {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    isPaid: row.isPaid,
    requiresApproval: row.requiresApproval,
    requiresAttachment: row.requiresAttachment,
    allowHalfDay: row.allowHalfDay,
    allowPastDates: row.allowPastDates,
    allowFutureDates: row.allowFutureDates,
    requiresBalance: row.requiresBalance,
    status: row.status,
    policyCount: row._count.policies,
    requestCount: row._count.requests,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toLeavePolicy(row: LeavePolicyRow): LeavePolicy {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    leaveTypeId: row.leaveTypeId,
    leaveType: row.leaveType,
    entitlementAmount: decimal(row.entitlementAmount),
    entitlementUnit: row.entitlementUnit,
    accrualMethod: row.accrualMethod,
    accrualFrequency: row.accrualFrequency,
    accrualStartRule: row.accrualStartRule,
    eligibilityMonths: row.eligibilityMonths,
    maxBalance: row.maxBalance === null ? null : decimal(row.maxBalance),
    carryOverEnabled: row.carryOverEnabled,
    maxCarryOverAmount: row.maxCarryOverAmount === null ? null : decimal(row.maxCarryOverAmount),
    carryOverExpirationMonths: row.carryOverExpirationMonths,
    minRequestDuration: row.minRequestDuration === null ? null : decimal(row.minRequestDuration),
    maxRequestDuration: row.maxRequestDuration === null ? null : decimal(row.maxRequestDuration),
    minAdvanceNoticeDays: row.minAdvanceNoticeDays,
    allowNegativeBalance: row.allowNegativeBalance,
    allowHalfDay: row.allowHalfDay,
    allowUnpaidLeave: row.allowUnpaidLeave,
    approvalMode: row.approvalMode,
    leaveYearStartMonth: row.leaveYearStartMonth,
    cancellationCutoffDays: row.cancellationCutoffDays,
    effectiveFrom: isoDate(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? isoDate(row.effectiveTo) : null,
    status: row.status,
    assignmentCount: row._count.assignments,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toLeaveAssignment(row: LeaveAssignmentRow): LeavePolicyAssignment {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employee: {
      id: row.employee.id,
      employeeNumber: row.employee.employeeNumber,
      fullName: displayName(row.employee),
    },
    leaveType: row.leaveType,
    policy: {
      ...row.policy,
      entitlementAmount: decimal(row.policy.entitlementAmount),
    },
    effectiveFrom: isoDate(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? isoDate(row.effectiveTo) : null,
    status: row.status,
    notes: row.notes,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

function toApproval(row: LeaveRequestRow["approvals"][number]): LeaveRequestApproval {
  return {
    id: row.id,
    stage: row.stage,
    decision: row.decision,
    actor: row.actor,
    actorName: row.actorName,
    comment: row.comment,
    isOverride: row.isOverride,
    createdAt: row.createdAt.toISOString(),
  };
}

function toAttachment(row: LeaveRequestRow["attachments"][number]): LeaveAttachment {
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toLeaveRequest(row: LeaveRequestRow): LeaveRequest {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeNumber: row.employee.employeeNumber,
    employeeName: displayName(row.employee),
    leaveType: row.leaveType,
    startDate: isoDate(row.startDate),
    endDate: isoDate(row.endDate),
    duration: decimal(row.duration),
    durationUnit: row.durationUnit,
    requestMode: row.requestMode,
    halfDayPeriod: row.halfDayPeriod,
    reason: row.reason,
    status: row.status,
    approvalStage: row.approvalStage,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    reviewedBy: row.reviewer,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewComments: row.reviewComments,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelledBy: row.cancelledBy,
    cancellationReason: row.cancellationReason,
    withdrawnAt: row.withdrawnAt?.toISOString() ?? null,
    days: row.days.map((day) => ({
      date: isoDate(day.date),
      duration: decimal(day.duration),
      halfDayPeriod: day.halfDayPeriod,
    })),
    approvals: row.approvals.map(toApproval),
    attachments: row.attachments.map(toAttachment),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toLeaveTransaction(row: LeaveTransactionRow): LeaveTransaction {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeNumber: row.employee.employeeNumber,
    employeeName: displayName(row.employee),
    leaveType: row.leaveType,
    periodStart: isoDate(row.period.periodStart),
    periodEnd: isoDate(row.period.periodEnd),
    type: row.type,
    amount: decimal(row.amount),
    transactionDate: isoDate(row.transactionDate),
    expiresAt: row.expiresAt ? isoDate(row.expiresAt) : null,
    sourceType: row.sourceType,
    sourceRef: row.sourceRef,
    description: row.description,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}
