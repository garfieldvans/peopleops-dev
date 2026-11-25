import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface ApprovedLeaveDay {
  requestId: string;
  employeeId: string;
  date: string;
  duration: number;
  requestMode: "FULL_DAY" | "HALF_DAY" | "HOURLY";
  halfDayPeriod: "FIRST_HALF" | "SECOND_HALF" | null;
  leaveType: { id: string; name: string; code: string };
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Read-only attendance integration port. Attendance imports this module, while
 * leave itself never imports attendance from here, so the modules stay acyclic.
 */
@Injectable()
export class LeaveIntegrationService {
  constructor(private readonly prisma: PrismaService) {}

  async approvedDays(employeeId: string, from: string, to: string): Promise<ApprovedLeaveDay[]> {
    const rows = await this.prisma.leaveRequestDay.findMany({
      where: {
        date: {
          gte: new Date(`${from}T00:00:00.000Z`),
          lte: new Date(`${to}T00:00:00.000Z`),
        },
        request: { employeeId, status: "APPROVED" },
      },
      select: {
        date: true,
        duration: true,
        halfDayPeriod: true,
        request: {
          select: {
            id: true,
            employeeId: true,
            requestMode: true,
            leaveType: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { date: "asc" },
    });
    return rows.map((row) => ({
      requestId: row.request.id,
      employeeId: row.request.employeeId,
      date: dateKey(row.date),
      duration: Number(row.duration),
      requestMode: row.request.requestMode,
      halfDayPeriod: row.halfDayPeriod,
      leaveType: row.request.leaveType,
    }));
  }

  async approvedDay(employeeId: string, date: string): Promise<ApprovedLeaveDay | null> {
    const rows = await this.approvedDays(employeeId, date, date);
    return rows[0] ?? null;
  }

  async approvedDaysForEmployees(
    employeeIds: string[],
    date: string,
  ): Promise<Map<string, ApprovedLeaveDay>> {
    if (employeeIds.length === 0) return new Map();
    const rows = await this.prisma.leaveRequestDay.findMany({
      where: {
        date: new Date(`${date}T00:00:00.000Z`),
        request: { employeeId: { in: employeeIds }, status: "APPROVED" },
      },
      select: {
        date: true,
        duration: true,
        halfDayPeriod: true,
        request: {
          select: {
            id: true,
            employeeId: true,
            requestMode: true,
            leaveType: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
    const result = new Map<string, ApprovedLeaveDay>();
    for (const row of rows) {
      result.set(row.request.employeeId, {
        requestId: row.request.id,
        employeeId: row.request.employeeId,
        date: dateKey(row.date),
        duration: Number(row.duration),
        requestMode: row.request.requestMode,
        halfDayPeriod: row.halfDayPeriod,
        leaveType: row.request.leaveType,
      });
    }
    return result;
  }
}
