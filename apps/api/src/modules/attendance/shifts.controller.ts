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
import { ShiftsService } from "./shifts.service";
import { CreateShiftDto, ListShiftsQueryDto, UpdateShiftDto } from "./dto/shift.dto";

@ApiTags("attendance")
@ApiBearerAuth()
@Controller("shifts")
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SHIFT_READ)
  @ApiOperation({ summary: "List shifts, including overnight shifts" })
  list(@Query() query: ListShiftsQueryDto) {
    return this.shifts.list(query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.SHIFT_READ)
  @ApiOperation({ summary: "Get a shift" })
  get(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.shifts.getById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SHIFT_CREATE)
  @ApiOperation({ summary: "Create a shift" })
  create(@Body() dto: CreateShiftDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.shifts.create(dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.SHIFT_UPDATE)
  @ApiOperation({ summary: "Update a shift" })
  update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateShiftDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.shifts.update(id, dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Patch(":id/deactivate")
  @RequirePermissions(PERMISSIONS.SHIFT_DEACTIVATE)
  @ApiOperation({ summary: "Deactivate a shift" })
  deactivate(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.shifts.deactivate(id, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }
}
