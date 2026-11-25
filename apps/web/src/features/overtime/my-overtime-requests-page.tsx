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
  OVERTIME_STATUSES,
  PERMISSIONS,
  type OvertimeRequestListItem,
  type OvertimeStatus,
  type PaginatedResponse,
} from "@peopleops/shared-types";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { useAuth } from "../auth/auth-context";
import { OvertimeStatusBadge, PageHeading } from "./overtime-ui";
import { OVERTIME_PAGE_SIZE, formatDateTime, formatMinutes, statusLabel } from "./overtime-utils";

export function MyOvertimeRequestsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OvertimeStatus | "">("");
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
    pageSize: String(OVERTIME_PAGE_SIZE),
  });
  if (search) params.set("search", search);
  if (status) params.set("status", status);

  const requestsQuery = useQuery({
    queryKey: ["overtime", "requests", "me", params.toString()],
    queryFn: () =>
      apiRequest<PaginatedResponse<OvertimeRequestListItem>>(
        `/overtime/requests/me?${params.toString()}`,
      ),
  });

  return (
    <Stack spacing={16}>
      <PageHeading
        title="My overtime requests"
        description="Drafts, approvals, completed work, and verified overtime"
        actions={
          hasPermission(PERMISSIONS.OVERTIME_CREATE) ? (
            <Button onClick={() => navigate("/overtime/requests/new")}>Request overtime</Button>
          ) : undefined
        }
      />

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                aria-label="Search my overtime requests"
                placeholder="Search reason"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                clearable
                onClear={() => setSearchInput("")}
                fullWidth
              />
              <Select
                aria-label="Filter overtime status"
                value={status}
                onChange={(value) => {
                  setStatus(value as OvertimeStatus | "");
                  setPage(1);
                }}
                options={[
                  { label: "All statuses", value: "" },
                  ...OVERTIME_STATUSES.map((entry) => ({
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
                  Loading overtime requests…
                </Typography>
              </Stack>
            ) : requestsQuery.isError ? (
              <Alert tone="error" title="Could not load your overtime requests">
                {requestsQuery.error instanceof ApiRequestError
                  ? requestsQuery.error.message
                  : "Unexpected error"}
              </Alert>
            ) : (
              <Table
                columns={[
                  { key: "date", header: "Work date", render: (row) => row.workDate },
                  {
                    key: "window",
                    header: "Window",
                    render: (row) =>
                      `${formatDateTime(row.plannedStartAt)} – ${formatDateTime(row.plannedEndAt)}`,
                  },
                  {
                    key: "requested",
                    header: "Requested",
                    render: (row) => formatMinutes(row.requestedMinutes),
                  },
                  {
                    key: "actual",
                    header: "Actual",
                    render: (row) => formatMinutes(row.actualMinutes),
                  },
                  {
                    key: "verified",
                    header: "Verified",
                    render: (row) => formatMinutes(row.verifiedMinutes),
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => <OvertimeStatusBadge status={row.status} />,
                  },
                  {
                    key: "actions",
                    header: "",
                    align: "right",
                    render: (row) => (
                      <Button
                        variant="text"
                        size="sm"
                        onClick={() => navigate(`/overtime/requests/${row.id}`)}
                      >
                        Detail
                      </Button>
                    ),
                  },
                ]}
                data={requestsQuery.data.items}
                rowKey={(row) => row.id}
                pagination={{
                  page,
                  pageSize: OVERTIME_PAGE_SIZE,
                  pageCount: requestsQuery.data.totalPages,
                  total: requestsQuery.data.total,
                  onChange: setPage,
                }}
                emptyText="No overtime requests match these filters."
              />
            )}
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  );
}
