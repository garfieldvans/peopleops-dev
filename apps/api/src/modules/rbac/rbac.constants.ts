import {
  PERMISSIONS,
  ROLE_CODES,
  type PermissionCode,
  type RoleCode,
} from "@peopleops/shared-types";

export interface PermissionDefinition {
  code: PermissionCode;
  name: string;
  description: string;
}

export const PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    code: PERMISSIONS.AUTH_ME,
    name: "View own account",
    description: "Read the authenticated user's profile, roles and permissions",
  },
  {
    code: PERMISSIONS.AUTH_CHANGE_PASSWORD,
    name: "Change own password",
    description: "Change the authenticated user's password",
  },
  {
    code: PERMISSIONS.USER_READ,
    name: "Read users",
    description: "List and inspect application accounts",
  },
  {
    code: PERMISSIONS.USER_CREATE,
    name: "Create users",
    description: "Provision new application accounts with an initial password",
  },
  {
    code: PERMISSIONS.USER_UPDATE,
    name: "Update users",
    description: "Edit account name and email",
  },
  {
    code: PERMISSIONS.USER_DEACTIVATE,
    name: "Change user status",
    description: "Activate, deactivate or suspend accounts",
  },
  {
    code: PERMISSIONS.USER_ASSIGN_ROLE,
    name: "Assign roles",
    description: "Change the roles assigned to an account",
  },
  {
    code: PERMISSIONS.ROLE_READ,
    name: "Read roles",
    description: "List roles and the permission catalog",
  },
  {
    code: PERMISSIONS.ROLE_CREATE,
    name: "Create roles",
    description: "Create custom roles",
  },
  {
    code: PERMISSIONS.ROLE_UPDATE,
    name: "Update roles",
    description: "Rename roles and change their permissions",
  },
  {
    code: PERMISSIONS.ROLE_DELETE,
    name: "Delete roles",
    description: "Delete unused, non-system roles",
  },
  {
    code: PERMISSIONS.COMPANY_READ,
    name: "Read company profile",
    description: "View the company profile",
  },
  {
    code: PERMISSIONS.COMPANY_UPDATE,
    name: "Update company profile",
    description: "Edit the company profile",
  },
  {
    code: PERMISSIONS.BRANCH_READ,
    name: "Read branches",
    description: "List and inspect branches",
  },
  {
    code: PERMISSIONS.BRANCH_CREATE,
    name: "Create branches",
    description: "Add branches",
  },
  {
    code: PERMISSIONS.BRANCH_UPDATE,
    name: "Update branches",
    description: "Edit branches and their status",
  },
  {
    code: PERMISSIONS.BRANCH_DELETE,
    name: "Delete branches",
    description: "Delete branches that hold no departments or employees",
  },
  {
    code: PERMISSIONS.DEPARTMENT_READ,
    name: "Read departments",
    description: "List departments and the department tree",
  },
  {
    code: PERMISSIONS.DEPARTMENT_CREATE,
    name: "Create departments",
    description: "Add departments and place them in the hierarchy",
  },
  {
    code: PERMISSIONS.DEPARTMENT_UPDATE,
    name: "Update departments",
    description: "Edit departments, their parent and their head",
  },
  {
    code: PERMISSIONS.DEPARTMENT_DELETE,
    name: "Delete departments",
    description: "Delete departments that hold no positions or employees",
  },
  {
    code: PERMISSIONS.POSITION_READ,
    name: "Read positions",
    description: "List and inspect positions",
  },
  {
    code: PERMISSIONS.POSITION_CREATE,
    name: "Create positions",
    description: "Add positions inside a department",
  },
  {
    code: PERMISSIONS.POSITION_UPDATE,
    name: "Update positions",
    description: "Edit positions, their department and job level",
  },
  {
    code: PERMISSIONS.POSITION_DELETE,
    name: "Delete positions",
    description: "Delete positions with no employees",
  },
  {
    code: PERMISSIONS.JOB_LEVEL_READ,
    name: "Read job levels",
    description: "List job levels",
  },
  {
    code: PERMISSIONS.JOB_LEVEL_CREATE,
    name: "Create job levels",
    description: "Add job levels",
  },
  {
    code: PERMISSIONS.JOB_LEVEL_UPDATE,
    name: "Update job levels",
    description: "Edit job levels and their display order",
  },
  {
    code: PERMISSIONS.JOB_LEVEL_DELETE,
    name: "Delete job levels",
    description: "Delete job levels that are not in use",
  },
  {
    code: PERMISSIONS.EMPLOYEE_READ,
    name: "Read employees",
    description: "Browse the employee directory and employee profiles",
  },
  {
    code: PERMISSIONS.EMPLOYEE_CREATE,
    name: "Create employees",
    description: "Add employee records",
  },
  {
    code: PERMISSIONS.EMPLOYEE_UPDATE,
    name: "Update employees",
    description: "Edit employee records and employment assignments",
  },
  {
    code: PERMISSIONS.EMPLOYEE_DEACTIVATE,
    name: "Deactivate employees",
    description: "Mark employees inactive and close their employment record",
  },
  {
    code: PERMISSIONS.EMPLOYEE_READ_SENSITIVE,
    name: "Read sensitive employee data",
    description: "View identity numbers, salary-related and document metadata",
  },
  {
    code: PERMISSIONS.EMPLOYEE_MANAGE_DOCUMENTS,
    name: "Manage employee documents",
    description: "Upload, download and delete employee documents",
  },
  {
    code: PERMISSIONS.EMPLOYEE_MANAGE_USER_ACCOUNT,
    name: "Link employee accounts",
    description: "Create or link a login account for an employee",
  },
  {
    code: PERMISSIONS.EMPLOYEE_READ_TEAM,
    name: "Read own team",
    description: "Read employees inside the manager's reporting line",
  },
  {
    code: PERMISSIONS.EMPLOYEE_READ_SELF,
    name: "Read own employee profile",
    description: "Read the employee record linked to the signed-in account",
  },
  {
    code: PERMISSIONS.EMPLOYEE_UPDATE_SELF,
    name: "Update own contact details",
    description: "Edit the employee's own personal contact information",
  },
  {
    code: PERMISSIONS.WORK_SCHEDULE_READ,
    name: "Read work schedules",
    description: "View work schedules and their working days",
  },
  {
    code: PERMISSIONS.WORK_SCHEDULE_CREATE,
    name: "Create work schedules",
    description: "Add work schedules",
  },
  {
    code: PERMISSIONS.WORK_SCHEDULE_UPDATE,
    name: "Update work schedules",
    description: "Edit work schedules and working days",
  },
  {
    code: PERMISSIONS.WORK_SCHEDULE_DEACTIVATE,
    name: "Deactivate work schedules",
    description: "Deactivate work schedules that are no longer used",
  },
  {
    code: PERMISSIONS.SHIFT_READ,
    name: "Read shifts",
    description: "View shift master data",
  },
  {
    code: PERMISSIONS.SHIFT_CREATE,
    name: "Create shifts",
    description: "Add shifts, including overnight shifts",
  },
  {
    code: PERMISSIONS.SHIFT_UPDATE,
    name: "Update shifts",
    description: "Edit shift master data",
  },
  {
    code: PERMISSIONS.SHIFT_DEACTIVATE,
    name: "Deactivate shifts",
    description: "Deactivate shifts that are no longer assigned",
  },
  {
    code: PERMISSIONS.ATTENDANCE_READ,
    name: "Read own attendance",
    description: "View the attendance record linked to the signed-in account",
  },
  {
    code: PERMISSIONS.ATTENDANCE_READ_ALL,
    name: "Read all attendance",
    description: "View attendance for every employee",
  },
  {
    code: PERMISSIONS.ATTENDANCE_READ_TEAM,
    name: "Read team attendance",
    description: "View attendance for employees inside the manager's reporting line",
  },
  {
    code: PERMISSIONS.ATTENDANCE_CLOCK_IN,
    name: "Clock in",
    description: "Record the signed-in employee's clock-in",
  },
  {
    code: PERMISSIONS.ATTENDANCE_CLOCK_OUT,
    name: "Clock out",
    description: "Record the signed-in employee's clock-out and breaks",
  },
  {
    code: PERMISSIONS.ATTENDANCE_MANAGE,
    name: "Manage attendance",
    description: "Manually adjust attendance records with audit logging",
  },
  {
    code: PERMISSIONS.ATTENDANCE_EXPORT,
    name: "Export attendance",
    description: "Export attendance records as CSV",
  },
  {
    code: PERMISSIONS.ATTENDANCE_CORRECTION_READ,
    name: "Read attendance corrections",
    description: "View attendance correction requests",
  },
  {
    code: PERMISSIONS.ATTENDANCE_CORRECTION_CREATE,
    name: "Request attendance corrections",
    description: "Submit correction requests for the signed-in employee",
  },
  {
    code: PERMISSIONS.ATTENDANCE_CORRECTION_REVIEW,
    name: "Review attendance corrections",
    description: "Approve or reject attendance correction requests within scope",
  },
  {
    code: PERMISSIONS.HOLIDAY_READ,
    name: "Read holidays",
    description: "View the holiday calendar",
  },
  {
    code: PERMISSIONS.HOLIDAY_CREATE,
    name: "Create holidays",
    description: "Add national, company or branch holidays",
  },
  {
    code: PERMISSIONS.HOLIDAY_UPDATE,
    name: "Update holidays",
    description: "Edit holiday master data",
  },
  {
    code: PERMISSIONS.HOLIDAY_DEACTIVATE,
    name: "Deactivate holidays",
    description: "Deactivate holidays that no longer apply",
  },
  {
    code: PERMISSIONS.LEAVE_TYPE_READ,
    name: "Read leave types",
    description: "View configurable leave types",
  },
  {
    code: PERMISSIONS.LEAVE_TYPE_CREATE,
    name: "Create leave types",
    description: "Add configurable leave types",
  },
  {
    code: PERMISSIONS.LEAVE_TYPE_UPDATE,
    name: "Update leave types",
    description: "Edit leave types and their configuration",
  },
  {
    code: PERMISSIONS.LEAVE_TYPE_DEACTIVATE,
    name: "Deactivate leave types",
    description: "Deactivate leave types that are no longer used",
  },
  {
    code: PERMISSIONS.LEAVE_POLICY_READ,
    name: "Read leave policies",
    description: "View leave policies and their accrual rules",
  },
  {
    code: PERMISSIONS.LEAVE_POLICY_CREATE,
    name: "Create leave policies",
    description: "Add leave policies",
  },
  {
    code: PERMISSIONS.LEAVE_POLICY_UPDATE,
    name: "Update leave policies",
    description: "Edit leave policies and effective dates",
  },
  {
    code: PERMISSIONS.LEAVE_POLICY_DEACTIVATE,
    name: "Deactivate leave policies",
    description: "Deactivate leave policies",
  },
  {
    code: PERMISSIONS.LEAVE_POLICY_ASSIGN,
    name: "Assign leave policies",
    description: "Assign leave policies to employees",
  },
  {
    code: PERMISSIONS.LEAVE_REQUEST_READ,
    name: "Read own leave requests",
    description: "View leave requests belonging to the signed-in employee",
  },
  {
    code: PERMISSIONS.LEAVE_REQUEST_READ_ALL,
    name: "Read all leave requests",
    description: "View leave requests across the organisation",
  },
  {
    code: PERMISSIONS.LEAVE_REQUEST_READ_TEAM,
    name: "Read team leave requests",
    description: "View leave requests inside the manager's reporting line",
  },
  {
    code: PERMISSIONS.LEAVE_REQUEST_CREATE,
    name: "Create leave requests",
    description: "Create draft leave requests for the signed-in employee",
  },
  {
    code: PERMISSIONS.LEAVE_REQUEST_SUBMIT,
    name: "Submit leave requests",
    description: "Submit the signed-in employee's draft leave requests",
  },
  {
    code: PERMISSIONS.LEAVE_REQUEST_WITHDRAW,
    name: "Withdraw leave requests",
    description: "Withdraw pending leave requests",
  },
  {
    code: PERMISSIONS.LEAVE_REQUEST_APPROVE,
    name: "Approve leave requests",
    description: "Approve leave requests within scope",
  },
  {
    code: PERMISSIONS.LEAVE_REQUEST_REJECT,
    name: "Reject leave requests",
    description: "Reject leave requests within scope",
  },
  {
    code: PERMISSIONS.LEAVE_REQUEST_CANCEL,
    name: "Cancel leave requests",
    description: "Cancel approved leave requests",
  },
  {
    code: PERMISSIONS.LEAVE_REQUEST_OVERRIDE,
    name: "Override leave approval",
    description: "Override a pending approval stage and record the override",
  },
  {
    code: PERMISSIONS.LEAVE_BALANCE_READ,
    name: "Read own leave balance",
    description: "View the signed-in employee's leave balances",
  },
  {
    code: PERMISSIONS.LEAVE_BALANCE_READ_ALL,
    name: "Read all leave balances",
    description: "View leave balances for every employee",
  },
  {
    code: PERMISSIONS.LEAVE_BALANCE_ADJUST,
    name: "Adjust leave balances",
    description: "Create manual leave balance adjustments",
  },
  {
    code: PERMISSIONS.LEAVE_TRANSACTION_READ,
    name: "Read own leave ledger",
    description: "View the signed-in employee's leave transactions",
  },
  {
    code: PERMISSIONS.LEAVE_TRANSACTION_READ_ALL,
    name: "Read all leave ledger",
    description: "View leave transactions for every employee",
  },
  {
    code: PERMISSIONS.LEAVE_REPORT_READ,
    name: "Read leave reports",
    description: "View and export leave reports",
  },
  {
    code: PERMISSIONS.OVERTIME_READ_SELF,
    name: "Read own overtime",
    description: "View the signed-in employee's overtime requests",
  },
  {
    code: PERMISSIONS.OVERTIME_CREATE,
    name: "Create overtime requests",
    description: "Create overtime requests for the signed-in employee",
  },
  {
    code: PERMISSIONS.OVERTIME_UPDATE_SELF,
    name: "Update own overtime",
    description: "Edit the signed-in employee's draft overtime requests",
  },
  {
    code: PERMISSIONS.OVERTIME_WITHDRAW_SELF,
    name: "Withdraw own overtime",
    description: "Withdraw the signed-in employee's pending overtime requests",
  },
  {
    code: PERMISSIONS.OVERTIME_READ_TEAM,
    name: "Read team overtime",
    description: "View overtime requests inside the reporting subtree",
  },
  {
    code: PERMISSIONS.OVERTIME_APPROVE,
    name: "Approve overtime",
    description: "Approve an overtime request at the current stage",
  },
  {
    code: PERMISSIONS.OVERTIME_REJECT,
    name: "Reject overtime",
    description: "Reject an overtime request with a reason",
  },
  {
    code: PERMISSIONS.OVERTIME_READ_ALL,
    name: "Read all overtime",
    description: "View every overtime request in the organization",
  },
  {
    code: PERMISSIONS.OVERTIME_MANAGE,
    name: "Manage overtime",
    description: "Override approvals, cancel requests, and administer overtime",
  },
  {
    code: PERMISSIONS.OVERTIME_VERIFY,
    name: "Verify overtime",
    description: "Verify actual overtime and make it payroll-eligible",
  },
  {
    code: PERMISSIONS.OVERTIME_CORRECT,
    name: "Correct verified overtime",
    description: "Correct a verified overtime duration with an audit trail",
  },
  {
    code: PERMISSIONS.OVERTIME_EXPORT,
    name: "Export overtime",
    description: "Export overtime records and summaries as CSV",
  },
  {
    code: PERMISSIONS.OVERTIME_POLICY_READ,
    name: "Read overtime policies",
    description: "View overtime policies and assignments",
  },
  {
    code: PERMISSIONS.OVERTIME_POLICY_MANAGE,
    name: "Manage overtime policies",
    description: "Create, update, and deactivate overtime policies",
  },
  {
    code: PERMISSIONS.OVERTIME_ASSIGNMENT_MANAGE,
    name: "Manage overtime assignments",
    description: "Assign overtime policies to employees, departments, or branches",
  },
  {
    code: PERMISSIONS.PAYROLL_COMPENSATION_READ,
    name: "Read compensation",
    description: "View employee compensation and history",
  },
  {
    code: PERMISSIONS.PAYROLL_COMPENSATION_MANAGE,
    name: "Manage compensation",
    description: "Create and update effective-dated employee compensation",
  },
  {
    code: PERMISSIONS.PAYROLL_COMPONENTS_READ,
    name: "Read payroll components",
    description: "View payroll component configuration",
  },
  {
    code: PERMISSIONS.PAYROLL_COMPONENTS_MANAGE,
    name: "Manage payroll components",
    description: "Create, update, and deactivate payroll components",
  },
  {
    code: PERMISSIONS.PAYROLL_ASSIGNMENTS_MANAGE,
    name: "Manage payroll assignments",
    description: "Assign recurring payroll components to employees",
  },
  {
    code: PERMISSIONS.PAYROLL_SETTINGS_READ,
    name: "Read payroll settings",
    description: "View payroll calculation settings",
  },
  {
    code: PERMISSIONS.PAYROLL_SETTINGS_MANAGE,
    name: "Manage payroll settings",
    description: "Update payroll calculation settings",
  },
  {
    code: PERMISSIONS.PAYROLL_PERIODS_READ,
    name: "Read payroll periods",
    description: "View payroll periods and runs",
  },
  {
    code: PERMISSIONS.PAYROLL_PERIODS_MANAGE,
    name: "Manage payroll periods",
    description: "Create and update payroll periods",
  },
  {
    code: PERMISSIONS.PAYROLL_RUNS_READ,
    name: "Read payroll runs",
    description: "View payroll runs, calculations, and warnings",
  },
  {
    code: PERMISSIONS.PAYROLL_RUNS_CALCULATE,
    name: "Calculate payroll",
    description: "Create and recalculate payroll runs",
  },
  {
    code: PERMISSIONS.PAYROLL_RUNS_REVIEW,
    name: "Review payroll",
    description: "Submit a calculated payroll run for review",
  },
  {
    code: PERMISSIONS.PAYROLL_RUNS_APPROVE,
    name: "Approve payroll",
    description: "Approve a payroll run for publication",
  },
  {
    code: PERMISSIONS.PAYROLL_RUNS_PUBLISH,
    name: "Publish payroll",
    description: "Publish approved payroll and payslips",
  },
  {
    code: PERMISSIONS.PAYROLL_RUNS_CANCEL,
    name: "Cancel payroll",
    description: "Cancel a payroll run with an audit reason",
  },
  {
    code: PERMISSIONS.PAYROLL_RUNS_OVERRIDE,
    name: "Override payroll separation of duties",
    description: "Allow a run creator to approve their own payroll run",
  },
  {
    code: PERMISSIONS.PAYROLL_ADJUSTMENTS_READ,
    name: "Read payroll adjustments",
    description: "View payroll adjustments",
  },
  {
    code: PERMISSIONS.PAYROLL_ADJUSTMENTS_CREATE,
    name: "Create payroll adjustments",
    description: "Create one-time payroll adjustments",
  },
  {
    code: PERMISSIONS.PAYROLL_ADJUSTMENTS_APPROVE,
    name: "Approve payroll adjustments",
    description: "Approve or reject payroll adjustments",
  },
  {
    code: PERMISSIONS.PAYROLL_PAYSLIPS_READ_SELF,
    name: "Read own payslips",
    description: "View the signed-in employee's published payslips",
  },
  {
    code: PERMISSIONS.PAYROLL_PAYSLIPS_READ_ALL,
    name: "Read all payslips",
    description: "View published payslips across the organization",
  },
  {
    code: PERMISSIONS.PAYROLL_PAYSLIPS_DOWNLOAD,
    name: "Download payslips",
    description: "Download authorized payslip PDFs",
  },
  {
    code: PERMISSIONS.PAYROLL_REPORTS_READ,
    name: "Read payroll reports",
    description: "View payroll summary, deduction, and overtime reports",
  },
  {
    code: PERMISSIONS.PAYROLL_HISTORY_READ,
    name: "Read payroll history",
    description: "View historical payroll runs and published results",
  },
  { code: PERMISSIONS.ONBOARDING_READ, name: "Read onboarding", description: "View onboarding templates and records" },
  { code: PERMISSIONS.ONBOARDING_MANAGE, name: "Manage onboarding", description: "Create templates and onboarding records" },
  { code: PERMISSIONS.ONBOARDING_TASK_UPDATE, name: "Update onboarding tasks", description: "Update onboarding task progress" },
  { code: PERMISSIONS.OFFBOARDING_READ, name: "Read offboarding", description: "View offboarding records and tasks" },
  { code: PERMISSIONS.OFFBOARDING_MANAGE, name: "Manage offboarding", description: "Create and complete offboarding records" },
  { code: PERMISSIONS.OFFBOARDING_TASK_UPDATE, name: "Update offboarding tasks", description: "Update offboarding task progress" },
  { code: PERMISSIONS.OFFBOARDING_SENSITIVE_READ, name: "Read offboarding sensitive data", description: "View exit interview and access review notes" },
  { code: PERMISSIONS.PERFORMANCE_CYCLES_READ, name: "Read performance cycles", description: "View performance cycles" },
  { code: PERMISSIONS.PERFORMANCE_CYCLES_MANAGE, name: "Manage performance cycles", description: "Create and transition performance cycles" },
  { code: PERMISSIONS.PERFORMANCE_GOALS_READ_SELF, name: "Read own goals", description: "View own performance goals" },
  { code: PERMISSIONS.PERFORMANCE_GOALS_MANAGE, name: "Manage performance goals", description: "Create and update performance goals" },
  { code: PERMISSIONS.PERFORMANCE_REVIEWS_READ_SELF, name: "Read own reviews", description: "View own performance reviews" },
  { code: PERMISSIONS.PERFORMANCE_REVIEWS_READ_TEAM, name: "Read team reviews", description: "View reviews for the reporting tree" },
  { code: PERMISSIONS.PERFORMANCE_REVIEWS_READ_ALL, name: "Read all reviews", description: "View all performance reviews" },
  { code: PERMISSIONS.PERFORMANCE_REVIEWS_SUBMIT_SELF, name: "Submit self review", description: "Submit own self review" },
  { code: PERMISSIONS.PERFORMANCE_REVIEWS_SUBMIT_MANAGER, name: "Submit manager review", description: "Submit manager reviews for the team" },
  { code: PERMISSIONS.PERFORMANCE_REVIEWS_MANAGE, name: "Manage performance reviews", description: "Create and complete HR reviews" },
  { code: PERMISSIONS.PERFORMANCE_REVIEWS_INTERNAL_NOTES_READ, name: "Read internal review notes", description: "View internal HR-only review notes" },
  { code: PERMISSIONS.LEARNING_PROGRAMS_READ, name: "Read training programs", description: "View the training catalog" },
  { code: PERMISSIONS.LEARNING_PROGRAMS_MANAGE, name: "Manage training programs", description: "Create and update training programs" },
  { code: PERMISSIONS.LEARNING_ENROLLMENT_CREATE, name: "Request training enrollment", description: "Request enrollment in a training program" },
  { code: PERMISSIONS.LEARNING_ENROLLMENT_READ_SELF, name: "Read own enrollments", description: "View own training enrollments and certificates" },
  { code: PERMISSIONS.LEARNING_ENROLLMENT_READ_ALL, name: "Read all enrollments", description: "View all training enrollments" },
  { code: PERMISSIONS.LEARNING_ENROLLMENT_MANAGE, name: "Manage training enrollments", description: "Approve, reject, and complete enrollments" },
  { code: PERMISSIONS.LEARNING_CERTIFICATES_READ_SELF, name: "Read own certificates", description: "View own training certificates" },
  { code: PERMISSIONS.LEARNING_CERTIFICATES_MANAGE, name: "Manage certificates", description: "Upload and manage training certificates" },
  { code: PERMISSIONS.REPORTS_HR_READ, name: "Read HR dashboard", description: "View the company HR overview dashboard" },
  { code: PERMISSIONS.REPORTS_EMPLOYEE_READ, name: "Read employee reports", description: "View employee reports" },
  { code: PERMISSIONS.REPORTS_ATTENDANCE_READ, name: "Read attendance reports", description: "View attendance and absence reports" },
  { code: PERMISSIONS.REPORTS_LEAVE_READ, name: "Read leave reports", description: "View leave utilization reports" },
  { code: PERMISSIONS.REPORTS_OVERTIME_READ, name: "Read overtime reports", description: "View verified overtime reports" },
  { code: PERMISSIONS.REPORTS_PAYROLL_READ, name: "Read payroll reports", description: "View published payroll aggregate reports" },
  { code: PERMISSIONS.REPORTS_EXPORT, name: "Export reports", description: "Export report data as CSV" },
];

