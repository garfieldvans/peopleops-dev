import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Input,
  Spinner,
  Stack,
  Table,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useState } from "react";
import { PERMISSIONS, type OvertimeSummary } from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError, downloadFile } from "../../lib/http";
import { MetricCard, PageHeading } from "./overtime-ui";
import { formatMinutes, todayKey } from "./overtime-utils";

function currentYearStart(): string {
  return `${new Date().getFullYear()}-01-01`;
}

export function OvertimeReportsPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [from, setFrom] = useState(currentYearStart());
  const [to, setTo] = useState(todayKey());

  const params = new URLSearchParams({ from, to });
  const summaryQuery = useQuery({
    queryKey: ["overtime", "reports", params.toString()],
    queryFn: () => apiRequest<OvertimeSummary>(`/overtime/summary?${params.toString()}`),
    enabled: Boolean(from && to),
  });

  const exportMutation = useMutation({
    mutationFn: () => downloadFile(`/overtime/export?${params.toString()}`, `overtime-${to}.csv`),
    onSuccess: () => toast.success("Overtime report downloaded"),
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not export the report"),
  });

  const summary = summaryQuery.data;

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Overtime reports"
        description="Requested, actual, and verified overtime inside your reporting scope"
        actions={
          hasPermission(PERMISSIONS.OVERTIME_EXPORT) ? (
            <Button
              variant="outlined"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
            >
              {exportMutation.isPending ? "Preparing CSV…" : "Export CSV"}
            </Button>
          ) : undefined
        }
      />

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                label="From"
                type="date"
                value={from}
                max={to}
                onChange={(event) => setFrom(event.target.value)}
                required
                fullWidth
              />
              <Input
                label="To"
                type="date"
                value={to}
                min={from}
                onChange={(event) => setTo(event.target.value)}
                required
                fullWidth
              />
            </div>

            {summaryQuery.isPending ? (
              <Stack direction="row" spacing={12} align="center">
                <Spinner />
                <Typography variant="bodySmall" color="neutral">
                  Building report…
                </Typography>
              </Stack>
            ) : summaryQuery.isError ? (
              <Alert tone="error" title="Could not load the overtime report">
                {summaryQuery.error instanceof ApiRequestError
                  ? summaryQuery.error.message
                  : "Unexpected error"}
              </Alert>
            ) : summary ? (
              <Stack spacing={16}>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Requests" value={summary.requestCount} />
                  <MetricCard label="Pending approvals" value={summary.pendingApprovals} />
                  <MetricCard label="Pending verification" value={summary.pendingVerification} />
                  <MetricCard label="Verified requests" value={summary.verifiedCount} />
                  <MetricCard label="Requested" value={formatMinutes(summary.requestedMinutes)} />
                  <MetricCard label="Actual" value={formatMinutes(summary.actualMinutes)} />
                  <MetricCard label="Verified" value={formatMinutes(summary.verifiedMinutes)} />
                </div>

                <Table
                  columns={[
                    {
                      key: "employee",
                      header: "Employee",
                      render: (row) => (
                        <Stack spacing={1}>
                          <Typography variant="bodySmall" className="font-medium">
                            {row.employeeName}
                          </Typography>
                          <Typography variant="caption" color="neutral">
                            {row.employeeNumber}
                          </Typography>
                        </Stack>
                      ),
                    },
                    {
                      key: "org",
                      header: "Branch / Department",
                      render: (row) => (
                        <Stack spacing={1}>
                          <Typography variant="bodySmall">{row.branch ?? "No branch"}</Typography>
                          <Typography variant="caption" color="neutral">
                            {row.department ?? "No department"}
                          </Typography>
                        </Stack>
                      ),
                    },
                    {
                      key: "requests",
                      header: "Requests",
                      render: (row) => row.requestCount,
                    },
                    {
                      key: "requested",
                      header: "Requested",
                      render: (row) => formatMinutes(row.requestedMinutes),
                    },
                    {
                      key: "actual",
                      header: "Actual",
                      render: (row) => formatMinutes(row.actualMinutes),
                    },
                    {
                      key: "verified",
                      header: "Verified",
                      render: (row) => (
                        <Typography variant="bodySmall" className="font-medium">
                          {formatMinutes(row.verifiedMinutes)}
                        </Typography>
                      ),
                    },
                  ]}
                  data={summary.rows}
                  rowKey={(row) => row.employeeId}
                  emptyText="No overtime data for this period."
                />
              </Stack>
            ) : null}
          </Stack>
        </CardBody>
      </Card>

      <Card variant="outlined" padding="lg">
        <CardBody>
          <Typography variant="bodySmall" color="neutral">
            Only verified minutes are payroll-eligible in a future phase. Actual minutes are
            recorded separately and do not change attendance.
          </Typography>
        </CardBody>
      </Card>
    </Stack>
  );
}
