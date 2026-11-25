import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  Spinner,
  Stack,
  Table,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useState } from "react";
import {
  LEAVE_REQUEST_STATUSES,
  type LeaveReportSummary,
  type LeaveRequestStatus,
} from "@peopleops/shared-types";
import { apiRequest, ApiRequestError, downloadFile } from "../../lib/http";
import { MetricCard, PageHeading } from "./leave-ui";
import { formatQuantity, todayKey, useLeaveTypes } from "./leave-utils";
import {
  departmentChoiceOptions,
  useBranchOptions,
  useDepartmentTree,
} from "../employees/employee-options";

function currentYearStart(): string {
  return `${new Date().getFullYear()}-01-01`;
}

export function LeaveReportsPage() {
  const toast = useToast();
  const typesQuery = useLeaveTypes();
  const branchesQuery = useBranchOptions();
  const departmentsQuery = useDepartmentTree();
  const [from, setFrom] = useState(currentYearStart());
  const [to, setTo] = useState(todayKey());
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState<LeaveRequestStatus | "">("");

  const params = new URLSearchParams({ from, to });
  if (leaveTypeId) params.set("leaveTypeId", leaveTypeId);
  if (branchId) params.set("branchId", branchId);
  if (departmentId) params.set("departmentId", departmentId);
  if (status) params.set("status", status);

  const summaryQuery = useQuery({
    queryKey: ["leave", "reports", params.toString()],
    queryFn: () => apiRequest<LeaveReportSummary>(`/leave-reports/summary?${params.toString()}`),
    enabled: Boolean(from && to),
  });

  const exportMutation = useMutation({
    mutationFn: () =>
      downloadFile(`/leave-reports/export?${params.toString()}`, `leave-report-${to}.csv`),
    onSuccess: () => toast.success("Leave report downloaded"),
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not export the report"),
  });

  const summary = summaryQuery.data;

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Leave reports"
        description="Usage, request outcomes, and remaining balances across the organisation"
        actions={
          <Button
            variant="outlined"
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
          >
            {exportMutation.isPending ? "Preparing CSV…" : "Export CSV"}
          </Button>
        }
      />

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
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
              <Select
                label="Leave type"
                value={leaveTypeId}
                onChange={(value) => setLeaveTypeId(value)}
                options={[
                  { label: "All leave types", value: "" },
                  ...(typesQuery.data?.map((type) => ({ label: type.name, value: type.id })) ?? []),
                ]}
                fullWidth
              />
              <Select
                label="Branch"
                value={branchId}
                onChange={(value) => {
                  setBranchId(value);
                  setDepartmentId("");
                }}
                options={[
                  { label: "All branches", value: "" },
                  ...(branchesQuery.data?.items.map((branch) => ({
                    label: branch.name,
                    value: branch.id,
                  })) ?? []),
                ]}
                fullWidth
              />
              <Select
                label="Department"
                value={departmentId}
                onChange={(value) => setDepartmentId(value)}
                options={[
                  { label: "All departments", value: "" },
                  ...departmentChoiceOptions(departmentsQuery.data ?? []),
                ]}
                fullWidth
              />
              <Select
                label="Request status"
                value={status}
                onChange={(value) => setStatus(value as LeaveRequestStatus | "")}
                options={[
                  { label: "All statuses", value: "" },
                  ...LEAVE_REQUEST_STATUSES.map((value) => ({ label: value, value })),
                ]}
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
              <Alert tone="error" title="Could not load the leave report">
                {summaryQuery.error instanceof ApiRequestError
                  ? summaryQuery.error.message
                  : "Unexpected error"}
              </Alert>
            ) : summary ? (
              <Stack spacing={16}>
                <div className="grid grid-cols-2 gap-3 [&>*:last-child]:col-span-2 sm:grid-cols-3 sm:[&>*:last-child]:col-span-1 xl:grid-cols-5">
                  <MetricCard label="Requests" value={summary.requestCount} />
                  <MetricCard label="Approved requests" value={summary.approvedCount} />
                  <MetricCard label="Pending requests" value={summary.pendingCount} />
                  <MetricCard label="Rejected requests" value={summary.rejectedCount} />
                  <MetricCard
                    label="Approved leave days"
                    value={formatQuantity(summary.totalDays)}
                  />
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
                    { key: "leave", header: "Leave type", render: (row) => row.leaveType },
                    {
                      key: "entitled",
                      header: "Entitled",
                      render: (row) => formatQuantity(row.entitled),
                    },
                    { key: "used", header: "Used", render: (row) => formatQuantity(row.used) },
                    {
                      key: "reserved",
                      header: "Reserved",
                      render: (row) => formatQuantity(row.reserved),
                    },
                    {
                      key: "available",
                      header: "Available",
                      render: (row) => (
                        <Typography variant="bodySmall" className="font-medium">
                          {formatQuantity(row.available)}
                        </Typography>
                      ),
                    },
                  ]}
                  data={summary.rows}
                  rowKey={(row) => `${row.employeeId}-${row.leaveType}`}
                  emptyText="No leave balance data for this period."
                />
              </Stack>
            ) : null}
          </Stack>
        </CardBody>
      </Card>

      <Card variant="outlined" padding="lg">
        <CardHeader title="How this report is calculated" />
        <CardBody>
          <Typography variant="bodySmall" color="neutral">
            Request counts include requests that overlap the selected period. Balance rows reflect
            entitlement periods overlapping the period and use the ledger totals, including pending
            reservations. CSV export contains the same balance rows.
          </Typography>
        </CardBody>
      </Card>
    </Stack>
  );
}
