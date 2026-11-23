import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { PERMISSIONS } from "@peopleops/shared-types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequireAnyPermission } from "../../common/decorators/require-any-permission.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestMeta } from "../../common/http/request-meta";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
  EmployeeDocumentsService,
  MAX_DOCUMENT_BYTES,
  type UploadedDocumentFile,
} from "./employee-documents.service";
import { UploadEmployeeDocumentDto } from "./dto/employee.dto";

const READ_ANY = [
  PERMISSIONS.EMPLOYEE_READ,
  PERMISSIONS.EMPLOYEE_READ_SENSITIVE,
  PERMISSIONS.EMPLOYEE_READ_TEAM,
  PERMISSIONS.EMPLOYEE_READ_SELF,
];

@ApiTags("employees")
@ApiBearerAuth()
@Controller("employees/:employeeId/documents")
export class EmployeeDocumentsController {
  constructor(private readonly documents: EmployeeDocumentsService) {}

  @Get()
  @RequireAnyPermission(...READ_ANY)
  @ApiOperation({ summary: "List document metadata for an employee" })
  list(
    @Param("employeeId", new ParseUUIDPipe({ version: "4" })) employeeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.list(employeeId, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE_DOCUMENTS)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_DOCUMENT_BYTES } }))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload an employee document to private storage" })
  upload(
    @Param("employeeId", new ParseUUIDPipe({ version: "4" })) employeeId: string,
    @UploadedFile() file: UploadedDocumentFile | undefined,
    @Body() dto: UploadEmployeeDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.documents.upload(employeeId, file, dto, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }

  @Get(":documentId/download")
  @RequireAnyPermission(...READ_ANY)
  @ApiOperation({ summary: "Download a document through an authorized stream" })
  async download(
    @Param("employeeId", new ParseUUIDPipe({ version: "4" })) employeeId: string,
    @Param("documentId", new ParseUUIDPipe({ version: "4" })) documentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { document, content } = await this.documents.download(employeeId, documentId, user);
    res.setHeader("Content-Type", document.mimeType);
    res.setHeader("Content-Length", String(content.length));
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
    );
    return content;
  }

  @Delete(":documentId")
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE_DOCUMENTS)
  @ApiOperation({ summary: "Delete an employee document" })
  async remove(
    @Param("employeeId", new ParseUUIDPipe({ version: "4" })) employeeId: string,
    @Param("documentId", new ParseUUIDPipe({ version: "4" })) documentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.documents.remove(employeeId, documentId, {
      actorUserId: user.id,
      actorEmail: user.email,
      meta: requestMeta(req),
    });
  }
}
