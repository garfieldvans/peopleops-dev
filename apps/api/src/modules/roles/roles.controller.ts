import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import { CreateRoleDto } from "./dto/create-role.dto";
import { ListRolesQueryDto } from "./dto/list-roles-query.dto";
import { SetRolePermissionsDto } from "./dto/set-role-permissions.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { RolesService } from "./roles.service";

@ApiTags("roles")
@ApiBearerAuth()
@Controller("roles")
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ROLE_READ)
  @ApiOperation({ summary: "List roles with their permissions" })
  list(@Query() query: ListRolesQueryDto) {
    return this.roles.list(query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ROLE_CREATE)
  @ApiOperation({ summary: "Create a custom role" })
  create(@Body() dto: CreateRoleDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.roles.create(dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.ROLE_READ)
  @ApiOperation({ summary: "Get a role with permissions and user count" })
  get(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.roles.getById(id);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.ROLE_UPDATE)
  @ApiOperation({ summary: "Rename a role or change its description" })
  update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.roles.update(id, dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.ROLE_DELETE)
  @ApiOperation({ summary: "Delete an unused non-system role" })
  async remove(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    await this.roles.delete(id, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Put(":id/permissions")
  @RequirePermissions(PERMISSIONS.ROLE_UPDATE)
  @ApiOperation({ summary: "Replace the permissions of a non-system role" })
  setPermissions(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: SetRolePermissionsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.roles.setPermissions(id, dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }
}
