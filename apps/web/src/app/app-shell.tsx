import { Badge, Button, Divider, Spinner, Stack, Typography, useTheme } from "@nemo-ui/ui";
import { Suspense } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { PERMISSIONS } from "@peopleops/shared-types";
import { useAuth } from "../features/auth/auth-context";
import { useThemeStore } from "../stores/theme-store";

interface NavItem {
  to: string;
  label: string;
  permission?: string;
  anyPermission?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Overview" },
  {
    to: "/attendance/me",
    label: "My attendance",
    permission: PERMISSIONS.ATTENDANCE_READ,
  },
  {
    to: "/attendance",
    label: "Attendance",
    anyPermission: [PERMISSIONS.ATTENDANCE_READ_ALL, PERMISSIONS.ATTENDANCE_READ_TEAM],
  },
  {
    to: "/attendance/corrections",
    label: "Corrections",
    permission: PERMISSIONS.ATTENDANCE_CORRECTION_READ,
  },
  {
    to: "/attendance/schedules",
    label: "Work schedules",
    permission: PERMISSIONS.WORK_SCHEDULE_READ,
  },
  { to: "/attendance/shifts", label: "Shifts", permission: PERMISSIONS.SHIFT_READ },
  {
    to: "/attendance/assignments",
    label: "Schedule assignments",
    permission: PERMISSIONS.EMPLOYEE_READ,
  },
  { to: "/attendance/holidays", label: "Holidays", permission: PERMISSIONS.HOLIDAY_READ },
  {
    to: "/leave",
    label: "Leave",
    permission: PERMISSIONS.LEAVE_REQUEST_READ,
  },
  { to: "/leave/requests", label: "My leave", permission: PERMISSIONS.LEAVE_REQUEST_READ },
  { to: "/leave/balances", label: "My leave balance", permission: PERMISSIONS.LEAVE_BALANCE_READ },
  {
    to: "/leave/team",
    label: "Team leave",
    anyPermission: [PERMISSIONS.LEAVE_REQUEST_READ_TEAM, PERMISSIONS.LEAVE_REQUEST_READ_ALL],
  },
  {
    to: "/leave/approvals",
    label: "Leave approvals",
    permission: PERMISSIONS.LEAVE_REQUEST_APPROVE,
  },
  { to: "/leave/calendar", label: "Leave calendar", permission: PERMISSIONS.LEAVE_REQUEST_READ },
  { to: "/leave/types", label: "Leave types", permission: PERMISSIONS.LEAVE_TYPE_READ },
  { to: "/leave/policies", label: "Leave policies", permission: PERMISSIONS.LEAVE_POLICY_READ },
  {
    to: "/leave/assignments",
    label: "Leave assignments",
    permission: PERMISSIONS.LEAVE_POLICY_READ,
  },
  {
    to: "/leave/balance-management",
    label: "Leave balances",
    permission: PERMISSIONS.LEAVE_BALANCE_READ_ALL,
  },
  {
    to: "/leave/transactions",
    label: "Leave transactions",
    permission: PERMISSIONS.LEAVE_TRANSACTION_READ,
  },
  { to: "/leave/reports", label: "Leave reports", permission: PERMISSIONS.LEAVE_REPORT_READ },
  {
    to: "/overtime",
    label: "Overtime",
    permission: PERMISSIONS.OVERTIME_READ_SELF,
  },
  {
    to: "/overtime/requests",
    label: "My overtime",
    permission: PERMISSIONS.OVERTIME_READ_SELF,
  },
  {
    to: "/overtime/team",
    label: "Team overtime",
    anyPermission: [PERMISSIONS.OVERTIME_READ_TEAM, PERMISSIONS.OVERTIME_READ_ALL],
  },
  {
    to: "/overtime/approvals",
    label: "Overtime approvals",
    permission: PERMISSIONS.OVERTIME_APPROVE,
  },
  {
    to: "/overtime/verification",
    label: "Overtime verification",
    permission: PERMISSIONS.OVERTIME_VERIFY,
  },
  {
    to: "/overtime/policies",
    label: "Overtime policies",
    permission: PERMISSIONS.OVERTIME_POLICY_READ,
  },
  {
    to: "/overtime/assignments",
    label: "Overtime assignments",
    permission: PERMISSIONS.OVERTIME_POLICY_READ,
  },
  {
    to: "/overtime/reports",
    label: "Overtime reports",
    anyPermission: [PERMISSIONS.OVERTIME_READ_TEAM, PERMISSIONS.OVERTIME_READ_ALL],
  },
  { to: "/payroll", label: "Payroll", permission: PERMISSIONS.PAYROLL_RUNS_READ },
  {
    to: "/payroll/compensation",
    label: "Compensation",
    permission: PERMISSIONS.PAYROLL_COMPENSATION_READ,
  },
  {
    to: "/payroll/components",
    label: "Payroll components",
    permission: PERMISSIONS.PAYROLL_COMPONENTS_READ,
  },
  {
    to: "/payroll/assignments",
    label: "Payroll assignments",
    permission: PERMISSIONS.PAYROLL_COMPONENTS_READ,
  },
  {
    to: "/payroll/periods",
    label: "Payroll periods",
    permission: PERMISSIONS.PAYROLL_PERIODS_READ,
  },
  { to: "/payroll/runs", label: "Payroll runs", permission: PERMISSIONS.PAYROLL_RUNS_READ },
  {
    to: "/payroll/adjustments",
    label: "Payroll adjustments",
    permission: PERMISSIONS.PAYROLL_ADJUSTMENTS_READ,
  },
  {
    to: "/payroll/payslips",
    label: "Payslips",
    anyPermission: [
      PERMISSIONS.PAYROLL_PAYSLIPS_READ_SELF,
      PERMISSIONS.PAYROLL_PAYSLIPS_READ_ALL,
    ],
  },
  {
    to: "/payroll/reports",
    label: "Payroll reports",
    permission: PERMISSIONS.PAYROLL_REPORTS_READ,
  },
  { to: "/employees/me", label: "My profile", permission: PERMISSIONS.EMPLOYEE_READ_SELF },
  {
    to: "/employees",
    label: "Employees",
    anyPermission: [
      PERMISSIONS.EMPLOYEE_READ,
      PERMISSIONS.EMPLOYEE_READ_SENSITIVE,
      PERMISSIONS.EMPLOYEE_READ_TEAM,
    ],
  },
  { to: "/users", label: "Users", permission: PERMISSIONS.USER_READ },
  { to: "/roles", label: "Roles", permission: PERMISSIONS.ROLE_READ },
  { to: "/organization/company", label: "Company profile", permission: PERMISSIONS.COMPANY_READ },
  { to: "/organization/branches", label: "Branches", permission: PERMISSIONS.BRANCH_READ },
  {
    to: "/organization/departments",
    label: "Departments",
    permission: PERMISSIONS.DEPARTMENT_READ,
  },
  { to: "/organization/positions", label: "Positions", permission: PERMISSIONS.POSITION_READ },
  { to: "/organization/job-levels", label: "Job levels", permission: PERMISSIONS.JOB_LEVEL_READ },
];

