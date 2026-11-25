import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Modal,
  Spinner,
  Stack,
  Table,
  Textarea,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LeaveRequest, PaginatedResponse } from "@peopleops/shared-types";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import { PageHeading } from "./leave-ui";
import { LEAVE_PAGE_SIZE, formatDate, formatQuantity } from "./leave-utils";

type Decision = "approve" | "reject";

export function LeaveApprovalInboxPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<{ request: LeaveRequest; decision: Decision } | null>(null);
  const [comment, setComment] = useState("");

  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(LEAVE_PAGE_SIZE),
    status: "PENDING",
  });

  const inboxQuery = useQuery({
    queryKey: ["leave", "requests", "inbox", params.toString()],
    queryFn: () =>
      apiRequest<PaginatedResponse<LeaveRequest>>(`/leave-requests?${params.toString()}`),
  });

  const decisionMutation = useMutation({
    mutationFn: () => {
      if (!target) throw new Error("No request selected");
      return apiRequest<LeaveRequest>(`/leave-requests/${target.request.id}/${target.decision}`, {
        method: "POST",
        body: { comment: comment || null },
      });
    },
    onSuccess: () => {
      toast.success(target?.decision === "approve" ? "Leave approved" : "Leave rejected");
      setTarget(null);
      setComment("");
      void queryClient.invalidateQueries({ queryKey: ["leave"] });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiRequestError ? error.message : "Could not update the request",
      ),
  });

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Leave approval inbox"
        description="Pending requests waiting for your manager or HR decision"
        actions={
          <Button variant="outlined" onClick={() => navigate("/leave/team")}>
            All team requests
          </Button>
        }
      />

      <Card variant="elevated" padding="lg">
        <CardBody>
          {inboxQuery.isPending ? (
            <Stack direction="row" spacing={12} align="center">
              <Spinner />
              <Typography variant="bodySmall" color="neutral">
                Loading approval inbox…
              </Typography>
            </Stack>
          ) : inboxQuery.isError ? (
            <Alert tone="error" title="Could not load the approval inbox">
              {inboxQuery.error instanceof ApiRequestError
                ? inboxQuery.error.message
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
                  key: "stage",
                  header: "Waiting on",
                  render: (row) => row.approvalStage?.toLowerCase() ?? "—",
                },
                {
                  key: "reason",
                  header: "Reason",
                  render: (row) => (
                    <Typography variant="caption" color="neutral">
                      {row.reason.length > 60 ? `${row.reason.slice(0, 60)}…` : row.reason}
                    </Typography>
                  ),
                },
                {
                  key: "actions",
                  header: "",
                  align: "right",
                  render: (row) => (
                    <Stack direction="row" spacing={4} justify="end">
                      <Button
                        variant="text"
                        size="sm"
                        onClick={() => {
                          setTarget({ request: row, decision: "approve" });
                          setComment("");
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="text"
                        size="sm"
                        onClick={() => {
                          setTarget({ request: row, decision: "reject" });
                          setComment("");
                        }}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="text"
                        size="sm"
                        onClick={() => navigate(`/leave/requests/${row.id}`)}
                      >
                        Detail
                      </Button>
                    </Stack>
                  ),
                },
              ]}
              data={inboxQuery.data.items}
              rowKey={(row) => row.id}
              pagination={{
                page,
                pageSize: LEAVE_PAGE_SIZE,
                pageCount: inboxQuery.data.totalPages,
                total: inboxQuery.data.total,
                onChange: setPage,
              }}
              emptyText="No pending leave requests in your scope."
            />
          )}
        </CardBody>
      </Card>

      <Modal
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null);
            setComment("");
          }
        }}
        title={target?.decision === "approve" ? "Approve leave request" : "Reject leave request"}
        size="sm"
        footer={
          <>
            <Button
              variant="outlined"
              onClick={() => {
                setTarget(null);
                setComment("");
              }}
            >
              Cancel
            </Button>
            <LoadingButton
              loading={decisionMutation.isPending}
              onClick={() => decisionMutation.mutate()}
            >
              Confirm
            </LoadingButton>
          </>
        }
      >
        {target ? (
          <Stack spacing={12}>
            <Typography variant="bodySmall">
              {target.request.employeeName} · {target.request.leaveType.name} ·{" "}
              {formatDate(target.request.startDate)} – {formatDate(target.request.endDate)}
            </Typography>
            <Typography variant="caption" color="neutral">
              The request will advance to the next approval stage or close based on the policy.
            </Typography>
            <Textarea
              label="Comment"
              rows={3}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              fullWidth
            />
          </Stack>
        ) : null}
      </Modal>
    </Stack>
  );
}