const ALL_PERMISSIONS = PERMISSION_DEFINITIONS.map((permission) => permission.code);

const ORGANIZATION_READ = [
  PERMISSIONS.COMPANY_READ,
  PERMISSIONS.BRANCH_READ,
  PERMISSIONS.DEPARTMENT_READ,
  PERMISSIONS.POSITION_READ,
  PERMISSIONS.JOB_LEVEL_READ,
] as const;

const ATTENDANCE_READ_ALL = [
  PERMISSIONS.ATTENDANCE_READ,
  PERMISSIONS.ATTENDANCE_READ_ALL,
  PERMISSIONS.ATTENDANCE_MANAGE,
  PERMISSIONS.ATTENDANCE_EXPORT,
] as const;

const ATTENDANCE_SELF = [
  PERMISSIONS.ATTENDANCE_READ,
  PERMISSIONS.ATTENDANCE_CLOCK_IN,
  PERMISSIONS.ATTENDANCE_CLOCK_OUT,
  PERMISSIONS.ATTENDANCE_CORRECTION_READ,
  PERMISSIONS.ATTENDANCE_CORRECTION_CREATE,
] as const;

const ORGANIZATION_WRITE = [
  PERMISSIONS.COMPANY_UPDATE,
  PERMISSIONS.BRANCH_CREATE,
  PERMISSIONS.BRANCH_UPDATE,
  PERMISSIONS.BRANCH_DELETE,
  PERMISSIONS.DEPARTMENT_CREATE,
  PERMISSIONS.DEPARTMENT_UPDATE,
  PERMISSIONS.DEPARTMENT_DELETE,
  PERMISSIONS.POSITION_CREATE,
  PERMISSIONS.POSITION_UPDATE,
  PERMISSIONS.POSITION_DELETE,
  PERMISSIONS.JOB_LEVEL_CREATE,
  PERMISSIONS.JOB_LEVEL_UPDATE,
  PERMISSIONS.JOB_LEVEL_DELETE,
] as const;

