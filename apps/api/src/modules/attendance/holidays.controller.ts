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
import { HolidaysService } from "./holidays.service";
import { CreateHolidayDto, ListHolidaysQueryDto, UpdateHolidayDto } from "./dto/holiday.dto";

@ApiTags("attendance")
@ApiBearerAuth()
@Controller("holidays")
export class HolidaysController {
  constructor(private readonly holidays: HolidaysService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.HOLIDAY_READ)
  @ApiOperation({ summary: "List holidays" })
  list(@Query() query: ListHolidaysQueryDto) {
    return this.holidays.list(query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.HOLIDAY_READ)
  @ApiOperation({ summary: "Get a holiday" })
  get(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.holidays.getById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.HOLIDAY_CREATE)
  @ApiOperation({ summary: "Create a company or branch holiday" })
  create(
    @Body() dto: CreateHolidayDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.holidays.create(dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.HOLIDAY_UPDATE)
  @ApiOperation({ summary: "Update a holiday" })
  update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateHolidayDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.holidays.update(id, dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Patch(":id/deactivate")
  @RequirePermissions(PERMISSIONS.HOLIDAY_UPDATE)
  @ApiOperation({ summary: "Deactivate a holiday" })
  deactivate(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.holidays.deactivate(id, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }
}
