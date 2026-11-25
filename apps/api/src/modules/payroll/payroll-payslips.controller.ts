import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { PERMISSIONS } from "@peopleops/shared-types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { attachmentDisposition } from "../../common/http/content-disposition";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
  ListPayrollPayslipsQueryDto,
  PayrollRegisterQueryDto,
  PayrollReportQueryDto,
} from "./dto/payroll.dto";
import { PayrollPayslipsService } from "./payroll-payslips.service";
import { PayrollReportsService } from "./payroll-reports.service";

@ApiTags("payroll-payslips")
@ApiBearerAuth()
@Controller("payroll")
export class PayrollPayslipsController {
  constructor(
    private readonly payslips: PayrollPayslipsService,
    private readonly reports: PayrollReportsService,
  ) {}

  @Get("payslips")
  @RequirePermissions(PERMISSIONS.PAYROLL_PAYSLIPS_READ_SELF)
  @ApiOperation({ summary: "List payslips available to the signed-in user" })
  list(@Query() query: ListPayrollPayslipsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payslips.list(query, user);
  }

  @Get("payslips/:id")
  @RequirePermissions(PERMISSIONS.PAYROLL_PAYSLIPS_READ_SELF)
  @ApiOperation({ summary: "Get a payslip with its calculation snapshot" })
  get(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payslips.getById(id, user);
  }

  @Get("payslips/:id/pdf")
  @RequirePermissions(PERMISSIONS.PAYROLL_PAYSLIPS_READ_SELF)
  @ApiOperation({ summary: "Download a payslip as a PDF" })
  async download(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const file = await this.payslips.download(id, user);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", attachmentDisposition(file.fileName));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");
    res.send(Buffer.from(file.buffer));
  }

  @Get("reports/summary")
  @RequirePermissions(PERMISSIONS.PAYROLL_REPORTS_READ)
  @ApiOperation({ summary: "Get payroll totals for a date range" })
  summary(@Query() query: PayrollReportQueryDto) {
    return this.reports.summary(query.from, query.to);
  }

  @Get("reports/components")
  @RequirePermissions(PERMISSIONS.PAYROLL_REPORTS_READ)
  @ApiOperation({ summary: "Get payroll component totals for a date range" })
  components(@Query() query: PayrollReportQueryDto) {
    return this.reports.components(query.from, query.to);
  }

  @Get("reports/register")
  @RequirePermissions(PERMISSIONS.PAYROLL_REPORTS_READ)
  @ApiOperation({ summary: "Get the payroll register for a date range" })
  register(@Query() query: PayrollRegisterQueryDto) {
    return this.reports.register(query.from, query.to, query.page, query.pageSize);
  }
}
