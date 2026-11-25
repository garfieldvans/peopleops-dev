import {
  Body,
  Controller,
  Delete,
  Get,
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
import {
  CancelOvertimeRequestDto,
  CompleteOvertimeRequestDto,
  CorrectOvertimeRequestDto,
  CreateOvertimeRequestDto,
  ListOvertimeRequestsQueryDto,
  RejectOvertimeRequestDto,
  ReviewOvertimeRequestDto,
  UpdateOvertimeRequestDto,
  VerifyOvertimeRequestDto,
} from "./dto/overtime.dto";
import {
  MAX_OVERTIME_ATTACHMENT_BYTES,
  OvertimeAttachmentsService,
  type UploadedOvertimeFile,
} from "./overtime-attachments.service";
import { OvertimeRequestsService } from "./overtime-requests.service";
import type { OvertimeActor } from "./overtime.types";

function actorOf(user: AuthenticatedUser, req: Request): OvertimeActor {
  return { actorUserId: user.id, actorEmail: user.email, meta: requestMeta(req) };
}

@ApiTags("overtime-requests")
@ApiBearerAuth()
@Controller("overtime/requests")
export class OvertimeRequestsController {
  constructor(
    private readonly requests: OvertimeRequestsService,
    private readonly attachments: OvertimeAttachmentsService,
  ) {}

  @Get("me")
  @RequirePermissions(PERMISSIONS.OVERTIME_READ_SELF)
  @ApiOperation({ summary: "List the signed-in employee's overtime requests" })
  mine(@Query() query: ListOvertimeRequestsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.requests.listMine(query, user);
  }

  @Get()
  @RequireAnyPermission(
    PERMISSIONS.OVERTIME_READ_SELF,
    PERMISSIONS.OVERTIME_READ_TEAM,
    PERMISSIONS.OVERTIME_READ_ALL,
  )
  @ApiOperation({ summary: "List overtime requests inside the caller's scope" })
  list(@Query() query: ListOvertimeRequestsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.requests.list(query, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.OVERTIME_CREATE)
  @ApiOperation({ summary: "Create a draft overtime request for the signed-in employee" })
  create(@Body() dto: CreateOvertimeRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.requests.create(dto, user);
  }

  @Get(":id")
  @RequireAnyPermission(
    PERMISSIONS.OVERTIME_READ_SELF,
    PERMISSIONS.OVERTIME_READ_TEAM,
    PERMISSIONS.OVERTIME_READ_ALL,
  )
  @ApiOperation({ summary: "Get an overtime request" })
  get(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.getById(id, user);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.OVERTIME_UPDATE_SELF)
  @ApiOperation({ summary: "Update a draft overtime request" })
  update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateOvertimeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.update(id, dto, user);
  }

  @Post(":id/submit")
  @RequirePermissions(PERMISSIONS.OVERTIME_CREATE)
  @ApiOperation({ summary: "Submit a draft overtime request" })
  submit(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.submit(id, user);
  }

  @Post(":id/withdraw")
  @RequirePermissions(PERMISSIONS.OVERTIME_WITHDRAW_SELF)
  @ApiOperation({ summary: "Withdraw a pending overtime request" })
  withdraw(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.withdraw(id, user);
  }

  @Post(":id/approve")
  @RequirePermissions(PERMISSIONS.OVERTIME_APPROVE)
  @ApiOperation({ summary: "Approve the current overtime approval stage" })
  approve(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: ReviewOvertimeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.approve(id, dto, user);
  }

  @Post(":id/reject")
  @RequirePermissions(PERMISSIONS.OVERTIME_REJECT)
  @ApiOperation({ summary: "Reject a pending overtime request" })
  reject(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: RejectOvertimeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.reject(id, dto, user);
  }

  @Post(":id/cancel")
  @RequireAnyPermission(PERMISSIONS.OVERTIME_WITHDRAW_SELF, PERMISSIONS.OVERTIME_MANAGE)
  @ApiOperation({ summary: "Cancel an approved, pending-verification, or verified request" })
  cancel(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: CancelOvertimeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.cancel(id, dto, user);
  }

  @Post(":id/complete")
  @RequireAnyPermission(PERMISSIONS.OVERTIME_UPDATE_SELF, PERMISSIONS.OVERTIME_MANAGE)
  @ApiOperation({ summary: "Record actual overtime after the work date" })
  complete(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: CompleteOvertimeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.complete(id, dto, user);
  }

  @Post(":id/verify")
  @RequirePermissions(PERMISSIONS.OVERTIME_VERIFY)
  @ApiOperation({ summary: "Verify actual overtime and make it payroll-eligible" })
  verify(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: VerifyOvertimeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.verify(id, dto, user);
  }

  @Post(":id/correct")
  @RequirePermissions(PERMISSIONS.OVERTIME_CORRECT)
  @ApiOperation({ summary: "Correct a verified overtime duration with a reason" })
  correct(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: CorrectOvertimeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.correct(id, dto, user);
  }

  @Post(":id/attachments")
  @RequireAnyPermission(PERMISSIONS.OVERTIME_CREATE, PERMISSIONS.OVERTIME_MANAGE)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_OVERTIME_ATTACHMENT_BYTES } }))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload a private overtime attachment" })
  upload(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @UploadedFile() file: UploadedOvertimeFile | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.attachments.upload(id, file, user, actorOf(user, req));
  }

  @Get(":id/attachments/:attachmentId")
  @RequireAnyPermission(
    PERMISSIONS.OVERTIME_READ_SELF,
    PERMISSIONS.OVERTIME_READ_TEAM,
    PERMISSIONS.OVERTIME_READ_ALL,
  )
  @ApiOperation({ summary: "Download an overtime attachment through an authorized route" })
  async download(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Param("attachmentId", new ParseUUIDPipe({ version: "4" })) attachmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const file = await this.attachments.download(id, attachmentId, user);
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", attachmentDisposition(file.fileName));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");
    res.send(file.content);
  }

  @Delete(":id/attachments/:attachmentId")
  @RequireAnyPermission(PERMISSIONS.OVERTIME_CREATE, PERMISSIONS.OVERTIME_MANAGE)
  @ApiOperation({ summary: "Remove an overtime attachment" })
  removeAttachment(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Param("attachmentId", new ParseUUIDPipe({ version: "4" })) attachmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.attachments.remove(id, attachmentId, user, actorOf(user, req));
  }
}
