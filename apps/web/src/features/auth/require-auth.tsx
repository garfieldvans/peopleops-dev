import { Spinner, Stack, Typography } from "@nemo-ui/ui";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./auth-context";
import type { ReactNode } from "react";

export function FullPageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Stack direction="row" spacing={12} align="center">
        <Spinner />
        <Typography variant="bodySmall" color="neutral">
          {label}
        </Typography>
      </Stack>
    </div>
  );
}

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <FullPageLoader label="Restoring your session…" />;
  }

  if (status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export function RequireAnyPermission({
  permissions,
  children,
}: {
  permissions: string[];
  children: ReactNode;
}) {
  const { hasPermission } = useAuth();

  if (!permissions.some((permission) => hasPermission(permission))) {
    return <Navigate to="/forbidden" replace />;
  }

  return children;
}

export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) {
    return <Navigate to="/forbidden" replace />;
  }

  return children;
}
