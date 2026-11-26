import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";
import { Prisma } from "@peopleops/database";
import type {
  PaginatedResponse,
  TrainingDocument,
  TrainingEnrollment,
  TrainingProgram,
  TrainingProgramDetail,
} from "@peopleops/shared-types";
import { PERMISSIONS } from "@peopleops/shared-types";
import { toPageMeta } from "../../common/dto/page-query.dto";
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  type UploadedDocumentFile,
} from "../employee/employee-documents.service";
import { FILE_STORAGE, type FileStorage } from "../../common/storage/file-storage";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { EmployeesService } from "../employee/employees.service";
import { dateKey, isoDate } from "../onboarding/onboarding.utils";
import type {
  CreateTrainingProgramDto,
  EnrollTrainingDto,
  ListTrainingEnrollmentsQueryDto,
  ListTrainingProgramsQueryDto,
  UpdateTrainingEnrollmentDto,
  UpdateTrainingProgramDto,
  UploadTrainingDocumentDto,
} from "./dto/learning.dto";
import {
  toTrainingDocument,
  toTrainingEnrollment,
  toTrainingProgram,
  trainingEnrollmentInclude,
  trainingProgramInclude,
  type TrainingProgramDetailRow,
  type TrainingProgramRow,
} from "./learning.mapper";

type ActorMeta = { ip: string | null; userAgent: string | null };
const ACTIVE_STATUSES = ["REQUESTED", "APPROVED", "ENROLLED", "IN_PROGRESS", "COMPLETED"] as const;

