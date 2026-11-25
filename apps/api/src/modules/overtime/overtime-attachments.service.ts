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
import { OVERTIME_FILE_STORAGE } from "../../common/storage/storage.module";
import type { FileStorage } from "../../common/storage/file-storage";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { overtimeRequestInclude, toOvertimeRequest } from "./overtime.mapper";
import { OvertimeRequestsService } from "./overtime-requests.service";
import type { OvertimeActor } from "./overtime.types";

export const MAX_OVERTIME_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const ALLOWED_OVERTIME_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export interface UploadedOvertimeFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class OvertimeAttachmentsService {
  private readonly logger = new Logger(OvertimeAttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly requests: OvertimeRequestsService,
    @Inject(OVERTIME_FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async upload(
    requestId: string,
    file: UploadedOvertimeFile | undefined,
    user: AuthenticatedUser,
    actor: OvertimeActor,
  ) {
    if (!file) {
      throw new BadRequestException({ code: "FILE_REQUIRED", message: "A file is required" });
    }
    if (!ALLOWED_OVERTIME_ATTACHMENT_TYPES.includes(file.mimetype as never)) {
      throw new BadRequestException({
        code: "FILE_TYPE_NOT_ALLOWED",
        message: "Unsupported attachment type",
        details: { allowed: ALLOWED_OVERTIME_ATTACHMENT_TYPES },
      });
    }
    if (file.size > MAX_OVERTIME_ATTACHMENT_BYTES) {
      throw new PayloadTooLargeException({
        code: "FILE_TOO_LARGE",
        message: "Attachment exceeds the 5 MB limit",
        details: { maxBytes: MAX_OVERTIME_ATTACHMENT_BYTES },
      });
    }
    const request = await this.requests.getRowForUser(requestId, user);
    await this.assertOwner(request.employeeId, user);
    if (!this.isEditable(request.status)) {
      throw new BadRequestException({
        code: "OVERTIME_ATTACHMENT_LOCKED",
        message: "Attachments can only be changed while the request is draft or pending",
      });
    }

    const stored = await this.storage.save({
      data: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });
    try {
      await this.prisma.overtimeAttachment.create({
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
        action: "overtime_attachment.uploaded",
        entityType: "overtime_attachment",
        entityId: requestId,
        metadata: { fileName: file.originalname, sizeBytes: file.size },
        ip: actor.meta.ip,
        userAgent: actor.meta.userAgent,
      });
      return this.returnRequest(requestId);
    } catch (error) {
      await this.storage.remove(stored.key).catch((cleanupError: unknown) => {
        this.logger.error("Failed to roll back stored overtime attachment", String(cleanupError));
      });
      throw error;
    }
  }

  async download(
    requestId: string,
    attachmentId: string,
    user: AuthenticatedUser,
  ): Promise<{ fileName: string; mimeType: string; content: Buffer }> {
    await this.requests.getRowForUser(requestId, user);
    const attachment = await this.prisma.overtimeAttachment.findFirst({
      where: { id: attachmentId, requestId },
    });
    if (!attachment) {
      throw new NotFoundException({
        code: "OVERTIME_ATTACHMENT_NOT_FOUND",
        message: "Attachment not found",
      });
    }
    return {
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      content: await this.storage.read(attachment.storageKey),
    };
  }

  async remove(
    requestId: string,
    attachmentId: string,
    user: AuthenticatedUser,
    actor: OvertimeActor,
  ) {
    const request = await this.requests.getRowForUser(requestId, user);
    await this.assertOwner(request.employeeId, user);
    if (!this.isEditable(request.status)) {
      throw new BadRequestException({
        code: "OVERTIME_ATTACHMENT_LOCKED",
        message: "Attachments can only be changed while the request is draft or pending",
      });
    }
    const attachment = await this.prisma.overtimeAttachment.findFirst({
      where: { id: attachmentId, requestId },
    });
    if (!attachment) {
      throw new NotFoundException({
        code: "OVERTIME_ATTACHMENT_NOT_FOUND",
        message: "Attachment not found",
      });
    }
    await this.prisma.overtimeAttachment.delete({ where: { id: attachmentId } });
    await this.storage.remove(attachment.storageKey).catch((error: unknown) => {
      this.logger.error(
        `Failed to remove overtime attachment ${attachment.storageKey}`,
        String(error),
      );
    });
    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "overtime_attachment.deleted",
      entityType: "overtime_attachment",
      entityId: attachmentId,
      metadata: { requestId, fileName: attachment.fileName },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
    return this.returnRequest(requestId);
  }

  private async returnRequest(requestId: string) {
    const row = await this.prisma.overtimeRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: overtimeRequestInclude,
    });
    return toOvertimeRequest(row);
  }

  private async assertOwner(employeeId: string, user: AuthenticatedUser): Promise<void> {
    if (user.permissions.includes(PERMISSIONS.OVERTIME_MANAGE)) return;
    const employee = await this.prisma.employee.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (employee?.id !== employeeId) {
      throw new ForbiddenException({
        code: "OVERTIME_ATTACHMENT_FORBIDDEN",
        message: "You can only manage attachments on your own request",
      });
    }
  }

  private isEditable(status: string): boolean {
    return (
      status === "DRAFT" ||
      status === "PENDING_MANAGER_APPROVAL" ||
      status === "PENDING_HR_APPROVAL"
    );
  }
}
