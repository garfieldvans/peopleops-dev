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
import { EmergencyContactsService } from "./emergency-contacts.service";
import {
  CreateEmergencyContactDto,
  UpdateEmergencyContactDto,
} from "./dto/employee.dto";

const READ_ANY = [
  PERMISSIONS.EMPLOYEE_READ,
  PERMISSIONS.EMPLOYEE_READ_SENSITIVE,
  PERMISSIONS.EMPLOYEE_READ_TEAM,
  PERMISSIONS.EMPLOYEE_READ_SELF,
];

@ApiTags("employees")
@ApiBearerAuth()
@Controller("employees/:employeeId/emergency-contacts")
export class EmergencyContactsController {
  constructor(private readonly contacts: EmergencyContactsService) {}

  @Get()
  @RequireAnyPermission(...READ_ANY)
  @ApiOperation({ summary: "List emergency contacts for an employee" })
  list(
    @Param("employeeId", new ParseUUIDPipe({ version: "4" })) employeeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contacts.list(employeeId, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: "Add an emergency contact" })
  create(
    @Param("employeeId", new ParseUUIDPipe({ version: "4" })) employeeId: string,
    @Body() dto: CreateEmergencyContactDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.contacts.create(employeeId, dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Patch(":contactId")
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: "Update an emergency contact" })
  update(
    @Param("employeeId", new ParseUUIDPipe({ version: "4" })) employeeId: string,
    @Param("contactId", new ParseUUIDPipe({ version: "4" })) contactId: string,
    @Body() dto: UpdateEmergencyContactDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.contacts.update(employeeId, contactId, dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Delete(":contactId")
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: "Remove an emergency contact" })
  async remove(
    @Param("employeeId", new ParseUUIDPipe({ version: "4" })) employeeId: string,
    @Param("contactId", new ParseUUIDPipe({ version: "4" })) contactId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.contacts.remove(employeeId, contactId, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }
}
