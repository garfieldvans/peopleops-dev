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
import {
  CancelPayrollRunDto,
  CreatePayrollAdjustmentDto,
  CreatePayrollRunDto,
  ListPayrollAdjustmentsQueryDto,
  ListPayrollRunsQueryDto,
  PayrollRunCommentDto,
  ReviewPayrollAdjustmentDto,
  UpdatePayrollAdjustmentDto,
} from "./dto/payroll.dto";
import { PayrollAdjustmentsService } from "./payroll-adjustments.service";
import { PayrollRunsService } from "./payroll-runs.service";
import type { PayrollActor } from "./payroll.utils";

function actorOf(user: AuthenticatedUser, req: Request): PayrollActor {
  return { actorUserId: user.id, actorEmail: user.email, meta: requestMeta(req) };
}

@ApiTags("payroll-runs")
@ApiBearerAuth()
@Controller("payroll")
export class PayrollRunsController {
  constructor(
    private readonly runs: PayrollRunsService,
    private readonly adjustments: PayrollAdjustmentsService,
  ) {}

  @Get("dashboard")
  @RequirePermissions(PERMISSIONS.PAYROLL_RUNS_READ)
  @ApiOperation({ summary: "Get payroll operations dashboard counts" })
  dashboard() {
    return this.runs.dashboard();
  }

  @Get("runs")
  @RequirePermissions(PERMISSIONS.PAYROLL_RUNS_READ)
  @ApiOperation({ summary: "List payroll runs" })
  listRuns(@Query() query: ListPayrollRunsQueryDto) {
    return this.runs.list(query);
  }

  @Post("runs")
  @RequirePermissions(PERMISSIONS.PAYROLL_RUNS_CALCULATE)
  @ApiOperation({ summary: "Create a payroll run for an open period" })
  createRun(
    @Body() dto: CreatePayrollRunDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.runs.create(dto, actorOf(user, req));
  }

  @Get("runs/:id")
  @RequirePermissions(PERMISSIONS.PAYROLL_RUNS_READ)
  @ApiOperation({ summary: "Get a payroll run with approval history" })
  getRun(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.runs.getById(id);
  }

  @Post("runs/:id/calculate")
  @RequirePermissions(PERMISSIONS.PAYROLL_RUNS_CALCULATE)
  @ApiOperation({ summary: "Calculate or recalculate a payroll run" })
  calculateRun(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.runs.calculate(id, user);
  }

  @Post("runs/:id/submit-review")
  @RequirePermissions(PERMISSIONS.PAYROLL_RUNS_REVIEW)
  @ApiOperation({ summary: "Submit a calculated payroll run for review" })
  submitRun(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: PayrollRunCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.runs.submitReview(id, dto, user);
  }

  @Post("runs/:id/approve")
  @RequirePermissions(PERMISSIONS.PAYROLL_RUNS_APPROVE)
  @ApiOperation({ summary: "Approve a payroll run under review" })
  approveRun(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: PayrollRunCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.runs.approve(id, dto, user);
  }

  @Post("runs/:id/publish")
  @RequirePermissions(PERMISSIONS.PAYROLL_RUNS_PUBLISH)
  @ApiOperation({ summary: "Publish an approved payroll run and its payslips" })
  publishRun(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: PayrollRunCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.runs.publish(id, dto, user);
  }

  @Post("runs/:id/cancel")
  @RequirePermissions(PERMISSIONS.PAYROLL_RUNS_CANCEL)
  @ApiOperation({ summary: "Cancel a payroll run with a reason" })
  cancelRun(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: CancelPayrollRunDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.runs.cancel(id, dto, user);
  }

  @Get("adjustments")
  @RequirePermissions(PERMISSIONS.PAYROLL_ADJUSTMENTS_READ)
  @ApiOperation({ summary: "List payroll adjustments" })
  listAdjustments(@Query() query: ListPayrollAdjustmentsQueryDto) {
    return this.adjustments.list(query);
  }

  @Post("adjustments")
  @RequirePermissions(PERMISSIONS.PAYROLL_ADJUSTMENTS_CREATE)
  @ApiOperation({ summary: "Create a pending payroll adjustment" })
  createAdjustment(
    @Body() dto: CreatePayrollAdjustmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.adjustments.create(dto, actorOf(user, req));
  }

  @Patch("adjustments/:id")
  @RequirePermissions(PERMISSIONS.PAYROLL_ADJUSTMENTS_CREATE)
  @ApiOperation({ summary: "Update a pending payroll adjustment" })
  updateAdjustment(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdatePayrollAdjustmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.adjustments.update(id, dto, actorOf(user, req));
  }

  @Post("adjustments/:id/review")
  @RequirePermissions(PERMISSIONS.PAYROLL_ADJUSTMENTS_APPROVE)
  @ApiOperation({ summary: "Approve or reject a pending payroll adjustment" })
  reviewAdjustment(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: ReviewPayrollAdjustmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adjustments.review(id, dto, user);
  }
}
