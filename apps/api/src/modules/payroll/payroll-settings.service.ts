import { Injectable } from "@nestjs/common";
import type { PayrollSetting } from "@peopleops/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { UpdatePayrollSettingsDto } from "./dto/payroll.dto";
import type { PayrollActor } from "./payroll.utils";

@Injectable()
export class PayrollSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<PayrollSetting> {
    const row = await this.ensureRow();
    return {
      id: row.id,
      standardMonthlyHours: row.standardMonthlyHours.toString(),
      standardMonthlyDays: row.standardMonthlyDays.toString(),
      roundingMode: row.roundingMode,
      currencyScale: row.currencyScale,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async update(dto: UpdatePayrollSettingsDto, actor: PayrollActor): Promise<PayrollSetting> {
    const existing = await this.ensureRow();
    const row = await this.prisma.payrollSetting.update({
      where: { id: existing.id },
      data: {
        ...(dto.standardMonthlyHours !== undefined
          ? { standardMonthlyHours: dto.standardMonthlyHours }
          : {}),
        ...(dto.standardMonthlyDays !== undefined
          ? { standardMonthlyDays: dto.standardMonthlyDays }
          : {}),
        ...(dto.roundingMode !== undefined ? { roundingMode: dto.roundingMode } : {}),
        ...(dto.currencyScale !== undefined ? { currencyScale: dto.currencyScale } : {}),
        updatedById: actor.actorUserId,
      },
    });
    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "payroll.settings_updated",
      entityType: "payroll_settings",
      entityId: row.id,
      metadata: { fields: Object.keys(dto) },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return {
      id: row.id,
      standardMonthlyHours: row.standardMonthlyHours.toString(),
      standardMonthlyDays: row.standardMonthlyDays.toString(),
      roundingMode: row.roundingMode,
      currencyScale: row.currencyScale,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async ensureRow() {
    const existing = await this.prisma.payrollSetting.findFirst();
    if (existing) return existing;
    return this.prisma.payrollSetting.create({ data: {} });
  }
}
