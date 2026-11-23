import { Navigate, Route, Routes } from "react-router-dom";
import { PERMISSIONS } from "@peopleops/shared-types";
import { AuthProvider } from "../features/auth/auth-context";
import { LoginPage } from "../features/auth/login-page";
import {
  RequireAnyPermission,
  RequireAuth,
  RequirePermission,
} from "../features/auth/require-auth";
import { DashboardPage } from "../features/dashboard/dashboard-page";
import { EmployeeDetailPage } from "../features/employees/employee-detail-page";
import { EmployeeFormPage } from "../features/employees/employee-form-page";
import { EmployeesPage } from "../features/employees/employees-page";
import { ForbiddenPage } from "../features/forbidden/forbidden-page";
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
            <Route path="forbidden" element={<ForbiddenPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
