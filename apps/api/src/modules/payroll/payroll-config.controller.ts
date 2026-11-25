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
  CreateCompensationDto,
  CreatePayrollAssignmentDto,
  CreatePayrollComponentDto,
  CreatePayrollPeriodDto,
  ListCompensationQueryDto,
  ListPayrollAssignmentsQueryDto,
  ListPayrollComponentsQueryDto,
  ListPayrollPeriodsQueryDto,
  UpdateCompensationDto,
  UpdatePayrollAssignmentDto,
  UpdatePayrollComponentDto,
  UpdatePayrollPeriodDto,
  UpdatePayrollSettingsDto,
} from "./dto/payroll.dto";
import { PayrollAssignmentsService } from "./payroll-assignments.service";
import { PayrollCompensationService } from "./payroll-compensation.service";
import { PayrollComponentsService } from "./payroll-components.service";
import { PayrollPeriodsService } from "./payroll-periods.service";
import { PayrollSettingsService } from "./payroll-settings.service";
import type { PayrollActor } from "./payroll.utils";

function actorOf(user: AuthenticatedUser, req: Request): PayrollActor {
  return { actorUserId: user.id, actorEmail: user.email, meta: requestMeta(req) };
}

@ApiTags("payroll-configuration")
@ApiBearerAuth()
@Controller("payroll")
export class PayrollConfigController {
  constructor(
    private readonly settings: PayrollSettingsService,
    private readonly compensation: PayrollCompensationService,
    private readonly components: PayrollComponentsService,
    private readonly assignments: PayrollAssignmentsService,
    private readonly periods: PayrollPeriodsService,
  ) {}

  @Get("settings")
  @RequirePermissions(PERMISSIONS.PAYROLL_SETTINGS_READ)
  @ApiOperation({ summary: "Get payroll calculation settings" })
  getSettings() {
    return this.settings.get();
  }

  @Patch("settings")
  @RequirePermissions(PERMISSIONS.PAYROLL_SETTINGS_MANAGE)
  @ApiOperation({ summary: "Update payroll calculation settings" })
  updateSettings(
    @Body() dto: UpdatePayrollSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.settings.update(dto, actorOf(user, req));
  }

  @Get("compensation")
  @RequirePermissions(PERMISSIONS.PAYROLL_COMPENSATION_READ)
  @ApiOperation({ summary: "List employee compensation records" })
  listCompensation(@Query() query: ListCompensationQueryDto) {
    return this.compensation.list(query);
  }

  @Get("compensation/employees/:employeeId/history")
  @RequirePermissions(PERMISSIONS.PAYROLL_COMPENSATION_READ)
  @ApiOperation({ summary: "Get effective-dated compensation history for an employee" })
  compensationHistory(@Param("employeeId", new ParseUUIDPipe({ version: "4" })) employeeId: string) {
    return this.compensation.history(employeeId);
  }

  @Post("compensation")
  @RequirePermissions(PERMISSIONS.PAYROLL_COMPENSATION_MANAGE)
  @ApiOperation({ summary: "Create an effective-dated compensation record" })
  createCompensation(
    @Body() dto: CreateCompensationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.compensation.create(dto, actorOf(user, req));
  }

  @Patch("compensation/:id")
  @RequirePermissions(PERMISSIONS.PAYROLL_COMPENSATION_MANAGE)
  @ApiOperation({ summary: "Update a compensation record" })
  updateCompensation(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateCompensationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.compensation.update(id, dto, actorOf(user, req));
  }

  @Get("components")
  @RequirePermissions(PERMISSIONS.PAYROLL_COMPONENTS_READ)
  @ApiOperation({ summary: "List payroll components" })
  listComponents(@Query() query: ListPayrollComponentsQueryDto) {
    return this.components.list(query);
  }

  @Get("components/active")
  @RequirePermissions(PERMISSIONS.PAYROLL_COMPONENTS_READ)
  @ApiOperation({ summary: "List active payroll components for pickers" })
  activeComponents() {
    return this.components.listActive();
  }

  @Get("components/:id")
  @RequirePermissions(PERMISSIONS.PAYROLL_COMPONENTS_READ)
  @ApiOperation({ summary: "Get a payroll component" })
  getComponent(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.components.getById(id);
  }

  @Post("components")
  @RequirePermissions(PERMISSIONS.PAYROLL_COMPONENTS_MANAGE)
  @ApiOperation({ summary: "Create a payroll component" })
  createComponent(
    @Body() dto: CreatePayrollComponentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.components.create(dto, actorOf(user, req));
  }

  @Patch("components/:id")
  @RequirePermissions(PERMISSIONS.PAYROLL_COMPONENTS_MANAGE)
  @ApiOperation({ summary: "Update a payroll component" })
  updateComponent(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdatePayrollComponentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.components.update(id, dto, actorOf(user, req));
  }

  @Post("components/:id/deactivate")
  @RequirePermissions(PERMISSIONS.PAYROLL_COMPONENTS_MANAGE)
  @ApiOperation({ summary: "Deactivate a payroll component" })
  deactivateComponent(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.components.deactivate(id, actorOf(user, req));
  }

  @Get("assignments")
  @RequirePermissions(PERMISSIONS.PAYROLL_COMPONENTS_READ)
  @ApiOperation({ summary: "List employee payroll component assignments" })
  listAssignments(@Query() query: ListPayrollAssignmentsQueryDto) {
    return this.assignments.list(query);
  }

  @Post("assignments")
  @RequirePermissions(PERMISSIONS.PAYROLL_ASSIGNMENTS_MANAGE)
  @ApiOperation({ summary: "Assign a payroll component to an employee" })
  createAssignment(
    @Body() dto: CreatePayrollAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.assignments.create(dto, actorOf(user, req));
  }

  @Patch("assignments/:id")
  @RequirePermissions(PERMISSIONS.PAYROLL_ASSIGNMENTS_MANAGE)
  @ApiOperation({ summary: "Update an employee payroll component assignment" })
  updateAssignment(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdatePayrollAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.assignments.update(id, dto, actorOf(user, req));
  }

  @Post("assignments/:id/deactivate")
  @RequirePermissions(PERMISSIONS.PAYROLL_ASSIGNMENTS_MANAGE)
  @ApiOperation({ summary: "Deactivate an employee payroll component assignment" })
  deactivateAssignment(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.assignments.deactivate(id, actorOf(user, req));
  }

  @Get("periods")
  @RequirePermissions(PERMISSIONS.PAYROLL_PERIODS_READ)
  @ApiOperation({ summary: "List payroll periods" })
  listPeriods(@Query() query: ListPayrollPeriodsQueryDto) {
    return this.periods.list(query);
  }

  @Get("periods/:id")
  @RequirePermissions(PERMISSIONS.PAYROLL_PERIODS_READ)
  @ApiOperation({ summary: "Get a payroll period" })
  getPeriod(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.periods.getById(id);
  }

  @Post("periods")
  @RequirePermissions(PERMISSIONS.PAYROLL_PERIODS_MANAGE)
  @ApiOperation({ summary: "Create a payroll period" })
  createPeriod(
    @Body() dto: CreatePayrollPeriodDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.periods.create(dto, actorOf(user, req));
  }

  @Patch("periods/:id")
  @RequirePermissions(PERMISSIONS.PAYROLL_PERIODS_MANAGE)
  @ApiOperation({ summary: "Update a payroll period" })
  updatePeriod(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdatePayrollPeriodDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.periods.update(id, dto, actorOf(user, req));
  }
}
