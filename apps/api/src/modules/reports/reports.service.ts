import { Injectable } from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import type {
  AttendanceLeaveReport,
  CompletionReport,
  CsvExport,
  EmployeeReport,
  HrDashboard,
  LearningReport,
  OffboardingReport,
  OnboardingReport,
  OvertimePayrollReport,
  PerformanceReport,
} from "@peopleops/shared-types";
import Decimal from "decimal.js";
import { toPageMeta } from "../../common/dto/page-query.dto";
import { dateKeyOf } from "../../common/time/zoned-time";
import { PrismaService } from "../../prisma/prisma.service";
import { dateKey, isoDate } from "../onboarding/onboarding.utils";
import type {
  EmployeeReportQueryDto,
  ExportReportQueryDto,
  PerformanceReportQueryDto,
  ReportRangeQueryDto,
} from "./dto/reports.dto";

const ACTIVE_TRAINING = ["REQUESTED", "APPROVED", "ENROLLED", "IN_PROGRESS", "COMPLETED"];

function money(value: Decimal | Prisma.Decimal | null | undefined): string {
  return new Decimal(value?.toString() ?? "0").toFixed(2);
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async hrDashboard(): Promise<HrDashboard> {
    const today = await this.today();
    const monthStart = dateKey(`${today.slice(0, 7)}-01`);
    const [statusGroups, departmentGroups, newHires, resignations, pendingLeave, onboarding, offboarding, reviewsPending, training, payroll] =
      await Promise.all([
        this.prisma.employee.groupBy({ by: ["employmentStatus"], _count: { _all: true } }),
        this.prisma.employee.groupBy({ by: ["departmentId"], _count: { _all: true } }),
        this.prisma.employee.count({ where: { joinDate: { gte: monthStart } } }),
        this.prisma.employeeOffboarding.count({
          where: { status: "COMPLETED", completedAt: { gte: monthStart } },
        }),
        this.prisma.leaveRequest.count({ where: { status: "PENDING" } }),
        this.prisma.employeeOnboarding.count({ where: { status: "IN_PROGRESS" } }),
        this.prisma.employeeOffboarding.count({ where: { status: "IN_PROGRESS" } }),
        this.prisma.performanceReview.count({ where: { status: "DRAFT" } }),
        this.prisma.trainingEnrollment.findMany({
          where: { status: { in: ACTIVE_TRAINING as never } },
          distinct: ["employeeId"],
          select: { employeeId: true },
        }),
        this.prisma.payrollRun.aggregate({
          where: {
            status: { in: ["PUBLISHED", "LOCKED"] },
            period: {
              startDate: { lte: dateKey(today) },
              endDate: { gte: monthStart },
            },
          },
          _sum: { netTotal: true },
        }),
      ]);
    const departments = await this.prisma.department.findMany({
      where: { id: { in: departmentGroups.map((group) => group.departmentId).filter(Boolean) as string[] } },
      select: { id: true, name: true },
    });
    const departmentName = new Map(departments.map((department) => [department.id, department.name]));
    const status = new Map(statusGroups.map((group) => [group.employmentStatus, group._count._all]));
    return {
      headcount: {
        total: statusGroups.reduce((sum, group) => sum + group._count._all, 0),
        active: status.get("ACTIVE") ?? 0,
        probation: status.get("PROBATION") ?? 0,
        inactive: status.get("INACTIVE") ?? 0,
        resigned: status.get("RESIGNED") ?? 0,
      },
      newHires,
      resignations,
      pendingLeave,
      onboardingInProgress: onboarding,
      offboardingInProgress: offboarding,
      reviewsPending,
      trainingParticipants: training.length,
      payrollNetThisMonth: money(payroll._sum.netTotal),
      byDepartment: departmentGroups
        .map((group) => ({
          department: group.departmentId ? departmentName.get(group.departmentId) ?? "Unknown" : "Unassigned",
          count: group._count._all,
        }))
        .sort((a, b) => b.count - a.count),
      byStatus: statusGroups.map((group) => ({
        status: group.employmentStatus,
        count: group._count._all,
      })),
    };
  }

  async employees(query: EmployeeReportQueryDto): Promise<EmployeeReport> {
    const where: Prisma.EmployeeWhereInput = {
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.status ? { employmentStatus: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" } },
              { lastName: { contains: query.search, mode: "insensitive" } },
              { employeeNumber: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({
        where,
        include: { department: { select: { name: true } }, position: { select: { title: true } } },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      rows: rows.map((row) => ({
        id: row.id,
        employeeNumber: row.employeeNumber,
        fullName: [row.firstName, row.middleName, row.lastName].filter(Boolean).join(" "),
        department: row.department?.name ?? null,
        position: row.position?.title ?? null,
        status: row.employmentStatus,
        joinDate: isoDate(row.joinDate)!,
      })),
      ...toPageMeta(query.page, query.pageSize, total),
    };
  }

  async attendanceAndLeave(query: ReportRangeQueryDto): Promise<AttendanceLeaveReport> {
    const range = await this.range(query);
    const employeeWhere = query.departmentId ? { departmentId: query.departmentId } : {};
    const attendanceWhere: Prisma.AttendanceRecordWhereInput = {
      workDate: { gte: dateKey(range.from), lte: dateKey(range.to) },
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.departmentId ? { employee: employeeWhere } : {}),
    };
    const leaveWhere: Prisma.LeaveRequestWhereInput = {
      status: "APPROVED",
      startDate: { lte: dateKey(range.to) },
      endDate: { gte: dateKey(range.from) },
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.departmentId ? { employee: employeeWhere } : {}),
    };
    const [attendanceGroups, pending, leaveGroups] = await Promise.all([
      this.prisma.attendanceRecord.groupBy({
        by: ["status"],
        where: attendanceWhere,
        _count: { _all: true },
      }),
      this.prisma.leaveRequest.count({
        where: { ...leaveWhere, status: "PENDING" },
      }),
      this.prisma.leaveRequest.groupBy({
        by: ["leaveTypeId"],
        where: leaveWhere,
        _sum: { duration: true },
      }),
    ]);
    const leaveTypes = await this.prisma.leaveType.findMany({
      where: { id: { in: leaveGroups.map((group) => group.leaveTypeId) } },
      select: { id: true, name: true },
    });
    const leaveName = new Map(leaveTypes.map((type) => [type.id, type.name]));
    const statusCount = (key: string) =>
      attendanceGroups.find((group) => group.status === key)?._count._all ?? 0;
    const approvedDays = leaveGroups.reduce(
      (sum, group) => sum.plus(group._sum.duration ?? 0),
      new Decimal(0),
    );
    return {
      attendance: {
        present: statusCount("PRESENT"),
        late: statusCount("LATE") + statusCount("LATE_AND_EARLY_LEAVE"),
        absent: statusCount("ABSENT"),
        incomplete: statusCount("INCOMPLETE"),
      },
      leave: {
        approvedDays: approvedDays.toFixed(2),
        pendingRequests: pending,
        utilization: leaveGroups
          .map((group) => ({
            leaveType: leaveName.get(group.leaveTypeId) ?? "Unknown",
            days: new Decimal(group._sum.duration?.toString() ?? "0").toFixed(2),
          }))
          .sort((a, b) => Number(b.days) - Number(a.days)),
      },
    };
  }

  async overtimeAndPayroll(query: ReportRangeQueryDto): Promise<OvertimePayrollReport> {
    const range = await this.range(query);
    const employeeFilter = query.departmentId ? { departmentId: query.departmentId } : {};
    const overtimeWhere: Prisma.OvertimeRequestWhereInput = {
      status: "VERIFIED",
      workDate: { gte: dateKey(range.from), lte: dateKey(range.to) },
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.departmentId ? { employee: employeeFilter } : {}),
    };
    const payrollWhere: Prisma.PayrollRunWhereInput = {
      status: { in: ["PUBLISHED", "LOCKED"] },
      period: {
        startDate: { lte: dateKey(range.to) },
        endDate: { gte: dateKey(range.from) },
      },
    };
    const [overtimeGroups, payrollRuns, payrollByDepartment] = await Promise.all([
      this.prisma.overtimeRequest.groupBy({
        by: ["employeeId"],
        where: overtimeWhere,
        _sum: { verifiedMinutes: true },
      }),
      this.prisma.payrollRun.aggregate({
        where: payrollWhere,
        _count: { _all: true },
        _sum: { grossTotal: true, deductionTotal: true, netTotal: true },
      }),
      this.prisma.payrollPayslip.groupBy({
        by: ["departmentSnapshot"],
        where: { run: payrollWhere },
        _sum: { netPay: true },
      }),
    ]);
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: overtimeGroups.map((group) => group.employeeId) } },
      select: { id: true, department: { select: { name: true } } },
    });
    const departmentByEmployee = new Map(
      employees.map((employee) => [employee.id, employee.department?.name ?? "Unassigned"]),
    );
    const byDepartment = new Map<string, number>();
    for (const group of overtimeGroups) {
      const department = departmentByEmployee.get(group.employeeId) ?? "Unassigned";
      byDepartment.set(
        department,
        (byDepartment.get(department) ?? 0) + (group._sum.verifiedMinutes ?? 0),
      );
    }
    return {
      overtime: {
        verifiedMinutes: overtimeGroups.reduce(
          (sum, group) => sum + (group._sum.verifiedMinutes ?? 0),
          0,
        ),
        employees: overtimeGroups.length,
        byDepartment: [...byDepartment.entries()]
          .map(([department, minutes]) => ({ department, minutes }))
          .sort((a, b) => b.minutes - a.minutes),
      },
      payroll: {
        publishedRuns: payrollRuns._count._all,
        grossTotal: money(payrollRuns._sum.grossTotal),
        deductionTotal: money(payrollRuns._sum.deductionTotal),
        netTotal: money(payrollRuns._sum.netTotal),
        byDepartment: payrollByDepartment
          .map((group) => ({
            department: group.departmentSnapshot ?? "Unassigned",
            netTotal: money(group._sum?.netPay),
          }))
          .sort((a, b) => Number(b.netTotal) - Number(a.netTotal)),
      },
    };
  }

  async onboarding(query: ReportRangeQueryDto): Promise<OnboardingReport> {
    const range = await this.range(query);
    const where: Prisma.EmployeeOnboardingWhereInput = {
      startDate: { gte: dateKey(range.from), lte: dateKey(range.to) },
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.departmentId ? { employee: { departmentId: query.departmentId } } : {}),
    };
    const today = await this.today();
    const [statusGroups, overdueTasks, byTemplate] = await Promise.all([
      this.prisma.employeeOnboarding.groupBy({ by: ["status"], where, _count: { _all: true } }),
      this.prisma.onboardingTask.count({
        where: {
          onboarding: where,
          status: { not: "COMPLETED" },
          dueDate: { lt: dateKey(today) },
        },
      }),
      this.prisma.employeeOnboarding.groupBy({
        by: ["templateId", "status"],
        where,
        _count: { _all: true },
      }),
    ]);
    const templates = await this.prisma.onboardingTemplate.findMany({
      where: { id: { in: [...new Set(byTemplate.map((row) => row.templateId))] } },
      select: { id: true, name: true },
    });
    const names = new Map(templates.map((template) => [template.id, template.name]));
    const grouped = new Map<string, { template: string; total: number; completed: number }>();
    for (const row of byTemplate) {
      const entry = grouped.get(row.templateId) ?? {
        template: names.get(row.templateId) ?? "Unknown",
        total: 0,
        completed: 0,
      };
      entry.total += row._count._all;
      if (row.status === "COMPLETED") entry.completed += row._count._all;
      grouped.set(row.templateId, entry);
    }
    const count = (status: string) =>
      statusGroups.find((group) => group.status === status)?._count._all ?? 0;
    return {
      total: statusGroups.reduce((sum, group) => sum + group._count._all, 0),
      completed: count("COMPLETED"),
      inProgress: count("IN_PROGRESS"),
      notStarted: count("NOT_STARTED"),
      cancelled: count("CANCELLED"),
      overdueTasks,
      byTemplate: [...grouped.values()].sort((a, b) => b.total - a.total),
    };
  }

  async offboarding(query: ReportRangeQueryDto): Promise<OffboardingReport> {
    const range = await this.range(query);
    const where: Prisma.EmployeeOffboardingWhereInput = {
      lastWorkingDate: { gte: dateKey(range.from), lte: dateKey(range.to) },
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.departmentId ? { employee: { departmentId: query.departmentId } } : {}),
    };
    const today = await this.today();
    const [statusGroups, overdueTasks, byReason] = await Promise.all([
      this.prisma.employeeOffboarding.groupBy({ by: ["status"], where, _count: { _all: true } }),
      this.prisma.offboardingTask.count({
        where: {
          offboarding: where,
          status: { not: "COMPLETED" },
          dueDate: { lt: dateKey(today) },
        },
      }),
      this.prisma.employeeOffboarding.groupBy({
        by: ["reasonCategory"],
        where,
        _count: { _all: true },
      }),
    ]);
    const count = (status: string) =>
      statusGroups.find((group) => group.status === status)?._count._all ?? 0;
    return {
      total: statusGroups.reduce((sum, group) => sum + group._count._all, 0),
      completed: count("COMPLETED"),
      inProgress: count("IN_PROGRESS"),
      initiated: count("INITIATED"),
      cancelled: count("CANCELLED"),
      overdueTasks,
      byReason: byReason.map((row) => ({ reason: row.reasonCategory, count: row._count._all })),
    };
  }

  async performance(query: PerformanceReportQueryDto): Promise<PerformanceReport> {
    const where: Prisma.PerformanceReviewWhereInput = query.cycleId
      ? { cycleId: query.cycleId }
      : {};
    const [cycles, reviews, statusGroups, byCycleGroups] = await Promise.all([
      this.prisma.performanceCycle.count(),
      this.prisma.performanceReview.count({ where }),
      this.prisma.performanceReview.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      this.prisma.performanceReview.groupBy({
        by: ["cycleId", "status"],
        where,
        _count: { _all: true },
      }),
    ]);
    const cycleRows = await this.prisma.performanceCycle.findMany({
      where: { id: { in: [...new Set(byCycleGroups.map((row) => row.cycleId))] } },
      select: { id: true, name: true, status: true },
    });
    const cycleMap = new Map(cycleRows.map((cycle) => [cycle.id, cycle]));
    const byCycle = new Map<
      string,
      { cycle: string; status: PerformanceReport["byCycle"][number]["status"]; reviews: number; completed: number }
    >();
    for (const row of byCycleGroups) {
      const cycle = cycleMap.get(row.cycleId);
      if (!cycle) continue;
      const entry = byCycle.get(row.cycleId) ?? {
        cycle: cycle.name,
        status: cycle.status,
        reviews: 0,
        completed: 0,
      };
      entry.reviews += row._count._all;
      if (row.status === "COMPLETED") entry.completed += row._count._all;
      byCycle.set(row.cycleId, entry);
    }
    const count = (status: string) =>
      statusGroups.find((group) => group.status === status)?._count._all ?? 0;
    return {
      cycles,
      reviews,
      submitted: count("SUBMITTED"),
      completed: count("COMPLETED"),
      completionRate: reviews === 0 ? 0 : Math.round((count("COMPLETED") / reviews) * 1000) / 10,
      byCycle: [...byCycle.values()].sort((a, b) => b.reviews - a.reviews),
    };
  }

  async learning(query: ReportRangeQueryDto): Promise<LearningReport> {
    const range = await this.range(query);
    const where: Prisma.TrainingEnrollmentWhereInput = {
      createdAt: { gte: dateKey(range.from), lte: dateKey(range.to) },
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.departmentId ? { employee: { departmentId: query.departmentId } } : {}),
    };
    const [programs, enrollments, statusGroups, certificates, byProgramGroups] = await Promise.all([
      this.prisma.trainingProgram.count({
        where: { startDate: { gte: dateKey(range.from), lte: dateKey(range.to) } },
      }),
      this.prisma.trainingEnrollment.count({ where }),
      this.prisma.trainingEnrollment.groupBy({ by: ["status"], where, _count: { _all: true } }),
      this.prisma.trainingDocument.count({
        where: { kind: "CERTIFICATE", createdAt: { gte: dateKey(range.from), lte: dateKey(range.to) } },
      }),
      this.prisma.trainingEnrollment.groupBy({
        by: ["programId", "status"],
        where,
        _count: { _all: true },
      }),
    ]);
    const programRows = await this.prisma.trainingProgram.findMany({
      where: { id: { in: [...new Set(byProgramGroups.map((row) => row.programId))] } },
      select: { id: true, title: true },
    });
    const programMap = new Map(programRows.map((program) => [program.id, program.title]));
    const byProgram = new Map<string, { program: string; enrollments: number; completed: number }>();
    for (const row of byProgramGroups) {
      const entry = byProgram.get(row.programId) ?? {
        program: programMap.get(row.programId) ?? "Unknown",
        enrollments: 0,
        completed: 0,
      };
      entry.enrollments += row._count._all;
      if (row.status === "COMPLETED") entry.completed += row._count._all;
      byProgram.set(row.programId, entry);
    }
    const completed = statusGroups.find((group) => group.status === "COMPLETED")?._count._all ?? 0;
    return {
      programs,
      enrollments,
      completed,
      certificates,
      completionRate: enrollments === 0 ? 0 : Math.round((completed / enrollments) * 1000) / 10,
      byProgram: [...byProgram.values()].sort((a, b) => b.enrollments - a.enrollments),
    };
  }

  async completionSummary(): Promise<CompletionReport> {
    const [onboarding, offboarding, performance, learning] = await Promise.all([
      this.onboarding({}),
      this.offboarding({}),
      this.performance({}),
      this.learning({}),
    ]);
    return {
      onboarding: {
        total: onboarding.total,
        completed: onboarding.completed,
        inProgress: onboarding.inProgress,
        overdueTasks: onboarding.overdueTasks,
      },
      offboarding: {
        total: offboarding.total,
        completed: offboarding.completed,
        inProgress: offboarding.inProgress,
        overdueTasks: offboarding.overdueTasks,
      },
      performance: {
        cycles: performance.cycles,
        reviews: performance.reviews,
        submitted: performance.submitted,
        completed: performance.completed,
      },
      learning: {
        programs: learning.programs,
        enrollments: learning.enrollments,
        completed: learning.completed,
        certificates: learning.certificates,
      },
    };
  }

  async export(query: ExportReportQueryDto): Promise<CsvExport> {
    const rows = await this.exportRows(query);
    return {
      fileName: `${query.type}-report.csv`,
      content: csv(rows),
      mimeType: "text/csv;charset=utf-8",
    };
  }

  private async exportRows(query: ExportReportQueryDto): Promise<unknown[][]> {
    if (query.type === "employees") {
      const report = await this.employees({ page: 1, pageSize: 100 });
      return [
        ["Employee number", "Name", "Department", "Position", "Status", "Join date"],
        ...report.rows.map((row) => [
          row.employeeNumber,
          row.fullName,
          row.department,
          row.position,
          row.status,
          row.joinDate,
        ]),
      ];
    }
    if (query.type === "attendance") {
      const report = await this.attendanceAndLeave(query);
      return [
        ["Measure", "Value"],
        ["Present", report.attendance.present],
        ["Late", report.attendance.late],
        ["Absent", report.attendance.absent],
        ["Incomplete", report.attendance.incomplete],
      ];
    }
    if (query.type === "leave") {
      const report = await this.attendanceAndLeave(query);
      return [
        ["Leave type", "Approved days"],
        ...report.leave.utilization.map((row) => [row.leaveType, row.days]),
      ];
    }
    if (query.type === "overtime") {
      const report = await this.overtimeAndPayroll(query);
      return [
        ["Department", "Verified minutes"],
        ...report.overtime.byDepartment.map((row) => [row.department, row.minutes]),
      ];
    }
    if (query.type === "payroll") {
      const report = await this.overtimeAndPayroll(query);
      return [
        ["Department", "Net pay"],
        ...report.payroll.byDepartment.map((row) => [row.department, row.netTotal]),
      ];
    }
    if (query.type === "onboarding") {
      const report = await this.onboarding(query);
      return [
        ["Status", "Count"],
        ["Total", report.total],
        ["Completed", report.completed],
        ["In progress", report.inProgress],
        ["Not started", report.notStarted],
        ["Overdue tasks", report.overdueTasks],
      ];
    }
    if (query.type === "offboarding") {
      const report = await this.offboarding(query);
      return [
        ["Status", "Count"],
        ["Total", report.total],
        ["Completed", report.completed],
        ["In progress", report.inProgress],
        ["Initiated", report.initiated],
        ["Overdue tasks", report.overdueTasks],
      ];
    }
    if (query.type === "performance") {
      const report = await this.performance({});
      return [
        ["Measure", "Value"],
        ["Cycles", report.cycles],
        ["Reviews", report.reviews],
        ["Submitted", report.submitted],
        ["Completed", report.completed],
        ["Completion rate", `${report.completionRate}%`],
      ];
    }
    const report = await this.learning(query);
    return [
      ["Measure", "Value"],
      ["Programs", report.programs],
      ["Enrollments", report.enrollments],
      ["Completed", report.completed],
      ["Certificates", report.certificates],
      ["Completion rate", `${report.completionRate}%`],
    ];
  }

  private async today(): Promise<string> {
    const company = await this.prisma.company.findFirst({ select: { timezone: true } });
    return dateKeyOf(new Date(), company?.timezone ?? "Asia/Jakarta");
  }

  private async range(query: ReportRangeQueryDto): Promise<{ from: string; to: string }> {
    if (query.from && query.to) return { from: query.from, to: query.to };
    const today = await this.today();
    return { from: query.from ?? `${today.slice(0, 7)}-01`, to: query.to ?? today };
  }
}