const SELF_SERVICE = [
  PERMISSIONS.AUTH_ME,
  PERMISSIONS.AUTH_CHANGE_PASSWORD,
  PERMISSIONS.EMPLOYEE_READ_SELF,
  PERMISSIONS.EMPLOYEE_UPDATE_SELF,
] as const;

const LEAVE_SELF = [
  PERMISSIONS.LEAVE_REQUEST_READ,
  PERMISSIONS.LEAVE_REQUEST_CREATE,
  PERMISSIONS.LEAVE_REQUEST_SUBMIT,
  PERMISSIONS.LEAVE_REQUEST_WITHDRAW,
  PERMISSIONS.LEAVE_REQUEST_CANCEL,
  PERMISSIONS.LEAVE_BALANCE_READ,
  PERMISSIONS.LEAVE_TRANSACTION_READ,
] as const;

const LEAVE_ADMIN = [
  PERMISSIONS.LEAVE_TYPE_READ,
  PERMISSIONS.LEAVE_TYPE_CREATE,
  PERMISSIONS.LEAVE_TYPE_UPDATE,
  PERMISSIONS.LEAVE_TYPE_DEACTIVATE,
  PERMISSIONS.LEAVE_POLICY_READ,
  PERMISSIONS.LEAVE_POLICY_CREATE,
  PERMISSIONS.LEAVE_POLICY_UPDATE,
  PERMISSIONS.LEAVE_POLICY_DEACTIVATE,
  PERMISSIONS.LEAVE_POLICY_ASSIGN,
  PERMISSIONS.LEAVE_REQUEST_READ,
  PERMISSIONS.LEAVE_REQUEST_READ_ALL,
  PERMISSIONS.LEAVE_REQUEST_APPROVE,
  PERMISSIONS.LEAVE_REQUEST_REJECT,
  PERMISSIONS.LEAVE_REQUEST_CANCEL,
  PERMISSIONS.LEAVE_REQUEST_OVERRIDE,
  PERMISSIONS.LEAVE_BALANCE_READ,
  PERMISSIONS.LEAVE_BALANCE_READ_ALL,
  PERMISSIONS.LEAVE_BALANCE_ADJUST,
  PERMISSIONS.LEAVE_TRANSACTION_READ,
  PERMISSIONS.LEAVE_TRANSACTION_READ_ALL,
  PERMISSIONS.LEAVE_REPORT_READ,
] as const;

