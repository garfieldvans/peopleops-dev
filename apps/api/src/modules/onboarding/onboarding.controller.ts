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
  CompleteOnboardingDto,
  CreateOnboardingRecordDto,
  CreateOnboardingTemplateDto,
  ListOnboardingQueryDto,
  ListOnboardingTemplatesQueryDto,
  UpdateOnboardingRecordDto,
  UpdateOnboardingTaskDto,
  UpdateOnboardingTemplateDto,
} from "./dto/onboarding.dto";
import { OnboardingService } from "./onboarding.service";

@ApiTags("onboarding")
@ApiBearerAuth()
@Controller("onboarding")
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get("templates")
  @RequirePermissions(PERMISSIONS.ONBOARDING_READ)
  @ApiOperation({ summary: "List onboarding templates" })
  templates(@Query() query: ListOnboardingTemplatesQueryDto) {
    return this.onboarding.listTemplates(query);
  }

  @Post("templates")
  @RequirePermissions(PERMISSIONS.ONBOARDING_MANAGE)
  @ApiOperation({ summary: "Create an onboarding template" })
  createTemplate(
    @Body() dto: CreateOnboardingTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.onboarding.createTemplate(dto, user, requestMeta(req));
  }

  @Patch("templates/:id")
  @RequirePermissions(PERMISSIONS.ONBOARDING_MANAGE)
  @ApiOperation({ summary: "Update an onboarding template" })
  updateTemplate(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateOnboardingTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.onboarding.updateTemplate(id, dto, user, requestMeta(req));
  }

  @Get("records")
  @RequirePermissions(PERMISSIONS.ONBOARDING_READ)
  @ApiOperation({ summary: "List employee onboarding records" })
  records(@Query() query: ListOnboardingQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.list(query, user);
  }

  @Get("records/:id")
  @RequirePermissions(PERMISSIONS.ONBOARDING_READ)
  @ApiOperation({ summary: "Get an onboarding record and its tasks" })
  record(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.onboarding.get(id, user);
  }

  @Post("records")
  @RequirePermissions(PERMISSIONS.ONBOARDING_MANAGE)
  @ApiOperation({ summary: "Create an employee onboarding record from a template" })
  createRecord(
    @Body() dto: CreateOnboardingRecordDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.onboarding.create(dto, user, requestMeta(req));
  }

  @Patch("records/:id")
  @RequirePermissions(PERMISSIONS.ONBOARDING_MANAGE)
  @ApiOperation({ summary: "Update an onboarding record" })
  updateRecord(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateOnboardingRecordDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.onboarding.update(id, dto, user, requestMeta(req));
  }

  @Post("records/:id/complete")
  @RequirePermissions(PERMISSIONS.ONBOARDING_MANAGE)
  @ApiOperation({ summary: "Complete an onboarding record" })
  completeRecord(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: CompleteOnboardingDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.onboarding.complete(id, dto, user, requestMeta(req));
  }

  @Patch("tasks/:id")
  @RequirePermissions(PERMISSIONS.ONBOARDING_TASK_UPDATE)
  @ApiOperation({ summary: "Update an onboarding task" })
  updateTask(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateOnboardingTaskDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.onboarding.updateTask(id, dto, user, requestMeta(req));
  }
}
