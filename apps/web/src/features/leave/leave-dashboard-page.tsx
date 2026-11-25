import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, CardBody, Spinner, Stack, Table, Typography } from "@nemo-ui/ui";
import { Link, useNavigate } from "react-router-dom";
import { PERMISSIONS, type LeaveDashboard } from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { BalanceCard, LeaveStatusBadge, MetricCard, PageHeading } from "./leave-ui";
import { formatDate, formatQuantity } from "./leave-utils";

export function LeaveDashboardPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const dashboardQuery = useQuery({
    queryKey: ["leave", "dashboard"],
    queryFn: () => apiRequest<LeaveDashboard>("/leave-requests/dashboard"),
  });

  if (dashboardQuery.isPending) {
    return (
      <Stack direction="row" spacing={12} align="center">
        <Spinner />
        <Typography variant="bodySmall" color="neutral">
          Loading leave dashboard…
        </Typography>
      </Stack>
    );
  }

  if (dashboardQuery.isError) {
    return (
      <Alert tone="error" title="Could not load the leave dashboard">
        {dashboardQuery.error instanceof ApiRequestError
          ? dashboardQuery.error.message
          : "Unexpected error"}
      </Alert>
    );
  }

  const data = dashboardQuery.data;

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Leave"
        description="Your balances, requests, and approvals at a glance"
        actions={
          <Stack direction="row" spacing={8} wrap>
            {hasPermission(PERMISSIONS.LEAVE_REQUEST_CREATE) ? (
              <Button onClick={() => navigate("/leave/requests/new")}>Request leave</Button>
            ) : null}
            {hasPermission(PERMISSIONS.LEAVE_REQUEST_APPROVE) ? (
              <Button variant="outlined" onClick={() => navigate("/leave/approvals")}>
                Approval inbox ({data.inboxCount})
              </Button>
            ) : null}
          </Stack>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Pending requests" value={data.pendingRequests} />
        <MetricCard label="Approved this month" value={data.approvedThisMonth} />
        <MetricCard label="Awaiting your review" value={data.inboxCount} />
      </div>

      <Stack spacing={12}>
        <Stack direction="row" justify="between" align="center" wrap spacing={8}>
          <Typography variant="h6">Your balances</Typography>
          <Link to="/leave/balances" className="text-sm text-[var(--nemo-primary-700)] underline">
            View all balances
          </Link>
        </Stack>
        {data.balances.length === 0 ? (
          <Alert tone="info" title="No leave balance yet">
            Your leave balance appears after HR assigns a leave policy to you.
          </Alert>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.balances.map((balance) => (
              <BalanceCard
                key={`${balance.leaveType.id}-${balance.periodStart}`}
                balance={balance}
              />
            ))}
          </div>
        )}
      </Stack>

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={14}>
            <Stack direction="row" justify="between" align="center" wrap spacing={8}>
              <Typography variant="h6">Upcoming leave</Typography>
              <Link
                to="/leave/requests"
                className="text-sm text-[var(--nemo-primary-700)] underline"
              >
                My requests
              </Link>
            </Stack>
            <Table
              columns={[
                { key: "type", header: "Type", render: (row) => row.leaveType.name },
                {
                  key: "dates",
                  header: "Dates",
                  render: (row) =>
                    row.startDate === row.endDate
                      ? formatDate(row.startDate)
                      : `${formatDate(row.startDate)} – ${formatDate(row.endDate)}`,
                },
                {
                  key: "duration",
                  header: "Duration",
                  render: (row) => formatQuantity(row.duration, row.durationUnit),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => <LeaveStatusBadge status={row.status} />,
                },
                {
                  key: "actions",
                  header: "",
                  align: "right",
                  render: (row) => (
                    <Button
                      variant="text"
                      size="sm"
                      onClick={() => navigate(`/leave/requests/${row.id}`)}
                    >
                      Detail
                    </Button>
                  ),
                },
              ]}
              data={data.upcoming}
              rowKey={(row) => row.id}
              emptyText="No upcoming leave."
            />
            <Stack direction="row" spacing={12} wrap>
              <Link
                to="/leave/calendar"
                className="text-sm text-[var(--nemo-primary-700)] underline"
              >
                Leave calendar
              </Link>
              <Link
                to="/leave/transactions"
                className="text-sm text-[var(--nemo-primary-700)] underline"
              >
                Balance history
              </Link>
              {hasPermission(PERMISSIONS.LEAVE_REPORT_READ) ? (
                <Link
                  to="/leave/reports"
                  className="text-sm text-[var(--nemo-primary-700)] underline"
                >
                  Leave reports
                </Link>
              ) : null}
            </Stack>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  );
}
