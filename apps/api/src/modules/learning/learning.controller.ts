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
import { attachmentDisposition } from "../../common/http/content-disposition";
import { requestMeta } from "../../common/http/request-meta";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { MAX_DOCUMENT_BYTES, type UploadedDocumentFile } from "../employee/employee-documents.service";
import {
  CreateTrainingProgramDto,
  EnrollTrainingDto,
  ListTrainingEnrollmentsQueryDto,
  ListTrainingProgramsQueryDto,
  UpdateTrainingEnrollmentDto,
  UpdateTrainingProgramDto,
  UploadTrainingDocumentDto,
} from "./dto/learning.dto";
import { LearningService } from "./learning.service";

@ApiTags("learning")
@ApiBearerAuth()
@Controller("learning")
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Get("programs")
  @RequirePermissions(PERMISSIONS.LEARNING_PROGRAMS_READ)
  @ApiOperation({ summary: "List training programs" })
  programs(@Query() query: ListTrainingProgramsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.learning.listPrograms(query, user);
  }

  @Get("programs/:id")
  @RequirePermissions(PERMISSIONS.LEARNING_PROGRAMS_READ)
  @ApiOperation({ summary: "Get a training program" })
  program(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.learning.getProgram(id, user);
  }

  @Post("programs")
  @RequirePermissions(PERMISSIONS.LEARNING_PROGRAMS_MANAGE)
  @ApiOperation({ summary: "Create a training program" })
  createProgram(
    @Body() dto: CreateTrainingProgramDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.learning.createProgram(dto, user, requestMeta(req));
  }

  @Patch("programs/:id")
  @RequirePermissions(PERMISSIONS.LEARNING_PROGRAMS_MANAGE)
  @ApiOperation({ summary: "Update a training program" })
  updateProgram(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateTrainingProgramDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.learning.updateProgram(id, dto, user, requestMeta(req));
  }

  @Post("programs/:id/enroll")
  @RequirePermissions(PERMISSIONS.LEARNING_ENROLLMENT_CREATE)
  @ApiOperation({ summary: "Request enrollment in a training program" })
  enroll(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: EnrollTrainingDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.learning.enroll(id, dto, user, requestMeta(req));
  }

  @Get("enrollments")
  @RequirePermissions(PERMISSIONS.LEARNING_ENROLLMENT_READ_SELF)
  @ApiOperation({ summary: "List training enrollments in scope" })
  enrollments(
    @Query() query: ListTrainingEnrollmentsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.learning.listEnrollments(query, user);
  }

  @Patch("enrollments/:id")
  @RequirePermissions(PERMISSIONS.LEARNING_ENROLLMENT_MANAGE)
  @ApiOperation({ summary: "Approve, reject, or complete an enrollment" })
  updateEnrollment(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateTrainingEnrollmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.learning.updateEnrollment(id, dto, user, requestMeta(req));
  }

  @Get("my")
  @RequirePermissions(PERMISSIONS.LEARNING_ENROLLMENT_READ_SELF)
  @ApiOperation({ summary: "Get own learning history and certificates" })
  my(@CurrentUser() user: AuthenticatedUser) {
    return this.learning.myLearning(user);
  }

  @Post("programs/:id/documents")
  @RequireAnyPermission(
    PERMISSIONS.LEARNING_PROGRAMS_MANAGE,
    PERMISSIONS.LEARNING_CERTIFICATES_MANAGE,
  )
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_DOCUMENT_BYTES } }))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload a private training material or certificate" })
  uploadDocument(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @UploadedFile() file: UploadedDocumentFile | undefined,
    @Body() dto: UploadTrainingDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.learning.uploadDocument(id, file, dto, user, requestMeta(req));
  }

  @Get("documents/:id/download")
  @RequireAnyPermission(
    PERMISSIONS.LEARNING_PROGRAMS_READ,
    PERMISSIONS.LEARNING_CERTIFICATES_READ_SELF,
    PERMISSIONS.LEARNING_CERTIFICATES_MANAGE,
  )
  @ApiOperation({ summary: "Download a private training document" })
  async download(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { document, content } = await this.learning.downloadDocument(id, user);
    res.setHeader("Content-Type", document.mimeType);
    res.setHeader("Content-Length", String(content.length));
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", attachmentDisposition(document.fileName));
    return content;
  }

  @Delete("documents/:id")
  @HttpCode(204)
  @RequireAnyPermission(
    PERMISSIONS.LEARNING_PROGRAMS_MANAGE,
    PERMISSIONS.LEARNING_CERTIFICATES_MANAGE,
  )
  @ApiOperation({ summary: "Delete a training document" })
  async removeDocument(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.learning.removeDocument(id, user, requestMeta(req));
  }
}
