import { Prisma } from "@peopleops/database";
import type {
  EmployeeDetail,
  EmployeeDocument,
  EmployeeListItem,
  EmployeeRef,
  EmploymentHistoryEntry,
  EmergencyContact,
  NamedRef,
} from "@peopleops/shared-types";

export const employeeInclude = {
  branch: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  position: { select: { id: true, title: true } },
  jobLevel: { select: { id: true, name: true } },
  manager: {
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      photoUrl: true,
    },
  },
  user: { select: { id: true, name: true, email: true } },
  _count: { select: { emergencyContacts: true, documents: true } },
} satisfies Prisma.EmployeeInclude;

export type EmployeeRow = Prisma.EmployeeGetPayload<{ include: typeof employeeInclude }>;

export const historyInclude = {
  branch: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  position: { select: { id: true, title: true } },
  jobLevel: { select: { id: true, name: true } },
  manager: {
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      photoUrl: true,
    },
  },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.EmploymentHistoryInclude;

export type HistoryRow = Prisma.EmploymentHistoryGetPayload<{ include: typeof historyInclude }>;

export const documentInclude = {
  uploadedBy: { select: { id: true, name: true } },
} satisfies Prisma.EmployeeDocumentInclude;

export type DocumentRow = Prisma.EmployeeDocumentGetPayload<{ include: typeof documentInclude }>;

export function refName(row: {
  firstName: string;
  lastName: string;
  preferredName: string | null;
}): string {
  return row.preferredName?.trim() || `${row.firstName} ${row.lastName}`.trim();
}

function toNamedRef(row: { id: string; name: string } | null): NamedRef | null {
  return row ? { id: row.id, name: row.name } : null;
}

function toPositionRef(row: { id: string; title: string } | null): NamedRef | null {
  return row ? { id: row.id, name: row.title } : null;
}

function toEmployeeRef(
  row: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    preferredName: string | null;
    photoUrl: string | null;
  } | null,
): EmployeeRef | null {
  if (!row) return null;
  return {
    id: row.id,
    employeeNumber: row.employeeNumber,
    fullName: refName(row),
    photoUrl: row.photoUrl,
  };
}

function isoDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function toEmployeeListItem(row: EmployeeRow, showPersonalEmail: boolean): EmployeeListItem {
  return {
    id: row.id,
    employeeNumber: row.employeeNumber,
    firstName: row.firstName,
    middleName: row.middleName,
    lastName: row.lastName,
    preferredName: row.preferredName,
    fullName: refName(row),
    photoUrl: row.photoUrl,
    workEmail: row.workEmail,
    personalEmail: showPersonalEmail ? row.personalEmail : null,
    branch: toNamedRef(row.branch),
    department: toNamedRef(row.department),
    position: toPositionRef(row.position),
    jobLevel: toNamedRef(row.jobLevel),
    employmentType: row.employmentType,
    employmentStatus: row.employmentStatus,
    joinDate: isoDate(row.joinDate)!,
    manager: toEmployeeRef(row.manager),
  };
}

/** `includePersonal` is false for callers without sensitive-read access. */
export function toEmployeeDetail(row: EmployeeRow, includePersonal: boolean): EmployeeDetail {
  return {
    ...toEmployeeListItem(row, includePersonal),
    gender: includePersonal ? row.gender : null,
    birthDate: includePersonal ? isoDate(row.birthDate) : null,
    placeOfBirth: includePersonal ? row.placeOfBirth : null,
    maritalStatus: includePersonal ? row.maritalStatus : null,
    nationality: includePersonal ? row.nationality : null,
    phone: includePersonal ? row.phone : null,
    addressLine: includePersonal ? row.addressLine : null,
    city: includePersonal ? row.city : null,
    province: includePersonal ? row.province : null,
    postalCode: includePersonal ? row.postalCode : null,
    country: includePersonal ? row.country : "",
    probationEndDate: includePersonal ? isoDate(row.probationEndDate) : null,
    contractStartDate: includePersonal ? isoDate(row.contractStartDate) : null,
    contractEndDate: includePersonal ? isoDate(row.contractEndDate) : null,
    user: row.user,
    emergencyContactCount: row._count.emergencyContacts,
    documentCount: row._count.documents,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toHistoryEntry(row: HistoryRow): EmploymentHistoryEntry {
  return {
    id: row.id,
    effectiveFrom: isoDate(row.effectiveFrom)!,
    effectiveTo: isoDate(row.effectiveTo),
    employmentType: row.employmentType,
    employmentStatus: row.employmentStatus,
    branch: toNamedRef(row.branch),
    department: toNamedRef(row.department),
    position: toPositionRef(row.position),
    jobLevel: toNamedRef(row.jobLevel),
    manager: toEmployeeRef(row.manager),
    changeReason: row.changeReason,
    notes: row.notes,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toEmergencyContact(row: {
  id: string;
  employeeId: string;
  fullName: string;
  relationship: string;
  phone: string;
  email: string | null;
  address: string | null;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}): EmergencyContact {
  return {
    id: row.id,
    employeeId: row.employeeId,
    fullName: row.fullName,
    relationship: row.relationship,
    phone: row.phone,
    email: row.email,
    address: row.address,
    isPrimary: row.isPrimary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toDocument(row: DocumentRow): EmployeeDocument {
  return {
    id: row.id,
    employeeId: row.employeeId,
    category: row.category,
    title: row.title,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
  };
}
