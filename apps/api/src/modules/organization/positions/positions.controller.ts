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
import { PositionsService } from "./positions.service";
import {
  CreatePositionDto,
  ListPositionsQueryDto,
  UpdatePositionDto,
} from "./dto/position.dto";

@ApiTags("organization")
@ApiBearerAuth()
@Controller("positions")
export class PositionsController {
  constructor(private readonly positions: PositionsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.POSITION_READ)
  @ApiOperation({ summary: "List positions with search, filters and pagination" })
  list(@Query() query: ListPositionsQueryDto) {
    return this.positions.list(query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.POSITION_READ)
  @ApiOperation({ summary: "Get a position" })
  get(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.positions.getById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.POSITION_CREATE)
  @ApiOperation({ summary: "Create a position inside a department" })
  create(@Body() dto: CreatePositionDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.positions.create(dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.POSITION_UPDATE)
  @ApiOperation({ summary: "Update a position" })
  update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdatePositionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.positions.update(id, dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Delete(":id")
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.POSITION_DELETE)
  @ApiOperation({ summary: "Delete a position with no employees" })
  async remove(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.positions.remove(id, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }
}
