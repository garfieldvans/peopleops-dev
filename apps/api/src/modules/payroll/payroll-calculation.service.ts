import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import type {
  PayrollCalculationType,
  PayrollComponentType,
  PayrollSourceType,
} from "@peopleops/shared-types";
import Decimal from "decimal.js";
import { PrismaService } from "../../prisma/prisma.service";
import { decimal, displayName, isoDate, money, percentOf } from "./payroll.utils";

type EmployeeRow = Prisma.EmployeeGetPayload<{
  include: { department: true; position: true };
}>;

type CompensationRow = Prisma.EmployeeCompensationGetPayload<object>;

interface LineInput {
  componentId: string | null;
  code: string;
  name: string;
  componentType: PayrollComponentType;
  calculationType: PayrollCalculationType;
  quantity: string | null;
  rate: string | null;
  amount: string;
  sourceType: PayrollSourceType | null;
  notes: string | null;
}

interface SourceInput {
  kind: "ATTENDANCE" | "LEAVE" | "OVERTIME" | "ADJUSTMENT";
  sourceId: string;
  reference: Prisma.InputJsonValue;
  quantity: string | null;
  amount: string | null;
}

interface PayslipInput {
  employee: EmployeeRow;
  compensation: CompensationRow | null;
  lines: LineInput[];
  sources: SourceInput[];
  warnings: string[];
  baseSalary: Decimal;
  grossPay: Decimal;
  totalDeductions: Decimal;
  employerContributions: Decimal;
  netPay: Decimal;
  compensationSnapshot: Prisma.InputJsonValue;
  assignmentSnapshot: Prisma.InputJsonValue;
  attendanceSnapshot: Prisma.InputJsonValue;
  leaveSnapshot: Prisma.InputJsonValue;
  overtimeSnapshot: Prisma.InputJsonValue;
  adjustmentSnapshot: Prisma.InputJsonValue;
}

const CALCULABLE_STATUSES = ["DRAFT", "CALCULATED", "UNDER_REVIEW"] as const;

