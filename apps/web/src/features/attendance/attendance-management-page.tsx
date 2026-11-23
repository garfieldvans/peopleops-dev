import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Input,
  Select,
  Spinner,
  Stack,
  Table,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ATTENDANCE_STATUSES,
  PERMISSIONS,
  type AttendanceRecord,
  type PaginatedResponse,
} from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError, downloadFile } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import {
  departmentChoiceOptions,
  useBranchOptions,
  useDepartmentTree,
} from "../employees/employee-options";
import {
  ATTENDANCE_PAGE_SIZE,
  formatLocal,
  formatMinutes,
  statusColor,
  statusLabel,
  todayKey,
} from "./attendance-utils";

export function AttendanceManagementPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [from, setFrom] = useState(`${todayKey().slice(0, 7)}-01`);
  const [to, setTo] = useState(todayKey());
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const branchesQuery = useBranchOptions();
  const departmentsQuery = useDepartmentTree();

  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(ATTENDANCE_PAGE_SIZE),
    from,
    to,
    sortBy: "workDate",
    sortDir: "desc",
  });
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  if (branchId) params.set("branchId", branchId);
  if (departmentId) params.set("departmentId", departmentId);

  const recordsQuery = useQuery({
    queryKey: ["attendance", "management", params.toString()],
    queryFn: () =>
      apiRequest<PaginatedResponse<AttendanceRecord>>(`/attendance?${params.toString()}`),
  });

  const exportMutation = useMutation({
    mutationFn: () =>
      downloadFile(`/attendance/export?${params.toString()}`, `attendance-${to}.csv`),
    onSuccess: () => toast.success("Attendance export downloaded"),
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not export attendance"),
  });

  return (
    <Stack spacing={20}>
      <Stack direction="row" justify="between" align="center" wrap spacing={12}>
        <Stack spacing={4}>
          <Typography variant="h4" as="h1">
            Attendance
          </Typography>
          <Typography variant="bodySmall" color="neutral">
            Attendance records in your access scope
          </Typography>
        </Stack>
        {hasPermission(PERMISSIONS.ATTENDANCE_EXPORT) ? (
          <LoadingButton
            variant="outlined"
            loading={exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
          >
            Export CSV
          </LoadingButton>
        ) : null}
      </Stack>

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Input
                aria-label="Search attendance"
                placeholder="Search name or employee number"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                clearable
                onClear={() => setSearchInput("")}
                fullWidth
              />
              <div>
                <Typography variant="caption" color="neutral">
                  From
                </Typography>
                <Input
                  type="date"
                  value={from}
                  onChange={(event) => {
                    setFrom(event.target.value);
                    setPage(1);
                  }}
                  fullWidth
                />
              </div>
              <div>
                <Typography variant="caption" color="neutral">
                  To
                </Typography>
                <Input
                  type="date"
                  value={to}
                  onChange={(event) => {
                    setTo(event.target.value);
                    setPage(1);
                  }}
                  fullWidth
                />
              </div>
              <Select
                aria-label="Filter attendance status"
                value={status}
                onChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
                options={[
                  { label: "All statuses", value: "" },
                  ...ATTENDANCE_STATUSES.map((entry) => ({
                    label: statusLabel(entry),
                    value: entry,
                  })),
                ]}
                fullWidth
              />
              <Select
                aria-label="Filter by branch"
                value={branchId}
                onChange={(value) => {
                  setBranchId(value);
                  setPage(1);
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
                aria-label="Filter by department"
                value={departmentId}
                onChange={(value) => {
                  setDepartmentId(value);
                  setPage(1);
                }}
                options={[
                  { label: "All departments", value: "" },
                  ...departmentChoiceOptions(departmentsQuery.data ?? []),
                ]}
                fullWidth
              />
              <Button
                variant="outlined"
                onClick={() => {
                  setSearchInput("");
                  setStatus("");
                  setBranchId("");
                  setDepartmentId("");
                  setFrom(`${todayKey().slice(0, 7)}-01`);
                  setTo(todayKey());
                  setPage(1);
                }}
              >
                Reset filters
              </Button>
            </div>

            {recordsQuery.isPending ? (
              <Stack direction="row" spacing={12} align="center">
                <Spinner />
                <Typography variant="bodySmall" color="neutral">
                  Loading attendance…
                </Typography>
              </Stack>
            ) : recordsQuery.isError ? (
              <Alert tone="error" title="Could not load attendance">
                {recordsQuery.error instanceof ApiRequestError
                  ? recordsQuery.error.message
                  : "Unexpected error"}
              </Alert>
            ) : (
              <Table
                columns={[
                  {
                    key: "employee",
                    header: "Employee",
                    render: (row) => (
                      <Stack spacing={2}>
                        <Typography variant="bodySmall" className="font-medium">
                          {row.employeeName}
                        </Typography>
                        <Typography variant="caption" color="neutral">
                          {row.employeeNumber}
                        </Typography>
                      </Stack>
                    ),
                  },
                  { key: "date", header: "Work date", render: (row) => row.workDate },
                  {
                    key: "schedule",
                    header: "Schedule",
                    render: (row) =>
                      [row.workSchedule?.name, row.shift?.name].filter(Boolean).join(" / ") || "—",
                  },
                  { key: "in", header: "Clock-in", render: (row) => formatLocal(row.clockInLocal) },
                  { key: "out", header: "Clock-out", render: (row) => formatLocal(row.clockOutLocal) },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => (
                      <Stack direction="row" spacing={4} align="center" wrap>
                        <Badge variant="filled" color={statusColor(row.status)}>
                          {statusLabel(row.status)}
                        </Badge>
                        {row.hasPendingCorrection ? (
                          <Badge variant="outlined" color="warning">
                            correction
                          </Badge>
                        ) : null}
                      </Stack>
                    ),
                  },
                  {
                    key: "late",
                    header: "Late / early",
                    render: (row) => `${row.lateMinutes}m / ${row.earlyLeaveMinutes}m`,
                  },
                  {
                    key: "worked",
                    header: "Worked",
                    render: (row) => formatMinutes(row.workedMinutes),
                  },
                  {
                    key: "actions",
                    header: "",
                    align: "right",
                    render: (row) => (
                      <Button
                        variant="text"
                        size="sm"
                        onClick={() => navigate(`/attendance/${row.id}`)}
                      >
                        Detail
                      </Button>
                    ),
                  },
                ]}
                data={recordsQuery.data.items}
                rowKey={(row) => row.id}
                pagination={{
                  page,
                  pageSize: ATTENDANCE_PAGE_SIZE,
                  pageCount: recordsQuery.data.totalPages,
                  total: recordsQuery.data.total,
                  onChange: setPage,
                }}
                emptyText="No attendance records match these filters."
              />
            )}
            <Stack direction="row" spacing={12}>
              <Link
                to="/attendance/corrections"
                className="text-sm text-[var(--nemo-primary-700)] underline"
              >
                Review corrections
              </Link>
              <Link
                to="/attendance/assignments"
                className="text-sm text-[var(--nemo-primary-700)] underline"
              >
                Schedule assignments
              </Link>
            </Stack>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  );
}
