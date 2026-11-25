import { Injectable } from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import { calculatePeriodTotals, dateKeyOf } from "@peopleops/leave-engine";
import type { LeaveReportRow, LeaveReportSummary } from "@peopleops/shared-types";
import { csvCell } from "../../common/export/csv-cell";
import { PrismaService } from "../../prisma/prisma.service";
import type { LeaveReportQueryDto } from "./dto/leave.dto";
import { displayName } from "./leave.mapper";

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

@Injectable()
export class LeaveReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(query: LeaveReportQueryDto): Promise<LeaveReportSummary> {
    const where: Prisma.LeaveRequestWhereInput = {
      startDate: { lte: dateOnly(query.to) },
      endDate: { gte: dateOnly(query.from) },
      ...(query.leaveTypeId ? { leaveTypeId: query.leaveTypeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.branchId || query.departmentId
        ? {
            employee: {
              ...(query.branchId ? { branchId: query.branchId } : {}),
              ...(query.departmentId ? { departmentId: query.departmentId } : {}),
            },
          }
        : {}),
    };
    const [requestCount, approvedCount, pendingCount, rejectedCount, approved] = await Promise.all([
      this.prisma.leaveRequest.count({ where }),
      this.prisma.leaveRequest.count({ where: { ...where, status: "APPROVED" } }),
      this.prisma.leaveRequest.count({ where: { ...where, status: "PENDING" } }),
      this.prisma.leaveRequest.count({ where: { ...where, status: "REJECTED" } }),
      this.prisma.leaveRequest.findMany({
        where: { ...where, status: "APPROVED" },
        select: { duration: true },
      }),
    ]);
    const totalDays = approved.reduce((total, row) => total + Number(row.duration), 0);

    const periodWhere: Prisma.LeaveEntitlementPeriodWhereInput = {
      periodStart: { lte: dateOnly(query.to) },
      periodEnd: { gte: dateOnly(query.from) },
      ...(query.leaveTypeId ? { leaveTypeId: query.leaveTypeId } : {}),
      ...(query.branchId || query.departmentId
        ? {
            employee: {
              ...(query.branchId ? { branchId: query.branchId } : {}),
              ...(query.departmentId ? { departmentId: query.departmentId } : {}),
            },
          }
        : {}),
    };
    const periods = await this.prisma.leaveEntitlementPeriod.findMany({
      where: periodWhere,
      select: {
        id: true,
        employeeId: true,
        leaveTypeId: true,
        periodStart: true,
        periodEnd: true,
        entitlementUnit: true,
        employee: {
          select: {
            employeeNumber: true,
            firstName: true,
            lastName: true,
            preferredName: true,
            branch: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
        leaveType: { select: { name: true } },
      },
      orderBy: [{ employee: { firstName: "asc" } }, { leaveType: { name: "asc" } }],
    });
    const rows: LeaveReportRow[] = [];
    for (const period of periods) {
      const totals = await calculatePeriodTotals(this.prisma, period.id);
      rows.push({
        employeeId: period.employeeId,
        employeeNumber: period.employee.employeeNumber,
        employeeName: displayName(period.employee),
        branch: period.employee.branch?.name ?? null,
        department: period.employee.department?.name ?? null,
        leaveType: period.leaveType.name,
        entitled: totals.entitled,
        used: totals.used,
        reserved: totals.reserved,
        available: totals.available,
      });
    }

    return {
      from: query.from,
      to: query.to,
      requestCount,
      approvedCount,
      pendingCount,
      rejectedCount,
      totalDays,
      rows,
    };
  }

  async exportCsv(query: LeaveReportQueryDto): Promise<string> {
    const summary = await this.summary(query);
    const header = [
      "employee_number",
      "employee_name",
      "branch",
      "department",
      "leave_type",
      "entitled",
      "used",
      "reserved",
      "available",
    ];
    const lines = summary.rows.map((row) =>
      [
        row.employeeNumber,
        row.employeeName,
        row.branch ?? "",
        row.department ?? "",
        row.leaveType,
        String(row.entitled),
        String(row.used),
        String(row.reserved),
        String(row.available),
      ]
        .map(csvCell)
        .join(","),
    );
    return `\uFEFF${[header.join(","), ...lines].join("\r\n")}`;
  }

  static periodKey(row: { periodStart: Date; periodEnd: Date }): string {
    return `${dateKeyOf(row.periodStart)}..${dateKeyOf(row.periodEnd)}`;
  }
}
