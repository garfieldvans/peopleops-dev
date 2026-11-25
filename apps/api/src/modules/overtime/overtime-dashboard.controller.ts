import { Controller, Get, Query, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { PERMISSIONS } from "@peopleops/shared-types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequireAnyPermission } from "../../common/decorators/require-any-permission.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { OvertimeSummaryQueryDto } from "./dto/overtime.dto";
import { OvertimeRequestsService } from "./overtime-requests.service";

@ApiTags("overtime")
@ApiBearerAuth()
@Controller("overtime")
export class OvertimeDashboardController {
  constructor(private readonly requests: OvertimeRequestsService) {}

  @Get("dashboard")
  @RequirePermissions(PERMISSIONS.OVERTIME_READ_SELF)
  @ApiOperation({ summary: "Overtime dashboard for the signed-in employee and reviewers" })
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.requests.dashboard(user);
  }

  @Get("summary")
  @RequireAnyPermission(PERMISSIONS.OVERTIME_READ_ALL, PERMISSIONS.OVERTIME_READ_TEAM)
  @ApiOperation({ summary: "Summarize overtime inside the caller's scope" })
  summary(@Query() query: OvertimeSummaryQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.requests.summary(query, user);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.OVERTIME_EXPORT)
  @ApiOperation({ summary: "Export overtime summary as CSV" })
  async export(
    @Query() query: OvertimeSummaryQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const csv = await this.requests.exportCsv(query, user);
    const date = query.to ?? query.from ?? new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="overtime-${date}.csv"`);
    res.send(csv);
  }
}
