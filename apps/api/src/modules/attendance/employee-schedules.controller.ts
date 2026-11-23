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
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { PERMISSIONS } from "@peopleops/shared-types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestMeta } from "../../common/http/request-meta";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { EmployeeSchedulesService } from "./employee-schedules.service";
import {
  BulkEmployeeScheduleDto,
  CreateEmployeeScheduleDto,
  ListEmployeeSchedulesQueryDto,
  UpdateEmployeeScheduleDto,
} from "./dto/employee-schedule.dto";

@ApiTags("attendance")
@ApiBearerAuth()
@Controller("employee-schedules")
export class EmployeeSchedulesController {
  constructor(private readonly schedules: EmployeeSchedulesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: "List effective-dated schedule assignments" })
  list(
    @Query() query: ListEmployeeSchedulesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.schedules.list(query, user);
  }

  @Post("bulk")
  @RequirePermissions(PERMISSIONS.WORK_SCHEDULE_UPDATE)
  @ApiOperation({ summary: "Assign a schedule to a branch, department, or employee list" })
  bulk(
    @Body() dto: BulkEmployeeScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.schedules.bulk(dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.WORK_SCHEDULE_UPDATE)
  @ApiOperation({ summary: "Adjust an assignment period or schedule" })
  update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateEmployeeScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.schedules.update(id, dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }
}

@ApiTags("attendance")
@ApiBearerAuth()
@Controller("employees/:employeeId/schedules")
export class EmployeeScheduleHistoryController {
  constructor(private readonly schedules: EmployeeSchedulesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.WORK_SCHEDULE_READ)
  @ApiOperation({ summary: "Read an employee's schedule assignment history" })
  list(
    @Param("employeeId", new ParseUUIDPipe({ version: "4" })) employeeId: string,
    @Query() query: ListEmployeeSchedulesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.schedules.listForEmployee(employeeId, query, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.WORK_SCHEDULE_UPDATE)
  @ApiOperation({ summary: "Assign a schedule to one employee" })
  create(
    @Param("employeeId", new ParseUUIDPipe({ version: "4" })) employeeId: string,
    @Body() dto: CreateEmployeeScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.schedules.createForEmployee(employeeId, dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }
}
