import { Injectable } from "@nestjs/common";
import type {
  PayrollComponentReport,
  PayrollComponentReportRow,
  PayrollRegister,
  PayrollRegisterRow,
  PayrollReportSummary,
} from "@peopleops/shared-types";
import { toPageMeta } from "../../common/dto/page-query.dto";
import { dateKeyOf } from "../../common/time/zoned-time";
import { PrismaService } from "../../prisma/prisma.service";
import { decimal, isoDate, money } from "./payroll.utils";

@Injectable()
export class PayrollReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(from?: string, to?: string): Promise<PayrollReportSummary> {
    const range = await this.range(from, to);
    const runs = await this.runs(range);
    const totals = runs.reduce(
      (acc, run) => ({
        gross: acc.gross.plus(decimal(run.grossTotal)),
        deductions: acc.deductions.plus(decimal(run.deductionTotal)),
        net: acc.net.plus(decimal(run.netTotal)),
        employer: acc.employer.plus(decimal(run.employerContributionTotal)),
      }),
      {
        gross: decimal(0),
        deductions: decimal(0),
        net: decimal(0),
        employer: decimal(0),
      },
    );
    return {
      from: range.from,
      to: range.to,
      runCount: runs.length,
      payslipCount: runs.reduce((sum, run) => sum + run._count.payslips, 0),
      grossTotal: totals.gross.toFixed(2),
      deductionTotal: totals.deductions.toFixed(2),
      netTotal: totals.net.toFixed(2),
      employerContributionTotal: totals.employer.toFixed(2),
      rows: [
        { label: "Gross pay", amount: totals.gross.toFixed(2) },
        { label: "Deductions", amount: totals.deductions.toFixed(2) },
        { label: "Net pay", amount: totals.net.toFixed(2) },
        { label: "Employer contributions", amount: totals.employer.toFixed(2) },
      ],
    };
  }

  async components(from?: string, to?: string): Promise<PayrollComponentReport> {
    const range = await this.range(from, to);
    const runs = await this.runs(range);
    if (runs.length === 0) return { ...range, rows: [] };
    const lines = await this.prisma.payrollLine.findMany({
      where: { payslip: { runId: { in: runs.map((run) => run.id) } } },
      select: {
        code: true,
        name: true,
        componentType: true,
        amount: true,
        payslipId: true,
      },
    });
    const map = new Map<string, { row: PayrollComponentReportRow; employees: Set<string> }>();
    for (const line of lines) {
      const key = `${line.code}:${line.componentType}`;
      const entry = map.get(key) ?? {
        row: {
          code: line.code,
          name: line.name,
          componentType: line.componentType,
          employeeCount: 0,
          totalAmount: "0.00",
        },
        employees: new Set<string>(),
      };
      entry.row.totalAmount = money(
        decimal(entry.row.totalAmount).plus(decimal(line.amount)),
      ).toFixed(2);
      entry.employees.add(line.payslipId);
      entry.row.employeeCount = entry.employees.size;
      map.set(key, entry);
    }
    return {
      ...range,
      rows: [...map.values()]
        .map((entry) => entry.row)
        .sort((a, b) => a.componentType.localeCompare(b.componentType) || a.code.localeCompare(b.code)),
    };
  }

  async register(
    from?: string,
    to?: string,
    page = 1,
    pageSize = 20,
  ): Promise<PayrollRegister> {
    const range = await this.range(from, to);
    const runs = await this.runs(range);
    if (runs.length === 0) {
      return {
        ...range,
        rows: [],
        totals: { grossPay: "0.00", totalDeductions: "0.00", netPay: "0.00", employerContributions: "0.00" },
        ...toPageMeta(page, pageSize, 0),
      };
    }
    const where = { runId: { in: runs.map((run) => run.id) } };
    const [total, sums, payslips] = await this.prisma.$transaction([
      this.prisma.payrollPayslip.count({ where }),
      this.prisma.payrollPayslip.aggregate({
        where,
        _sum: {
          grossPay: true,
          totalDeductions: true,
          netPay: true,
          employerContributions: true,
        },
      }),
      this.prisma.payrollPayslip.findMany({
        where,
        include: { run: { select: { status: true, period: { select: { paymentDate: true } } } } },
        orderBy: [{ employeeNumberSnapshot: "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const rows: PayrollRegisterRow[] = payslips.map((row) => ({
      payslipId: row.id,
      employeeId: row.employeeId,
      employeeNumber: row.employeeNumberSnapshot,
      employeeName: row.employeeNameSnapshot,
      department: row.departmentSnapshot,
      position: row.positionSnapshot,
      currency: row.currency,
      grossPay: row.grossPay.toFixed(2),
      totalDeductions: row.totalDeductions.toFixed(2),
      netPay: row.netPay.toFixed(2),
      employerContributions: row.employerContributions.toFixed(2),
      status: row.run.status,
      paymentDate: isoDate(row.run.period.paymentDate),
    }));
    return {
      ...range,
      rows,
      totals: {
        grossPay: decimal(sums._sum.grossPay ?? 0).toFixed(2),
        totalDeductions: decimal(sums._sum.totalDeductions ?? 0).toFixed(2),
        netPay: decimal(sums._sum.netPay ?? 0).toFixed(2),
        employerContributions: decimal(sums._sum.employerContributions ?? 0).toFixed(2),
      },
      ...toPageMeta(page, pageSize, total),
    };
  }

  private async range(from?: string, to?: string): Promise<{ from: string; to: string }> {
    if (from && to) return { from, to };
    const company = await this.prisma.company.findFirst({ select: { timezone: true } });
    const today = dateKeyOf(new Date(), company?.timezone ?? "Asia/Jakarta");
    return { from: from ?? `${today.slice(0, 7)}-01`, to: to ?? today };
  }

  private runs(range: { from: string; to: string }) {
    return this.prisma.payrollRun.findMany({
      where: {
        status: { in: ["PUBLISHED", "LOCKED"] },
        period: { startDate: { lte: new Date(`${range.to}T23:59:59.999Z`) }, endDate: { gte: new Date(`${range.from}T00:00:00.000Z`) } },
      },
      include: { _count: { select: { payslips: true } } },
      orderBy: { createdAt: "desc" },
    });
  }
}
