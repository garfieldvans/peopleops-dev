import { Prisma } from "@peopleops/database";
import type {
  OvertimeApproval,
  OvertimeAttachment,
  OvertimeCorrection,
  OvertimePolicy,
  OvertimePolicyAssignment,
  OvertimePolicySnapshot,
  OvertimeRequest,
  OvertimeRequestListItem,
} from "@peopleops/shared-types";

export const overtimePolicyInclude = {
  _count: { select: { assignments: true } },
} satisfies Prisma.OvertimePolicyInclude;

export type OvertimePolicyRow = Prisma.OvertimePolicyGetPayload<{
  include: typeof overtimePolicyInclude;
}>;

export const overtimeAssignmentInclude = {
  policy: { select: { id: true, name: true, code: true } },
  employee: {
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      preferredName: true,
    },
  },
  department: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
} satisfies Prisma.OvertimePolicyAssignmentInclude;

export type OvertimeAssignmentRow = Prisma.OvertimePolicyAssignmentGetPayload<{
  include: typeof overtimeAssignmentInclude;
}>;

export const overtimeRequestInclude = {
  employee: {
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      managerId: true,
      department: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
    },
  },
  policy: { select: { id: true, name: true, code: true } },
  approvals: {
    orderBy: { createdAt: "asc" },
    include: { approver: { select: { id: true, name: true } } },
  },
  corrections: {
    orderBy: { createdAt: "asc" },
    include: { correctedBy: { select: { id: true, name: true } } },
  },
  attachments: {
    orderBy: { createdAt: "asc" },
    include: { uploadedBy: { select: { id: true, name: true } } },
  },
  verifier: { select: { id: true, name: true } },
  cancelledBy: { select: { id: true, name: true } },
} satisfies Prisma.OvertimeRequestInclude;

export type OvertimeRequestRow = Prisma.OvertimeRequestGetPayload<{
  include: typeof overtimeRequestInclude;
}>;

export const overtimeRequestListInclude = {
  employee: {
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      managerId: true,
      department: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
    },
  },
  policy: { select: { id: true, name: true, code: true } },
  verifier: { select: { id: true, name: true } },
  cancelledBy: { select: { id: true, name: true } },
} satisfies Prisma.OvertimeRequestInclude;

export type OvertimeRequestListRow = Prisma.OvertimeRequestGetPayload<{
  include: typeof overtimeRequestListInclude;
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

export function toOvertimePolicy(row: OvertimePolicyRow): OvertimePolicy {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    status: row.status,
    effectiveFrom: isoDate(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? isoDate(row.effectiveTo) : null,
    minMinutes: row.minMinutes,
    maxMinutes: row.maxMinutes,
    roundingStrategy: row.roundingStrategy,
    roundingMinutes: row.roundingMinutes,
    approvalMode: row.approvalMode,
    requiresAttachment: row.requiresAttachment,
    allowWeekend: row.allowWeekend,
    allowHoliday: row.allowHoliday,
    eligibleEmploymentStatuses: row.eligibleEmploymentStatuses,
    assignmentCount: row._count.assignments,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toOvertimeAssignment(row: OvertimeAssignmentRow): OvertimePolicyAssignment {
  const scope = row.employeeId ? "EMPLOYEE" : row.departmentId ? "DEPARTMENT" : "BRANCH";
  return {
    id: row.id,
    scope,
    policy: row.policy,
    employee: row.employee
      ? {
          id: row.employee.id,
          employeeNumber: row.employee.employeeNumber,
          fullName: displayName(row.employee),
        }
      : null,
    department: row.department,
    branch: row.branch,
    effectiveFrom: isoDate(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? isoDate(row.effectiveTo) : null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

function toApproval(row: OvertimeRequestRow["approvals"][number]): OvertimeApproval {
  return {
    id: row.id,
    stage: row.stage,
    decision: row.decision,
    approver: row.approver,
    approverName: row.approverName,
    comment: row.comment,
    isOverride: row.isOverride,
    createdAt: row.createdAt.toISOString(),
  };
}

function toCorrection(row: OvertimeRequestRow["corrections"][number]): OvertimeCorrection {
  return {
    id: row.id,
    previousValue: row.previousValue,
    correctedValue: row.correctedValue,
    reason: row.reason,
    correctedBy: row.correctedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

function toAttachment(row: OvertimeRequestRow["attachments"][number]): OvertimeAttachment {
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

function toOvertimeRequestFields(
  row: OvertimeRequestRow | OvertimeRequestListRow,
): OvertimeRequestListItem {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeNumber: row.employee.employeeNumber,
    employeeName: displayName(row.employee),
    department: row.employee.department,
    branch: row.employee.branch,
    policy: row.policy,
    policySnapshot: row.policySnapshot as unknown as OvertimePolicySnapshot,
    attendanceRecordId: row.attendanceRecordId,
    workDate: isoDate(row.workDate),
    category: row.category,
    reason: row.reason,
    plannedStartAt: row.plannedStartAt.toISOString(),
    plannedEndAt: row.plannedEndAt.toISOString(),
    plannedBreakMinutes: row.plannedBreakMinutes,
    actualStartAt: row.actualStartAt?.toISOString() ?? null,
    actualEndAt: row.actualEndAt?.toISOString() ?? null,
    actualBreakMinutes: row.actualBreakMinutes,
    requestedMinutes: row.requestedMinutes,
    actualMinutes: row.actualMinutes,
    verifiedMinutes: row.verifiedMinutes,
    approvedMinutes: row.approvedMinutes,
    status: row.status,
    approvalStage: row.approvalStage,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    verifier: row.verifier,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelledBy: row.cancelledBy,
    cancellationReason: row.cancellationReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toOvertimeRequestListItem(row: OvertimeRequestListRow): OvertimeRequestListItem {
  return toOvertimeRequestFields(row);
}

export function toOvertimeRequest(row: OvertimeRequestRow): OvertimeRequest {
  return {
    ...toOvertimeRequestFields(row),
    approvals: row.approvals.map(toApproval),
    corrections: row.corrections.map(toCorrection),
    attachments: row.attachments.map(toAttachment),
  };
}
