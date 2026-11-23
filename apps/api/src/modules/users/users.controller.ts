import {
  Body,
  Controller,
  Get,
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
import { CreateUserDto } from "./dto/create-user.dto";
import { ListUsersQueryDto } from "./dto/list-users-query.dto";
import { SetUserRolesDto } from "./dto/set-user-roles.dto";
import { UpdateUserStatusDto } from "./dto/update-user-status.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USER_READ)
  @ApiOperation({ summary: "List users with search, status filter and pagination" })
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USER_CREATE)
  @ApiOperation({ summary: "Provision a user with an initial password" })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.users.create(dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.USER_READ)
  @ApiOperation({ summary: "Get a user" })
  get(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.users.getById(id);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.USER_UPDATE)
  @ApiOperation({ summary: "Update name and email" })
  update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.users.update(id, dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Patch(":id/status")
  @RequirePermissions(PERMISSIONS.USER_DEACTIVATE)
  @ApiOperation({ summary: "Activate, deactivate or suspend an account" })
  updateStatus(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.users.updateStatus(id, dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Put(":id/roles")
  @RequirePermissions(PERMISSIONS.USER_ASSIGN_ROLE)
  @ApiOperation({ summary: "Replace the user's roles" })
  setRoles(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: SetUserRolesDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.users.setRoles(id, dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }
}
