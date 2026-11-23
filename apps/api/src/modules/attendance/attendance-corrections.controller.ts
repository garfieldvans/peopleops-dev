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
import { AttendanceCorrectionsService } from "./attendance-corrections.service";
import {
  CancelCorrectionDto,
  CreateCorrectionDto,
  ListCorrectionsQueryDto,
  ReviewCorrectionDto,
} from "./dto/attendance.dto";

@ApiTags("attendance")
@ApiBearerAuth()
@Controller("attendance/corrections")
export class AttendanceCorrectionsController {
  constructor(private readonly corrections: AttendanceCorrectionsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ATTENDANCE_CORRECTION_READ)
  @ApiOperation({ summary: "List correction requests within the caller's scope" })
  list(
    @Query() query: ListCorrectionsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.corrections.list(query, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ATTENDANCE_CORRECTION_CREATE)
  @ApiOperation({ summary: "Submit an attendance correction request" })
  create(
    @Body() dto: CreateCorrectionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.corrections.create(dto, user, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_CORRECTION_READ)
  @ApiOperation({ summary: "Get a correction request" })
  get(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.corrections.getById(id, user);
  }

  @Patch(":id/approve")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_CORRECTION_REVIEW)
  @ApiOperation({ summary: "Approve a correction and recalculate attendance" })
  approve(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: ReviewCorrectionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.corrections.approve(id, dto, user, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Patch(":id/reject")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_CORRECTION_REVIEW)
  @ApiOperation({ summary: "Reject a correction request" })
  reject(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: ReviewCorrectionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.corrections.reject(id, dto, user, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Patch(":id/cancel")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_CORRECTION_CREATE)
  @ApiOperation({ summary: "Cancel your own pending correction" })
  cancel(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: CancelCorrectionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.corrections.cancel(id, dto.reason, user, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }
}
