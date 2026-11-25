import { Injectable, NotFoundException } from "@nestjs/common";
import type { LeaveCalendar, LeaveCalendarEntry } from "@peopleops/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { EmployeesService } from "../employee/employees.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { displayName } from "./leave.mapper";

function monthBounds(month: string): { start: string; end: string } {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  return {
    start: `${month}-01`,
    end: new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10),
  };
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

@Injectable()
export class LeaveCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
  ) {}

  async myCalendar(user: AuthenticatedUser, month: string): Promise<LeaveCalendar> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException({
        code: "EMPLOYEE_NOT_LINKED",
        message: "No employee record is linked to your account",
      });
    }
    return this.build(month, [employee.id]);
  }

  async teamCalendar(user: AuthenticatedUser, month: string): Promise<LeaveCalendar> {
    const scope = await this.employees.resolveScope(user);
    const ids = await this.employees.scopedEmployeeIds(scope);
    return this.build(month, ids);
  }

  async orgCalendar(month: string): Promise<LeaveCalendar> {
    return this.build(month, null);
  }

  private async build(month: string, employeeIds: string[] | null): Promise<LeaveCalendar> {
    const { start, end } = monthBounds(month);
    const rows = await this.prisma.leaveRequest.findMany({
      where: {
        ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
        status: { in: ["PENDING", "APPROVED"] },
        startDate: { lte: dateOnly(end) },
        endDate: { gte: dateOnly(start) },
      },
      select: {
        id: true,
        employeeId: true,
        startDate: true,
        endDate: true,
        duration: true,
        requestMode: true,
        halfDayPeriod: true,
        status: true,
        employee: {
          select: {
            employeeNumber: true,
            firstName: true,
            lastName: true,
            preferredName: true,
          },
        },
        leaveType: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ startDate: "asc" }, { employee: { firstName: "asc" } }],
    });
    const entries: LeaveCalendarEntry[] = rows.map((row) => ({
      id: row.id,
      employeeId: row.employeeId,
      employeeNumber: row.employee.employeeNumber,
      employeeName: displayName(row.employee),
      leaveType: row.leaveType,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate.toISOString().slice(0, 10),
      duration: Number(row.duration),
      status: row.status,
      requestMode: row.requestMode,
      halfDayPeriod: row.halfDayPeriod,
    }));
    return { month, entries };
  }
}
