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
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestMeta } from "../../common/http/request-meta";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
  CancelLeaveRequestDto,
  CreateLeaveRequestDto,
  LeavePreviewDto,
  ListLeaveRequestsQueryDto,
  ReviewLeaveRequestDto,
  UpdateLeaveRequestDto,
} from "./dto/leave.dto";
import {
  LeaveAttachmentsService,
  MAX_LEAVE_ATTACHMENT_BYTES,
  type UploadedLeaveFile,
} from "./leave-attachments.service";
import { LeaveRequestsService } from "./leave-requests.service";
import type { LeaveActor } from "./leave.types";

function actorOf(user: AuthenticatedUser, req: Request): LeaveActor {
  return { actorUserId: user.id, actorEmail: user.email, meta: requestMeta(req) };
}

@ApiTags("leave-requests")
@ApiBearerAuth()
@Controller("leave-requests")
export class LeaveRequestsController {
  constructor(
    private readonly requests: LeaveRequestsService,
    private readonly attachments: LeaveAttachmentsService,
  ) {}

  @Get("me")
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_READ)
  @ApiOperation({ summary: "List the signed-in employee's leave requests" })
  mine(@Query() query: ListLeaveRequestsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.requests.listMine(query, user);
  }

  @Post("preview")
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_CREATE)
  @ApiOperation({ summary: "Preview leave duration and balance before submitting" })
  preview(@Body() dto: LeavePreviewDto, @CurrentUser() user: AuthenticatedUser) {
    return this.requests.preview(dto, user);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_READ)
  @ApiOperation({ summary: "List leave requests within the caller's scope" })
  list(@Query() query: ListLeaveRequestsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.requests.list(query, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_CREATE)
  @ApiOperation({ summary: "Create a draft leave request for the signed-in employee" })
  create(@Body() dto: CreateLeaveRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.requests.create(dto, user);
  }

  @Get("dashboard")
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_READ)
  @ApiOperation({ summary: "Get the leave dashboard for the signed-in employee" })
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.requests.dashboard(user);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_READ)
  @ApiOperation({ summary: "Get a leave request" })
  get(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.getById(id, user);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_CREATE)
  @ApiOperation({ summary: "Update a draft leave request" })
  update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateLeaveRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.update(id, dto, user);
  }

  @Post(":id/submit")
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_SUBMIT)
  @ApiOperation({ summary: "Submit a draft leave request" })
  submit(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.submit(id, user);
  }

  @Post(":id/withdraw")
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_WITHDRAW)
  @ApiOperation({ summary: "Withdraw a pending leave request" })
  withdraw(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.withdraw(id, user);
  }

  @Post(":id/approve")
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_APPROVE)
  @ApiOperation({ summary: "Approve the current leave request stage" })
  approve(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: ReviewLeaveRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.approve(id, dto, user);
  }

  @Post(":id/reject")
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_REJECT)
  @ApiOperation({ summary: "Reject a pending leave request" })
  reject(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: ReviewLeaveRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.reject(id, dto, user);
  }

  @Post(":id/cancel")
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_CANCEL)
  @ApiOperation({ summary: "Cancel an approved leave request" })
  cancel(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: CancelLeaveRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.cancel(id, dto, user);
  }

  @Post(":id/attachments")
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_CREATE)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_LEAVE_ATTACHMENT_BYTES } }))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload a private leave attachment" })
  upload(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @UploadedFile() file: UploadedLeaveFile | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.attachments.upload(id, file, actorOf(user, req));
  }

  @Get(":id/attachments/:attachmentId")
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_READ)
  @ApiOperation({ summary: "Download a leave attachment through an authorized route" })
  async download(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Param("attachmentId", new ParseUUIDPipe({ version: "4" })) attachmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const file = await this.attachments.download(id, attachmentId, user);
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.fileName.replace(/"/g, "")}"`,
    );
    res.send(file.content);
  }

  @Delete(":id/attachments/:attachmentId")
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_CREATE)
  @ApiOperation({ summary: "Remove a leave attachment" })
  removeAttachment(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Param("attachmentId", new ParseUUIDPipe({ version: "4" })) attachmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.attachments.remove(id, attachmentId, actorOf(user, req));
  }
}
