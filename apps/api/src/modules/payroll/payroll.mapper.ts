import { Prisma } from "@peopleops/database";
import type {
  EmployeeCompensation,
  EmployeePayrollAssignment,
  PayrollAdjustment,
  PayrollComponent,
  PayrollLine,
  PayrollPayslip,
  PayrollPayslipDetail,
  PayrollPeriod,
  PayrollRun,
  PayrollRunApproval,
  PayrollRunDetail,
  PayrollSource,
  PayrollSourceKind,
} from "@peopleops/shared-types";
import { displayName, isoDate } from "./payroll.utils";

export const payrollEmployeeInclude = {
  select: {
    id: true,
    employeeNumber: true,
    firstName: true,
    lastName: true,
    preferredName: true,
    department: { select: { name: true } },
    position: { select: { title: true } },
  },
} satisfies Prisma.EmployeeDefaultArgs;

export const compensationInclude = {
  employee: payrollEmployeeInclude,
} satisfies Prisma.EmployeeCompensationInclude;

export type CompensationRow = Prisma.EmployeeCompensationGetPayload<{
  include: typeof compensationInclude;
}>;

export const payrollComponentInclude = {
  _count: { select: { assignments: true } },
} satisfies Prisma.PayrollComponentInclude;

export type PayrollComponentRow = Prisma.PayrollComponentGetPayload<{
  include: typeof payrollComponentInclude;
}>;

export const payrollAssignmentInclude = {
  employee: payrollEmployeeInclude,
  component: {
    select: {
      id: true,
      code: true,
      name: true,
      componentType: true,
      calculationType: true,
    },
  },
} satisfies Prisma.EmployeePayrollAssignmentInclude;

export type PayrollAssignmentRow = Prisma.EmployeePayrollAssignmentGetPayload<{
  include: typeof payrollAssignmentInclude;
}>;

export const payrollPeriodInclude = {
  _count: { select: { runs: true } },
} satisfies Prisma.PayrollPeriodInclude;

export type PayrollPeriodRow = Prisma.PayrollPeriodGetPayload<{
  include: typeof payrollPeriodInclude;
}>;

export const payrollRunInclude = {
  period: {
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      paymentDate: true,
      status: true,
    },
  },
  _count: { select: { payslips: true } },
  approvals: {
    orderBy: { createdAt: "asc" },
    include: { actor: { select: { id: true, name: true } } },
  },
} satisfies Prisma.PayrollRunInclude;

export type PayrollRunRow = Prisma.PayrollRunGetPayload<{ include: typeof payrollRunInclude }>;

export const payrollPayslipInclude = {
  run: {
    select: {
      id: true,
      status: true,
      period: {
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          paymentDate: true,
        },
      },
    },
  },
} satisfies Prisma.PayrollPayslipInclude;

export type PayrollPayslipRow = Prisma.PayrollPayslipGetPayload<{
  include: typeof payrollPayslipInclude;
}>;

