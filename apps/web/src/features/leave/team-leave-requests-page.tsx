import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Input,
  Select,
  Spinner,
  Stack,
  Table,
  Typography,
} from "@nemo-ui/ui";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LEAVE_REQUEST_STATUSES,
  type LeaveRequest,
  type LeaveRequestStatus,
  type PaginatedResponse,
} from "@peopleops/shared-types";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LeaveStatusBadge, PageHeading } from "./leave-ui";
import { LEAVE_PAGE_SIZE, formatDate, formatQuantity, statusLabel } from "./leave-utils";

export function TeamLeaveRequestsPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LeaveRequestStatus | "">("");
  const [page, setPage] = useState(1);

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
  if (status) params.set("status", status);

  const requestsQuery = useQuery({
    queryKey: ["leave", "requests", "team", params.toString()],
    queryFn: () =>
      apiRequest<PaginatedResponse<LeaveRequest>>(`/leave-requests?${params.toString()}`),
  });

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Team leave requests"
        description="Leave requests from employees within your access scope"
        actions={
          <Button variant="outlined" onClick={() => navigate("/leave/approvals")}>
            Approval inbox
          </Button>
        }
      />

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                aria-label="Search team leave requests"
                placeholder="Search employee, leave type, or reason"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                clearable
                onClear={() => setSearchInput("")}
                fullWidth
              />
              <Select
                aria-label="Filter team leave status"
                value={status}
                onChange={(value) => {
                  setStatus(value as LeaveRequestStatus | "");
                  setPage(1);
                }}
                options={[
                  { label: "All statuses", value: "" },
                  ...LEAVE_REQUEST_STATUSES.map((entry) => ({
                    label: statusLabel(entry),
                    value: entry,
                  })),
                ]}
                fullWidth
              />
              <Button
                variant="outlined"
                onClick={() => {
                  setSearchInput("");
                  setStatus("");
                  setPage(1);
                }}
              >
                Reset filters
              </Button>
            </div>

            {requestsQuery.isPending ? (
              <Stack direction="row" spacing={12} align="center">
                <Spinner />
                <Typography variant="bodySmall" color="neutral">
                  Loading team requests…
                </Typography>
              </Stack>
            ) : requestsQuery.isError ? (
              <Alert tone="error" title="Could not load leave requests">
                {requestsQuery.error instanceof ApiRequestError
                  ? requestsQuery.error.message
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
                  { key: "type", header: "Type", render: (row) => row.leaveType.name },
                  {
                    key: "dates",
                    header: "Dates",
                    render: (row) => `${formatDate(row.startDate)} – ${formatDate(row.endDate)}`,
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
                    key: "stage",
                    header: "Stage",
                    render: (row) => row.approvalStage?.toLowerCase() ?? "—",
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
                        Review
                      </Button>
                    ),
                  },
                ]}
                data={requestsQuery.data.items}
                rowKey={(row) => row.id}
                pagination={{
                  page,
                  pageSize: LEAVE_PAGE_SIZE,
                  pageCount: requestsQuery.data.totalPages,
                  total: requestsQuery.data.total,
                  onChange: setPage,
                }}
                emptyText="No team leave requests match these filters."
              />
            )}
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  );
}