@Injectable()
export class PayrollCalculationService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(runId: string): Promise<void> {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id: runId },
      include: { period: true },
    });
    if (!run) {
      throw new NotFoundException({
        code: "PAYROLL_RUN_NOT_FOUND",
        message: "Payroll run not found",
      });
    }
    if (!CALCULABLE_STATUSES.includes(run.status as (typeof CALCULABLE_STATUSES)[number])) {
      throw new ConflictException({
        code: "PAYROLL_RUN_NOT_CALCULABLE",
        message: "Only draft, calculated, or under-review runs can be calculated",
      });
    }

    const previousStatus = run.status;
    const claimed = await this.prisma.payrollRun.updateMany({
      where: { id: runId, status: previousStatus },
      data: { status: "CALCULATING" },
    });
    if (claimed.count === 0) {
      throw new ConflictException({
        code: "PAYROLL_RUN_BUSY",
        message: "Another calculation is already running for this payroll run",
      });
    }

    try {
      const payslips = await this.buildPayslips(run);
      const totals = payslips.reduce(
        (acc, row) => ({
          gross: acc.gross.plus(row.grossPay),
          deductions: acc.deductions.plus(row.totalDeductions),
          employer: acc.employer.plus(row.employerContributions),
          net: acc.net.plus(row.netPay),
        }),
        {
          gross: new Decimal(0),
          deductions: new Decimal(0),
          employer: new Decimal(0),
          net: new Decimal(0),
        },
      );
      const warnings = [...new Set(payslips.flatMap((row) => row.warnings))];

      await this.prisma.$transaction(async (tx) => {
        await tx.payrollPayslip.deleteMany({ where: { runId } });
        for (const row of payslips) {
          await tx.payrollPayslip.create({
            data: {
              runId,
              employeeId: row.employee.id,
              employeeNumberSnapshot: row.employee.employeeNumber,
              employeeNameSnapshot: displayName(row.employee),
              departmentSnapshot: row.employee.department?.name ?? null,
              positionSnapshot: row.employee.position?.title ?? null,
              currency: row.compensation?.currency ?? run.currency,
              baseSalary: row.baseSalary.toFixed(2),
              grossPay: row.grossPay.toFixed(2),
              totalDeductions: row.totalDeductions.toFixed(2),
              employerContributions: row.employerContributions.toFixed(2),
              netPay: row.netPay.toFixed(2),
              compensationSnapshot: row.compensationSnapshot,
              assignmentSnapshot: row.assignmentSnapshot,
              attendanceSnapshot: row.attendanceSnapshot,
              leaveSnapshot: row.leaveSnapshot,
              overtimeSnapshot: row.overtimeSnapshot,
              adjustmentSnapshot: row.adjustmentSnapshot,
              settingsSnapshot: {
                standardMonthlyHours: run.standardMonthlyHours.toString(),
                standardMonthlyDays: run.standardMonthlyDays.toString(),
                roundingMode: run.roundingMode,
                currencyScale: run.currencyScale,
              },
              warnings: row.warnings,
              lines: { create: row.lines },
              sources: { create: row.sources },
            },
          });
        }
        await tx.payrollRun.update({
          where: { id: runId },
          data: {
            status: "CALCULATED",
            calculationVersion: { increment: 1 },
            grossTotal: totals.gross.toFixed(2),
            deductionTotal: totals.deductions.toFixed(2),
            netTotal: totals.net.toFixed(2),
            employerContributionTotal: totals.employer.toFixed(2),
            warnings,
            calculatedAt: new Date(),
            reviewedAt: null,
            approvedAt: null,
            approvedById: null,
          },
        });
      });
    } catch (error) {
      await this.prisma.payrollRun.updateMany({
        where: { id: runId, status: "CALCULATING" },
        data: { status: previousStatus },
      });
      throw error;
    }
  }

  private async buildPayslips(
    run: Prisma.PayrollRunGetPayload<{ include: { period: true } }>,
  ): Promise<PayslipInput[]> {
    const start = run.period.startDate;
    const end = run.period.endDate;
    const scale = run.currencyScale;
    const rounding = run.roundingMode;
    const employees = await this.prisma.employee.findMany({
      where: {
        employmentStatus: { in: ["ACTIVE", "PROBATION"] },
        joinDate: { lte: end },
      },
      include: { department: true, position: true },
      orderBy: { employeeNumber: "asc" },
    });
    const employeeIds = employees.map((employee) => employee.id);
    if (employeeIds.length === 0) return [];

    const [compensations, assignments, adjustments, attendance, leaves, overtime, components] =
      await Promise.all([
        this.prisma.employeeCompensation.findMany({
          where: {
            employeeId: { in: employeeIds },
            status: "ACTIVE",
            effectiveFrom: { lte: end },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
          },
          orderBy: { effectiveFrom: "desc" },
        }),
        this.prisma.employeePayrollAssignment.findMany({
          where: {
            employeeId: { in: employeeIds },
            status: "ACTIVE",
            effectiveFrom: { lte: end },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
            component: {
              isActive: true,
              effectiveFrom: { lte: end },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
            },
          },
          include: { component: true },
          orderBy: { effectiveFrom: "desc" },
        }),
        this.prisma.payrollAdjustment.findMany({
          where: { periodId: run.periodId, status: "APPROVED", employeeId: { in: employeeIds } },
          include: { component: true },
          orderBy: { createdAt: "asc" },
        }),
        this.prisma.attendanceRecord.findMany({
          where: { employeeId: { in: employeeIds }, workDate: { gte: start, lte: end } },
          orderBy: { workDate: "asc" },
        }),
        this.prisma.leaveRequest.findMany({
          where: {
            employeeId: { in: employeeIds },
            status: "APPROVED",
            startDate: { lte: end },
            endDate: { gte: start },
            leaveType: { isPaid: false },
          },
          include: { leaveType: true, days: true },
          orderBy: { startDate: "asc" },
        }),
        this.prisma.overtimeRequest.findMany({
          where: {
            employeeId: { in: employeeIds },
            status: "VERIFIED",
            workDate: { gte: start, lte: end },
          },
          orderBy: { workDate: "asc" },
        }),
        this.prisma.payrollComponent.findMany({
          where: {
            isActive: true,
            calculationType: "SOURCE_BASED",
            effectiveFrom: { lte: end },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
          },
          orderBy: { code: "asc" },
        }),
      ]);

    const overtimeIds = overtime.map((row) => row.id);
    if (overtimeIds.length > 0) {
      const consumed = await this.prisma.payrollSource.findMany({
        where: {
          kind: "OVERTIME",
          sourceId: { in: overtimeIds },
          payslip: { run: { id: { not: run.id }, status: { not: "CANCELLED" } } },
        },
        select: { sourceId: true },
      });
      if (consumed.length > 0) {
        throw new ConflictException({
          code: "PAYROLL_OVERTIME_ALREADY_CONSUMED",
          message: "One or more verified overtime records are already used by another payroll run",
          details: { sourceIds: consumed.map((row) => row.sourceId) },
        });
      }
    }

    const byEmployee = <T extends { employeeId: string }>(rows: T[]) => {
      const map = new Map<string, T[]>();
      for (const row of rows) {
        const list = map.get(row.employeeId) ?? [];
        list.push(row);
        map.set(row.employeeId, list);
      }
      return map;
    };
    const compensationMap = new Map<string, CompensationRow>();
    for (const row of compensations) {
      const coversEnd = !row.effectiveTo || row.effectiveTo >= end;
      if (!compensationMap.has(row.employeeId) && row.effectiveFrom <= end && coversEnd) {
        compensationMap.set(row.employeeId, row);
      }
    }
    const assignmentMap = byEmployee(assignments);
    const adjustmentMap = byEmployee(adjustments);
    const attendanceMap = byEmployee(attendance);
    const leaveMap = byEmployee(leaves);
    const overtimeMap = byEmployee(overtime);
    const sourceComponents = new Map<PayrollSourceType, typeof components>();
    for (const component of components) {
      if (!component.sourceType) continue;
      const list = sourceComponents.get(component.sourceType) ?? [];
      list.push(component);
      sourceComponents.set(component.sourceType, list);
    }

    return employees.map((employee) => {
      const compensation = compensationMap.get(employee.id) ?? null;
      const base = compensation ? decimal(compensation.baseSalary) : new Decimal(0);
      const hourly = decimal(run.standardMonthlyHours).gt(0)
        ? base.div(decimal(run.standardMonthlyHours))
        : new Decimal(0);
      const daily = decimal(run.standardMonthlyDays).gt(0)
        ? base.div(decimal(run.standardMonthlyDays))
        : new Decimal(0);
      const employeeAssignments = assignmentMap.get(employee.id) ?? [];
      const employeeAdjustments = adjustmentMap.get(employee.id) ?? [];
      const employeeAttendance = attendanceMap.get(employee.id) ?? [];
      const employeeLeaves = leaveMap.get(employee.id) ?? [];
      const employeeOvertime = overtimeMap.get(employee.id) ?? [];
      const warnings = new Set<string>();
      const lines: LineInput[] = [];
      const sources: SourceInput[] = [];

      if (!compensation) {
        warnings.add("NO_COMPENSATION");
      } else if (compensation.effectiveFrom > start) {
        warnings.add("COMPENSATION_STARTS_MID_PERIOD");
      }

      if (compensation) {
        lines.push({
          componentId: null,
          code: "BASE_SALARY",
          name: "Base salary",
          componentType: "EARNING",
          calculationType: "FIXED_AMOUNT",
          quantity: null,
          rate: base.toFixed(6),
          amount: money(base, scale, rounding).toFixed(scale),
          sourceType: null,
          notes: "Base salary from the effective compensation record",
        });
      }

      for (const assignment of employeeAssignments) {
        const component = assignment.component;
        if (component.calculationType === "MANUAL_AMOUNT") continue;
        if (component.calculationType === "SOURCE_BASED") continue;
        let amount = decimal(assignment.amountOverride ?? component.defaultAmount);
        if (component.calculationType === "PERCENTAGE") {
          amount = percentOf(base, decimal(component.percentage ?? 0));
        }
        lines.push({
          componentId: component.id,
          code: component.code,
          name: component.name,
          componentType: component.componentType,
          calculationType: component.calculationType,
          quantity: null,
          rate: amount.toFixed(6),
          amount: money(amount, scale, rounding).toFixed(scale),
          sourceType: null,
          notes: assignment.notes,
        });
      }

      const addSourceLine = (
        sourceType: PayrollSourceType,
        quantity: Decimal,
        rate: Decimal,
        reference: Prisma.InputJsonValue,
        sourceId: string,
        kind: "ATTENDANCE" | "LEAVE" | "OVERTIME",
      ) => {
        const candidates = sourceComponents.get(sourceType) ?? [];
        if (candidates.length === 0) {
          if (sourceType === "OVERTIME") warnings.add("OVERTIME_RATE_NOT_CONFIGURED");
          return;
        }
        if (candidates.length > 1) warnings.add(`MULTIPLE_${sourceType}_COMPONENTS`);
        const component = candidates[0]!;
        const multiplier = decimal(component.rateMultiplier ?? 1);
        const amount = money(rate.mul(multiplier).mul(quantity), scale, rounding);
        lines.push({
          componentId: component.id,
          code: component.code,
          name: component.name,
          componentType: component.componentType,
          calculationType: "SOURCE_BASED",
          quantity: quantity.toFixed(4),
          rate: rate.toFixed(6),
          amount: amount.toFixed(scale),
          sourceType,
          notes: null,
        });
        sources.push({
          kind,
          sourceId,
          reference,
          quantity: quantity.toFixed(4),
          amount: amount.toFixed(scale),
        });
      };

      const absent = employeeAttendance.filter((row) => row.status === "ABSENT");
      if (absent.length > 0) {
        addSourceLine(
          "ABSENCE",
          new Decimal(absent.length),
          daily,
          { count: absent.length, dates: absent.map((row) => isoDate(row.workDate)) },
          absent[0]!.id,
          "ATTENDANCE",
        );
      }
      const lateMinutes = employeeAttendance.reduce((sum, row) => sum + row.lateMinutes, 0);
      if (lateMinutes > 0) {
        addSourceLine(
          "LATE",
          decimal(lateMinutes).div(60),
          hourly,
          { minutes: lateMinutes },
          employeeAttendance[0]!.id,
          "ATTENDANCE",
        );
      }
      const earlyMinutes = employeeAttendance.reduce((sum, row) => sum + row.earlyLeaveMinutes, 0);
      if (earlyMinutes > 0) {
        addSourceLine(
          "EARLY_LEAVE",
          decimal(earlyMinutes).div(60),
          hourly,
          { minutes: earlyMinutes },
          employeeAttendance[0]!.id,
          "ATTENDANCE",
        );
      }
      const incomplete = employeeAttendance.filter((row) => row.status === "INCOMPLETE");
      if (incomplete.length > 0) warnings.add("INCOMPLETE_ATTENDANCE");

      const leaveDays = employeeLeaves.reduce(
        (sum, leave) =>
          sum.plus(
            leave.days
              .filter((day) => day.date >= start && day.date <= end)
              .reduce((days, day) => days.plus(decimal(day.duration)), new Decimal(0)),
          ),
        new Decimal(0),
      );
      if (leaveDays.gt(0)) {
        for (const leave of employeeLeaves) {
          const days = leave.days
            .filter((day) => day.date >= start && day.date <= end)
            .reduce((sum, day) => sum.plus(decimal(day.duration)), new Decimal(0));
          if (days.lte(0)) continue;
          addSourceLine(
            "UNPAID_LEAVE",
            days,
            daily,
            { leaveType: leave.leaveType.name, startDate: isoDate(leave.startDate), endDate: isoDate(leave.endDate) },
            leave.id,
            "LEAVE",
          );
        }
      }

      const overtimeMinutes = employeeOvertime.reduce(
        (sum, row) => sum + (row.verifiedMinutes ?? 0),
        0,
      );
      if (overtimeMinutes > 0) {
        const overtimeComponent = sourceComponents.get("OVERTIME")?.[0];
        if (!overtimeComponent) {
          warnings.add("OVERTIME_RATE_NOT_CONFIGURED");
        } else {
          for (const row of employeeOvertime) {
            const minutes = row.verifiedMinutes ?? 0;
            if (minutes <= 0) continue;
            addSourceLine(
              "OVERTIME",
              decimal(minutes).div(60),
              hourly,
              { workDate: isoDate(row.workDate), verifiedMinutes: minutes },
              row.id,
              "OVERTIME",
            );
          }
        }
      }

      for (const adjustment of employeeAdjustments) {
        lines.push({
          componentId: adjustment.component.id,
          code: adjustment.component.code,
          name: adjustment.component.name,
          componentType: adjustment.component.componentType,
          calculationType: "MANUAL_AMOUNT",
          quantity: null,
          rate: null,
          amount: money(decimal(adjustment.amount), scale, rounding).toFixed(scale),
          sourceType: null,
          notes: adjustment.reason,
        });
        sources.push({
          kind: "ADJUSTMENT",
          sourceId: adjustment.id,
          reference: {
            component: adjustment.component.code,
            reason: adjustment.reason,
            amount: adjustment.amount.toString(),
          },
          quantity: null,
          amount: money(decimal(adjustment.amount), scale, rounding).toFixed(scale),
        });
      }

      const gross = lines
        .filter((line) => line.componentType === "EARNING")
        .reduce((sum, line) => sum.plus(decimal(line.amount)), new Decimal(0));
      const deductions = lines
        .filter((line) => line.componentType === "DEDUCTION")
        .reduce((sum, line) => sum.plus(decimal(line.amount)), new Decimal(0));
      const employer = lines
        .filter((line) => line.componentType === "EMPLOYER_CONTRIBUTION")
        .reduce((sum, line) => sum.plus(decimal(line.amount)), new Decimal(0));
      const net = gross.minus(deductions);
      if (net.lt(0)) warnings.add("NEGATIVE_NET_PAY");

      return {
        employee,
        compensation,
        lines,
        sources,
        warnings: [...warnings],
        baseSalary: base,
        grossPay: money(gross, scale, rounding),
        totalDeductions: money(deductions, scale, rounding),
        employerContributions: money(employer, scale, rounding),
        netPay: money(net, scale, rounding),
        compensationSnapshot: compensation
          ? {
              id: compensation.id,
              baseSalary: compensation.baseSalary.toString(),
              currency: compensation.currency,
              paymentFrequency: compensation.paymentFrequency,
              effectiveFrom: isoDate(compensation.effectiveFrom),
              effectiveTo: compensation.effectiveTo ? isoDate(compensation.effectiveTo) : null,
            }
          : { missing: true },
        assignmentSnapshot: employeeAssignments.map((assignment) => ({
          id: assignment.id,
          componentCode: assignment.component.code,
          amountOverride: assignment.amountOverride?.toString() ?? null,
          effectiveFrom: isoDate(assignment.effectiveFrom),
          effectiveTo: assignment.effectiveTo ? isoDate(assignment.effectiveTo) : null,
        })),
        attendanceSnapshot: {
          records: employeeAttendance.length,
          absentDays: absent.length,
          lateMinutes,
          earlyLeaveMinutes: earlyMinutes,
          incompleteRecords: incomplete.length,
        },
        leaveSnapshot: employeeLeaves.map((leave) => ({
          id: leave.id,
          leaveType: leave.leaveType.name,
          startDate: isoDate(leave.startDate),
          endDate: isoDate(leave.endDate),
          days: leave.days
            .filter((day) => day.date >= start && day.date <= end)
            .reduce((sum, day) => sum.plus(decimal(day.duration)), new Decimal(0))
            .toString(),
        })),
        overtimeSnapshot: employeeOvertime.map((row) => ({
          id: row.id,
          workDate: isoDate(row.workDate),
          verifiedMinutes: row.verifiedMinutes,
        })),
        adjustmentSnapshot: employeeAdjustments.map((adjustment) => ({
          id: adjustment.id,
          componentCode: adjustment.component.code,
          amount: adjustment.amount.toString(),
          reason: adjustment.reason,
        })),
      };
    });
  }
}
