import { Controller, Get, Query, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { PERMISSIONS } from "@peopleops/shared-types";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { LeaveReportQueryDto } from "./dto/leave.dto";
import { LeaveReportsService } from "./leave-reports.service";

@ApiTags("leave-reports")
@ApiBearerAuth()
@Controller("leave-reports")
export class LeaveReportsController {
  constructor(private readonly reports: LeaveReportsService) {}

  @Get("summary")
  @RequirePermissions(PERMISSIONS.LEAVE_REPORT_READ)
  @ApiOperation({ summary: "Summarise leave usage and balances" })
  summary(@Query() query: LeaveReportQueryDto) {
    return this.reports.summary(query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.LEAVE_REPORT_READ)
  @ApiOperation({ summary: "Export the leave balance report as CSV" })
  async export(@Query() query: LeaveReportQueryDto, @Res() res: Response) {
    const csv = await this.reports.exportCsv(query);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="leave-report-${query.to}.csv"`);
    res.send(csv);
  }
}
