import { Alert, Card, CardBody, Spinner, Stack, Table, Typography } from "@nemo-ui/ui";
import { Link } from "react-router-dom";
import { useMyLeaveBalances } from "./leave-utils";
import { BalanceCard, PageHeading } from "./leave-ui";
import { ApiRequestError } from "../../lib/http";

export function MyLeaveBalancePage() {
  const balancesQuery = useMyLeaveBalances();

  return (
    <Stack spacing={16}>
      <PageHeading
        title="My leave balance"
        description="Entitled, used, reserved, and available leave for the current period"
      />

      {balancesQuery.isPending ? (
        <Stack direction="row" spacing={12} align="center">
          <Spinner />
          <Typography variant="bodySmall" color="neutral">
            Loading balances…
          </Typography>
        </Stack>
      ) : balancesQuery.isError ? (
        <Alert tone="error" title="Could not load your leave balances">
          {balancesQuery.error instanceof ApiRequestError
            ? balancesQuery.error.message
            : "Unexpected error"}
        </Alert>
      ) : balancesQuery.data.length === 0 ? (
        <Alert tone="info" title="No leave balance yet">
          Your balance will appear after HR assigns an active leave policy to your employee record.
        </Alert>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {balancesQuery.data.map((balance) => (
              <BalanceCard
                key={`${balance.leaveType.id}-${balance.periodStart}`}
                balance={balance}
              />
            ))}
          </div>
          <Card variant="elevated" padding="lg">
            <CardBody>
              <Stack spacing={12}>
                <Stack direction="row" justify="between" align="center" wrap spacing={8}>
                  <Typography variant="h6">Balance details</Typography>
                  <Link
                    to="/leave/transactions"
                    className="text-sm text-[var(--nemo-primary-700)] underline"
                  >
                    View ledger
                  </Link>
                </Stack>
                <Table
                  columns={[
                    { key: "type", header: "Leave type", render: (row) => row.leaveType.name },
                    {
                      key: "period",
                      header: "Period",
                      render: (row) => `${row.periodStart} – ${row.periodEnd}`,
                    },
                    { key: "entitled", header: "Entitled", render: (row) => row.entitled },
                    { key: "used", header: "Used", render: (row) => row.used },
                    { key: "reserved", header: "Reserved", render: (row) => row.reserved },
                    { key: "available", header: "Available", render: (row) => row.available },
                    { key: "unit", header: "Unit", render: (row) => row.unit.toLowerCase() },
                  ]}
                  data={balancesQuery.data}
                  rowKey={(row) => `${row.leaveType.id}-${row.periodStart}`}
                  emptyText="No balances."
                />
              </Stack>
            </CardBody>
          </Card>
        </>
      )}
    </Stack>
  );
}
