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
  CompleteOffboardingDto,
  CreateOffboardingRecordDto,
  CreateOffboardingTemplateDto,
  ListOffboardingQueryDto,
  ListOnboardingTemplatesQueryDto,
  UpdateOffboardingRecordDto,
  UpdateOffboardingTaskDto,
  UpdateOffboardingTemplateDto,
} from "./dto/onboarding.dto";
import { OffboardingService } from "./offboarding.service";

@ApiTags("offboarding")
@ApiBearerAuth()
@Controller("offboarding")
export class OffboardingController {
  constructor(private readonly offboarding: OffboardingService) {}

  @Get("templates")
  @RequirePermissions(PERMISSIONS.OFFBOARDING_READ)
  @ApiOperation({ summary: "List offboarding templates" })
  templates(@Query() query: ListOnboardingTemplatesQueryDto) {
    return this.offboarding.listTemplates(query);
  }

  @Post("templates")
  @RequirePermissions(PERMISSIONS.OFFBOARDING_MANAGE)
  @ApiOperation({ summary: "Create an offboarding template" })
  createTemplate(
    @Body() dto: CreateOffboardingTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.offboarding.createTemplate(dto, user, requestMeta(req));
  }

  @Patch("templates/:id")
  @RequirePermissions(PERMISSIONS.OFFBOARDING_MANAGE)
  @ApiOperation({ summary: "Update an offboarding template" })
  updateTemplate(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateOffboardingTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.offboarding.updateTemplate(id, dto, user, requestMeta(req));
  }

  @Get("records")
  @RequirePermissions(PERMISSIONS.OFFBOARDING_READ)
  @ApiOperation({ summary: "List offboarding records" })
  records(@Query() query: ListOffboardingQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.offboarding.list(query, user);
  }

  @Get("records/:id")
  @RequirePermissions(PERMISSIONS.OFFBOARDING_READ)
  @ApiOperation({ summary: "Get an offboarding record and its tasks" })
  record(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.offboarding.get(id, user);
  }

  @Post("records")
  @RequirePermissions(PERMISSIONS.OFFBOARDING_MANAGE)
  @ApiOperation({ summary: "Initiate offboarding for an employee" })
  createRecord(
    @Body() dto: CreateOffboardingRecordDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.offboarding.create(dto, user, requestMeta(req));
  }

  @Patch("records/:id")
  @RequirePermissions(PERMISSIONS.OFFBOARDING_MANAGE)
  @ApiOperation({ summary: "Update an offboarding record" })
  updateRecord(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateOffboardingRecordDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.offboarding.update(id, dto, user, requestMeta(req));
  }

  @Post("records/:id/complete")
  @RequirePermissions(PERMISSIONS.OFFBOARDING_MANAGE)
  @ApiOperation({ summary: "Complete offboarding and update the employee lifecycle" })
  completeRecord(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: CompleteOffboardingDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.offboarding.complete(id, dto, user, requestMeta(req));
  }

  @Patch("tasks/:id")
  @RequirePermissions(PERMISSIONS.OFFBOARDING_TASK_UPDATE)
  @ApiOperation({ summary: "Update an offboarding task" })
  updateTask(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateOffboardingTaskDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.offboarding.updateTask(id, dto, user, requestMeta(req));
  }
}
