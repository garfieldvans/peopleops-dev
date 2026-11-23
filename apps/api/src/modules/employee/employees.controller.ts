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
import { RequireAnyPermission } from "../../common/decorators/require-any-permission.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestMeta } from "../../common/http/request-meta";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { EmployeesService } from "./employees.service";
import {
  CreateEmployeeDto,
  DeactivateEmployeeDto,
  LinkEmployeeUserDto,
  ListEmployeeHistoryQueryDto,
  ListEmployeesQueryDto,
  UpdateEmployeeProfileDto,
  UpdateSelfEmployeeDto,
} from "./dto/employee.dto";

const READ_ANY = [
  PERMISSIONS.EMPLOYEE_READ,
  PERMISSIONS.EMPLOYEE_READ_SENSITIVE,
  PERMISSIONS.EMPLOYEE_READ_TEAM,
  PERMISSIONS.EMPLOYEE_READ_SELF,
];

@ApiTags("employees")
@ApiBearerAuth()
@Controller("employees")
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @RequireAnyPermission(...READ_ANY)
  @ApiOperation({ summary: "List employees with server-side search, filters and sorting" })
  list(@Query() query: ListEmployeesQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.employees.list(query, user);
  }

  @Get("me")
  @RequireAnyPermission(...READ_ANY)
  @ApiOperation({ summary: "Get the employee record linked to the signed-in account" })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.employees.getSelf(user);
  }

  @Patch("me")
  @RequireAnyPermission(PERMISSIONS.EMPLOYEE_UPDATE_SELF, PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: "Update own contact details" })
  async updateMe(
    @Body() dto: UpdateSelfEmployeeDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const self = await this.employees.getSelf(user);
    return this.employees.updateSelf(self.id, dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Get(":id")
  @RequireAnyPermission(...READ_ANY)
  @ApiOperation({ summary: "Get an employee profile" })
  get(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employees.getById(id, user);
  }

  @Get(":id/history")
  @RequireAnyPermission(...READ_ANY)
  @ApiOperation({ summary: "List employment history entries" })
  history(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Query() _query: ListEmployeeHistoryQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employees.history(id, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_CREATE)
  @ApiOperation({ summary: "Create an employee with an initial employment history entry" })
  create(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.employees.create(dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: "Update an employee profile and employment assignment" })
  update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateEmployeeProfileDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.employees.update(id, dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Post(":id/deactivate")
  @RequirePermissions(PERMISSIONS.EMPLOYEE_DEACTIVATE)
  @ApiOperation({ summary: "Deactivate an employee and close the current employment record" })
  deactivate(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: DeactivateEmployeeDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.employees.deactivate(id, dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Patch(":id/user")
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE_USER_ACCOUNT)
  @ApiOperation({ summary: "Link or unlink a login account to an employee" })
  linkUser(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: LinkEmployeeUserDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.employees.linkUser(id, dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }
}
