import { Alert, Button, Card, CardBody, Spinner, Stack, Table, Typography } from "@nemo-ui/ui";
import { Link } from "react-router-dom";
import { PERMISSIONS } from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { ApiRequestError } from "../../lib/http";
import { formatDateTime, formatMoney, usePayrollDashboard } from "./payroll-utils";
import {
  EmptyState,
  MetricCard,
  PageHeading,
  PayrollStatusBadge,
  PermissionNotice,
} from "./payroll-ui";

export function PayrollDashboardPage() {
  const { hasPermission } = useAuth();
  const dashboardQuery = usePayrollDashboard();

  if (!hasPermission(PERMISSIONS.PAYROLL_RUNS_READ)) {
    return <PermissionNotice>Ask payroll for payroll run access.</PermissionNotice>;
  }

  if (dashboardQuery.isPending) {
    return (
      <Stack direction="row" spacing={12} align="center">
        <Spinner />
        <Typography variant="bodySmall" color="neutral">
          Loading payroll dashboard…
        </Typography>
      </Stack>
    );
  }

  if (dashboardQuery.isError) {
    return (
      <Alert tone="error" title="Could not load the payroll dashboard">
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
        title="Payroll"
        description="Periods, calculation, review, approval, publication, and employee payslips."
        actions={
          <Stack direction="row" spacing={8} wrap>
            {hasPermission(PERMISSIONS.PAYROLL_RUNS_CALCULATE) ? (
              <Link to="/payroll/runs">
                <Button>Create payroll run</Button>
              </Link>
            ) : null}
            {hasPermission(PERMISSIONS.PAYROLL_PERIODS_MANAGE) ? (
              <Link to="/payroll/periods">
                <Button variant="outlined">Manage periods</Button>
              </Link>
            ) : null}
          </Stack>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Open periods" value={data.openPeriods} hint="Ready for a run" />
        <MetricCard label="Active runs" value={data.activeRuns} hint="Draft through approved" />
        <MetricCard
          label="Pending adjustments"
          value={data.pendingAdjustments}
          hint="Awaiting approval"
        />
        <MetricCard
          label="Published this month"
          value={data.publishedRunsThisMonth}
          hint="Stable payslips"
        />
        <MetricCard
          label="Net paid this month"
          value={formatMoney(data.netPaidThisMonth)}
          hint="Published and locked runs"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card variant="elevated" padding="lg">
          <CardBody>
            <Stack spacing={12}>
              <Stack direction="row" justify="between" align="center">
                <Typography variant="h6">Recent payroll runs</Typography>
                <Link to="/payroll/runs">
                  <Button variant="text" size="sm">
                    View all
                  </Button>
                </Link>
              </Stack>
              <Table
                data={data.recentRuns}
                rowKey={(row) => row.id}
                emptyText={
                  <EmptyState
                    title="No payroll runs yet"
                    description="Create a period, then start a payroll run."
                  />
                }
                columns={[
                  {
                    key: "period",
                    header: "Period",
                    render: (row) => (
                      <Link to={`/payroll/runs/${row.id}`} className="underline">
                        <Typography variant="bodySmall" className="font-medium">
                          {row.period.name}
                        </Typography>
                      </Link>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => <PayrollStatusBadge status={row.status} />,
                  },
                  {
                    key: "employees",
                    header: "Employees",
                    render: (row) => row.employeeCount,
                  },
                  {
                    key: "net",
                    header: "Net",
                    align: "right",
                    render: (row) => formatMoney(row.netTotal, row.currency),
                  },
                  {
                    key: "updated",
                    header: "Updated",
                    render: (row) => (
                      <Typography variant="caption">{formatDateTime(row.updatedAt)}</Typography>
                    ),
                  },
                ]}
              />
            </Stack>
          </CardBody>
        </Card>

        <Card variant="outlined" padding="lg">
          <CardBody>
            <Stack spacing={12}>
              <Typography variant="h6">Workflow</Typography>
              <Typography variant="bodySmall" color="neutral">
                Draft → Calculated → Under review → Approved → Published
              </Typography>
              <Stack spacing={8}>
                <Link to="/payroll/compensation" className="underline">
                  <Typography variant="bodySmall">Compensation and salary history</Typography>
                </Link>
                <Link to="/payroll/components" className="underline">
                  <Typography variant="bodySmall">Payroll components</Typography>
                </Link>
                <Link to="/payroll/assignments" className="underline">
                  <Typography variant="bodySmall">Employee assignments</Typography>
                </Link>
                <Link to="/payroll/adjustments" className="underline">
                  <Typography variant="bodySmall">Adjustments</Typography>
                </Link>
                <Link to="/payroll/payslips" className="underline">
                  <Typography variant="bodySmall">Payslips</Typography>
                </Link>
                {hasPermission(PERMISSIONS.PAYROLL_REPORTS_READ) ? (
                  <Link to="/payroll/reports" className="underline">
                    <Typography variant="bodySmall">Reports</Typography>
                  </Link>
                ) : null}
              </Stack>
            </Stack>
          </CardBody>
        </Card>
      </div>

      <Alert tone="info" title="Published payroll is immutable">
        Recalculating a run replaces draft payslips and increments the calculation version. Published
        payslips keep their employee, compensation, attendance, leave, overtime, adjustment, and
        settings snapshots.
      </Alert>
    </Stack>
  );
}
