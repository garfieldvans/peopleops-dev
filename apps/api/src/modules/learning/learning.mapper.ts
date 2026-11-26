import { Prisma } from "@peopleops/database";
import type {
  TrainingDocument,
  TrainingEnrollment,
  TrainingProgram,
} from "@peopleops/shared-types";
import { displayName, isoDate } from "../onboarding/onboarding.utils";

const ACTIVE_ENROLLMENT_STATUSES = [
  "REQUESTED",
  "APPROVED",
  "ENROLLED",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

export const trainingProgramInclude = {
  enrollments: { select: { status: true } },
} satisfies Prisma.TrainingProgramInclude;

export type TrainingProgramRow = Prisma.TrainingProgramGetPayload<{
  include: typeof trainingProgramInclude;
}>;

export const trainingEnrollmentInclude = {
  program: { select: { id: true, title: true, startDate: true, endDate: true, status: true } },
  employee: {
    select: { id: true, employeeNumber: true, firstName: true, middleName: true, lastName: true },
  },
  approvedBy: { select: { id: true, name: true } },
} satisfies Prisma.TrainingEnrollmentInclude;

export type TrainingEnrollmentRow = Prisma.TrainingEnrollmentGetPayload<{
  include: typeof trainingEnrollmentInclude;
}>;

export type TrainingProgramDetailRow = Prisma.TrainingProgramGetPayload<{
  include: {
    enrollments: { include: typeof trainingEnrollmentInclude };
    documents: true;
  };
}>;

export function toTrainingProgram(row: TrainingProgramRow): TrainingProgram {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    trainingType: row.trainingType,
    provider: row.provider,
    durationMinutes: row.durationMinutes,
    deliveryMethod: row.deliveryMethod,
    location: row.location,
    registrationDeadline: isoDate(row.registrationDeadline),
    startDate: isoDate(row.startDate)!,
    endDate: isoDate(row.endDate)!,
    capacity: row.capacity,
    status: row.status,
    enrolledCount: row.enrollments.filter((enrollment) =>
      ACTIVE_ENROLLMENT_STATUSES.includes(enrollment.status as never),
    ).length,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toTrainingEnrollment(row: TrainingEnrollmentRow): TrainingEnrollment {
  return {
    id: row.id,
    program: {
      id: row.program.id,
      title: row.program.title,
      startDate: isoDate(row.program.startDate)!,
      endDate: isoDate(row.program.endDate)!,
      status: row.program.status,
    },
    employee: {
      id: row.employee.id,
      employeeNumber: row.employee.employeeNumber,
      fullName: displayName(row.employee),
    },
    status: row.status,
    enrolledAt: row.enrolledAt?.toISOString() ?? null,
    approvedBy: row.approvedBy,
    completedAt: row.completedAt?.toISOString() ?? null,
    result: row.result,
    feedback: row.feedback,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toTrainingDocument(row: {
  id: string;
  programId: string;
  enrollmentId: string | null;
  employeeId: string | null;
  kind: TrainingDocument["kind"];
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  issuedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}): TrainingDocument {
  return {
    id: row.id,
    programId: row.programId,
    enrollmentId: row.enrollmentId,
    employeeId: row.employeeId,
    kind: row.kind,
    title: row.title,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    issuedAt: isoDate(row.issuedAt),
    expiresAt: isoDate(row.expiresAt),
    createdAt: row.createdAt.toISOString(),
  };
}
