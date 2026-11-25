import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { PERMISSIONS } from "@peopleops/shared-types";
import { AuthProvider } from "../features/auth/auth-context";
import {
  RequireAnyPermission,
  RequireAuth,
  RequirePermission,
} from "../features/auth/require-auth";
import { AppShell } from "./app-shell";

const LoginPage = lazy(() =>
  import("../features/auth/login-page").then((module) => ({ default: module.LoginPage })),
);
const AttendanceCorrectionsPage = lazy(() =>
  import("../features/attendance/attendance-corrections-page").then((module) => ({
    default: module.AttendanceCorrectionsPage,
  })),
);
const AttendanceDetailPage = lazy(() =>
  import("../features/attendance/attendance-detail-page").then((module) => ({
    default: module.AttendanceDetailPage,
  })),
);
const AttendanceManagementPage = lazy(() =>
  import("../features/attendance/attendance-management-page").then((module) => ({
    default: module.AttendanceManagementPage,
  })),
);
const EmployeeSchedulesPage = lazy(() =>
  import("../features/attendance/employee-schedules-page").then((module) => ({
    default: module.EmployeeSchedulesPage,
  })),
);
const HolidaysPage = lazy(() =>
  import("../features/attendance/holidays-page").then((module) => ({
    default: module.HolidaysPage,
  })),
);
const MyAttendancePage = lazy(() =>
  import("../features/attendance/my-attendance-page").then((module) => ({
    default: module.MyAttendancePage,
  })),
);
const ShiftsPage = lazy(() =>
  import("../features/attendance/shifts-page").then((module) => ({ default: module.ShiftsPage })),
);
const WorkSchedulesPage = lazy(() =>
  import("../features/attendance/work-schedules-page").then((module) => ({
    default: module.WorkSchedulesPage,
  })),
);
const DashboardPage = lazy(() =>
  import("../features/dashboard/dashboard-page").then((module) => ({
    default: module.DashboardPage,
  })),
);
const EmployeeDetailPage = lazy(() =>
  import("../features/employees/employee-detail-page").then((module) => ({
    default: module.EmployeeDetailPage,
  })),
);
const EmployeeFormPage = lazy(() =>
  import("../features/employees/employee-form-page").then((module) => ({
    default: module.EmployeeFormPage,
  })),
);
const EmployeesPage = lazy(() =>
  import("../features/employees/employees-page").then((module) => ({
    default: module.EmployeesPage,
  })),
);
const ForbiddenPage = lazy(() =>
  import("../features/forbidden/forbidden-page").then((module) => ({
    default: module.ForbiddenPage,
  })),
);
const LeaveApprovalInboxPage = lazy(() =>
  import("../features/leave/leave-approval-inbox-page").then((module) => ({
    default: module.LeaveApprovalInboxPage,
  })),
);
const LeaveBalanceManagementPage = lazy(() =>
  import("../features/leave/leave-balance-management-page").then((module) => ({
    default: module.LeaveBalanceManagementPage,
  })),
);
const LeaveCalendarPage = lazy(() =>
  import("../features/leave/leave-calendar-page").then((module) => ({
    default: module.LeaveCalendarPage,
  })),
);
const LeaveDashboardPage = lazy(() =>
  import("../features/leave/leave-dashboard-page").then((module) => ({
    default: module.LeaveDashboardPage,
  })),
);
const LeavePoliciesPage = lazy(() =>
  import("../features/leave/leave-policies-page").then((module) => ({
    default: module.LeavePoliciesPage,
  })),
);
const LeavePolicyAssignmentsPage = lazy(() =>
  import("../features/leave/leave-policy-assignments-page").then((module) => ({
    default: module.LeavePolicyAssignmentsPage,
  })),
);
const LeaveReportsPage = lazy(() =>
  import("../features/leave/leave-reports-page").then((module) => ({
    default: module.LeaveReportsPage,
  })),
);
const LeaveRequestDetailPage = lazy(() =>
  import("../features/leave/leave-request-detail-page").then((module) => ({
    default: module.LeaveRequestDetailPage,
  })),
);
const LeaveRequestFormPage = lazy(() =>
  import("../features/leave/leave-request-form-page").then((module) => ({
    default: module.LeaveRequestFormPage,
  })),
);
const LeaveTransactionsPage = lazy(() =>
  import("../features/leave/leave-transactions-page").then((module) => ({
    default: module.LeaveTransactionsPage,
  })),
);
const LeaveTypesPage = lazy(() =>
  import("../features/leave/leave-types-page").then((module) => ({
    default: module.LeaveTypesPage,
  })),
);
const MyLeaveBalancePage = lazy(() =>
  import("../features/leave/my-leave-balance-page").then((module) => ({
    default: module.MyLeaveBalancePage,
  })),
);
const MyLeaveRequestsPage = lazy(() =>
  import("../features/leave/my-leave-requests-page").then((module) => ({
    default: module.MyLeaveRequestsPage,
  })),
);
const TeamLeaveRequestsPage = lazy(() =>
  import("../features/leave/team-leave-requests-page").then((module) => ({
    default: module.TeamLeaveRequestsPage,
  })),
);
const MyOvertimeRequestsPage = lazy(() =>
  import("../features/overtime/my-overtime-requests-page").then((module) => ({
    default: module.MyOvertimeRequestsPage,
  })),
);
const OvertimeApprovalsPage = lazy(() =>
  import("../features/overtime/overtime-approvals-page").then((module) => ({
    default: module.OvertimeApprovalsPage,
  })),
);
const OvertimeAssignmentsPage = lazy(() =>
  import("../features/overtime/overtime-assignments-page").then((module) => ({
    default: module.OvertimeAssignmentsPage,
  })),
);
const OvertimeDashboardPage = lazy(() =>
  import("../features/overtime/overtime-dashboard-page").then((module) => ({
    default: module.OvertimeDashboardPage,
  })),
);
const OvertimePoliciesPage = lazy(() =>
  import("../features/overtime/overtime-policies-page").then((module) => ({
    default: module.OvertimePoliciesPage,
  })),
);
const OvertimeReportsPage = lazy(() =>
  import("../features/overtime/overtime-reports-page").then((module) => ({
    default: module.OvertimeReportsPage,
  })),
);
const OvertimeRequestDetailPage = lazy(() =>
  import("../features/overtime/overtime-request-detail-page").then((module) => ({
    default: module.OvertimeRequestDetailPage,
  })),
);
const OvertimeRequestFormPage = lazy(() =>
  import("../features/overtime/overtime-request-form-page").then((module) => ({
    default: module.OvertimeRequestFormPage,
  })),
);
const OvertimeVerificationPage = lazy(() =>
  import("../features/overtime/overtime-verification-page").then((module) => ({
    default: module.OvertimeVerificationPage,
  })),
);
const TeamOvertimeRequestsPage = lazy(() =>
  import("../features/overtime/team-overtime-requests-page").then((module) => ({
    default: module.TeamOvertimeRequestsPage,
  })),
);
const BranchesPage = lazy(() =>
  import("../features/organization/branches-page").then((module) => ({
    default: module.BranchesPage,
  })),
);
const CompanyPage = lazy(() =>
  import("../features/organization/company-page").then((module) => ({
    default: module.CompanyPage,
  })),
);
const DepartmentsPage = lazy(() =>
  import("../features/organization/departments-page").then((module) => ({
    default: module.DepartmentsPage,
  })),
);
const JobLevelsPage = lazy(() =>
  import("../features/organization/job-levels-page").then((module) => ({
    default: module.JobLevelsPage,
  })),
);
const PositionsPage = lazy(() =>
  import("../features/organization/positions-page").then((module) => ({
    default: module.PositionsPage,
  })),
);
const PayrollDashboardPage = lazy(() =>
  import("../features/payroll/payroll-dashboard-page").then((module) => ({
    default: module.PayrollDashboardPage,
  })),
);
const CompensationPage = lazy(() =>
  import("../features/payroll/compensation-page").then((module) => ({
    default: module.CompensationPage,
  })),
);
const PayrollComponentsPage = lazy(() =>
  import("../features/payroll/payroll-components-page").then((module) => ({
    default: module.PayrollComponentsPage,
  })),
);
const PayrollAssignmentsPage = lazy(() =>
  import("../features/payroll/payroll-assignments-page").then((module) => ({
    default: module.PayrollAssignmentsPage,
  })),
);
const PayrollPeriodsPage = lazy(() =>
  import("../features/payroll/payroll-periods-page").then((module) => ({
    default: module.PayrollPeriodsPage,
  })),
);
const PayrollRunsPage = lazy(() =>
  import("../features/payroll/payroll-runs-page").then((module) => ({
    default: module.PayrollRunsPage,
  })),
);
const PayrollRunDetailPage = lazy(() =>
  import("../features/payroll/payroll-run-detail-page").then((module) => ({
    default: module.PayrollRunDetailPage,
  })),
);
const PayrollAdjustmentsPage = lazy(() =>
  import("../features/payroll/payroll-adjustments-page").then((module) => ({
    default: module.PayrollAdjustmentsPage,
  })),
);
const MyPayslipsPage = lazy(() =>
  import("../features/payroll/my-payslips-page").then((module) => ({
    default: module.MyPayslipsPage,
  })),
);
const PayslipDetailPage = lazy(() =>
  import("../features/payroll/payslip-detail-page").then((module) => ({
    default: module.PayslipDetailPage,
  })),
);
const PayrollReportsPage = lazy(() =>
  import("../features/payroll/payroll-reports-page").then((module) => ({
    default: module.PayrollReportsPage,
  })),
);
const RolesPage = lazy(() =>
  import("../features/roles/roles-page").then((module) => ({ default: module.RolesPage })),
);
const UsersPage = lazy(() =>
  import("../features/users/users-page").then((module) => ({ default: module.UsersPage })),
);

