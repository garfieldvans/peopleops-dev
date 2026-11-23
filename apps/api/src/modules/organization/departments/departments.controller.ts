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
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { PERMISSIONS } from "@peopleops/shared-types";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { requestMeta } from "../../../common/http/request-meta";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import { DepartmentsService } from "./departments.service";
import {
  CreateDepartmentDto,
  ListDepartmentsQueryDto,
  UpdateDepartmentDto,
} from "./dto/department.dto";

@ApiTags("organization")
@ApiBearerAuth()
@Controller("departments")
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DEPARTMENT_READ)
  @ApiOperation({ summary: "List departments with search, filters and pagination" })
  list(@Query() query: ListDepartmentsQueryDto) {
    return this.departments.list(query);
  }

  @Get("tree")
  @RequirePermissions(PERMISSIONS.DEPARTMENT_READ)
  @ApiOperation({ summary: "Full department hierarchy as a tree" })
  tree() {
    return this.departments.tree();
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.DEPARTMENT_READ)
  @ApiOperation({ summary: "Get a department" })
  get(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.departments.getById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.DEPARTMENT_CREATE)
  @ApiOperation({ summary: "Create a department" })
  create(
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.departments.create(dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.DEPARTMENT_UPDATE)
  @ApiOperation({ summary: "Update a department, including its parent" })
  update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.departments.update(id, dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Delete(":id")
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.DEPARTMENT_DELETE)
  @ApiOperation({ summary: "Delete an empty department" })
  async remove(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.departments.remove(id, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }
}
