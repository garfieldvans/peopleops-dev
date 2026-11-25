import { Alert, Button, Card, CardBody, Spinner, Stack, Table, Typography, useToast } from "@nemo-ui/ui";
import { useState } from "react";
import { Link } from "react-router-dom";
import { PERMISSIONS } from "@peopleops/shared-types";
import { downloadFile, ApiRequestError } from "../../lib/http";
import { useAuth } from "../auth/auth-context";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  PAYROLL_PAGE_SIZE,
  usePayslips,
} from "./payroll-utils";
import { EmptyState, PageHeading, PermissionNotice } from "./payroll-ui";

export function MyPayslipsPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState<string | null>(null);
  const canRead = hasPermission(PERMISSIONS.PAYROLL_PAYSLIPS_READ_SELF);
  const params = new URLSearchParams({ page: String(page), pageSize: String(PAYROLL_PAGE_SIZE) });
  const listQuery = usePayslips(params, canRead);

  const download = async (id: string, name: string) => {
    setDownloading(id);
    try {
      await downloadFile(`/payroll/payslips/${id}/pdf`, `payslip-${name}.pdf`);
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Could not download payslip");
    } finally {
      setDownloading(null);
    }
  };

  if (!canRead) {
    return <PermissionNotice>Ask HR for payslip access.</PermissionNotice>;
  }

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Payslips"
        description="Published payslips are generated from immutable payroll snapshots."
      />

      <Alert tone="info" title="Only published payslips are visible to employees">
        Draft and unapproved payroll data is never exposed through this page.
      </Alert>

      <Card variant="elevated" padding="lg">
        <CardBody>
          {listQuery.isPending ? (
            <Stack direction="row" spacing={12} align="center">
              <Spinner />
              <Typography variant="bodySmall" color="neutral">
                Loading payslips…
              </Typography>
            </Stack>
          ) : listQuery.isError ? (
            <Alert tone="error" title="Could not load payslips">
              {listQuery.error instanceof ApiRequestError
                ? listQuery.error.message
                : "Unexpected error"}
            </Alert>
          ) : (
            <Table
              data={listQuery.data?.items ?? []}
              rowKey={(row) => row.id}
              emptyText={
                <EmptyState
                  title="No published payslips"
                  description="Payslips appear after payroll is approved and published."
                />
              }
              pagination={{
                page,
                pageSize: PAYROLL_PAGE_SIZE,
                pageCount: listQuery.data?.totalPages ?? 1,
                total: listQuery.data?.total ?? 0,
                onChange: setPage,
              }}
              columns={[
                {
                  key: "period",
                  header: "Period",
                  render: (row) => (
                    <Stack spacing={1}>
                      <Typography variant="bodySmall" className="font-medium">
                        {row.period.name}
                      </Typography>
                      <Typography variant="caption" color="neutral">
                        {formatDate(row.period.startDate)} – {formatDate(row.period.endDate)}
                      </Typography>
                    </Stack>
                  ),
                },
                {
                  key: "employee",
                  header: "Employee",
                  render: (row) => (
                    <Stack spacing={1}>
                      <Typography variant="bodySmall">{row.employeeName}</Typography>
                      <Typography variant="caption" color="neutral">
                        {row.employeeNumber}
                      </Typography>
                    </Stack>
                  ),
                },
                {
                  key: "gross",
                  header: "Gross",
                  align: "right",
                  render: (row) => formatMoney(row.grossPay, row.currency),
                },
                {
                  key: "deductions",
                  header: "Deductions",
                  align: "right",
                  render: (row) => formatMoney(row.totalDeductions, row.currency),
                },
                {
                  key: "net",
                  header: "Net",
                  align: "right",
                  render: (row) => formatMoney(row.netPay, row.currency),
                },
                {
                  key: "published",
                  header: "Published",
                  render: (row) => (
                    <Typography variant="caption">{formatDateTime(row.publishedAt)}</Typography>
                  ),
                },
                {
                  key: "actions",
                  header: "",
                  align: "right",
                  render: (row) => (
                    <Stack direction="row" spacing={4} justify="end">
                      <Link to={`/payroll/payslips/${row.id}`}>
                        <Button variant="text" size="sm">
                          View
                        </Button>
                      </Link>
                      <Button
                        variant="text"
                        size="sm"
                        disabled={downloading === row.id}
                        onClick={() => void download(row.id, `${row.employeeNumber}-${row.period.name}`)}
                      >
                        {downloading === row.id ? "Downloading…" : "PDF"}
                      </Button>
                    </Stack>
                  ),
                },
              ]}
            />
          )}
        </CardBody>
      </Card>
    </Stack>
  );
}
