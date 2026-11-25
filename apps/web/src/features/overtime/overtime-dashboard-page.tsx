import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, CardBody, Spinner, Stack, Table, Typography } from "@nemo-ui/ui";
import { useNavigate } from "react-router-dom";
import { PERMISSIONS, type OvertimeDashboard } from "@peopleops/shared-types";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { useAuth } from "../auth/auth-context";
import { MetricCard, OvertimeStatusBadge, PageHeading } from "./overtime-ui";
import { formatDateTime, formatMinutes } from "./overtime-utils";

export function OvertimeDashboardPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const dashboardQuery = useQuery({
    queryKey: ["overtime", "dashboard"],
    queryFn: () => apiRequest<OvertimeDashboard>("/overtime/dashboard"),
  });

  if (dashboardQuery.isPending) {
    return (
      <Stack direction="row" spacing={12} align="center">
        <Spinner />
        <Typography variant="bodySmall" color="neutral">
          Loading overtime…
        </Typography>
      </Stack>
    );
  }

  if (dashboardQuery.isError) {
    return (
      <Alert tone="error" title="Could not load the overtime dashboard">
        {dashboardQuery.error instanceof ApiRequestError
          ? dashboardQuery.error.message
          : "Unexpected error"}
      </Alert>
    );
  }

  const data = dashboardQuery.data;

  return (
    <Stack spacing={20}>
      <PageHeading
        title="Overtime"
        description="Request overtime, follow approvals, and verify actual hours"
        actions={
          <Stack direction="row" spacing={8} wrap>
            {hasPermission(PERMISSIONS.OVERTIME_CREATE) ? (
              <Button onClick={() => navigate("/overtime/requests/new")}>Request overtime</Button>
            ) : null}
            {hasPermission(PERMISSIONS.OVERTIME_APPROVE) ? (
              <Button variant="outlined" onClick={() => navigate("/overtime/approvals")}>
                Approval inbox
              </Button>
            ) : null}
            {hasPermission(PERMISSIONS.OVERTIME_VERIFY) ? (
              <Button variant="outlined" onClick={() => navigate("/overtime/verification")}>
                Verification queue
              </Button>
            ) : null}
          </Stack>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="My pending requests" value={data.myPending} />
        <MetricCard label="Approved, awaiting work" value={data.myApproved} />
        <MetricCard label="Pending verification" value={data.myPendingVerification} />
        <MetricCard
          label="Verified this month"
          value={formatMinutes(data.verifiedMinutesThisMonth)}
          hint={`${data.myVerifiedThisMonth} request(s)`}
        />
      </div>

      {hasPermission(PERMISSIONS.OVERTIME_READ_TEAM) ||
      hasPermission(PERMISSIONS.OVERTIME_READ_ALL) ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricCard label="Approvals waiting" value={data.pendingApprovals} />
          <MetricCard label="Verification waiting" value={data.pendingVerification} />
        </div>
      ) : null}

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={14}>
            <Stack direction="row" justify="between" align="center" wrap spacing={8}>
              <Typography variant="h6">Recent requests</Typography>
              <Stack direction="row" spacing={8} wrap>
                <Button variant="text" onClick={() => navigate("/overtime/requests")}>
                  My requests
                </Button>
                {hasPermission(PERMISSIONS.OVERTIME_READ_TEAM) ||
                hasPermission(PERMISSIONS.OVERTIME_READ_ALL) ? (
                  <Button variant="text" onClick={() => navigate("/overtime/team")}>
                    Team requests
                  </Button>
                ) : null}
              </Stack>
            </Stack>
            <Table
              columns={[
                { key: "date", header: "Work date", render: (row) => row.workDate },
                { key: "reason", header: "Reason", render: (row) => row.reason },
                {
                  key: "planned",
                  header: "Requested",
                  render: (row) => formatMinutes(row.requestedMinutes),
                },
                {
                  key: "verified",
                  header: "Verified",
                  render: (row) => formatMinutes(row.verifiedMinutes),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => <OvertimeStatusBadge status={row.status} />,
                },
                {
                  key: "created",
                  header: "Created",
                  render: (row) => formatDateTime(row.createdAt),
                },
                {
                  key: "actions",
                  header: "",
                  align: "right",
                  render: (row) => (
                    <Button
                      variant="text"
                      size="sm"
                      onClick={() => navigate(`/overtime/requests/${row.id}`)}
                    >
                      Detail
                    </Button>
                  ),
                },
              ]}
              data={data.recent}
              rowKey={(row) => row.id}
              emptyText="No overtime requests yet."
            />
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  );
}
