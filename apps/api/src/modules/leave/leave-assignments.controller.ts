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
import {
  CreateLeavePolicyAssignmentDto,
  ListLeaveAssignmentsQueryDto,
  UpdateLeavePolicyAssignmentDto,
} from "./dto/leave.dto";
import { LeaveAssignmentsService } from "./leave-assignments.service";
import type { LeaveActor } from "./leave.types";

function actorOf(user: AuthenticatedUser, req: Request): LeaveActor {
  return { actorUserId: user.id, actorEmail: user.email, meta: requestMeta(req) };
}

@ApiTags("leave-policy-assignments")
@ApiBearerAuth()
@Controller("leave-policy-assignments")
export class LeaveAssignmentsController {
  constructor(private readonly assignments: LeaveAssignmentsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.LEAVE_POLICY_READ)
  @ApiOperation({ summary: "List leave policy assignments" })
  list(@Query() query: ListLeaveAssignmentsQueryDto) {
    return this.assignments.list(query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.LEAVE_POLICY_ASSIGN)
  @ApiOperation({ summary: "Assign a leave policy to one or more employees" })
  create(
    @Body() dto: CreateLeavePolicyAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.assignments.create(dto, actorOf(user, req));
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.LEAVE_POLICY_ASSIGN)
  @ApiOperation({ summary: "Update a leave policy assignment" })
  update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateLeavePolicyAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.assignments.update(id, dto, actorOf(user, req));
  }
}
