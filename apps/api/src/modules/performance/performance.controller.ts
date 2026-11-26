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
  AddGoalUpdateDto,
  CreatePerformanceCycleDto,
  CreatePerformanceGoalDto,
  CreatePerformanceReviewDto,
  ListPerformanceCyclesQueryDto,
  ListPerformanceGoalsQueryDto,
  ListPerformanceReviewsQueryDto,
  TransitionPerformanceCycleDto,
  UpdatePerformanceCycleDto,
  UpdatePerformanceGoalDto,
  UpdatePerformanceReviewDto,
} from "./dto/performance.dto";
import { PerformanceService } from "./performance.service";

@ApiTags("performance")
@ApiBearerAuth()
@Controller("performance")
export class PerformanceController {
  constructor(private readonly performance: PerformanceService) {}

  @Get("cycles")
  @RequirePermissions(PERMISSIONS.PERFORMANCE_CYCLES_READ)
  @ApiOperation({ summary: "List performance cycles" })
  cycles(@Query() query: ListPerformanceCyclesQueryDto) {
    return this.performance.listCycles(query);
  }

  @Get("cycles/:id")
  @RequirePermissions(PERMISSIONS.PERFORMANCE_CYCLES_READ)
  @ApiOperation({ summary: "Get a performance cycle" })
  cycle(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.performance.getCycle(id);
  }

  @Post("cycles")
  @RequirePermissions(PERMISSIONS.PERFORMANCE_CYCLES_MANAGE)
  @ApiOperation({ summary: "Create a performance cycle" })
  createCycle(
    @Body() dto: CreatePerformanceCycleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.performance.createCycle(dto, user, requestMeta(req));
  }

  @Patch("cycles/:id")
  @RequirePermissions(PERMISSIONS.PERFORMANCE_CYCLES_MANAGE)
  @ApiOperation({ summary: "Update a draft performance cycle" })
  updateCycle(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdatePerformanceCycleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.performance.updateCycle(id, dto, user, requestMeta(req));
  }

  @Post("cycles/:id/transition")
  @RequirePermissions(PERMISSIONS.PERFORMANCE_CYCLES_MANAGE)
  @ApiOperation({ summary: "Transition a performance cycle" })
  transitionCycle(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: TransitionPerformanceCycleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.performance.transitionCycle(id, dto, user, requestMeta(req));
  }

  @Get("goals")
  @RequirePermissions(PERMISSIONS.PERFORMANCE_GOALS_READ_SELF)
  @ApiOperation({ summary: "List performance goals in scope" })
  goals(@Query() query: ListPerformanceGoalsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.performance.listGoals(query, user);
  }

  @Get("goals/:id")
  @RequirePermissions(PERMISSIONS.PERFORMANCE_GOALS_READ_SELF)
  @ApiOperation({ summary: "Get a performance goal and its progress history" })
  goal(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performance.getGoal(id, user);
  }

  @Post("goals")
  @RequirePermissions(PERMISSIONS.PERFORMANCE_GOALS_MANAGE)
  @ApiOperation({ summary: "Create a performance goal" })
  createGoal(
    @Body() dto: CreatePerformanceGoalDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.performance.createGoal(dto, user, requestMeta(req));
  }

  @Patch("goals/:id")
  @RequirePermissions(PERMISSIONS.PERFORMANCE_GOALS_MANAGE)
  @ApiOperation({ summary: "Update a performance goal" })
  updateGoal(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdatePerformanceGoalDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.performance.updateGoal(id, dto, user, requestMeta(req));
  }

  @Post("goals/:id/updates")
  @RequirePermissions(PERMISSIONS.PERFORMANCE_GOALS_MANAGE)
  @ApiOperation({ summary: "Append a goal progress update" })
  goalUpdate(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: AddGoalUpdateDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.performance.addGoalUpdate(id, dto, user, requestMeta(req));
  }

  @Get("reviews")
  @RequirePermissions(PERMISSIONS.PERFORMANCE_REVIEWS_READ_SELF)
  @ApiOperation({ summary: "List performance reviews in scope" })
  reviews(@Query() query: ListPerformanceReviewsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.performance.listReviews(query, user);
  }

  @Get("reviews/:id")
  @RequirePermissions(PERMISSIONS.PERFORMANCE_REVIEWS_READ_SELF)
  @ApiOperation({ summary: "Get a performance review" })
  review(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performance.getReview(id, user);
  }

  @Post("reviews")
  @RequirePermissions(PERMISSIONS.PERFORMANCE_REVIEWS_SUBMIT_SELF)
  @ApiOperation({ summary: "Create a self, manager, or HR review" })
  createReview(
    @Body() dto: CreatePerformanceReviewDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.performance.createReview(dto, user, requestMeta(req));
  }

  @Patch("reviews/:id")
  @RequirePermissions(PERMISSIONS.PERFORMANCE_REVIEWS_SUBMIT_SELF)
  @ApiOperation({ summary: "Update a draft review" })
  updateReview(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdatePerformanceReviewDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.performance.updateReview(id, dto, user, requestMeta(req));
  }

  @Post("reviews/:id/submit")
  @RequirePermissions(PERMISSIONS.PERFORMANCE_REVIEWS_SUBMIT_SELF)
  @ApiOperation({ summary: "Submit a draft review" })
  submitReview(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.performance.submitReview(id, user, requestMeta(req));
  }

  @Post("reviews/:id/complete")
  @RequirePermissions(PERMISSIONS.PERFORMANCE_REVIEWS_MANAGE)
  @ApiOperation({ summary: "Complete a submitted review" })
  completeReview(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.performance.completeReview(id, user, requestMeta(req));
  }
}
