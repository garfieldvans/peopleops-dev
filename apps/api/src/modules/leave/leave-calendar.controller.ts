import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@peopleops/shared-types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { LeaveCalendarQueryDto } from "./dto/leave.dto";
import { LeaveCalendarService } from "./leave-calendar.service";

@ApiTags("leave-calendar")
@ApiBearerAuth()
@Controller("leave-calendar")
export class LeaveCalendarController {
  constructor(private readonly calendar: LeaveCalendarService) {}

  @Get("me")
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_READ)
  @ApiOperation({ summary: "Get the signed-in employee's leave calendar" })
  mine(@Query() query: LeaveCalendarQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.calendar.myCalendar(user, query.month);
  }

  @Get("team")
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_READ_TEAM)
  @ApiOperation({ summary: "Get the reporting line leave calendar" })
  team(@Query() query: LeaveCalendarQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.calendar.teamCalendar(user, query.month);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_READ_ALL)
  @ApiOperation({ summary: "Get the organisation leave calendar" })
  organisation(@Query() query: LeaveCalendarQueryDto) {
    return this.calendar.orgCalendar(query.month);
  }
}