export const payrollPayslipDetailInclude = {
  ...payrollPayslipInclude,
  lines: { orderBy: { createdAt: "asc" } },
  sources: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.PayrollPayslipInclude;

export type PayrollPayslipDetailRow = Prisma.PayrollPayslipGetPayload<{
  include: typeof payrollPayslipDetailInclude;
}>;

export const payrollAdjustmentInclude = {
  period: { select: { id: true, name: true, startDate: true, endDate: true } },
  employee: payrollEmployeeInclude,
  component: {
    select: { id: true, code: true, name: true, componentType: true },
  },
  createdBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
} satisfies Prisma.PayrollAdjustmentInclude;

export type PayrollAdjustmentRow = Prisma.PayrollAdjustmentGetPayload<{
  include: typeof payrollAdjustmentInclude;
}>;

function employeeRef(row: CompensationRow["employee"]) {
  return {
    id: row.id,
    employeeNumber: row.employeeNumber,
    fullName: displayName(row),
    department: row.department?.name ?? null,
    position: row.position?.title ?? null,
  };
}

export function toCompensation(row: CompensationRow): EmployeeCompensation {
  return {
    id: row.id,
    employee: employeeRef(row.employee),
    baseSalary: row.baseSalary.toString(),
    currency: row.currency,
    paymentFrequency: row.paymentFrequency,
    effectiveFrom: isoDate(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? isoDate(row.effectiveTo) : null,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPayrollComponent(row: PayrollComponentRow): PayrollComponent {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    componentType: row.componentType,
    calculationType: row.calculationType,
    defaultAmount: row.defaultAmount.toString(),
    percentage: row.percentage?.toString() ?? null,
    rateMultiplier: row.rateMultiplier?.toString() ?? null,
    sourceType: row.sourceType,
    isTaxable: row.isTaxable,
    isRecurring: row.isRecurring,
    isActive: row.isActive,
    effectiveFrom: isoDate(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? isoDate(row.effectiveTo) : null,
    assignmentCount: row._count.assignments,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPayrollAssignment(row: PayrollAssignmentRow): EmployeePayrollAssignment {
  return {
    id: row.id,
    employee: employeeRef(row.employee),
    component: row.component,
    amountOverride: row.amountOverride?.toString() ?? null,
    effectiveFrom: isoDate(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? isoDate(row.effectiveTo) : null,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toPayrollPeriod(row: PayrollPeriodRow): PayrollPeriod {
  return {
    id: row.id,
    name: row.name,
    startDate: isoDate(row.startDate),
    endDate: isoDate(row.endDate),
    paymentDate: isoDate(row.paymentDate),
    status: row.status,
    notes: row.notes,
    runCount: row._count.runs,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function warningsOf(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function toRunApproval(row: PayrollRunRow["approvals"][number]): PayrollRunApproval {
  return {
    id: row.id,
    action: row.action,
    actor: row.actor,
    actorName: row.actorName,
    comment: row.comment,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toPayrollRun(row: PayrollRunRow): PayrollRun {
  return {
    id: row.id,
    period: {
      id: row.period.id,
      name: row.period.name,
      startDate: isoDate(row.period.startDate),
      endDate: isoDate(row.period.endDate),
      paymentDate: isoDate(row.period.paymentDate),
      status: row.period.status,
    },
    runNumber: row.runNumber,
    status: row.status,
    calculationVersion: row.calculationVersion,
    currency: row.currency,
    grossTotal: row.grossTotal.toString(),
    deductionTotal: row.deductionTotal.toString(),
    netTotal: row.netTotal.toString(),
    employerContributionTotal: row.employerContributionTotal.toString(),
    warnings: warningsOf(row.warnings),
    employeeCount: row._count.payslips,
    calculatedAt: row.calculatedAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelReason: row.cancelReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPayrollRunDetail(row: PayrollRunRow): PayrollRunDetail {
  return { ...toPayrollRun(row), approvals: row.approvals.map(toRunApproval) };
}

export function toPayrollPayslip(row: PayrollPayslipRow): PayrollPayslip {
  return {
    id: row.id,
    runId: row.runId,
    period: {
      id: row.run.period.id,
      name: row.run.period.name,
      startDate: isoDate(row.run.period.startDate),
      endDate: isoDate(row.run.period.endDate),
      paymentDate: isoDate(row.run.period.paymentDate),
    },
    employeeId: row.employeeId,
    employeeNumber: row.employeeNumberSnapshot,
    employeeName: row.employeeNameSnapshot,
    department: row.departmentSnapshot,
    position: row.positionSnapshot,
    currency: row.currency,
    baseSalary: row.baseSalary.toString(),
    grossPay: row.grossPay.toString(),
    totalDeductions: row.totalDeductions.toString(),
    employerContributions: row.employerContributions.toString(),
    netPay: row.netPay.toString(),
    warnings: warningsOf(row.warnings),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toLine(row: PayrollPayslipDetailRow["lines"][number]): PayrollLine {
  return {
    id: row.id,
    componentId: row.componentId,
    code: row.code,
    name: row.name,
    componentType: row.componentType,
    calculationType: row.calculationType,
    quantity: row.quantity?.toString() ?? null,
    rate: row.rate?.toString() ?? null,
    amount: row.amount.toString(),
    sourceType: row.sourceType,
    notes: row.notes,
  };
}

function toSource(row: PayrollPayslipDetailRow["sources"][number]): PayrollSource {
  return {
    id: row.id,
    kind: row.kind as PayrollSourceKind,
    sourceId: row.sourceId,
    reference: (row.reference as Record<string, unknown> | null) ?? null,
    quantity: row.quantity?.toString() ?? null,
    amount: row.amount?.toString() ?? null,
  };
}

export function toPayrollPayslipDetail(row: PayrollPayslipDetailRow): PayrollPayslipDetail {
  return {
    ...toPayrollPayslip(row),
    lines: row.lines.map(toLine),
    sources: row.sources.map(toSource),
    compensationSnapshot: row.compensationSnapshot as Record<string, unknown>,
    assignmentSnapshot: row.assignmentSnapshot as Record<string, unknown>,
    attendanceSnapshot: row.attendanceSnapshot as Record<string, unknown>,
    leaveSnapshot: row.leaveSnapshot as Record<string, unknown>,
    overtimeSnapshot: row.overtimeSnapshot as Record<string, unknown>,
    adjustmentSnapshot: row.adjustmentSnapshot as Record<string, unknown>,
    settingsSnapshot: row.settingsSnapshot as Record<string, unknown>,
  };
}

export function toPayrollAdjustment(row: PayrollAdjustmentRow): PayrollAdjustment {
  return {
    id: row.id,
    period: {
      id: row.period.id,
      name: row.period.name,
      startDate: isoDate(row.period.startDate),
      endDate: isoDate(row.period.endDate),
    },
    employee: employeeRef(row.employee),
    component: row.component,
    amount: row.amount.toString(),
    reason: row.reason,
    status: row.status,
    createdBy: row.createdBy,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewComment: row.reviewComment,
    createdAt: row.createdAt.toISOString(),
  };
}
