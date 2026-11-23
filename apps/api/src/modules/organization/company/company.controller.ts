import { Body, Controller, Get, Patch, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { PERMISSIONS } from "@peopleops/shared-types";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { requestMeta } from "../../../common/http/request-meta";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import { CompanyService } from "./company.service";
import { UpdateCompanyDto } from "./dto/update-company.dto";

@ApiTags("organization")
@ApiBearerAuth()
@Controller("company")
export class CompanyController {
  constructor(private readonly company: CompanyService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.COMPANY_READ)
  @ApiOperation({ summary: "Get the company profile (singleton)" })
  get() {
    return this.company.get();
  }

  @Patch()
  @RequirePermissions(PERMISSIONS.COMPANY_UPDATE)
  @ApiOperation({ summary: "Update the company profile" })
  update(@Body() dto: UpdateCompanyDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.company.update(dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }
}