const LEAVE_TEAM = [
  PERMISSIONS.LEAVE_REQUEST_READ,
  PERMISSIONS.LEAVE_REQUEST_READ_TEAM,
  PERMISSIONS.LEAVE_REQUEST_APPROVE,
  PERMISSIONS.LEAVE_REQUEST_REJECT,
  PERMISSIONS.LEAVE_BALANCE_READ,
  PERMISSIONS.LEAVE_TRANSACTION_READ,
] as const;

const OVERTIME_SELF = [
  PERMISSIONS.OVERTIME_READ_SELF,
  PERMISSIONS.OVERTIME_CREATE,
  PERMISSIONS.OVERTIME_UPDATE_SELF,
  PERMISSIONS.OVERTIME_WITHDRAW_SELF,
] as const;

const OVERTIME_TEAM = [
  PERMISSIONS.OVERTIME_READ_SELF,
  PERMISSIONS.OVERTIME_READ_TEAM,
  PERMISSIONS.OVERTIME_APPROVE,
  PERMISSIONS.OVERTIME_REJECT,
] as const;

const OVERTIME_ADMIN = [
  PERMISSIONS.OVERTIME_READ_SELF,
  PERMISSIONS.OVERTIME_READ_ALL,
  PERMISSIONS.OVERTIME_MANAGE,
  PERMISSIONS.OVERTIME_VERIFY,
  PERMISSIONS.OVERTIME_CORRECT,
  PERMISSIONS.OVERTIME_EXPORT,
  PERMISSIONS.OVERTIME_APPROVE,
  PERMISSIONS.OVERTIME_REJECT,
  PERMISSIONS.OVERTIME_POLICY_READ,
  PERMISSIONS.OVERTIME_POLICY_MANAGE,
  PERMISSIONS.OVERTIME_ASSIGNMENT_MANAGE,
] as const;

