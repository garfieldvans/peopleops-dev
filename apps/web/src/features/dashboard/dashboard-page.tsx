import { Badge, Card, CardBody, CardHeader, Stack, Typography } from "@nemo-ui/ui";
import { Link } from "react-router-dom";
import { PERMISSIONS } from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";

export function DashboardPage() {
  const { user, hasPermission } = useAuth();

  return (
    <Stack spacing={24}>
      <Stack spacing={4}>
        <Typography variant="h4" as="h1">
          Welcome, {user?.name}
        </Typography>
        <Typography variant="bodySmall" color="neutral">
          Phase 2 — authentication and access control
        </Typography>
      </Stack>

      <div className="grid gap-4 md:grid-cols-2">
        <Card variant="elevated" padding="lg">
          <CardHeader title="Your access" subtitle="Roles and permissions from the API" />
          <CardBody>
            <Stack spacing={12}>
              <Stack direction="row" spacing={8} wrap>
                {user?.roles.map((role) => (                    <Badge key={role.id} variant="filled" color="primary">
                    {role.name}
                  </Badge>
                ))}
              </Stack>
              <Typography variant="bodySmall" color="neutral">
                {user?.permissions.length ?? 0} permissions granted
              </Typography>
              <Typography variant="caption" color="neutral">
                Session expires {user ? new Date(user.session.expiresAt).toLocaleString() : "—"}
              </Typography>
            </Stack>
          </CardBody>
        </Card>

        <Card variant="elevated" padding="lg">
          <CardHeader title="Administration" subtitle="Available based on your permissions" />
          <CardBody>
            <Stack spacing={8}>
              {hasPermission(PERMISSIONS.USER_READ) ? (
                <Link to="/users" className="text-sm text-[var(--nemo-primary-700)] underline">
                  Manage users
                </Link>
              ) : null}
              {hasPermission(PERMISSIONS.ROLE_READ) ? (
                <Link to="/roles" className="text-sm text-[var(--nemo-primary-700)] underline">
                  Manage roles and permissions
                </Link>
              ) : null}
              {!hasPermission(PERMISSIONS.USER_READ) &&
              !hasPermission(PERMISSIONS.ROLE_READ) ? (
                <Typography variant="bodySmall" color="neutral">
                  Your account has no administration permissions. Employee modules arrive in the
                  next phase.
                </Typography>
              ) : null}
            </Stack>
          </CardBody>
        </Card>
      </div>
    </Stack>
  );
}
