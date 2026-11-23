/**
 * Types shared between the API and the web app.
 * Keep this package free of runtime dependencies; it must stay safe to import anywhere.
 */

export type HealthStatus = "ok" | "degraded";

export interface HealthCheck {
  status: "up" | "down";
  latencyMs: number | null;
  message?: string;
}

export interface HealthResponse {
  status: HealthStatus;
  service: string;
  version: string;
  environment: string;
  timezone: string;
  uptimeSeconds: number;
  timestamp: string;
  checks: {
    database: HealthCheck;
  };
}

/** Error envelope returned by the global exception filter (ADR-010). */
export interface ApiErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  traceId: string;
  timestamp: string;
  path: string;
}

// ---------------------------------------------------------------------------
// Authentication & RBAC
// ---------------------------------------------------------------------------

export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export const USER_STATUSES: readonly UserStatus[] = ["ACTIVE", "INACTIVE", "SUSPENDED"];

/** Permission catalog. The database is the source of truth; these constants keep
 * the API and the web app from drifting on the stable codes. */
export const PERMISSIONS = {
  AUTH_ME: "auth.me",
  AUTH_CHANGE_PASSWORD: "auth.change_password",
  USER_READ: "user.read",
  USER_CREATE: "user.create",
  USER_UPDATE: "user.update",
  USER_DEACTIVATE: "user.deactivate",
  USER_ASSIGN_ROLE: "user.assign_role",
  ROLE_READ: "role.read",
  ROLE_CREATE: "role.create",
  ROLE_UPDATE: "role.update",
  ROLE_DELETE: "role.delete",
  COMPANY_READ: "company.read",
  COMPANY_UPDATE: "company.update",
  BRANCH_READ: "branch.read",
  BRANCH_CREATE: "branch.create",
  BRANCH_UPDATE: "branch.update",
  BRANCH_DELETE: "branch.delete",
  DEPARTMENT_READ: "department.read",
  DEPARTMENT_CREATE: "department.create",
  DEPARTMENT_UPDATE: "department.update",
  DEPARTMENT_DELETE: "department.delete",
  POSITION_READ: "position.read",
  POSITION_CREATE: "position.create",
  POSITION_UPDATE: "position.update",
  POSITION_DELETE: "position.delete",
  JOB_LEVEL_READ: "job_level.read",
  JOB_LEVEL_CREATE: "job_level.create",
  JOB_LEVEL_UPDATE: "job_level.update",
  JOB_LEVEL_DELETE: "job_level.delete",
  EMPLOYEE_READ: "employee.read",
  EMPLOYEE_CREATE: "employee.create",
  EMPLOYEE_UPDATE: "employee.update",
  EMPLOYEE_DEACTIVATE: "employee.deactivate",
  EMPLOYEE_READ_SENSITIVE: "employee.read_sensitive",
  EMPLOYEE_MANAGE_DOCUMENTS: "employee.manage_documents",
  EMPLOYEE_MANAGE_USER_ACCOUNT: "employee.manage_user_account",
  EMPLOYEE_READ_TEAM: "employee.read_team",
  EMPLOYEE_READ_SELF: "employee.read_self",
  EMPLOYEE_UPDATE_SELF: "employee.update_self",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_CODES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  HR_ADMIN: "HR_ADMIN",
  MANAGER: "MANAGER",
  EMPLOYEE: "EMPLOYEE",
  PAYROLL_OFFICER: "PAYROLL_OFFICER",
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

export interface RoleSummary {
  id: string;
  name: string;
  code: string;
}

export interface PermissionSummary {
  id: string;
  name: string;
  code: string;
  description: string | null;
}

export interface RoleDetail extends RoleSummary {
  description: string | null;
  isSystem: boolean;
  permissions: PermissionSummary[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  roles: RoleSummary[];
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionInfo {
  id: string;
  expiresAt: string;
  createdAt: string;
}

/** Response of GET /auth/me and the user payload returned by login/refresh. */
export interface CurrentUser extends UserSummary {
  permissions: string[];
  session: SessionInfo;
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  user: CurrentUser;
}

export interface AccessTokenResponse {
  accessToken: string;
  expiresIn: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

export type MasterStatus = "ACTIVE" | "INACTIVE";

export const MASTER_STATUSES: readonly MasterStatus[] = ["ACTIVE", "INACTIVE"];

export interface Company {
  id: string;
  name: string;
  code: string;
  registrationNumber: string | null;
  email: string;
  phone: string | null;
  website: string | null;
  addressLine: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;
  logoUrl: string | null;
  timezone: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  status: MasterStatus;
  departmentCount: number;
  employeeCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Compact reference embedded in other payloads. */
export interface NamedRef {
  id: string;
  name: string;
}

export interface JobLevel {
  id: string;
  name: string;
  code: string;
  description: string | null;
  displayOrder: number;
  status: MasterStatus;
  positionCount: number;
  employeeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: MasterStatus;
  branchId: string | null;
  parentId: string | null;
  headEmployeeId: string | null;
  branch: NamedRef | null;
  parent: NamedRef | null;
  head: { id: string; name: string } | null;
  positionCount: number;
  employeeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentTreeNode extends Department {
  children: DepartmentTreeNode[];
}

export interface Position {
  id: string;
  title: string;
  code: string;
  description: string | null;
  status: MasterStatus;
  departmentId: string;
  jobLevelId: string | null;
  department: NamedRef;
  jobLevel: NamedRef | null;
  employeeCount: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

export type Gender = "MALE" | "FEMALE" | "OTHER";
export const GENDERS: readonly Gender[] = ["MALE", "FEMALE", "OTHER"];

export type MaritalStatus = "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED";
export const MARITAL_STATUSES: readonly MaritalStatus[] = [
  "SINGLE",
  "MARRIED",
  "DIVORCED",
  "WIDOWED",
];

export type EmploymentType = "PERMANENT" | "CONTRACT" | "INTERN" | "FREELANCE" | "PART_TIME";
export const EMPLOYMENT_TYPES: readonly EmploymentType[] = [
  "PERMANENT",
  "CONTRACT",
  "INTERN",
  "FREELANCE",
  "PART_TIME",
];

export type EmploymentStatus = "ACTIVE" | "PROBATION" | "INACTIVE" | "RESIGNED" | "TERMINATED";
export const EMPLOYMENT_STATUSES: readonly EmploymentStatus[] = [
  "ACTIVE",
  "PROBATION",
  "INACTIVE",
  "RESIGNED",
  "TERMINATED",
];

export type EmployeeDocumentCategory = "CONTRACT" | "IDENTITY" | "CERTIFICATE" | "OTHER";
export const EMPLOYEE_DOCUMENT_CATEGORIES: readonly EmployeeDocumentCategory[] = [
  "CONTRACT",
  "IDENTITY",
  "CERTIFICATE",
  "OTHER",
];

export const EMPLOYEE_SORT_FIELDS = ["name", "employeeNumber", "joinDate"] as const;
export type EmployeeSortField = (typeof EMPLOYEE_SORT_FIELDS)[number];

export interface EmployeeRef {
  id: string;
  employeeNumber: string;
  fullName: string;
  photoUrl: string | null;
}

/** Directory row. Sensitive personal fields are intentionally absent. */
export interface EmployeeListItem {
  id: string;
  employeeNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  preferredName: string | null;
  fullName: string;
  photoUrl: string | null;
  workEmail: string | null;
  personalEmail: string | null;
  branch: NamedRef | null;
  department: NamedRef | null;
  position: NamedRef | null;
  jobLevel: NamedRef | null;
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;
  joinDate: string;
  manager: EmployeeRef | null;
}

/**
 * Profile payload. When the caller lacks `employee.read_sensitive` (and is not
 * the employee themselves) the personal block is nulled out server-side.
 */
export interface EmployeeDetail extends EmployeeListItem {
  gender: Gender | null;
  birthDate: string | null;
  placeOfBirth: string | null;
  maritalStatus: MaritalStatus | null;
  nationality: string | null;
  phone: string | null;
  addressLine: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;
  probationEndDate: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  user: { id: string; name: string; email: string } | null;
  emergencyContactCount: number;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmploymentHistoryEntry {
  id: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;
  branch: NamedRef | null;
  department: NamedRef | null;
  position: NamedRef | null;
  jobLevel: NamedRef | null;
  manager: EmployeeRef | null;
  changeReason: string | null;
  notes: string | null;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
}

export interface EmergencyContact {
  id: string;
  employeeId: string;
  fullName: string;
  relationship: string;
  phone: string;
  email: string | null;
  address: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  category: EmployeeDocumentCategory;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: { id: string; name: string } | null;
  createdAt: string;
}