const PAYROLL_EMPLOYEE = [
  PERMISSIONS.PAYROLL_PAYSLIPS_READ_SELF,
  PERMISSIONS.PAYROLL_PAYSLIPS_DOWNLOAD,
] as const;

const PAYROLL_HR = [
  PERMISSIONS.PAYROLL_COMPENSATION_READ,
  PERMISSIONS.PAYROLL_COMPENSATION_MANAGE,
  PERMISSIONS.PAYROLL_COMPONENTS_READ,
  PERMISSIONS.PAYROLL_COMPONENTS_MANAGE,
  PERMISSIONS.PAYROLL_ASSIGNMENTS_MANAGE,
  PERMISSIONS.PAYROLL_SETTINGS_READ,
  PERMISSIONS.PAYROLL_SETTINGS_MANAGE,
  PERMISSIONS.PAYROLL_PERIODS_READ,
  PERMISSIONS.PAYROLL_PERIODS_MANAGE,
  PERMISSIONS.PAYROLL_RUNS_READ,
  PERMISSIONS.PAYROLL_RUNS_CALCULATE,
  PERMISSIONS.PAYROLL_RUNS_REVIEW,
  PERMISSIONS.PAYROLL_RUNS_APPROVE,
  PERMISSIONS.PAYROLL_RUNS_PUBLISH,
  PERMISSIONS.PAYROLL_RUNS_CANCEL,
  PERMISSIONS.PAYROLL_ADJUSTMENTS_READ,
  PERMISSIONS.PAYROLL_ADJUSTMENTS_CREATE,
  PERMISSIONS.PAYROLL_ADJUSTMENTS_APPROVE,
  PERMISSIONS.PAYROLL_PAYSLIPS_READ_SELF,
  PERMISSIONS.PAYROLL_PAYSLIPS_READ_ALL,
  PERMISSIONS.PAYROLL_PAYSLIPS_DOWNLOAD,
  PERMISSIONS.PAYROLL_REPORTS_READ,
  PERMISSIONS.PAYROLL_HISTORY_READ,
  ...PAYROLL_EMPLOYEE,
] as const;

