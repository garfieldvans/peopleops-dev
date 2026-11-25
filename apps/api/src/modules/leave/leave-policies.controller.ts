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
  CreateLeavePolicyDto,
  ListLeavePoliciesQueryDto,
  UpdateLeavePolicyDto,
} from "./dto/leave.dto";
import { LeavePoliciesService } from "./leave-policies.service";
import type { LeaveActor } from "./leave.types";

function actorOf(user: AuthenticatedUser, req: Request): LeaveActor {
  return { actorUserId: user.id, actorEmail: user.email, meta: requestMeta(req) };
}

@ApiTags("leave-policies")
@ApiBearerAuth()
@Controller("leave-policies")
export class LeavePoliciesController {
  constructor(private readonly policies: LeavePoliciesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.LEAVE_POLICY_READ)
  @ApiOperation({ summary: "List leave policies" })
  list(@Query() query: ListLeavePoliciesQueryDto) {
    return this.policies.list(query);
  }

  @Get("active")
  @RequirePermissions(PERMISSIONS.LEAVE_POLICY_READ)
  @ApiOperation({ summary: "List active leave policies for assignment" })
  active() {
    return this.policies.listActive();
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.LEAVE_POLICY_READ)
  @ApiOperation({ summary: "Get a leave policy" })
  get(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.policies.getById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.LEAVE_POLICY_CREATE)
  @ApiOperation({ summary: "Create a leave policy" })
  create(
    @Body() dto: CreateLeavePolicyDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.policies.create(dto, actorOf(user, req));
  }

  @Patch(":id/deactivate")
  @RequirePermissions(PERMISSIONS.LEAVE_POLICY_DEACTIVATE)
  @ApiOperation({ summary: "Deactivate a leave policy" })
  deactivate(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.policies.deactivate(id, actorOf(user, req));
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.LEAVE_POLICY_UPDATE)
  @ApiOperation({ summary: "Update a leave policy" })
  update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateLeavePolicyDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.policies.update(id, dto, actorOf(user, req));
  }
}
