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
import { CreateLeaveTypeDto, ListLeaveTypesQueryDto, UpdateLeaveTypeDto } from "./dto/leave.dto";
import { LeaveTypesService } from "./leave-types.service";
import type { LeaveActor } from "./leave.types";

function actorOf(user: AuthenticatedUser, req: Request): LeaveActor {
  return { actorUserId: user.id, actorEmail: user.email, meta: requestMeta(req) };
}

@ApiTags("leave-types")
@ApiBearerAuth()
@Controller("leave-types")
export class LeaveTypesController {
  constructor(private readonly leaveTypes: LeaveTypesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.LEAVE_TYPE_READ)
  @ApiOperation({ summary: "List leave types" })
  list(@Query() query: ListLeaveTypesQueryDto) {
    return this.leaveTypes.list(query);
  }

  @Get("active")
  @RequirePermissions(PERMISSIONS.LEAVE_TYPE_READ)
  @ApiOperation({ summary: "List active leave types for request forms" })
  active() {
    return this.leaveTypes.listActive();
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.LEAVE_TYPE_READ)
  @ApiOperation({ summary: "Get a leave type" })
  get(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.leaveTypes.getById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.LEAVE_TYPE_CREATE)
  @ApiOperation({ summary: "Create a leave type" })
  create(
    @Body() dto: CreateLeaveTypeDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.leaveTypes.create(dto, actorOf(user, req));
  }

  @Patch(":id/deactivate")
  @RequirePermissions(PERMISSIONS.LEAVE_TYPE_DEACTIVATE)
  @ApiOperation({ summary: "Deactivate a leave type" })
  deactivate(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.leaveTypes.deactivate(id, actorOf(user, req));
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.LEAVE_TYPE_UPDATE)
  @ApiOperation({ summary: "Update a leave type" })
  update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateLeaveTypeDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.leaveTypes.update(id, dto, actorOf(user, req));
  }
}