const PAYROLL_OFFICER = [
  PERMISSIONS.PAYROLL_COMPENSATION_READ,
  PERMISSIONS.PAYROLL_COMPONENTS_READ,
  PERMISSIONS.PAYROLL_ASSIGNMENTS_MANAGE,
  PERMISSIONS.PAYROLL_SETTINGS_READ,
  PERMISSIONS.PAYROLL_PERIODS_READ,
  PERMISSIONS.PAYROLL_PERIODS_MANAGE,
  PERMISSIONS.PAYROLL_RUNS_READ,
  PERMISSIONS.PAYROLL_RUNS_CALCULATE,
  PERMISSIONS.PAYROLL_RUNS_REVIEW,
  PERMISSIONS.PAYROLL_RUNS_APPROVE,
  PERMISSIONS.PAYROLL_RUNS_PUBLISH,
  PERMISSIONS.PAYROLL_RUNS_CANCEL,
  PERMISSIONS.PAYROLL_ADJUSTMENTS_READ,
  PERMISSIONS.PAYROLL_ADJUSTMENTS_CREATE,
  PERMISSIONS.PAYROLL_ADJUSTMENTS_APPROVE,
  PERMISSIONS.PAYROLL_PAYSLIPS_READ_SELF,
  PERMISSIONS.PAYROLL_PAYSLIPS_READ_ALL,
  PERMISSIONS.PAYROLL_PAYSLIPS_DOWNLOAD,
  PERMISSIONS.PAYROLL_REPORTS_READ,
  PERMISSIONS.PAYROLL_HISTORY_READ,
  ...PAYROLL_EMPLOYEE,
] as const;