@Injectable()
export class LearningService {
  private readonly logger = new Logger(LearningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
    private readonly audit: AuditService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async listPrograms(
    query: ListTrainingProgramsQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<TrainingProgram>> {
    const canManage = user.permissions.includes(PERMISSIONS.LEARNING_PROGRAMS_MANAGE);
    const where: Prisma.TrainingProgramWhereInput = {
      ...(canManage ? {} : { status: { in: ["PUBLISHED", "ONGOING"] } }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.trainingType ? { trainingType: query.trainingType } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { provider: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.trainingProgram.count({ where }),
      this.prisma.trainingProgram.findMany({
        where,
        include: trainingProgramInclude,
        orderBy: [{ startDate: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toTrainingProgram), ...toPageMeta(query.page, query.pageSize, total) };
  }

  async getProgram(id: string, user: AuthenticatedUser): Promise<TrainingProgramDetail> {
    const row = await this.findProgram(id, true);
    if (
      !["PUBLISHED", "ONGOING"].includes(row.status) &&
      !user.permissions.includes(PERMISSIONS.LEARNING_PROGRAMS_MANAGE)
    ) {
      throw new NotFoundException({
        code: "TRAINING_PROGRAM_NOT_FOUND",
        message: "Training program not found",
      });
    }
    const canManage = user.permissions.includes(PERMISSIONS.LEARNING_PROGRAMS_MANAGE);
    return {
      ...toTrainingProgram(row),
      enrollments: canManage
        ? row.enrollments.map((enrollment) => toTrainingEnrollment(enrollment))
        : [],
      documents: row.documents
        .filter((document) => canManage || document.kind !== "CERTIFICATE")
        .map(toTrainingDocument),
    };
  }

  async createProgram(
    dto: CreateTrainingProgramDto,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ): Promise<TrainingProgram> {
    this.validateProgramDates(dto);
    const row = await this.prisma.trainingProgram.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
        category: dto.category ?? null,
        trainingType: dto.trainingType ?? "INTERNAL",
        provider: dto.provider ?? null,
        durationMinutes: dto.durationMinutes ?? null,
        deliveryMethod: dto.deliveryMethod ?? "IN_PERSON",
        location: dto.location ?? null,
        registrationDeadline: dto.registrationDeadline
          ? dateKey(dto.registrationDeadline)
          : null,
        startDate: dateKey(dto.startDate),
        endDate: dateKey(dto.endDate),
        capacity: dto.capacity ?? null,
        status: dto.status ?? "DRAFT",
        createdById: user.id,
      },
      include: trainingProgramInclude,
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "learning.program_created",
      entityType: "training_program",
      entityId: row.id,
      metadata: { title: row.title },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toTrainingProgram(row);
  }

  async updateProgram(
    id: string,
    dto: UpdateTrainingProgramDto,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ): Promise<TrainingProgram> {
    const current = await this.findProgram(id);
    const dates = {
      startDate: dto.startDate ?? isoDate(current.startDate)!,
      endDate: dto.endDate ?? isoDate(current.endDate)!,
      registrationDeadline:
        dto.registrationDeadline !== undefined
          ? dto.registrationDeadline
          : isoDate(current.registrationDeadline),
    };
    this.validateProgramDates(dates);
    const row = await this.prisma.trainingProgram.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.trainingType !== undefined ? { trainingType: dto.trainingType } : {}),
        ...(dto.provider !== undefined ? { provider: dto.provider } : {}),
        ...(dto.durationMinutes !== undefined ? { durationMinutes: dto.durationMinutes } : {}),
        ...(dto.deliveryMethod !== undefined ? { deliveryMethod: dto.deliveryMethod } : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...(dto.registrationDeadline !== undefined
          ? {
              registrationDeadline: dto.registrationDeadline
                ? dateKey(dto.registrationDeadline)
                : null,
            }
          : {}),
        ...(dto.startDate !== undefined ? { startDate: dateKey(dto.startDate) } : {}),
        ...(dto.endDate !== undefined ? { endDate: dateKey(dto.endDate) } : {}),
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: trainingProgramInclude,
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "learning.program_updated",
      entityType: "training_program",
      entityId: id,
      metadata: { fields: Object.keys(dto) },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toTrainingProgram(row);
  }

  async enroll(
    programId: string,
    dto: EnrollTrainingDto,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ): Promise<TrainingEnrollment> {
    const program = await this.findProgram(programId);
    const employeeId = await this.resolveEmployeeId(dto.employeeId, user);
    if (!["PUBLISHED", "ONGOING"].includes(program.status)) {
      throw new ConflictException({
        code: "TRAINING_NOT_OPEN",
        message: "This training program is not open for enrollment",
      });
    }
    if (program.registrationDeadline && isoDate(program.registrationDeadline)! < todayKey()) {
      throw new ConflictException({
        code: "TRAINING_REGISTRATION_CLOSED",
        message: "The registration deadline has passed",
      });
    }
    const existing = await this.prisma.trainingEnrollment.findUnique({
      where: { programId_employeeId: { programId, employeeId } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: "TRAINING_ALREADY_ENROLLED",
        message: "This employee is already enrolled in the program",
      });
    }
    const row = await this.prisma.$transaction(async (tx) => {
      if (program.capacity !== null) {
        const active = await tx.trainingEnrollment.count({
          where: { programId, status: { in: [...ACTIVE_STATUSES] } },
        });
        if (active >= program.capacity) {
          throw new ConflictException({
            code: "TRAINING_CAPACITY_FULL",
            message: "This training program is at capacity",
          });
        }
      }
      return tx.trainingEnrollment.create({
        data: { programId, employeeId, status: "REQUESTED" },
        include: trainingEnrollmentInclude,
      });
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "learning.enrollment_requested",
      entityType: "training_enrollment",
      entityId: row.id,
      metadata: { programId, employeeId },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toTrainingEnrollment(row);
  }

  async listEnrollments(
    query: ListTrainingEnrollmentsQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<TrainingEnrollment>> {
    const where: Prisma.TrainingEnrollmentWhereInput = {
      ...(query.programId ? { programId: query.programId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    };
    const scope = await this.employees.resolveScope(user);
    if (!user.permissions.includes(PERMISSIONS.LEARNING_ENROLLMENT_READ_ALL)) {
      where.employeeId = scope.employeeId ?? "__none__";
    } else if (!scope.readAll) {
      if (scope.readTeam && scope.employeeId) {
        where.employeeId = { in: await this.employees.scopedEmployeeIds(scope) };
      } else {
        where.employeeId = scope.employeeId ?? "__none__";
      }
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.trainingEnrollment.count({ where }),
      this.prisma.trainingEnrollment.findMany({
        where,
        include: trainingEnrollmentInclude,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: rows.map(toTrainingEnrollment),
      ...toPageMeta(query.page, query.pageSize, total),
    };
  }

  async updateEnrollment(
    id: string,
    dto: UpdateTrainingEnrollmentDto,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ): Promise<TrainingEnrollment> {
    const current = await this.prisma.trainingEnrollment.findUnique({
      where: { id },
      include: trainingEnrollmentInclude,
    });
    if (!current) {
      throw new NotFoundException({
        code: "TRAINING_ENROLLMENT_NOT_FOUND",
        message: "Training enrollment not found",
      });
    }
    this.assertEnrollmentTransition(current.status, dto.status);
    const row = await this.prisma.trainingEnrollment.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.status === "APPROVED" || dto.status === "REJECTED"
          ? { approvedById: user.id }
          : {}),
        ...(dto.status === "COMPLETED" || dto.status === "FAILED"
          ? { completedAt: new Date() }
          : {}),
        ...(dto.result !== undefined ? { result: dto.result } : {}),
        ...(dto.feedback !== undefined ? { feedback: dto.feedback } : {}),
      },
      include: trainingEnrollmentInclude,
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "learning.enrollment_updated",
      entityType: "training_enrollment",
      entityId: id,
      metadata: { from: current.status, to: dto.status, comment: dto.comment ?? null },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toTrainingEnrollment(row);
  }

  async uploadDocument(
    programId: string,
    file: UploadedDocumentFile | undefined,
    dto: UploadTrainingDocumentDto,
    user: AuthenticatedUser,
    meta: ActorMeta,
  ): Promise<TrainingDocument> {
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
    await this.findProgram(programId);
    let employeeId = dto.employeeId ?? null;
    if (dto.kind === "CERTIFICATE") {
      if (!user.permissions.includes(PERMISSIONS.LEARNING_CERTIFICATES_MANAGE)) {
        throw new ForbiddenException({
          code: "TRAINING_CERTIFICATE_FORBIDDEN",
          message: "You do not have permission to manage certificates",
        });
      }
      if (dto.enrollmentId) {
        const enrollment = await this.prisma.trainingEnrollment.findUnique({
          where: { id: dto.enrollmentId },
          select: { employeeId: true, programId: true },
        });
        if (!enrollment || enrollment.programId !== programId) {
          throw new BadRequestException({
            code: "TRAINING_ENROLLMENT_SCOPE",
            message: "The enrollment does not belong to this program",
          });
        }
        employeeId = enrollment.employeeId;
      }
    }
    const stored = await this.storage.save({
      data: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });
    try {
      const row = await this.prisma.trainingDocument.create({
        data: {
          id: randomUUID(),
          programId,
          enrollmentId: dto.enrollmentId ?? null,
          employeeId,
          kind: dto.kind ?? "MATERIAL",
          title: dto.title,
          fileName: file.originalname.slice(0, 255),
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storageKey: stored.key,
          issuedAt: dto.issuedAt ? dateKey(dto.issuedAt) : null,
          expiresAt: dto.expiresAt ? dateKey(dto.expiresAt) : null,
          uploadedById: user.id,
        },
      });
      await this.audit.record({
        actorUserId: user.id,
        actorEmail: user.email,
        action: "learning.document_uploaded",
        entityType: "training_document",
        entityId: row.id,
        metadata: { programId, kind: row.kind, sizeBytes: row.sizeBytes },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return toTrainingDocument(row);
    } catch (error) {
      await this.storage.remove(stored.key).catch((cleanupError: unknown) => {
        this.logger.error("Failed to roll back stored training document", String(cleanupError));
      });
      throw error;
    }
  }

  async downloadDocument(
    id: string,
    user: AuthenticatedUser,
  ): Promise<{ document: TrainingDocument; content: Buffer }> {
    const row = await this.prisma.trainingDocument.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({
        code: "TRAINING_DOCUMENT_NOT_FOUND",
        message: "Training document not found",
      });
    }
    if (row.kind === "CERTIFICATE") {
      const scope = await this.employees.resolveScope(user);
      const canManage = user.permissions.includes(PERMISSIONS.LEARNING_CERTIFICATES_MANAGE);
      if (!canManage && row.employeeId !== scope.employeeId) {
        throw new ForbiddenException({
          code: "TRAINING_CERTIFICATE_FORBIDDEN",
          message: "This certificate is not available to you",
        });
      }
    }
    const content = await this.storage.read(row.storageKey);
    return { document: toTrainingDocument(row), content };
  }

  async removeDocument(id: string, user: AuthenticatedUser, meta: ActorMeta): Promise<void> {
    const row = await this.prisma.trainingDocument.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({
        code: "TRAINING_DOCUMENT_NOT_FOUND",
        message: "Training document not found",
      });
    }
    if (
      row.kind === "CERTIFICATE" &&
      !user.permissions.includes(PERMISSIONS.LEARNING_CERTIFICATES_MANAGE)
    ) {
      throw new ForbiddenException({
        code: "TRAINING_CERTIFICATE_FORBIDDEN",
        message: "You do not have permission to manage certificates",
      });
    }
    await this.prisma.trainingDocument.delete({ where: { id } });
    await this.storage.remove(row.storageKey).catch((error: unknown) => {
      this.logger.error(`Failed to remove training document ${row.storageKey}`, String(error));
    });
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "learning.document_removed",
      entityType: "training_document",
      entityId: id,
      metadata: { programId: row.programId, kind: row.kind },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  async myLearning(user: AuthenticatedUser) {
    const employeeId = await this.resolveEmployeeId(undefined, user);
    const [enrollments, certificates] = await Promise.all([
      this.prisma.trainingEnrollment.findMany({
        where: { employeeId },
        include: trainingEnrollmentInclude,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.trainingDocument.findMany({
        where: { employeeId, kind: "CERTIFICATE" },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return {
      enrollments: enrollments.map(toTrainingEnrollment),
      certificates: certificates.map(toTrainingDocument),
    };
  }

  private validateProgramDates(dto: {
    startDate: string;
    endDate: string;
    registrationDeadline?: string | null;
  }) {
    if (dto.startDate > dto.endDate) {
      throw new BadRequestException({
        code: "TRAINING_DATE_ORDER",
        message: "Training start date must not be after the end date",
      });
    }
    if (dto.registrationDeadline && dto.registrationDeadline > dto.startDate) {
      throw new BadRequestException({
        code: "TRAINING_REGISTRATION_DEADLINE",
        message: "Registration deadline cannot be after the start date",
      });
    }
  }

  private assertEnrollmentTransition(from: string, to: string) {
    const allowed: Record<string, string[]> = {
      REQUESTED: ["APPROVED", "REJECTED", "CANCELLED"],
      APPROVED: ["ENROLLED", "CANCELLED"],
      ENROLLED: ["IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED"],
      IN_PROGRESS: ["COMPLETED", "FAILED", "CANCELLED"],
      REJECTED: [],
      COMPLETED: [],
      CANCELLED: [],
      FAILED: [],
    };
    if (!allowed[from]?.includes(to)) {
      throw new ConflictException({
        code: "TRAINING_ENROLLMENT_TRANSITION",
        message: `Cannot move an enrollment from ${from} to ${to}`,
      });
    }
  }

  private async resolveEmployeeId(
    requested: string | undefined,
    user: AuthenticatedUser,
  ): Promise<string> {
    const scope = await this.employees.resolveScope(user);
    if (requested && requested !== scope.employeeId) {
      if (!user.permissions.includes(PERMISSIONS.LEARNING_ENROLLMENT_MANAGE)) {
        throw new ForbiddenException({
          code: "TRAINING_ENROLLMENT_FORBIDDEN",
          message: "You can only enroll yourself",
        });
      }
      return requested;
    }
    if (!scope.employeeId) {
      throw new BadRequestException({
        code: "EMPLOYEE_ACCOUNT_REQUIRED",
        message: "Your account is not linked to an employee record",
      });
    }
    return scope.employeeId;
  }

  private findProgram(id: string): Promise<TrainingProgramRow>;
  private findProgram(id: string, detail: true): Promise<TrainingProgramDetailRow>;
  private async findProgram(
    id: string,
    detail = false,
  ): Promise<TrainingProgramRow | TrainingProgramDetailRow> {
    const row = detail
      ? await this.prisma.trainingProgram.findUnique({
          where: { id },
          include: {
            enrollments: {
              include: trainingEnrollmentInclude,
              orderBy: { createdAt: "desc" as const },
            },
            documents: { orderBy: { createdAt: "desc" as const } },
          },
        })
      : await this.prisma.trainingProgram.findUnique({
          where: { id },
          include: trainingProgramInclude,
        });
    if (!row) {
      throw new NotFoundException({
        code: "TRAINING_PROGRAM_NOT_FOUND",
        message: "Training program not found",
      });
    }
    return row as TrainingProgramRow | TrainingProgramDetailRow;
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
