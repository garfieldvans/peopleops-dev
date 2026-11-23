import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { requestMeta } from "../../../common/http/request-meta";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import { BranchesService } from "./branches.service";
import { CreateBranchDto, ListBranchesQueryDto, UpdateBranchDto } from "./dto/branch.dto";

@ApiTags("organization")
@ApiBearerAuth()
@Controller("branches")
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.BRANCH_READ)
  @ApiOperation({ summary: "List branches with search, status filter and pagination" })
  list(@Query() query: ListBranchesQueryDto) {
    return this.branches.list(query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.BRANCH_READ)
  @ApiOperation({ summary: "Get a branch" })
  get(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.branches.getById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.BRANCH_CREATE)
  @ApiOperation({ summary: "Create a branch" })
  create(@Body() dto: CreateBranchDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.branches.create(dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.BRANCH_UPDATE)
  @ApiOperation({ summary: "Update a branch" })
  update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateBranchDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.branches.update(id, dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Delete(":id")
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.BRANCH_DELETE)
  @ApiOperation({ summary: "Delete an unused branch" })
  async remove(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.branches.remove(id, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }
}
