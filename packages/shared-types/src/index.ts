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
  WORK_SCHEDULE_READ: "work_schedule.read",
  WORK_SCHEDULE_CREATE: "work_schedule.create",
  WORK_SCHEDULE_UPDATE: "work_schedule.update",
  WORK_SCHEDULE_DEACTIVATE: "work_schedule.deactivate",
  SHIFT_READ: "shift.read",
  SHIFT_CREATE: "shift.create",
  SHIFT_UPDATE: "shift.update",
  SHIFT_DEACTIVATE: "shift.deactivate",
  ATTENDANCE_READ: "attendance.read",
  ATTENDANCE_READ_ALL: "attendance.read_all",
  ATTENDANCE_READ_TEAM: "attendance.read_team",
  ATTENDANCE_CLOCK_IN: "attendance.clock_in",
  ATTENDANCE_CLOCK_OUT: "attendance.clock_out",
  ATTENDANCE_MANAGE: "attendance.manage",
  ATTENDANCE_EXPORT: "attendance.export",
  ATTENDANCE_CORRECTION_READ: "attendance_correction.read",
  ATTENDANCE_CORRECTION_CREATE: "attendance_correction.create",
  ATTENDANCE_CORRECTION_REVIEW: "attendance_correction.review",
  HOLIDAY_READ: "holiday.read",
  HOLIDAY_CREATE: "holiday.create",
  HOLIDAY_UPDATE: "holiday.update",
  HOLIDAY_DEACTIVATE: "holiday.deactivate",
  LEAVE_TYPE_READ: "leave_type.read",
  LEAVE_TYPE_CREATE: "leave_type.create",
  LEAVE_TYPE_UPDATE: "leave_type.update",
  LEAVE_TYPE_DEACTIVATE: "leave_type.deactivate",
  LEAVE_POLICY_READ: "leave_policy.read",
  LEAVE_POLICY_CREATE: "leave_policy.create",
  LEAVE_POLICY_UPDATE: "leave_policy.update",
  LEAVE_POLICY_DEACTIVATE: "leave_policy.deactivate",
  LEAVE_POLICY_ASSIGN: "leave_policy.assign",
  LEAVE_REQUEST_READ: "leave_request.read",
  LEAVE_REQUEST_READ_ALL: "leave_request.read_all",
  LEAVE_REQUEST_READ_TEAM: "leave_request.read_team",
  LEAVE_REQUEST_CREATE: "leave_request.create",
  LEAVE_REQUEST_SUBMIT: "leave_request.submit",
  LEAVE_REQUEST_WITHDRAW: "leave_request.withdraw",
  LEAVE_REQUEST_APPROVE: "leave_request.approve",
  LEAVE_REQUEST_REJECT: "leave_request.reject",
  LEAVE_REQUEST_CANCEL: "leave_request.cancel",
  LEAVE_REQUEST_OVERRIDE: "leave_request.override",
  LEAVE_BALANCE_READ: "leave_balance.read",
  LEAVE_BALANCE_READ_ALL: "leave_balance.read_all",
  LEAVE_BALANCE_ADJUST: "leave_balance.adjust",
  LEAVE_TRANSACTION_READ: "leave_transaction.read",
  LEAVE_TRANSACTION_READ_ALL: "leave_transaction.read_all",
  LEAVE_REPORT_READ: "leave_report.read",
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

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export type AttendanceStatus =
  | "PRESENT"
  | "LATE"
  | "EARLY_LEAVE"
  | "LATE_AND_EARLY_LEAVE"
  | "ABSENT"
  | "HALF_DAY"
  | "INCOMPLETE"
  | "ON_LEAVE";
export const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = [
  "PRESENT",
  "LATE",
  "EARLY_LEAVE",
  "LATE_AND_EARLY_LEAVE",
  "ABSENT",
  "HALF_DAY",
  "INCOMPLETE",
  "ON_LEAVE",
];

export type AttendanceCorrectionStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export const ATTENDANCE_CORRECTION_STATUSES: readonly AttendanceCorrectionStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
];

export type AttendanceCorrectionType = "CLOCK_IN" | "CLOCK_OUT" | "BOTH";
export const ATTENDANCE_CORRECTION_TYPES: readonly AttendanceCorrectionType[] = [
  "CLOCK_IN",
  "CLOCK_OUT",
  "BOTH",
];

