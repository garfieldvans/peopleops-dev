import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Input,
  Modal,
  Select,
  Spinner,
  Stack,
  Table,
  Textarea,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useEffect, useState } from "react";
import { PERMISSIONS, type LeaveBalance, type PaginatedResponse } from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import { useAttendanceEmployees } from "../attendance/attendance-utils";
import { PageHeading } from "./leave-ui";
import { LEAVE_PAGE_SIZE, formatQuantity, todayKey, useLeaveTypes } from "./leave-utils";

interface AdjustForm {
  employeeId: string;
  leaveTypeId: string;
  amount: string;
  transactionDate: string;
  reason: string;
}

const emptyForm = (): AdjustForm => ({
  employeeId: "",
  leaveTypeId: "",
  amount: "",
  transactionDate: todayKey(),
  reason: "",
});

export function LeaveBalanceManagementPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<AdjustForm>(emptyForm());
  const employeesQuery = useAttendanceEmployees();
  const typesQuery = useLeaveTypes();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(LEAVE_PAGE_SIZE),
  });
  if (search) params.set("search", search);
  if (leaveTypeId) params.set("leaveTypeId", leaveTypeId);

  const balancesQuery = useQuery({
    queryKey: ["leave", "balances", "all", params.toString()],
    queryFn: () =>
      apiRequest<PaginatedResponse<LeaveBalance>>(`/leave-balances?${params.toString()}`),
  });

  const adjustMutation = useMutation({
    mutationFn: () =>
      apiRequest<LeaveBalance>(`/leave-balances/${form.employeeId}/adjustments`, {
        method: "POST",
        body: {
          leaveTypeId: form.leaveTypeId,
          amount: Number(form.amount),
          transactionDate: form.transactionDate,
          reason: form.reason,
        },
      }),
    onSuccess: () => {
      toast.success("Leave balance adjusted");
      setDialogOpen(false);
      setForm(emptyForm());
      void queryClient.invalidateQueries({ queryKey: ["leave"] });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiRequestError ? error.message : "Could not adjust the balance",
      ),
  });

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Leave balance management"
        description="Traceable balances with manual adjustments recorded in the ledger"
        actions={
          hasPermission(PERMISSIONS.LEAVE_BALANCE_ADJUST) ? (
            <Button
              onClick={() => {
                setForm(emptyForm());
                setDialogOpen(true);
              }}
            >
              Adjust balance
            </Button>
          ) : undefined
        }
      />

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                aria-label="Search employee balances"
                placeholder="Search employee name or number"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                clearable
                onClear={() => setSearchInput("")}
                fullWidth
              />
              <Select
                aria-label="Filter balance by leave type"
                value={leaveTypeId}
                onChange={(value) => {
                  setLeaveTypeId(value);
                  setPage(1);
                }}
                options={[
                  { label: "All leave types", value: "" },
                  ...(typesQuery.data?.map((type) => ({ label: type.name, value: type.id })) ?? []),
                ]}
                fullWidth
              />
              <Button
                variant="outlined"
                onClick={() => {
                  setSearchInput("");
                  setLeaveTypeId("");
                  setPage(1);
                }}
              >
                Reset filters
              </Button>
            </div>

            {balancesQuery.isPending ? (
              <Stack direction="row" spacing={12} align="center">
                <Spinner />
                <Typography variant="bodySmall" color="neutral">
                  Loading balances…
                </Typography>
              </Stack>
            ) : balancesQuery.isError ? (
              <Alert tone="error" title="Could not load leave balances">
                {balancesQuery.error instanceof ApiRequestError
                  ? balancesQuery.error.message
                  : "Unexpected error"}
              </Alert>
            ) : (
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
                  { key: "type", header: "Leave type", render: (row) => row.leaveType.name },
                  {
                    key: "period",
                    header: "Period",
                    render: (row) => `${row.periodStart} – ${row.periodEnd}`,
                  },
                  {
                    key: "entitled",
                    header: "Entitled",
                    render: (row) => formatQuantity(row.entitled, row.unit),
                  },
                  {
                    key: "used",
                    header: "Used",
                    render: (row) => formatQuantity(row.used, row.unit),
                  },
                  {
                    key: "reserved",
                    header: "Reserved",
                    render: (row) => formatQuantity(row.reserved, row.unit),
                  },
                  {
                    key: "available",
                    header: "Available",
                    render: (row) => (
                      <Typography variant="bodySmall" className="font-medium">
                        {formatQuantity(row.available, row.unit)}
                      </Typography>
                    ),
                  },
                ]}
                data={balancesQuery.data.items}
                rowKey={(row) => `${row.employeeId}-${row.leaveType.id}-${row.periodStart}`}
                pagination={{
                  page,
                  pageSize: LEAVE_PAGE_SIZE,
                  pageCount: balancesQuery.data.totalPages,
                  total: balancesQuery.data.total,
                  onChange: setPage,
                }}
                emptyText="No leave balances match these filters."
              />
            )}
          </Stack>
        </CardBody>
      </Card>

      <Modal
        open={dialogOpen}
        onOpenChange={(open) => setDialogOpen(open)}
        title="Adjust leave balance"
        size="md"
        footer={
          <>
            <Button variant="outlined" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <LoadingButton
              type="submit"
              form="leave-adjustment-form"
              loading={adjustMutation.isPending}
              disabled={
                !form.employeeId || !form.leaveTypeId || !form.amount || Number(form.amount) === 0
              }
            >
              Save adjustment
            </LoadingButton>
          </>
        }
      >
        <form
          id="leave-adjustment-form"
          onSubmit={(event) => {
            event.preventDefault();
            adjustMutation.mutate();
          }}
        >
          <Stack spacing={14}>
            <Alert tone="info" title="Immutable ledger entry">
              A positive amount adds leave; a negative amount deducts it. The reason is stored with
              the transaction and in the audit log.
            </Alert>
            <Select
              label="Employee"
              value={form.employeeId}
              onChange={(value) => setForm({ ...form, employeeId: value })}
              options={
                employeesQuery.data?.items.map((employee) => ({
                  label: `${employee.fullName} (${employee.employeeNumber})`,
                  value: employee.id,
                })) ?? []
              }
              fullWidth
            />
            <Select
              label="Leave type"
              value={form.leaveTypeId}
              onChange={(value) => setForm({ ...form, leaveTypeId: value })}
              options={
                typesQuery.data
                  ?.filter((type) => type.requiresBalance)
                  .map((type) => ({ label: type.name, value: type.id })) ?? []
              }
              fullWidth
            />
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label="Adjustment amount"
                type="number"
                step="0.5"
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
                helperText="Use a negative value to deduct"
                required
                fullWidth
              />
              <Input
                label="Transaction date"
                type="date"
                value={form.transactionDate}
                onChange={(event) => setForm({ ...form, transactionDate: event.target.value })}
                required
                fullWidth
              />
            </div>
            <Textarea
              label="Reason"
              rows={3}
              value={form.reason}
              onChange={(event) => setForm({ ...form, reason: event.target.value })}
              required
              fullWidth
            />
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
