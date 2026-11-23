import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { PERMISSIONS } from "@peopleops/shared-types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestMeta } from "../../common/http/request-meta";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { AttendanceService } from "./attendance.service";
import type { AttendanceActor } from "./attendance.service";
import {
  AttendanceCalendarQueryDto,
  AttendanceExportQueryDto,
  ListAttendanceQueryDto,
  ManualAttendanceDto,
  MyAttendanceQueryDto,
  OverviewQueryDto,
} from "./dto/attendance.dto";

function actorOf(user: AuthenticatedUser, req: Request): AttendanceActor {
  return {
    actorUserId: user.id,
    actorEmail: user.email,
    meta: requestMeta(req),
  };
}

@ApiTags("attendance")
@ApiBearerAuth()
@Controller("attendance")
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ApiOperation({ summary: "List attendance records within the caller's scope" })
  list(
    @Query() query: ListAttendanceQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.list(query, user);
  }

  @Get("dashboard")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ApiOperation({ summary: "Self-service attendance dashboard for today" })
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.attendance.dashboard(user);
  }

  @Get("overview")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ_ALL)
  @ApiOperation({ summary: "HR attendance overview for a date" })
  overview(@Query() query: OverviewQueryDto) {
    return this.attendance.overview(query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_EXPORT)
  @ApiOperation({ summary: "Export attendance records as CSV" })
  async export(
    @Query() query: AttendanceExportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const csv = await this.attendance.exportCsv(query, user);
    const date = query.to ?? query.from ?? new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="attendance-${date}.csv"`,
    );
    res.send(csv);
  }

  @Get("me/calendar")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ApiOperation({ summary: "Self attendance calendar for a month" })
  myCalendar(
    @Query() query: AttendanceCalendarQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.myCalendar(query, user);
  }

  @Get("me")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ApiOperation({ summary: "List the caller's own attendance records" })
  listMine(
    @Query() query: MyAttendanceQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.listMine(query, user);
  }

  @Get("employees/:employeeId/calendar")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ApiOperation({ summary: "Attendance calendar for an employee in scope" })
  employeeCalendar(
    @Param("employeeId", new ParseUUIDPipe({ version: "4" })) employeeId: string,
    @Query() query: AttendanceCalendarQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.calendarForEmployee(employeeId, query, user);
  }

  @Get("employees/:employeeId/records")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ApiOperation({ summary: "Attendance records for an employee in scope" })
  employeeRecords(
    @Param("employeeId", new ParseUUIDPipe({ version: "4" })) employeeId: string,
    @Query() query: MyAttendanceQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.listForEmployee(employeeId, query, user);
  }

  @Post("clock-in")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_CLOCK_IN)
  @ApiOperation({ summary: "Clock in to the current scheduled shift" })
  clockIn(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.attendance.clockIn(user, actorOf(user, req));
  }

  @Post("clock-out")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_CLOCK_OUT)
  @ApiOperation({ summary: "Clock out and calculate the final attendance values" })
  clockOut(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.attendance.clockOut(user, actorOf(user, req));
  }

  @Post("breaks/start")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_CLOCK_IN)
  @ApiOperation({ summary: "Start an unpaid break" })
  startBreak(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.attendance.startBreak(user, actorOf(user, req));
  }

  @Post("breaks/end")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_CLOCK_OUT)
  @ApiOperation({ summary: "End the active break" })
  endBreak(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.attendance.endBreak(user, actorOf(user, req));
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ApiOperation({ summary: "Get an attendance record" })
  get(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.getById(id, user);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_MANAGE)
  @ApiOperation({ summary: "Manually correct an attendance record with a reason" })
  update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: ManualAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.attendance.updateManual(id, dto, actorOf(user, req));
  }
}