const ONBOARDING_HR = [
  PERMISSIONS.ONBOARDING_READ,
  PERMISSIONS.ONBOARDING_MANAGE,
  PERMISSIONS.ONBOARDING_TASK_UPDATE,
  PERMISSIONS.OFFBOARDING_READ,
  PERMISSIONS.OFFBOARDING_MANAGE,
  PERMISSIONS.OFFBOARDING_TASK_UPDATE,
  PERMISSIONS.OFFBOARDING_SENSITIVE_READ,
] as const;

const ONBOARDING_SELF = [
  PERMISSIONS.ONBOARDING_READ,
  PERMISSIONS.ONBOARDING_TASK_UPDATE,
  PERMISSIONS.OFFBOARDING_READ,
] as const;

const PERFORMANCE_HR = [
  PERMISSIONS.PERFORMANCE_CYCLES_READ,
  PERMISSIONS.PERFORMANCE_CYCLES_MANAGE,
  PERMISSIONS.PERFORMANCE_GOALS_READ_SELF,
  PERMISSIONS.PERFORMANCE_GOALS_MANAGE,
  PERMISSIONS.PERFORMANCE_REVIEWS_READ_SELF,
  PERMISSIONS.PERFORMANCE_REVIEWS_READ_ALL,
  PERMISSIONS.PERFORMANCE_REVIEWS_SUBMIT_SELF,
  PERMISSIONS.PERFORMANCE_REVIEWS_SUBMIT_MANAGER,
  PERMISSIONS.PERFORMANCE_REVIEWS_MANAGE,
  PERMISSIONS.PERFORMANCE_REVIEWS_INTERNAL_NOTES_READ,
] as const;

const PERFORMANCE_MANAGER = [
  PERMISSIONS.PERFORMANCE_CYCLES_READ,
  PERMISSIONS.PERFORMANCE_GOALS_READ_SELF,
  PERMISSIONS.PERFORMANCE_GOALS_MANAGE,
  PERMISSIONS.PERFORMANCE_REVIEWS_READ_SELF,
  PERMISSIONS.PERFORMANCE_REVIEWS_READ_TEAM,
  PERMISSIONS.PERFORMANCE_REVIEWS_SUBMIT_SELF,
  PERMISSIONS.PERFORMANCE_REVIEWS_SUBMIT_MANAGER,
] as const;

const PERFORMANCE_SELF = [
  PERMISSIONS.PERFORMANCE_CYCLES_READ,
  PERMISSIONS.PERFORMANCE_GOALS_READ_SELF,
  PERMISSIONS.PERFORMANCE_REVIEWS_READ_SELF,
  PERMISSIONS.PERFORMANCE_REVIEWS_SUBMIT_SELF,
] as const;

const LEARNING_HR = [
  PERMISSIONS.LEARNING_PROGRAMS_READ,
  PERMISSIONS.LEARNING_PROGRAMS_MANAGE,
  PERMISSIONS.LEARNING_ENROLLMENT_CREATE,
  PERMISSIONS.LEARNING_ENROLLMENT_READ_SELF,
  PERMISSIONS.LEARNING_ENROLLMENT_READ_ALL,
  PERMISSIONS.LEARNING_ENROLLMENT_MANAGE,
  PERMISSIONS.LEARNING_CERTIFICATES_READ_SELF,
  PERMISSIONS.LEARNING_CERTIFICATES_MANAGE,
] as const;

const LEARNING_MANAGER = [
  PERMISSIONS.LEARNING_PROGRAMS_READ,
  PERMISSIONS.LEARNING_ENROLLMENT_CREATE,
  PERMISSIONS.LEARNING_ENROLLMENT_READ_SELF,
  PERMISSIONS.LEARNING_ENROLLMENT_READ_ALL,
  PERMISSIONS.LEARNING_ENROLLMENT_MANAGE,
  PERMISSIONS.LEARNING_CERTIFICATES_READ_SELF,
] as const;

const LEARNING_SELF = [
  PERMISSIONS.LEARNING_PROGRAMS_READ,
  PERMISSIONS.LEARNING_ENROLLMENT_CREATE,
  PERMISSIONS.LEARNING_ENROLLMENT_READ_SELF,
  PERMISSIONS.LEARNING_CERTIFICATES_READ_SELF,
] as const;

const REPORTS_HR = [
  PERMISSIONS.REPORTS_HR_READ,
  PERMISSIONS.REPORTS_EMPLOYEE_READ,
  PERMISSIONS.REPORTS_ATTENDANCE_READ,
  PERMISSIONS.REPORTS_LEAVE_READ,
  PERMISSIONS.REPORTS_OVERTIME_READ,
  PERMISSIONS.REPORTS_PAYROLL_READ,
  PERMISSIONS.REPORTS_EXPORT,
] as const;

const REPORTS_MANAGER = [
  PERMISSIONS.REPORTS_EMPLOYEE_READ,
  PERMISSIONS.REPORTS_ATTENDANCE_READ,
  PERMISSIONS.REPORTS_LEAVE_READ,
  PERMISSIONS.REPORTS_OVERTIME_READ,
] as const;

const REPORTS_PAYROLL = [
  PERMISSIONS.REPORTS_OVERTIME_READ,
  PERMISSIONS.REPORTS_PAYROLL_READ,
  PERMISSIONS.REPORTS_EXPORT,
] as const;

