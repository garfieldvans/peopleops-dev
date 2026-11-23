import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Spinner,
  Stack,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import type { HealthResponse } from "@peopleops/shared-types";
import type { ReactNode } from "react";
import { useThemeStore } from "../../stores/theme-store";
import { useHealth } from "./use-health";

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function StatusRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack direction="row" justify="between" align="center" spacing={16}>
      <Typography variant="bodySmall" color="neutral">
        {label}
      </Typography>
      <Stack direction="row" spacing={8} align="center">
        {children}
      </Stack>
    </Stack>
  );
}

function HealthSummary({ health }: { health: HealthResponse }) {
  const databaseUp = health.checks.database.status === "up";

  return (
    <Stack spacing={12}>
      <StatusRow label="API">
        <Badge variant="filled" color={health.status === "ok" ? "success" : "warning"}>
          {health.status === "ok" ? "operational" : "degraded"}
        </Badge>
      </StatusRow>
      <StatusRow label="Database">
        <Badge variant="filled" color={databaseUp ? "success" : "error"}>
          {databaseUp ? "up" : "down"}
        </Badge>
        {health.checks.database.latencyMs !== null ? (
          <Typography variant="caption" color="neutral">
            {health.checks.database.latencyMs} ms
          </Typography>
        ) : null}
      </StatusRow>
      <Divider />
      <StatusRow label="Environment">
        <Typography variant="bodySmall">{health.environment}</Typography>
      </StatusRow>
      <StatusRow label="Company timezone">
        <Typography variant="bodySmall">{health.timezone}</Typography>
      </StatusRow>
      <StatusRow label="Uptime">
        <Typography variant="bodySmall">{formatUptime(health.uptimeSeconds)}</Typography>
      </StatusRow>
      <StatusRow label="API version">
        <Typography variant="bodySmall">{health.version}</Typography>
      </StatusRow>
      <StatusRow label="Last checked">
        <Typography variant="bodySmall">{new Date(health.timestamp).toLocaleTimeString()}</Typography>
      </StatusRow>
    </Stack>
  );
}

export function SystemStatusPage() {
  const { data, error, isPending, isFetching, refetch } = useHealth();
  const { mode, toggle } = useThemeStore();
  const toast = useToast();

  async function handleRefresh() {
    const result = await refetch();
    if (result.isError) {
      toast.error("API is unreachable");
    } else {
      toast.success("API is reachable");
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <Stack spacing={24}>
        <Stack direction="row" justify="between" align="center" wrap spacing={16}>
          <Stack spacing={4}>
            <Typography variant="h4" as="h1">
              PeopleOps
            </Typography>
            <Typography variant="bodySmall" color="neutral">
              Phase 1 — project foundation
            </Typography>
          </Stack>
          <Stack direction="row" spacing={8} wrap>
            <Button variant="outlined" onClick={toggle}>
              {mode === "light" ? "Dark mode" : "Light mode"}
            </Button>
            <Button
              onClick={() => {
                window.open("/api/docs", "_blank", "noopener,noreferrer");
              }}
            >
              API docs
            </Button>
          </Stack>
        </Stack>

        <Card variant="elevated" padding="lg">
          <CardHeader
            title="System status"
            subtitle="Live check from the browser to GET /api/v1/health"
            action={
              <Button variant="text" onClick={handleRefresh} disabled={isFetching}>
                {isFetching ? "Checking…" : "Check again"}
              </Button>
            }
          />
          <CardBody>
            {isPending ? (
              <Stack direction="row" spacing={12} align="center">
                <Spinner />
                <Typography variant="bodySmall" color="neutral">
                  Contacting the API…
                </Typography>
              </Stack>
            ) : error ? (
              <Alert
                tone="error"
                title="API unreachable"
                action={
                  <Button variant="text" color="error" onClick={handleRefresh}>
                    Retry
                  </Button>
                }
              >
                {error instanceof Error ? error.message : "Unknown error"}
              </Alert>
            ) : data ? (
              <HealthSummary health={data} />
            ) : null}
          </CardBody>
        </Card>

        <Typography variant="caption" color="neutral">
          Business modules (authentication, employees, attendance, payroll) start in Phase 2.
        </Typography>
      </Stack>
    </main>
  );
}
