import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Modal,
  Select,
  Spinner,
  Stack,
  Table,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useState } from "react";
import { Link } from "react-router-dom";
import { PERMISSIONS, type PayrollRun } from "@peopleops/shared-types";
import { LoadingButton } from "../../components/loading-button";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { useAuth } from "../auth/auth-context";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  PAYROLL_PAGE_SIZE,
  useOpenPayrollPeriods,
  usePayrollRuns,
} from "./payroll-utils";
import { EmptyState, PageHeading, PayrollStatusBadge, PermissionNotice } from "./payroll-ui";

export function PayrollRunsPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [periodId, setPeriodId] = useState("");

  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(PAYROLL_PAGE_SIZE),
  });
  if (status) params.set("status", status);
  const listQuery = usePayrollRuns(params);
  const periodsQuery = useOpenPayrollPeriods();
  const periodOptions =
    periodsQuery.data?.items.map((period) => ({
      label: `${period.name} · ${formatDate(period.startDate)} – ${formatDate(period.endDate)}`,
      value: period.id,
    })) ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest<PayrollRun>("/payroll/runs", { method: "POST", body: { periodId } }),
    onSuccess: () => {
      toast.success("Payroll run created");
      setCreateOpen(false);
      setPeriodId("");
      void queryClient.invalidateQueries({ queryKey: ["payroll"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not create the run"),
  });

  if (!hasPermission(PERMISSIONS.PAYROLL_RUNS_READ)) {
    return <PermissionNotice>Ask payroll for payroll run access.</PermissionNotice>;
  }

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Payroll runs"
        description="A run is the calculation container for one period. Only one non-cancelled run can exist per period."
        actions={
          hasPermission(PERMISSIONS.PAYROLL_RUNS_CALCULATE) ? (
            <Button onClick={() => setCreateOpen(true)}>Create run</Button>
          ) : undefined
        }
      />

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="grid gap-3 md:grid-cols-3">
              <Select
                aria-label="Filter run status"
                value={status}
                onChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
                options={[
                  { label: "All statuses", value: "" },
                  { label: "Draft", value: "DRAFT" },
                  { label: "Calculating", value: "CALCULATING" },
                  { label: "Calculated", value: "CALCULATED" },
                  { label: "Under review", value: "UNDER_REVIEW" },
                  { label: "Approved", value: "APPROVED" },
                  { label: "Published", value: "PUBLISHED" },
                  { label: "Cancelled", value: "CANCELLED" },
                ]}
                fullWidth
              />
              <Button
                variant="outlined"
                onClick={() => {
                  setStatus("");
                  setPage(1);
                }}
              >
                Reset filter
              </Button>
            </div>

            {listQuery.isPending ? (
              <Stack direction="row" spacing={12} align="center">
                <Spinner />
                <Typography variant="bodySmall" color="neutral">
                  Loading payroll runs…
                </Typography>
              </Stack>
            ) : listQuery.isError ? (
              <Alert tone="error" title="Could not load payroll runs">
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
                    title="No payroll runs"
                    description="Create a period, then start a payroll run."
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
                        <Link to={`/payroll/runs/${row.id}`} className="underline">
                          <Typography variant="bodySmall" className="font-medium">
                            {row.period.name}
                          </Typography>
                        </Link>
                        <Typography variant="caption" color="neutral">
                          Run #{row.runNumber} · payment {formatDate(row.period.paymentDate)}
                        </Typography>
                      </Stack>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => <PayrollStatusBadge status={row.status} />,
                  },
                  {
                    key: "version",
                    header: "Version",
                    render: (row) => `v${row.calculationVersion}`,
                  },
                  {
                    key: "employees",
                    header: "Employees",
                    render: (row) => row.employeeCount,
                  },
                  {
                    key: "gross",
                    header: "Gross",
                    align: "right",
                    render: (row) => formatMoney(row.grossTotal, row.currency),
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
                  {
                    key: "actions",
                    header: "",
                    align: "right",
                    render: (row) => (
                      <Link to={`/payroll/runs/${row.id}`}>
                        <Button variant="text" size="sm">
                          Open
                        </Button>
                      </Link>
                    ),
                  },
                ]}
              />
            )}
          </Stack>
        </CardBody>
      </Card>

      <Modal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create payroll run"
        description="Choose an open period. The run starts as a draft and is calculated explicitly."
        size="sm"
        footer={
          <Stack direction="row" justify="end" spacing={8}>
            <Button variant="outlined" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <LoadingButton
              loading={createMutation.isPending}
              disabled={!periodId}
              onClick={() => createMutation.mutate()}
            >
              Create run
            </LoadingButton>
          </Stack>
        }
      >
        <Stack spacing={12}>
          {periodOptions.length === 0 ? (
            <Alert tone="warning" title="No open periods">
              Create or reopen a payroll period before starting a run.
            </Alert>
          ) : (
            <Select
              label="Payroll period"
              value={periodId}
              onChange={setPeriodId}
              options={periodOptions}
              searchable
              fullWidth
            />
          )}
        </Stack>
      </Modal>
    </Stack>
  );
}
