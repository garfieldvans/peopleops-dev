import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import {
  PERMISSIONS,
  type PaginatedResponse,
  type PayrollPayslip,
  type PayrollPayslipDetail,
} from "@peopleops/shared-types";
import { toPageMeta } from "../../common/dto/page-query.dto";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { ListPayrollPayslipsQueryDto } from "./dto/payroll.dto";
import {
  payrollPayslipDetailInclude,
  payrollPayslipInclude,
  toPayrollPayslip,
  toPayrollPayslipDetail,
  type PayrollPayslipDetailRow,
  type PayrollPayslipRow,
} from "./payroll.mapper";
import { buildPayslipPdf } from "./payslip-pdf";

@Injectable()
export class PayrollPayslipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    query: ListPayrollPayslipsQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<PayrollPayslip>> {
    const readAll = user.permissions.includes(PERMISSIONS.PAYROLL_PAYSLIPS_READ_ALL);
    let employeeId: string | null = null;
    if (!readAll) {
      employeeId = await this.selfEmployeeId(user.id);
      if (!employeeId) return { items: [], ...toPageMeta(query.page, query.pageSize, 0) };
    }
    const where: Prisma.PayrollPayslipWhereInput = {
      ...(readAll
        ? {
            ...(query.employeeId ? { employeeId: query.employeeId } : {}),
          }
        : { employeeId: employeeId!, publishedAt: { not: null } }),
      ...(query.runId ? { runId: query.runId } : {}),
      ...(query.periodId ? { run: { periodId: query.periodId } } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.payrollPayslip.count({ where }),
      this.prisma.payrollPayslip.findMany({
        where,
        include: payrollPayslipInclude,
        orderBy: [{ run: { period: { startDate: "desc" } } }, { employeeNameSnapshot: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toPayrollPayslip), ...toPageMeta(query.page, query.pageSize, total) };
  }

  async getById(id: string, user: AuthenticatedUser): Promise<PayrollPayslipDetail> {
    const row = await this.findDetail(id);
    await this.assertCanRead(row, user);
    return toPayrollPayslipDetail(row);
  }

  async download(
    id: string,
    user: AuthenticatedUser,
  ): Promise<{ fileName: string; buffer: Uint8Array }> {
    const row = await this.findDetail(id);
    await this.assertCanRead(row, user);
    if (
      !user.permissions.includes(PERMISSIONS.PAYROLL_PAYSLIPS_DOWNLOAD) &&
      !user.permissions.includes(PERMISSIONS.PAYROLL_PAYSLIPS_READ_SELF)
    ) {
      throw new ForbiddenException({
        code: "PAYROLL_PAYSLIP_DOWNLOAD_FORBIDDEN",
        message: "You do not have permission to download payslips",
      });
    }
    const company = await this.prisma.company.findFirst({
      select: { name: true, addressLine: true, city: true, email: true },
    });
    const buffer = await buildPayslipPdf(
      toPayrollPayslipDetail(row),
      company ?? { name: "PeopleOps", addressLine: null, city: null, email: "hr@peopleops.local" },
    );
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "payroll.payslip_downloaded",
      entityType: "payroll_payslip",
      entityId: id,
      metadata: { employeeId: row.employeeId, runId: row.runId },
    });
    const safePeriod = row.run.period.name.replace(/[^a-zA-Z0-9_-]+/g, "-");
    return {
      fileName: `payslip-${row.employeeNumberSnapshot}-${safePeriod}.pdf`,
      buffer,
    };
  }

  private async findDetail(id: string): Promise<PayrollPayslipDetailRow> {
    const row = await this.prisma.payrollPayslip.findUnique({
      where: { id },
      include: payrollPayslipDetailInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: "PAYROLL_PAYSLIP_NOT_FOUND",
        message: "Payslip not found",
      });
    }
    return row;
  }

  private async assertCanRead(
    row: PayrollPayslipDetailRow | PayrollPayslipRow,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (user.permissions.includes(PERMISSIONS.PAYROLL_PAYSLIPS_READ_ALL)) return;
    const employeeId = await this.selfEmployeeId(user.id);
    if (!employeeId || employeeId !== row.employeeId || !row.publishedAt) {
      throw new ForbiddenException({
        code: "PAYROLL_PAYSLIP_FORBIDDEN",
        message: "This payslip is not available to you",
      });
    }
  }

  private async selfEmployeeId(userId: string): Promise<string | null> {
    const employee = await this.prisma.employee.findFirst({
      where: { userId },
      select: { id: true },
    });
    return employee?.id ?? null;
  }
}
