import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@peopleops/shared-types";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import {
  EmployeeReportQueryDto,
  ExportReportQueryDto,
  PerformanceReportQueryDto,
  ReportRangeQueryDto,
} from "./dto/reports.dto";
import { ReportsService } from "./reports.service";

@ApiTags("reports")
@ApiBearerAuth()
@Controller("reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("hr-dashboard")
  @RequirePermissions(PERMISSIONS.REPORTS_HR_READ)
  @ApiOperation({ summary: "Get company-wide HR dashboard metrics" })
  hrDashboard() {
    return this.reports.hrDashboard();
  }

  @Get("employees")
  @RequirePermissions(PERMISSIONS.REPORTS_EMPLOYEE_READ)
  @ApiOperation({ summary: "Get the paginated employee report" })
  employees(@Query() query: EmployeeReportQueryDto) {
    return this.reports.employees(query);
  }

  @Get("attendance")
  @RequirePermissions(PERMISSIONS.REPORTS_ATTENDANCE_READ)
  @ApiOperation({ summary: "Get attendance and absence summaries" })
  attendance(@Query() query: ReportRangeQueryDto) {
    return this.reports.attendanceAndLeave(query);
  }

  @Get("leave")
  @RequirePermissions(PERMISSIONS.REPORTS_LEAVE_READ)
  @ApiOperation({ summary: "Get leave utilization" })
  leave(@Query() query: ReportRangeQueryDto) {
    return this.reports.attendanceAndLeave(query);
  }

  @Get("overtime")
  @RequirePermissions(PERMISSIONS.REPORTS_OVERTIME_READ)
  @ApiOperation({ summary: "Get verified overtime summaries" })
  overtime(@Query() query: ReportRangeQueryDto) {
    return this.reports.overtimeAndPayroll(query);
  }

  @Get("payroll")
  @RequirePermissions(PERMISSIONS.REPORTS_PAYROLL_READ)
  @ApiOperation({ summary: "Get published payroll summaries" })
  payroll(@Query() query: ReportRangeQueryDto) {
    return this.reports.overtimeAndPayroll(query);
  }

  @Get("onboarding")
  @RequirePermissions(PERMISSIONS.ONBOARDING_READ)
  @ApiOperation({ summary: "Get onboarding completion and overdue metrics" })
  onboarding(@Query() query: ReportRangeQueryDto) {
    return this.reports.onboarding(query);
  }

  @Get("offboarding")
  @RequirePermissions(PERMISSIONS.OFFBOARDING_READ)
  @ApiOperation({ summary: "Get offboarding completion and overdue metrics" })
  offboarding(@Query() query: ReportRangeQueryDto) {
    return this.reports.offboarding(query);
  }

  @Get("performance")
  @RequirePermissions(PERMISSIONS.PERFORMANCE_CYCLES_READ)
  @ApiOperation({ summary: "Get performance review completion metrics" })
  performance(@Query() query: PerformanceReportQueryDto) {
    return this.reports.performance(query);
  }

  @Get("learning")
  @RequirePermissions(PERMISSIONS.LEARNING_PROGRAMS_READ)
  @ApiOperation({ summary: "Get training participation and completion metrics" })
  learning(@Query() query: ReportRangeQueryDto) {
    return this.reports.learning(query);
  }

  @Get("completion")
  @RequirePermissions(PERMISSIONS.REPORTS_HR_READ)
  @ApiOperation({ summary: "Get combined onboarding, offboarding, performance, and learning metrics" })
  completion() {
    return this.reports.completionSummary();
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.REPORTS_EXPORT)
  @ApiOperation({ summary: "Export a report as CSV" })
  export(@Query() query: ExportReportQueryDto) {
    return this.reports.export(query);
  }
}