export type HolidayType = "NATIONAL" | "COMPANY" | "BRANCH";
export const HOLIDAY_TYPES: readonly HolidayType[] = ["NATIONAL", "COMPANY", "BRANCH"];

export interface WorkScheduleDay {
  id: string;
  dayOfWeek: number;
  isWorkingDay: boolean;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number;
}

export interface WorkSchedule {
  id: string;
  name: string;
  code: string;
  description: string | null;
  graceLateMinutes: number;
  graceEarlyMinutes: number;
  status: MasterStatus;
  days: WorkScheduleDay[];
  assignmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Shift {
  id: string;
  name: string;
  code: string;
  description: string | null;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  graceLateMinutes: number;
  graceEarlyMinutes: number;
  status: MasterStatus;
  assignmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftRef {
  id: string;
  name: string;
  code: string;
}

export interface ScheduleRef {
  id: string;
  name: string;
  code: string;
}

export interface BulkAssignmentResult {
  assigned: number;
  employeeIds: string[];
}

export interface EmployeeScheduleAssignment {
  id: string;
  employeeId: string;
  employee: { id: string; employeeNumber: string; fullName: string };
  workSchedule: ScheduleRef;
  shift: ShiftRef | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  changeReason: string | null;
  createdAt: string;
}

export interface AttendanceBreak {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  branch: NamedRef | null;
  department: NamedRef | null;
  position: NamedRef | null;
  workDate: string;
  timezone: string;
  workSchedule: ScheduleRef | null;
  shift: ShiftRef | null;
  scheduledStartAt: string;
  scheduledEndAt: string;
  scheduledStartLocal: string;
  scheduledEndLocal: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  clockInLocal: string | null;
  clockOutLocal: string | null;
  expectedBreakMinutes: number;
  graceLateMinutes: number;
  graceEarlyMinutes: number;
  status: AttendanceStatus;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workedMinutes: number;
  breakMinutesTaken: number;
  isCorrected: boolean;
  hasPendingCorrection: boolean;
  breaks: AttendanceBreak[];
  createdAt: string;
  updatedAt: string;
}

export type AttendanceDayStatus = AttendanceStatus | "HOLIDAY" | "OFF" | "NO_RECORD";

export interface AttendanceLeaveInfo {
  requestId: string;
  leaveType: { id: string; name: string; code: string };
  duration: number;
  requestMode: LeaveRequestMode;
  halfDayPeriod: LeaveHalfDayPeriod | null;
}

export interface AttendanceCalendarDay {
  date: string;
  dayOfWeek: number;
  status: AttendanceDayStatus;
  holiday: { id: string; name: string; type: HolidayType } | null;
  leave: AttendanceLeaveInfo | null;
  record: AttendanceRecord | null;
}

export interface AttendanceCalendar {
  month: string;
  timezone: string;
  days: AttendanceCalendarDay[];
  summary: {
    present: number;
    late: number;
    incomplete: number;
    off: number;
    holiday: number;
    onLeave: number;
  };
}

export type AttendanceTodayState =
  | "NOT_CLOCKED_IN"
  | "WORKING"
  | "ON_BREAK"
  | "CLOCKED_OUT"
  | "DAY_OFF"
  | "HOLIDAY"
  | "ON_LEAVE"
  | "NO_EMPLOYEE";

export interface AttendanceDashboard {
  date: string;
  timezone: string;
  employee: { id: string; employeeNumber: string; fullName: string };
  state: AttendanceTodayState;
  schedule: {
    workSchedule: ScheduleRef;
    shift: ShiftRef | null;
    scheduledStartLocal: string;
    scheduledEndLocal: string;
  } | null;
  holiday: { id: string; name: string; type: HolidayType } | null;
  leave: AttendanceLeaveInfo | null;
  record: AttendanceRecord | null;
  pendingCorrections: number;
}

export interface AttendanceOverview {
  date: string;
  timezone: string;
  scheduledEmployees: number;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  incomplete: number;
  pendingCorrections: number;
}

export interface AttendanceCorrection {
  id: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  attendanceRecordId: string | null;
  workDate: string;
  type: AttendanceCorrectionType;
  status: AttendanceCorrectionStatus;
  originalClockInLocal: string | null;
  originalClockOutLocal: string | null;
  requestedClockInLocal: string | null;
  requestedClockOutLocal: string | null;
  reason: string;
  reviewer: { id: string; name: string } | null;
  reviewNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  description: string | null;
  type: HolidayType;
  branchId: string | null;
  branch: NamedRef | null;
  status: MasterStatus;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Leave
// ---------------------------------------------------------------------------

export type LeaveDurationUnit = "DAY" | "HOUR";
export const LEAVE_DURATION_UNITS: readonly LeaveDurationUnit[] = ["DAY", "HOUR"];

export type LeaveAccrualMethod =
  | "GRANTED_UPFRONT"
  | "MONTHLY_ACCRUAL"
  | "ANNUAL_ACCRUAL"
  | "MANUAL_GRANT";
export const LEAVE_ACCRUAL_METHODS: readonly LeaveAccrualMethod[] = [
  "GRANTED_UPFRONT",
  "MONTHLY_ACCRUAL",
  "ANNUAL_ACCRUAL",
  "MANUAL_GRANT",
];

export type LeaveAccrualFrequency = "MONTHLY" | "ANNUAL" | "ONE_TIME";
export const LEAVE_ACCRUAL_FREQUENCIES: readonly LeaveAccrualFrequency[] = [
  "MONTHLY",
  "ANNUAL",
  "ONE_TIME",
];

export type LeaveAccrualStartRule = "PERIOD_START" | "ASSIGNMENT_START";
export const LEAVE_ACCRUAL_START_RULES: readonly LeaveAccrualStartRule[] = [
  "PERIOD_START",
  "ASSIGNMENT_START",
];

export type LeaveApprovalMode = "MANAGER" | "HR" | "MANAGER_AND_HR";
export const LEAVE_APPROVAL_MODES: readonly LeaveApprovalMode[] = [
  "MANAGER",
  "HR",
  "MANAGER_AND_HR",
];

export type LeaveApprovalStage = "MANAGER" | "HR";
export const LEAVE_APPROVAL_STAGES: readonly LeaveApprovalStage[] = ["MANAGER", "HR"];

export type LeaveRequestStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "WITHDRAWN";
export const LEAVE_REQUEST_STATUSES: readonly LeaveRequestStatus[] = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "WITHDRAWN",
];

export type LeaveRequestMode = "FULL_DAY" | "HALF_DAY" | "HOURLY";
export const LEAVE_REQUEST_MODES: readonly LeaveRequestMode[] = [
  "FULL_DAY",
  "HALF_DAY",
  "HOURLY",
];

export type LeaveHalfDayPeriod = "FIRST_HALF" | "SECOND_HALF";
export const LEAVE_HALF_DAY_PERIODS: readonly LeaveHalfDayPeriod[] = [
  "FIRST_HALF",
  "SECOND_HALF",
];

export type LeaveTransactionType =
  | "OPENING_BALANCE"
  | "ENTITLEMENT"
  | "ACCRUAL"
  | "LEAVE_DEDUCTION"
  | "LEAVE_REVERSAL"
  | "CARRY_OVER"
  | "EXPIRATION"
  | "ADJUSTMENT";

export type LeaveReservationStatus = "PENDING" | "CONSUMED" | "RELEASED";
export type LeavePeriodStatus = "OPEN" | "CLOSED";

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isPaid: boolean;
  requiresApproval: boolean;
  requiresAttachment: boolean;
  allowHalfDay: boolean;
  allowPastDates: boolean;
  allowFutureDates: boolean;
  requiresBalance: boolean;
  status: MasterStatus;
  policyCount: number;
  requestCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LeavePolicy {
  id: string;
  name: string;
  code: string;
  description: string | null;
  leaveTypeId: string;
  leaveType: { id: string; name: string; code: string };
  entitlementAmount: number;
  entitlementUnit: LeaveDurationUnit;
  accrualMethod: LeaveAccrualMethod;
  accrualFrequency: LeaveAccrualFrequency;
  accrualStartRule: LeaveAccrualStartRule;
  eligibilityMonths: number;
  maxBalance: number | null;
  carryOverEnabled: boolean;
  maxCarryOverAmount: number | null;
  carryOverExpirationMonths: number | null;
  minRequestDuration: number | null;
  maxRequestDuration: number | null;
  minAdvanceNoticeDays: number;
  allowNegativeBalance: boolean;
  allowHalfDay: boolean;
  allowUnpaidLeave: boolean;
  approvalMode: LeaveApprovalMode;
  leaveYearStartMonth: number;
  cancellationCutoffDays: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: MasterStatus;
  assignmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LeavePolicyAssignment {
  id: string;
  employeeId: string;
  employee: { id: string; employeeNumber: string; fullName: string };
  leaveType: { id: string; name: string; code: string };
  policy: { id: string; name: string; code: string; entitlementAmount: number };
  effectiveFrom: string;
  effectiveTo: string | null;
  status: MasterStatus;
  notes: string | null;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
}

export interface LeaveBalance {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  leaveType: { id: string; name: string; code: string; isPaid: boolean };
  periodStart: string;
  periodEnd: string;
  entitled: number;
  used: number;
  reserved: number;
  available: number;
  unit: LeaveDurationUnit;
  policy: { id: string; name: string; code: string } | null;
}

export interface LeaveTransaction {
  id: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  leaveType: { id: string; name: string; code: string };
  periodStart: string;
  periodEnd: string;
  type: LeaveTransactionType;
  amount: number;
  transactionDate: string;
  expiresAt: string | null;
  sourceType: string;
  sourceRef: string;
  description: string | null;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
}

export interface LeaveRequestDay {
  date: string;
  duration: number;
  halfDayPeriod: LeaveHalfDayPeriod | null;
}

export interface LeaveRequestApproval {
  id: string;
  stage: LeaveApprovalStage;
  decision: "APPROVED" | "REJECTED";
  actor: { id: string; name: string } | null;
  actorName: string;
  comment: string | null;
  isOverride: boolean;
  createdAt: string;
}

export interface LeaveAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: { id: string; name: string } | null;
  createdAt: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  leaveType: {
    id: string;
    name: string;
    code: string;
    isPaid: boolean;
    requiresAttachment: boolean;
    requiresApproval: boolean;
    requiresBalance: boolean;
  };
  startDate: string;
  endDate: string;
  duration: number;
  durationUnit: LeaveDurationUnit;
  requestMode: LeaveRequestMode;
  halfDayPeriod: LeaveHalfDayPeriod | null;
  reason: string;
  status: LeaveRequestStatus;
  approvalStage: LeaveApprovalStage | null;
  submittedAt: string | null;
  reviewedBy: { id: string; name: string } | null;
  reviewedAt: string | null;
  reviewComments: string | null;
  cancelledAt: string | null;
  cancelledBy: { id: string; name: string } | null;
  cancellationReason: string | null;
  withdrawnAt: string | null;
  days: LeaveRequestDay[];
  approvals: LeaveRequestApproval[];
  attachments: LeaveAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface LeaveRequestPreviewDay {
  date: string;
  duration: number;
  isWorkingDay: boolean;
  halfDayPeriod: LeaveHalfDayPeriod | null;
}

export interface LeaveRequestPreview {
  startDate: string;
  endDate: string;
  duration: number;
  durationUnit: LeaveDurationUnit;
  requestMode: LeaveRequestMode;
  halfDayPeriod: LeaveHalfDayPeriod | null;
  days: LeaveRequestPreviewDay[];
  balance: LeaveBalance | null;
  estimatedRemaining: number | null;
  requiresAttachment: boolean;
}

export interface LeaveCalendarEntry {
  id: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  leaveType: { id: string; name: string; code: string };
  startDate: string;
  endDate: string;
  duration: number;
  status: LeaveRequestStatus;
  requestMode: LeaveRequestMode;
  halfDayPeriod: LeaveHalfDayPeriod | null;
}

export interface LeaveCalendar {
  month: string;
  entries: LeaveCalendarEntry[];
}

export interface LeaveDashboard {
  date: string;
  balances: LeaveBalance[];
  pendingRequests: number;
  approvedThisMonth: number;
  upcoming: LeaveRequest[];
  inboxCount: number;
}

export interface LeaveReportRow {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  branch: string | null;
  department: string | null;
  leaveType: string;
  entitled: number;
  used: number;
  reserved: number;
  available: number;
}

export interface LeaveReportSummary {
  from: string;
  to: string;
  requestCount: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  totalDays: number;
  rows: LeaveReportRow[];
}