function navClassName({ isActive }: { isActive: boolean }): string {
  return [
    "block rounded-md px-3 py-2 text-sm transition-colors",
    isActive
      ? "bg-[var(--nemo-primary-50)] font-medium text-[var(--nemo-primary-700)]"
      : "text-[var(--nemo-neutral-700)] hover:bg-[var(--nemo-neutral-100)]",
  ].join(" ");
}

export function AppShell() {
  const { user, logout, hasPermission } = useAuth();
  const { mode, toggle } = useThemeStore();
  const { setMode } = useTheme();
  const items = NAV_ITEMS.filter((item) => {
    if (item.anyPermission)
      return item.anyPermission.some((permission) => hasPermission(permission));
    return !item.permission || hasPermission(item.permission);
  });

  return (
    <div className="min-h-screen md:flex">
      <aside className="w-full shrink-0 border-b border-[var(--nemo-neutral-200)] bg-[var(--nemo-neutral-0)] md:sticky md:top-0 md:flex md:h-screen md:w-64 md:flex-col md:overflow-hidden md:border-r md:border-b-0">
        <div className="px-5 py-5">
          <Typography variant="h5" as="p">
            PeopleOps
          </Typography>
          <Typography variant="caption" color="neutral">
            Human resources
          </Typography>
        </div>
        <Divider />
        <nav
          className="flex gap-1 overflow-x-auto px-3 py-3 md:min-h-0 md:flex-1 md:flex-col md:overflow-y-auto"
          aria-label="Main"
        >
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={
                item.to === "/" ||
                item.to === "/leave" ||
                item.to === "/overtime" ||
                item.to === "/payroll"
              }
              className={navClassName}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden shrink-0 border-t border-[var(--nemo-neutral-200)] px-5 py-4 md:block">
          <Typography variant="caption" color="neutral">
            Signed in as
          </Typography>
          <div className="mt-1 min-w-0">
            <Typography variant="bodySmall" className="block truncate">
              {user?.name}
            </Typography>
            <Typography variant="caption" color="neutral" className="block truncate">
              {user?.email}
            </Typography>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--nemo-neutral-200)] bg-[var(--nemo-neutral-0)] px-5 py-3">
          <Stack direction="row" spacing={8} align="center" wrap>
            {user?.roles.map((role) => (
              <Badge key={role.id} variant="outlined" color="primary">
                {role.name}
              </Badge>
            ))}
          </Stack>
          <Stack direction="row" spacing={8} align="center">
            <Button
              variant="text"
              onClick={() => {
                const next = mode === "light" ? "dark" : "light";
                toggle();
                setMode(next);
              }}
            >
              {mode === "light" ? "Dark mode" : "Light mode"}
            </Button>
            <Button variant="outlined" onClick={() => void logout()}>
              Sign out
            </Button>
          </Stack>
        </header>

        <main className="min-w-0 flex-1 px-5 py-6">
          <Suspense
            fallback={
              <Stack direction="row" spacing={12} align="center">
                <Spinner />
                <Typography variant="bodySmall" color="neutral">
                  Loading page…
                </Typography>
              </Stack>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
