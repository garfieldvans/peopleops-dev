import {
  Alert,
  Button,
  Card,
  CardBody,
  Spinner,
  Stack,
  Table,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PERMISSIONS } from "@peopleops/shared-types";
import { downloadFile, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import { useAuth } from "../auth/auth-context";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  usePayslip,
} from "./payroll-utils";
import {
  EmptyState,
  MetricCard,
  PageHeading,
  PayrollWarnings,
  PermissionNotice,
} from "./payroll-ui";

export function PayslipDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const query = usePayslip(id);
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    if (!query.data) return;
    setDownloading(true);
    try {
      await downloadFile(
        `/payroll/payslips/${query.data.id}/pdf`,
        `payslip-${query.data.employeeNumber}-${query.data.period.name}.pdf`,
      );
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Could not download payslip");
    } finally {
      setDownloading(false);
    }
  };

  if (!hasPermission(PERMISSIONS.PAYROLL_PAYSLIPS_READ_SELF)) {
    return <PermissionNotice>Ask HR for payslip access.</PermissionNotice>;
  }

  if (query.isPending) {
    return (
      <Stack direction="row" spacing={12} align="center">
        <Spinner />
        <Typography variant="bodySmall" color="neutral">
          Loading payslip…
        </Typography>
      </Stack>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Alert tone="error" title="Could not load payslip">
        {query.error instanceof ApiRequestError ? query.error.message : "Payslip not found"}
      </Alert>
    );
  }

  const payslip = query.data;
  const earnings = payslip.lines.filter((line) => line.componentType === "EARNING");
  const deductions = payslip.lines.filter((line) => line.componentType === "DEDUCTION");
  const employer = payslip.lines.filter((line) => line.componentType === "EMPLOYER_CONTRIBUTION");
  const informational = payslip.lines.filter((line) => line.componentType === "INFORMATIONAL");

  return (
    <Stack spacing={16}>
      <PageHeading
        title={`${payslip.employeeName} · ${payslip.period.name}`}
        description={`${payslip.employeeNumber}${payslip.department ? ` · ${payslip.department}` : ""}${payslip.position ? ` · ${payslip.position}` : ""}`}
        actions={
          <Stack direction="row" spacing={8} wrap>
            <Link to="/payroll/payslips">
              <Button variant="outlined">Back to payslips</Button>
            </Link>
            <LoadingButton loading={downloading} onClick={() => void download()}>
              Download PDF
            </LoadingButton>
          </Stack>
        }
      />

      <PayrollWarnings warnings={payslip.warnings} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Gross pay" value={formatMoney(payslip.grossPay, payslip.currency)} />
        <MetricCard
          label="Deductions"
          value={formatMoney(payslip.totalDeductions, payslip.currency)}
        />
        <MetricCard label="Net pay" value={formatMoney(payslip.netPay, payslip.currency)} />
        <MetricCard
          label="Employer contributions"
          value={formatMoney(payslip.employerContributions, payslip.currency)}
          hint="Reported separately"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card variant="elevated" padding="lg">
          <CardBody>
            <Stack spacing={12}>
              <Typography variant="h6">Earnings</Typography>
              <Table
                data={earnings}
                rowKey={(row) => row.id}
                emptyText={<EmptyState title="No earnings" description="No earning lines." />}
                columns={[
                  {
                    key: "name",
                    header: "Component",
                    render: (row) => (
                      <Stack spacing={1}>
                        <Typography variant="bodySmall">{row.name}</Typography>
                        <Typography variant="caption" color="neutral">
                          {row.code}
                        </Typography>
                      </Stack>
                    ),
                  },
                  {
                    key: "amount",
                    header: "Amount",
                    align: "right",
                    render: (row) => formatMoney(row.amount, payslip.currency),
                  },
                ]}
              />
            </Stack>
          </CardBody>
        </Card>

        <Card variant="elevated" padding="lg">
          <CardBody>
            <Stack spacing={12}>
              <Typography variant="h6">Deductions</Typography>
              <Table
                data={deductions}
                rowKey={(row) => row.id}
                emptyText={
                  <EmptyState title="No deductions" description="No deduction lines this period." />
                }
                columns={[
                  {
                    key: "name",
                    header: "Component",
                    render: (row) => (
                      <Stack spacing={1}>
                        <Typography variant="bodySmall">{row.name}</Typography>
                        <Typography variant="caption" color="neutral">
                          {row.code}
                        </Typography>
                      </Stack>
                    ),
                  },
                  {
                    key: "amount",
                    header: "Amount",
                    align: "right",
                    render: (row) => formatMoney(row.amount, payslip.currency),
                  },
                ]}
              />
            </Stack>
          </CardBody>
        </Card>
      </div>

      {employer.length > 0 ? (
        <Card variant="outlined" padding="lg">
          <CardBody>
            <Stack spacing={12}>
              <Typography variant="h6">Employer contributions</Typography>
              <Typography variant="caption" color="neutral">
                These amounts are not deducted from the employee's net pay.
              </Typography>
              <Table
                data={employer}
                rowKey={(row) => row.id}
                columns={[
                  { key: "name", header: "Component", render: (row) => row.name },
                  {
                    key: "amount",
                    header: "Amount",
                    align: "right",
                    render: (row) => formatMoney(row.amount, payslip.currency),
                  },
                ]}
              />
            </Stack>
          </CardBody>
        </Card>
      ) : null}

      {informational.length > 0 ? (
        <Card variant="outlined" padding="lg">
          <CardBody>
            <Stack spacing={12}>
              <Typography variant="h6">Information</Typography>
              <Table
                data={informational}
                rowKey={(row) => row.id}
                columns={[
                  { key: "name", header: "Component", render: (row) => row.name },
                  {
                    key: "amount",
                    header: "Amount",
                    align: "right",
                    render: (row) => formatMoney(row.amount, payslip.currency),
                  },
                ]}
              />
            </Stack>
          </CardBody>
        </Card>
      ) : null}

      <Card variant="outlined" padding="lg">
        <CardBody>
          <Stack spacing={12}>
            <Typography variant="h6">Calculation snapshot</Typography>
            <Typography variant="caption" color="neutral">
              Period {formatDate(payslip.period.startDate)} – {formatDate(payslip.period.endDate)} ·
              payment {formatDate(payslip.period.paymentDate)} · published{" "}
              {formatDateTime(payslip.publishedAt)}
            </Typography>
            <div className="grid gap-3 md:grid-cols-2">
              <SnapshotBlock title="Compensation" value={payslip.compensationSnapshot} />
              <SnapshotBlock title="Attendance" value={payslip.attendanceSnapshot} />
              <SnapshotBlock title="Leave" value={payslip.leaveSnapshot} />
              <SnapshotBlock title="Verified overtime" value={payslip.overtimeSnapshot} />
              <SnapshotBlock title="Adjustments" value={payslip.adjustmentSnapshot} />
              <SnapshotBlock title="Settings" value={payslip.settingsSnapshot} />
            </div>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  );
}

function SnapshotBlock({ title, value }: { title: string; value: Record<string, unknown> }) {
  return (
    <div className="rounded-md border border-[var(--nemo-neutral-200)] p-3">
      <Typography variant="caption" color="neutral">
        {title}
      </Typography>
      <pre className="mt-1 overflow-auto text-xs text-[var(--nemo-neutral-700)]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
