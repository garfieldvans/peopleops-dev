import { Badge, Button, Divider, Stack, Typography, useTheme } from "@nemo-ui/ui";
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
    if (item.anyPermission) return item.anyPermission.some((permission) => hasPermission(permission));
    return !item.permission || hasPermission(item.permission);
  });

  return (
    <div className="min-h-screen md:flex">
      <aside className="w-full shrink-0 border-b border-[var(--nemo-neutral-200)] bg-[var(--nemo-neutral-0)] md:min-h-screen md:w-64 md:border-r md:border-b-0">
        <div className="px-5 py-5">
          <Typography variant="h5" as="p">
            PeopleOps
          </Typography>
          <Typography variant="caption" color="neutral">
            Human resources
          </Typography>
        </div>
        <Divider />
        <nav className="flex gap-1 overflow-x-auto px-3 py-3 md:flex-col" aria-label="Main">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"} className={navClassName}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden px-5 py-4 md:block">
          <Typography variant="caption" color="neutral">
            Signed in as
          </Typography>
          <Typography variant="bodySmall">{user?.name}</Typography>
          <Typography variant="caption" color="neutral">
            {user?.email}
          </Typography>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--nemo-neutral-200)] bg-[var(--nemo-neutral-0)] px-5 py-3">
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
          <Outlet />
        </main>
      </div>
    </div>
  );
}