export function App() {
  return (
    <AuthProvider>
      <Suspense
        fallback={<div className="p-6 text-sm text-[var(--nemo-neutral-600)]">Loading page…</div>}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route
                path="users"
                element={
                  <RequirePermission permission={PERMISSIONS.USER_READ}>
                    <UsersPage />
                  </RequirePermission>
                }
              />
              <Route
                path="employees"
                element={
                  <RequireAnyPermission
                    permissions={[
                      PERMISSIONS.EMPLOYEE_READ,
                      PERMISSIONS.EMPLOYEE_READ_SENSITIVE,
                      PERMISSIONS.EMPLOYEE_READ_TEAM,
                    ]}
                  >
                    <EmployeesPage />
                  </RequireAnyPermission>
                }
              />
              <Route
                path="employees/new"
                element={
                  <RequirePermission permission={PERMISSIONS.EMPLOYEE_CREATE}>
                    <EmployeeFormPage mode="create" />
                  </RequirePermission>
                }
              />
              <Route
                path="employees/me"
                element={
                  <RequirePermission permission={PERMISSIONS.EMPLOYEE_READ_SELF}>
                    <EmployeeDetailPage self />
                  </RequirePermission>
                }
              />
              <Route
                path="employees/:id"
                element={
                  <RequireAnyPermission
                    permissions={[
                      PERMISSIONS.EMPLOYEE_READ,
                      PERMISSIONS.EMPLOYEE_READ_SENSITIVE,
                      PERMISSIONS.EMPLOYEE_READ_TEAM,
                      PERMISSIONS.EMPLOYEE_READ_SELF,
                    ]}
                  >
                    <EmployeeDetailPage />
                  </RequireAnyPermission>
                }
              />
              <Route
                path="employees/:id/edit"
                element={
                  <RequirePermission permission={PERMISSIONS.EMPLOYEE_UPDATE}>
                    <EmployeeFormPage mode="edit" />
                  </RequirePermission>
                }
              />
              <Route
                path="attendance"
                element={
                  <RequireAnyPermission
                    permissions={[
                      PERMISSIONS.ATTENDANCE_READ_ALL,
                      PERMISSIONS.ATTENDANCE_READ_TEAM,
                    ]}
                  >
                    <AttendanceManagementPage />
                  </RequireAnyPermission>
                }
              />
              <Route
                path="attendance/me"
                element={
                  <RequirePermission permission={PERMISSIONS.ATTENDANCE_READ}>
                    <MyAttendancePage />
                  </RequirePermission>
                }
              />
              <Route
                path="attendance/schedules"
                element={
                  <RequirePermission permission={PERMISSIONS.WORK_SCHEDULE_READ}>
                    <WorkSchedulesPage />
                  </RequirePermission>
                }
              />
              <Route
                path="attendance/shifts"
                element={
                  <RequirePermission permission={PERMISSIONS.SHIFT_READ}>
                    <ShiftsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="attendance/assignments"
                element={
                  <RequirePermission permission={PERMISSIONS.EMPLOYEE_READ}>
                    <EmployeeSchedulesPage />
                  </RequirePermission>
                }
              />
              <Route
                path="attendance/corrections"
                element={
                  <RequirePermission permission={PERMISSIONS.ATTENDANCE_CORRECTION_READ}>
                    <AttendanceCorrectionsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="attendance/holidays"
                element={
                  <RequirePermission permission={PERMISSIONS.HOLIDAY_READ}>
                    <HolidaysPage />
                  </RequirePermission>
                }
              />
              <Route
                path="attendance/:id"
                element={
                  <RequirePermission permission={PERMISSIONS.ATTENDANCE_READ}>
                    <AttendanceDetailPage />
                  </RequirePermission>
                }
              />
              <Route
                path="roles"
                element={
                  <RequirePermission permission={PERMISSIONS.ROLE_READ}>
                    <RolesPage />
                  </RequirePermission>
                }
              />
              <Route
                path="organization/company"
                element={
                  <RequirePermission permission={PERMISSIONS.COMPANY_READ}>
                    <CompanyPage />
                  </RequirePermission>
                }
              />
              <Route
                path="organization/branches"
                element={
                  <RequirePermission permission={PERMISSIONS.BRANCH_READ}>
                    <BranchesPage />
                  </RequirePermission>
                }
              />
              <Route
                path="organization/departments"
                element={
                  <RequirePermission permission={PERMISSIONS.DEPARTMENT_READ}>
                    <DepartmentsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="organization/positions"
                element={
                  <RequirePermission permission={PERMISSIONS.POSITION_READ}>
                    <PositionsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="organization/job-levels"
                element={
                  <RequirePermission permission={PERMISSIONS.JOB_LEVEL_READ}>
                    <JobLevelsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="leave"
                element={
                  <RequirePermission permission={PERMISSIONS.LEAVE_REQUEST_READ}>
                    <LeaveDashboardPage />
                  </RequirePermission>
                }
              />
              <Route
                path="leave/balances"
                element={
                  <RequirePermission permission={PERMISSIONS.LEAVE_BALANCE_READ}>
                    <MyLeaveBalancePage />
                  </RequirePermission>
                }
              />
              <Route
                path="leave/requests"
                element={
                  <RequirePermission permission={PERMISSIONS.LEAVE_REQUEST_READ}>
                    <MyLeaveRequestsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="leave/requests/new"
                element={
                  <RequirePermission permission={PERMISSIONS.LEAVE_REQUEST_CREATE}>
                    <LeaveRequestFormPage />
                  </RequirePermission>
                }
              />
              <Route
                path="leave/requests/:id"
                element={
                  <RequireAnyPermission
                    permissions={[
                      PERMISSIONS.LEAVE_REQUEST_READ,
                      PERMISSIONS.LEAVE_REQUEST_READ_TEAM,
                      PERMISSIONS.LEAVE_REQUEST_READ_ALL,
                    ]}
                  >
                    <LeaveRequestDetailPage />
                  </RequireAnyPermission>
                }
              />
              <Route
                path="leave/team"
                element={
                  <RequireAnyPermission
                    permissions={[
                      PERMISSIONS.LEAVE_REQUEST_READ_TEAM,
                      PERMISSIONS.LEAVE_REQUEST_READ_ALL,
                    ]}
                  >
                    <TeamLeaveRequestsPage />
                  </RequireAnyPermission>
                }
              />
              <Route
                path="leave/approvals"
                element={
                  <RequirePermission permission={PERMISSIONS.LEAVE_REQUEST_APPROVE}>
                    <LeaveApprovalInboxPage />
                  </RequirePermission>
                }
              />
              <Route
                path="leave/calendar"
                element={
                  <RequireAnyPermission
                    permissions={[
                      PERMISSIONS.LEAVE_REQUEST_READ,
                      PERMISSIONS.LEAVE_REQUEST_READ_TEAM,
                      PERMISSIONS.LEAVE_REQUEST_READ_ALL,
                    ]}
                  >
                    <LeaveCalendarPage />
                  </RequireAnyPermission>
                }
              />
              <Route
                path="leave/types"
                element={
                  <RequirePermission permission={PERMISSIONS.LEAVE_TYPE_READ}>
                    <LeaveTypesPage />
                  </RequirePermission>
                }
              />
              <Route
                path="leave/policies"
                element={
                  <RequirePermission permission={PERMISSIONS.LEAVE_POLICY_READ}>
                    <LeavePoliciesPage />
                  </RequirePermission>
                }
              />
              <Route
                path="leave/assignments"
                element={
                  <RequireAnyPermission
                    permissions={[PERMISSIONS.LEAVE_POLICY_READ, PERMISSIONS.LEAVE_POLICY_ASSIGN]}
                  >
                    <LeavePolicyAssignmentsPage />
                  </RequireAnyPermission>
                }
              />
              <Route
                path="leave/balance-management"
                element={
                  <RequirePermission permission={PERMISSIONS.LEAVE_BALANCE_READ_ALL}>
                    <LeaveBalanceManagementPage />
                  </RequirePermission>
                }
              />
              <Route
                path="leave/transactions"
                element={
                  <RequirePermission permission={PERMISSIONS.LEAVE_TRANSACTION_READ}>
                    <LeaveTransactionsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="leave/reports"
                element={
                  <RequirePermission permission={PERMISSIONS.LEAVE_REPORT_READ}>
                    <LeaveReportsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="overtime"
                element={
                  <RequirePermission permission={PERMISSIONS.OVERTIME_READ_SELF}>
                    <OvertimeDashboardPage />
                  </RequirePermission>
                }
              />
              <Route
                path="overtime/requests"
                element={
                  <RequirePermission permission={PERMISSIONS.OVERTIME_READ_SELF}>
                    <MyOvertimeRequestsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="overtime/requests/new"
                element={
                  <RequirePermission permission={PERMISSIONS.OVERTIME_CREATE}>
                    <OvertimeRequestFormPage />
                  </RequirePermission>
                }
              />
              <Route
                path="overtime/requests/:id"
                element={
                  <RequireAnyPermission
                    permissions={[
                      PERMISSIONS.OVERTIME_READ_SELF,
                      PERMISSIONS.OVERTIME_READ_TEAM,
                      PERMISSIONS.OVERTIME_READ_ALL,
                    ]}
                  >
                    <OvertimeRequestDetailPage />
                  </RequireAnyPermission>
                }
              />
              <Route
                path="overtime/team"
                element={
                  <RequireAnyPermission
                    permissions={[PERMISSIONS.OVERTIME_READ_TEAM, PERMISSIONS.OVERTIME_READ_ALL]}
                  >
                    <TeamOvertimeRequestsPage />
                  </RequireAnyPermission>
                }
              />
              <Route
                path="overtime/approvals"
                element={
                  <RequirePermission permission={PERMISSIONS.OVERTIME_APPROVE}>
                    <OvertimeApprovalsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="overtime/verification"
                element={
                  <RequirePermission permission={PERMISSIONS.OVERTIME_VERIFY}>
                    <OvertimeVerificationPage />
                  </RequirePermission>
                }
              />
              <Route
                path="overtime/policies"
                element={
                  <RequirePermission permission={PERMISSIONS.OVERTIME_POLICY_READ}>
                    <OvertimePoliciesPage />
                  </RequirePermission>
                }
              />
              <Route
                path="overtime/assignments"
                element={
                  <RequireAnyPermission
                    permissions={[
                      PERMISSIONS.OVERTIME_POLICY_READ,
                      PERMISSIONS.OVERTIME_ASSIGNMENT_MANAGE,
                    ]}
                  >
                    <OvertimeAssignmentsPage />
                  </RequireAnyPermission>
                }
              />
              <Route
                path="overtime/reports"
                element={
                  <RequireAnyPermission
                    permissions={[PERMISSIONS.OVERTIME_READ_TEAM, PERMISSIONS.OVERTIME_READ_ALL]}
                  >
                    <OvertimeReportsPage />
                  </RequireAnyPermission>
                }
              />
              <Route
                path="payroll"
                element={
                  <RequirePermission permission={PERMISSIONS.PAYROLL_RUNS_READ}>
                    <PayrollDashboardPage />
                  </RequirePermission>
                }
              />
              <Route
                path="payroll/compensation"
                element={
                  <RequirePermission permission={PERMISSIONS.PAYROLL_COMPENSATION_READ}>
                    <CompensationPage />
                  </RequirePermission>
                }
              />
              <Route
                path="payroll/components"
                element={
                  <RequirePermission permission={PERMISSIONS.PAYROLL_COMPONENTS_READ}>
                    <PayrollComponentsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="payroll/assignments"
                element={
                  <RequirePermission permission={PERMISSIONS.PAYROLL_COMPONENTS_READ}>
                    <PayrollAssignmentsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="payroll/periods"
                element={
                  <RequirePermission permission={PERMISSIONS.PAYROLL_PERIODS_READ}>
                    <PayrollPeriodsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="payroll/runs"
                element={
                  <RequirePermission permission={PERMISSIONS.PAYROLL_RUNS_READ}>
                    <PayrollRunsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="payroll/runs/:id"
                element={
                  <RequirePermission permission={PERMISSIONS.PAYROLL_RUNS_READ}>
                    <PayrollRunDetailPage />
                  </RequirePermission>
                }
              />
              <Route
                path="payroll/adjustments"
                element={
                  <RequirePermission permission={PERMISSIONS.PAYROLL_ADJUSTMENTS_READ}>
                    <PayrollAdjustmentsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="payroll/payslips"
                element={
                  <RequireAnyPermission
                    permissions={[
                      PERMISSIONS.PAYROLL_PAYSLIPS_READ_SELF,
                      PERMISSIONS.PAYROLL_PAYSLIPS_READ_ALL,
                    ]}
                  >
                    <MyPayslipsPage />
                  </RequireAnyPermission>
                }
              />
              <Route
                path="payroll/payslips/:id"
                element={
                  <RequireAnyPermission
                    permissions={[
                      PERMISSIONS.PAYROLL_PAYSLIPS_READ_SELF,
                      PERMISSIONS.PAYROLL_PAYSLIPS_READ_ALL,
                    ]}
                  >
                    <PayslipDetailPage />
                  </RequireAnyPermission>
                }
              />
              <Route
                path="payroll/reports"
                element={
                  <RequirePermission permission={PERMISSIONS.PAYROLL_REPORTS_READ}>
                    <PayrollReportsPage />
                  </RequirePermission>
                }
              />
              <Route path="forbidden" element={<ForbiddenPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
