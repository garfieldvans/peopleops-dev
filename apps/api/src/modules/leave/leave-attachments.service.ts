import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";
import { PERMISSIONS } from "@peopleops/shared-types";
import { LEAVE_FILE_STORAGE } from "../../common/storage/storage.module";
import type { FileStorage } from "../../common/storage/file-storage";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import type { LeaveActor } from "./leave.types";
import { leaveRequestInclude, toLeaveRequest, type LeaveRequestRow } from "./leave.mapper";

export const MAX_LEAVE_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const ALLOWED_LEAVE_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export interface UploadedLeaveFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class LeaveAttachmentsService {
  private readonly logger = new Logger(LeaveAttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(LEAVE_FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async upload(
    requestId: string,
    file: UploadedLeaveFile | undefined,
    actor: LeaveActor,
  ): Promise<ReturnType<typeof toLeaveRequest>> {
    if (!file) {
      throw new BadRequestException({ code: "FILE_REQUIRED", message: "A file is required" });
    }
    if (!ALLOWED_LEAVE_ATTACHMENT_TYPES.includes(file.mimetype as never)) {
      throw new BadRequestException({
        code: "FILE_TYPE_NOT_ALLOWED",
        message: "Unsupported attachment type",
        details: { allowed: ALLOWED_LEAVE_ATTACHMENT_TYPES },
      });
    }
    if (file.size > MAX_LEAVE_ATTACHMENT_BYTES) {
      throw new PayloadTooLargeException({
        code: "FILE_TOO_LARGE",
        message: "Attachment exceeds the 5 MB limit",
        details: { maxBytes: MAX_LEAVE_ATTACHMENT_BYTES },
      });
    }
    const request = await this.findRequest(requestId);
    await this.assertOwner(request.employeeId, actor.actorUserId);
    if (request.status !== "DRAFT" && request.status !== "PENDING") {
      throw new BadRequestException({
        code: "LEAVE_ATTACHMENT_LOCKED",
        message: "Attachments can only be changed while the request is draft or pending",
      });
    }
    const stored = await this.storage.save({
      data: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });
    try {
      await this.prisma.leaveAttachment.create({
        data: {
          requestId,
          fileName: file.originalname.slice(0, 255),
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storageKey: stored.key,
          uploadedById: actor.actorUserId,
        },
      });
      await this.audit.record({
        actorUserId: actor.actorUserId,
        actorEmail: actor.actorEmail,
        action: "leave_attachment.uploaded",
        entityType: "leave_attachment",
        entityId: requestId,
        metadata: { fileName: file.originalname, sizeBytes: file.size },
        ip: actor.meta.ip,
        userAgent: actor.meta.userAgent,
      });
      return toLeaveRequest(await this.findRequest(requestId));
    } catch (error) {
      await this.storage.remove(stored.key).catch((cleanupError: unknown) => {
        this.logger.error("Failed to roll back stored leave attachment", String(cleanupError));
      });
      throw error;
    }
  }

  async download(
    requestId: string,
    attachmentId: string,
    user: AuthenticatedUser,
  ): Promise<{ fileName: string; mimeType: string; content: Buffer }> {
    const request = await this.findRequest(requestId);
    await this.assertCanRead(request.employeeId, request.employee.managerId, user);
    const attachment = await this.prisma.leaveAttachment.findFirst({
      where: { id: attachmentId, requestId },
    });
    if (!attachment) {
      throw new NotFoundException({
        code: "LEAVE_ATTACHMENT_NOT_FOUND",
        message: "Attachment not found",
      });
    }
    const content = await this.storage.read(attachment.storageKey);
    return {
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      content,
    };
  }

  async remove(
    requestId: string,
    attachmentId: string,
    actor: LeaveActor,
  ): Promise<ReturnType<typeof toLeaveRequest>> {
    const request = await this.findRequest(requestId);
    await this.assertOwner(request.employeeId, actor.actorUserId);
    if (request.status !== "DRAFT" && request.status !== "PENDING") {
      throw new BadRequestException({
        code: "LEAVE_ATTACHMENT_LOCKED",
        message: "Attachments can only be changed while the request is draft or pending",
      });
    }
    const attachment = await this.prisma.leaveAttachment.findFirst({
      where: { id: attachmentId, requestId },
    });
    if (!attachment) {
      throw new NotFoundException({
        code: "LEAVE_ATTACHMENT_NOT_FOUND",
        message: "Attachment not found",
      });
    }
    await this.prisma.leaveAttachment.delete({ where: { id: attachmentId } });
    await this.storage.remove(attachment.storageKey).catch((error: unknown) => {
      this.logger.error(
        `Failed to remove leave attachment ${attachment.storageKey}`,
        String(error),
      );
    });
    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "leave_attachment.deleted",
      entityType: "leave_attachment",
      entityId: attachmentId,
      metadata: { requestId, fileName: attachment.fileName },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return toLeaveRequest(await this.findRequest(requestId));
  }

  private async findRequest(requestId: string): Promise<LeaveRequestRow> {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: leaveRequestInclude,
    });
    if (!request) {
      throw new NotFoundException({
        code: "LEAVE_REQUEST_NOT_FOUND",
        message: "Leave request not found",
      });
    }
    return request;
  }

  private async assertOwner(employeeId: string, userId: string): Promise<void> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (employee?.id !== employeeId) {
      throw new ForbiddenException({
        code: "LEAVE_ATTACHMENT_FORBIDDEN",
        message: "You can only manage attachments on your own request",
      });
    }
  }

  private async assertCanRead(
    employeeId: string,
    managerId: string | null,
    user: AuthenticatedUser,
  ): Promise<void> {
    const permissions = new Set(user.permissions);
    if (permissions.has(PERMISSIONS.LEAVE_REQUEST_READ_ALL)) return;
    const employee = await this.prisma.employee.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (employee?.id === employeeId) return;
    if (employee?.id && managerId === employee.id) return;
    throw new ForbiddenException({
      code: "LEAVE_ATTACHMENT_FORBIDDEN",
      message: "You cannot access this attachment",
    });
  }
}
