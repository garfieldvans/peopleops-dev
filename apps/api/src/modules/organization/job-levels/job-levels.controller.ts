import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { MASTER_STATUSES, PERMISSIONS, type MasterStatus } from "@peopleops/shared-types";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { requestMeta } from "../../../common/http/request-meta";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import { JobLevelsService } from "./job-levels.service";
import { CreateJobLevelDto, UpdateJobLevelDto } from "./dto/job-level.dto";

class ListJobLevelsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: MASTER_STATUSES })
  @IsOptional()
  @IsIn([...MASTER_STATUSES])
  status?: MasterStatus;
}

@ApiTags("organization")
@ApiBearerAuth()
@Controller("job-levels")
export class JobLevelsController {
  constructor(private readonly jobLevels: JobLevelsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.JOB_LEVEL_READ)
  @ApiOperation({ summary: "List job levels ordered by display order" })
  list(@Query() query: ListJobLevelsQueryDto) {
    return this.jobLevels.list(query.search, query.status);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.JOB_LEVEL_CREATE)
  @ApiOperation({ summary: "Create a job level" })
  create(@Body() dto: CreateJobLevelDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.jobLevels.create(dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.JOB_LEVEL_UPDATE)
  @ApiOperation({ summary: "Update a job level" })
  update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateJobLevelDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.jobLevels.update(id, dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Delete(":id")
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.JOB_LEVEL_DELETE)
  @ApiOperation({ summary: "Delete an unused job level" })
  async remove(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.jobLevels.remove(id, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }
}
