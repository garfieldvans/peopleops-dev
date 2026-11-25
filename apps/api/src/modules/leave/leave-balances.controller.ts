import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { PERMISSIONS } from "@peopleops/shared-types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestMeta } from "../../common/http/request-meta";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
  AdjustLeaveBalanceDto,
  ListLeaveBalancesQueryDto,
  ListLeaveTransactionsQueryDto,
  MyLeaveBalanceQueryDto,
} from "./dto/leave.dto";
import { LeaveEntitlementService } from "./leave-entitlement.service";
import type { LeaveActor } from "./leave.types";

function actorOf(user: AuthenticatedUser, req: Request): LeaveActor {
  return { actorUserId: user.id, actorEmail: user.email, meta: requestMeta(req) };
}

@ApiTags("leave-balances")
@ApiBearerAuth()
@Controller("leave-balances")
export class LeaveBalancesController {
  constructor(private readonly entitlement: LeaveEntitlementService) {}

  @Get("me")
  @RequirePermissions(PERMISSIONS.LEAVE_BALANCE_READ)
  @ApiOperation({ summary: "Get the signed-in employee's leave balances" })
  mine(@Query() query: MyLeaveBalanceQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.entitlement.myBalances(user, query.asOf);
  }

  @Get("me/:leaveTypeId")
  @RequirePermissions(PERMISSIONS.LEAVE_BALANCE_READ)
  @ApiOperation({ summary: "Get one leave balance for the signed-in employee" })
  mineByType(
    @Param("leaveTypeId", new ParseUUIDPipe({ version: "4" })) leaveTypeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.entitlement
      .getLinkedEmployee(user.id)
      .then((employee) =>
        this.entitlement.getBalance(
          employee.id,
          leaveTypeId,
          new Date().toISOString().slice(0, 10),
        ),
      );
  }

  @Get()
  @RequirePermissions(PERMISSIONS.LEAVE_BALANCE_READ)
  @ApiOperation({ summary: "List leave balances within the caller's scope" })
  list(@Query() query: ListLeaveBalancesQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.entitlement.listBalances(query, user);
  }

  @Get(":employeeId")
  @RequirePermissions(PERMISSIONS.LEAVE_BALANCE_READ)
  @ApiOperation({ summary: "Get leave balances for an employee in scope" })
  forEmployee(
    @Param("employeeId", new ParseUUIDPipe({ version: "4" })) employeeId: string,
    @Query() query: MyLeaveBalanceQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.entitlement
      .assertCanReadEmployee(employeeId, user)
      .then(() => this.entitlement.balancesForEmployee(employeeId, query.asOf));
  }

  @Post(":employeeId/adjustments")
  @RequirePermissions(PERMISSIONS.LEAVE_BALANCE_ADJUST)
  @ApiOperation({ summary: "Create a manual leave balance adjustment" })
  adjust(
    @Param("employeeId", new ParseUUIDPipe({ version: "4" })) employeeId: string,
    @Body() dto: AdjustLeaveBalanceDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.entitlement.adjust(employeeId, dto, actorOf(user, req));
  }
}

@ApiTags("leave-transactions")
@ApiBearerAuth()
@Controller("leave-transactions")
export class LeaveTransactionsController {
  constructor(private readonly entitlement: LeaveEntitlementService) {}

  @Get("me")
  @RequirePermissions(PERMISSIONS.LEAVE_TRANSACTION_READ)
  @ApiOperation({ summary: "Get the signed-in employee's leave ledger" })
  mine(@Query() query: ListLeaveTransactionsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.entitlement.listTransactions(query, user, true);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.LEAVE_TRANSACTION_READ)
  @ApiOperation({ summary: "List leave transactions within the caller's scope" })
  list(@Query() query: ListLeaveTransactionsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.entitlement.listTransactions(query, user);
  }
}
