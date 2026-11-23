import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";
import type { EmployeeDocument } from "@peopleops/shared-types";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { FILE_STORAGE, type FileStorage } from "../../common/storage/file-storage";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import type { ActorContext } from "./employees.service";
import { EmployeesService } from "./employees.service";
import { documentInclude, toDocument } from "./employee.mapper";
import type { UploadEmployeeDocumentDto } from "./dto/employee.dto";

export interface UploadedDocumentFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

@Injectable()
export class EmployeeDocumentsService {
  private readonly logger = new Logger(EmployeeDocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
    private readonly audit: AuditService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async list(employeeId: string, user: AuthenticatedUser): Promise<EmployeeDocument[]> {
    await this.employees.assertCanReadEmployee(employeeId, user);
    const rows = await this.prisma.employeeDocument.findMany({
      where: { employeeId },
      include: documentInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDocument);
  }

  async upload(
    employeeId: string,
    file: UploadedDocumentFile | undefined,
    dto: UploadEmployeeDocumentDto,
    actor: ActorContext,
  ): Promise<EmployeeDocument> {
    if (!file) {
      throw new BadRequestException({ code: "FILE_REQUIRED", message: "A file is required" });
    }
    if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.mimetype as never)) {
      throw new BadRequestException({
        code: "FILE_TYPE_NOT_ALLOWED",
        message: "Unsupported document type",
        details: { allowed: ALLOWED_DOCUMENT_MIME_TYPES },
      });
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      throw new PayloadTooLargeException({
        code: "FILE_TOO_LARGE",
        message: "Document exceeds the 5 MB limit",
        details: { maxBytes: MAX_DOCUMENT_BYTES },
      });
    }

    const stored = await this.storage.save({
      data: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });

    try {
      const row = await this.prisma.employeeDocument.create({
        data: {
          id: randomUUID(),
          employeeId,
          category: dto.category ?? "OTHER",
          title: dto.title.trim(),
          fileName: file.originalname.slice(0, 255),
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storageKey: stored.key,
          uploadedById: actor.actorUserId,
        },
        include: documentInclude,
      });

      await this.audit.record({
        actorUserId: actor.actorUserId,
        actorEmail: actor.actorEmail,
        action: "employee.document_uploaded",
        entityType: "employee_document",
        entityId: row.id,
        metadata: { employeeId, fileName: row.fileName, sizeBytes: row.sizeBytes },
        ip: actor.meta.ip,
        userAgent: actor.meta.userAgent,
      });

      return toDocument(row);
    } catch (error) {
      await this.storage.remove(stored.key).catch((cleanupError: unknown) => {
        this.logger.error("Failed to roll back stored document", String(cleanupError));
      });
      throw error;
    }
  }

  async download(
    employeeId: string,
    documentId: string,
    user: AuthenticatedUser,
  ): Promise<{ document: EmployeeDocument; content: Buffer }> {
    await this.employees.assertCanReadEmployee(employeeId, user);
    const row = await this.prisma.employeeDocument.findFirst({
      where: { id: documentId, employeeId },
      include: documentInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: "DOCUMENT_NOT_FOUND",
        message: "Document not found",
      });
    }

    const content = await this.storage.read(row.storageKey);
    return { document: toDocument(row), content };
  }

  async remove(employeeId: string, documentId: string, actor: ActorContext): Promise<void> {
    const row = await this.prisma.employeeDocument.findFirst({
      where: { id: documentId, employeeId },
    });
    if (!row) {
      throw new NotFoundException({
        code: "DOCUMENT_NOT_FOUND",
        message: "Document not found",
      });
    }

    await this.prisma.employeeDocument.delete({ where: { id: documentId } });
    await this.storage.remove(row.storageKey).catch((error: unknown) => {
      this.logger.error(`Failed to remove stored file ${row.storageKey}`, String(error));
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "employee.document_deleted",
      entityType: "employee_document",
      entityId: documentId,
      metadata: { employeeId, fileName: row.fileName },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
  }
}
