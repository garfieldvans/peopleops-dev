import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, CardBody, Spinner, Stack, Table, Typography } from "@nemo-ui/ui";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { OvertimeRequestListItem, PaginatedResponse } from "@peopleops/shared-types";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { OvertimeStatusBadge, PageHeading } from "./overtime-ui";
import { OVERTIME_PAGE_SIZE, formatDateTime, formatMinutes } from "./overtime-utils";

export function OvertimeVerificationPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({
    status: "PENDING_VERIFICATION",
    page: String(page),
    pageSize: String(OVERTIME_PAGE_SIZE),
  });

  const queueQuery = useQuery({
    queryKey: ["overtime", "verification", "queue", page],
    queryFn: () =>
      apiRequest<PaginatedResponse<OvertimeRequestListItem>>(
        `/overtime/requests?${params.toString()}`,
      ),
  });

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Overtime verification"
        description="Confirm actual overtime before it becomes eligible for a future payroll phase"
        actions={
          <Button variant="outlined" onClick={() => navigate("/overtime/approvals")}>
            Approval inbox
          </Button>
        }
      />

      <Card variant="elevated" padding="lg">
        <CardBody>
          {queueQuery.isPending ? (
            <Stack direction="row" spacing={12} align="center">
              <Spinner />
              <Typography variant="bodySmall" color="neutral">
                Loading verification queue…
              </Typography>
            </Stack>
          ) : queueQuery.isError ? (
            <Alert tone="error" title="Could not load the verification queue">
              {queueQuery.error instanceof ApiRequestError
                ? queueQuery.error.message
                : "Unexpected error"}
            </Alert>
          ) : !queueQuery.data ? null : (
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
                { key: "date", header: "Work date", render: (row) => row.workDate },
                {
                  key: "actual",
                  header: "Actual",
                  render: (row) => formatMinutes(row.actualMinutes),
                },
                {
                  key: "window",
                  header: "Actual window",
                  render: (row) =>
                    `${formatDateTime(row.actualStartAt)} – ${formatDateTime(row.actualEndAt)}`,
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
                      Review
                    </Button>
                  ),
                },
              ]}
              data={queueQuery.data.items}
              rowKey={(row) => row.id}
              pagination={{
                page,
                pageSize: OVERTIME_PAGE_SIZE,
                pageCount: queueQuery.data.totalPages,
                total: queueQuery.data.total,
                onChange: setPage,
              }}
              emptyText="No overtime requests are waiting for verification."
            />
          )}
        </CardBody>
      </Card>
    </Stack>
  );
}