export interface RoleDefinition {
  code: RoleCode;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: readonly PermissionCode[];
}

export const ROLE_DEFINITIONS: readonly RoleDefinition[] = [
  {
    code: ROLE_CODES.SUPER_ADMIN,
    name: "Super Administrator",
    description: "Full access, including user and role administration",
    isSystem: true,
    permissions: ALL_PERMISSIONS,
  },
  {
    code: ROLE_CODES.HR_ADMIN,
    name: "HR Administrator",
    description: "Manages accounts, the organization and employee records",
    isSystem: false,
    permissions: [
      ...SELF_SERVICE,
      ...LEAVE_SELF,
      ...LEAVE_ADMIN,
      ...OVERTIME_SELF,
      ...OVERTIME_ADMIN,
      ...PAYROLL_HR,
      ...ONBOARDING_HR,
      ...PERFORMANCE_HR,
      ...LEARNING_HR,
      ...REPORTS_HR,
      PERMISSIONS.USER_READ,
      PERMISSIONS.USER_CREATE,
      PERMISSIONS.USER_UPDATE,
      PERMISSIONS.USER_DEACTIVATE,
      PERMISSIONS.USER_ASSIGN_ROLE,
      PERMISSIONS.ROLE_READ,
      ...ORGANIZATION_READ,
      ...ORGANIZATION_WRITE,
      PERMISSIONS.EMPLOYEE_READ,
      PERMISSIONS.EMPLOYEE_CREATE,
      PERMISSIONS.EMPLOYEE_UPDATE,
      PERMISSIONS.EMPLOYEE_DEACTIVATE,
      PERMISSIONS.EMPLOYEE_READ_SENSITIVE,
      PERMISSIONS.EMPLOYEE_MANAGE_DOCUMENTS,
      PERMISSIONS.EMPLOYEE_MANAGE_USER_ACCOUNT,
      PERMISSIONS.WORK_SCHEDULE_READ,
      PERMISSIONS.WORK_SCHEDULE_CREATE,
      PERMISSIONS.WORK_SCHEDULE_UPDATE,
      PERMISSIONS.WORK_SCHEDULE_DEACTIVATE,
      PERMISSIONS.SHIFT_READ,
      PERMISSIONS.SHIFT_CREATE,
      PERMISSIONS.SHIFT_UPDATE,
      PERMISSIONS.SHIFT_DEACTIVATE,
      ...ATTENDANCE_READ_ALL,
      PERMISSIONS.ATTENDANCE_CORRECTION_READ,
      PERMISSIONS.ATTENDANCE_CORRECTION_CREATE,
      PERMISSIONS.ATTENDANCE_CORRECTION_REVIEW,
      PERMISSIONS.HOLIDAY_READ,
      PERMISSIONS.HOLIDAY_CREATE,
      PERMISSIONS.HOLIDAY_UPDATE,
      PERMISSIONS.HOLIDAY_DEACTIVATE,
    ],
  },
  {
    code: ROLE_CODES.MANAGER,
    name: "Manager",
    description: "Reads the organization and the manager's own reporting line",
    isSystem: false,
    permissions: [
      ...SELF_SERVICE,
      ...LEAVE_SELF,
      ...LEAVE_TEAM,
      ...OVERTIME_SELF,
      ...OVERTIME_TEAM,
      ...ONBOARDING_SELF,
      ...PERFORMANCE_MANAGER,
      ...LEARNING_MANAGER,
      ...REPORTS_MANAGER,
      PERMISSIONS.OVERTIME_POLICY_READ,
      ...ORGANIZATION_READ,
      PERMISSIONS.EMPLOYEE_READ_TEAM,
      PERMISSIONS.WORK_SCHEDULE_READ,
      PERMISSIONS.SHIFT_READ,
      PERMISSIONS.HOLIDAY_READ,
      PERMISSIONS.ATTENDANCE_READ,
      PERMISSIONS.ATTENDANCE_READ_TEAM,
      PERMISSIONS.ATTENDANCE_CORRECTION_READ,
      PERMISSIONS.ATTENDANCE_CORRECTION_REVIEW,
    ],
  },
  {
    code: ROLE_CODES.PAYROLL_OFFICER,
    name: "Payroll Officer",
    description: "Runs payroll processing, adjustments, reports, and payslips",
    isSystem: false,
    permissions: [
      ...SELF_SERVICE,
      ...LEAVE_SELF,
      ...OVERTIME_SELF,
      ...PAYROLL_OFFICER,
      ...REPORTS_PAYROLL,
      PERMISSIONS.LEARNING_PROGRAMS_READ,
      PERMISSIONS.OVERTIME_READ_ALL,
      PERMISSIONS.OVERTIME_EXPORT,
      PERMISSIONS.OVERTIME_POLICY_READ,
      ...ORGANIZATION_READ,
      PERMISSIONS.HOLIDAY_READ,
      PERMISSIONS.ATTENDANCE_READ,
      PERMISSIONS.ATTENDANCE_READ_ALL,
      PERMISSIONS.ATTENDANCE_EXPORT,
    ],
  },
  {
    code: ROLE_CODES.EMPLOYEE,
    name: "Employee",
    description: "Self-service access for employees",
    isSystem: false,
    permissions: [
      ...SELF_SERVICE,
      ...LEAVE_SELF,
      ...OVERTIME_SELF,
      ...PAYROLL_EMPLOYEE,
      ...ONBOARDING_SELF,
      ...PERFORMANCE_SELF,
      ...LEARNING_SELF,
      PERMISSIONS.WORK_SCHEDULE_READ,
      PERMISSIONS.SHIFT_READ,
      PERMISSIONS.HOLIDAY_READ,
      PERMISSIONS.LEAVE_TYPE_READ,
      ...ATTENDANCE_SELF,
    ],
  },
];
