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
import { WorkSchedulesService } from "./work-schedules.service";
import {
  CreateWorkScheduleDto,
  ListWorkSchedulesQueryDto,
  UpdateWorkScheduleDto,
} from "./dto/work-schedule.dto";

@ApiTags("attendance")
@ApiBearerAuth()
@Controller("work-schedules")
export class WorkSchedulesController {
  constructor(private readonly schedules: WorkSchedulesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.WORK_SCHEDULE_READ)
  @ApiOperation({ summary: "List work schedules" })
  list(@Query() query: ListWorkSchedulesQueryDto) {
    return this.schedules.list(query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.WORK_SCHEDULE_READ)
  @ApiOperation({ summary: "Get a work schedule with its working days" })
  get(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.schedules.getById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.WORK_SCHEDULE_CREATE)
  @ApiOperation({ summary: "Create a work schedule" })
  create(
    @Body() dto: CreateWorkScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.schedules.create(dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.WORK_SCHEDULE_UPDATE)
  @ApiOperation({ summary: "Update a work schedule and replace its days" })
  update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateWorkScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.schedules.update(id, dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Patch(":id/deactivate")
  @RequirePermissions(PERMISSIONS.WORK_SCHEDULE_DEACTIVATE)
  @ApiOperation({ summary: "Deactivate a work schedule" })
  deactivate(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.schedules.deactivate(id, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }
}
