import {
  Body,
  Controller,
  Delete,
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
  CreateOvertimeAssignmentDto,
  ListOvertimeAssignmentsQueryDto,
  UpdateOvertimeAssignmentDto,
} from "./dto/overtime.dto";
import { OvertimeAssignmentsService } from "./overtime-assignments.service";
import type { OvertimeActor } from "./overtime.types";

function actorOf(user: AuthenticatedUser, req: Request): OvertimeActor {
  return { actorUserId: user.id, actorEmail: user.email, meta: requestMeta(req) };
}

@ApiTags("overtime-assignments")
@ApiBearerAuth()
@Controller("overtime/assignments")
export class OvertimeAssignmentsController {
  constructor(private readonly assignments: OvertimeAssignmentsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.OVERTIME_POLICY_READ)
  @ApiOperation({ summary: "List overtime policy assignments" })
  list(@Query() query: ListOvertimeAssignmentsQueryDto) {
    return this.assignments.list(query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.OVERTIME_ASSIGNMENT_MANAGE)
  @ApiOperation({ summary: "Assign an overtime policy to a scope" })
  create(
    @Body() dto: CreateOvertimeAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.assignments.create(dto, actorOf(user, req));
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.OVERTIME_ASSIGNMENT_MANAGE)
  @ApiOperation({ summary: "Update an overtime assignment" })
  update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateOvertimeAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.assignments.update(id, dto, actorOf(user, req));
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.OVERTIME_ASSIGNMENT_MANAGE)
  @ApiOperation({ summary: "Close an overtime assignment without deleting history" })
  deactivate(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.assignments.deactivate(id, actorOf(user, req));
  }
}
