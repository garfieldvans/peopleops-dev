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
  CreateOvertimePolicyDto,
  ListOvertimePoliciesQueryDto,
  UpdateOvertimePolicyDto,
} from "./dto/overtime.dto";
import { OvertimePoliciesService } from "./overtime-policies.service";
import type { OvertimeActor } from "./overtime.types";

function actorOf(user: AuthenticatedUser, req: Request): OvertimeActor {
  return { actorUserId: user.id, actorEmail: user.email, meta: requestMeta(req) };
}

@ApiTags("overtime-policies")
@ApiBearerAuth()
@Controller("overtime/policies")
export class OvertimePoliciesController {
  constructor(private readonly policies: OvertimePoliciesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.OVERTIME_POLICY_READ)
  @ApiOperation({ summary: "List overtime policies" })
  list(@Query() query: ListOvertimePoliciesQueryDto) {
    return this.policies.list(query);
  }

  @Get("active")
  @RequirePermissions(PERMISSIONS.OVERTIME_POLICY_READ)
  @ApiOperation({ summary: "List active overtime policies" })
  active() {
    return this.policies.listActive();
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.OVERTIME_POLICY_READ)
  @ApiOperation({ summary: "Get an overtime policy" })
  get(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.policies.getById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.OVERTIME_POLICY_MANAGE)
  @ApiOperation({ summary: "Create an overtime policy" })
  create(
    @Body() dto: CreateOvertimePolicyDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.policies.create(dto, actorOf(user, req));
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.OVERTIME_POLICY_MANAGE)
  @ApiOperation({ summary: "Update an overtime policy" })
  update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateOvertimePolicyDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.policies.update(id, dto, actorOf(user, req));
  }

  @Patch(":id/deactivate")
  @RequirePermissions(PERMISSIONS.OVERTIME_POLICY_MANAGE)
  @ApiOperation({ summary: "Deactivate an overtime policy" })
  deactivate(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.policies.deactivate(id, actorOf(user, req));
  }
}
