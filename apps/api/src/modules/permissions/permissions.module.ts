import { Controller, Get, Module } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@peopleops/shared-types";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PrismaService } from "../../prisma/prisma.service";

@ApiTags("permissions")
@ApiBearerAuth()
@Controller("permissions")
class PermissionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ROLE_READ)
  @ApiOperation({ summary: "List the permission catalog" })
  list() {
    return this.prisma.permission.findMany({
      orderBy: { code: "asc" },
      select: { id: true, name: true, code: true, description: true },
    });
  }
}

@Module({
  controllers: [PermissionsController],
})
export class PermissionsModule {}
