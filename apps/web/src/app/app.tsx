import { Navigate, Route, Routes } from "react-router-dom";
import { PERMISSIONS } from "@peopleops/shared-types";
import { AuthProvider } from "../features/auth/auth-context";
import { LoginPage } from "../features/auth/login-page";
import {
  RequireAnyPermission,
  RequireAuth,
  RequirePermission,
} from "../features/auth/require-auth";
import { AttendanceCorrectionsPage } from "../features/attendance/attendance-corrections-page";
import { AttendanceDetailPage } from "../features/attendance/attendance-detail-page";
import { AttendanceManagementPage } from "../features/attendance/attendance-management-page";
import { EmployeeSchedulesPage } from "../features/attendance/employee-schedules-page";
import { HolidaysPage } from "../features/attendance/holidays-page";
import { MyAttendancePage } from "../features/attendance/my-attendance-page";
import { ShiftsPage } from "../features/attendance/shifts-page";
import { WorkSchedulesPage } from "../features/attendance/work-schedules-page";
import { DashboardPage } from "../features/dashboard/dashboard-page";
import { EmployeeDetailPage } from "../features/employees/employee-detail-page";
import { EmployeeFormPage } from "../features/employees/employee-form-page";
import { EmployeesPage } from "../features/employees/employees-page";
import { ForbiddenPage } from "../features/forbidden/forbidden-page";
import { LeaveApprovalInboxPage } from "../features/leave/leave-approval-inbox-page";
import { LeaveBalanceManagementPage } from "../features/leave/leave-balance-management-page";
import { LeaveCalendarPage } from "../features/leave/leave-calendar-page";
import { LeaveDashboardPage } from "../features/leave/leave-dashboard-page";
import { LeavePoliciesPage } from "../features/leave/leave-policies-page";
import { LeavePolicyAssignmentsPage } from "../features/leave/leave-policy-assignments-page";
import { LeaveReportsPage } from "../features/leave/leave-reports-page";
import { LeaveRequestDetailPage } from "../features/leave/leave-request-detail-page";
import { LeaveRequestFormPage } from "../features/leave/leave-request-form-page";
import { LeaveTransactionsPage } from "../features/leave/leave-transactions-page";
import { LeaveTypesPage } from "../features/leave/leave-types-page";
import { MyLeaveBalancePage } from "../features/leave/my-leave-balance-page";
import { MyLeaveRequestsPage } from "../features/leave/my-leave-requests-page";
import { TeamLeaveRequestsPage } from "../features/leave/team-leave-requests-page";
import { BranchesPage } from "../features/organization/branches-page";
import { CompanyPage } from "../features/organization/company-page";
import { DepartmentsPage } from "../features/organization/departments-page";
import { JobLevelsPage } from "../features/organization/job-levels-page";
import { PositionsPage } from "../features/organization/positions-page";
import { RolesPage } from "../features/roles/roles-page";
import { UsersPage } from "../features/users/users-page";
import { AppShell } from "./app-shell";

export function App() {
  return (
    <AuthProvider>
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
                  permissions={[PERMISSIONS.ATTENDANCE_READ_ALL, PERMISSIONS.ATTENDANCE_READ_TEAM]}
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
                <RequireAnyPermission
                  permissions={[
                    PERMISSIONS.LEAVE_REQUEST_READ,
                    PERMISSIONS.LEAVE_REQUEST_READ_TEAM,
                    PERMISSIONS.LEAVE_REQUEST_READ_ALL,
                  ]}
                >
                  <LeaveDashboardPage />
                </RequireAnyPermission>
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
            <Route path="forbidden" element={<ForbiddenPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
