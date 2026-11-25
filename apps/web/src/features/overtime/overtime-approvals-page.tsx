import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Checkbox,
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
import {
  PERMISSIONS,
  type OvertimeRequest,
  type OvertimeRequestListItem,
  type PaginatedResponse,
} from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import { OvertimeStatusBadge, PageHeading } from "./overtime-ui";
import { OVERTIME_PAGE_SIZE, categoryLabel, formatDateTime, formatMinutes } from "./overtime-utils";

type Decision = "approve" | "reject";

export function OvertimeApprovalsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<{
    request: OvertimeRequestListItem;
    decision: Decision;
  } | null>(null);
  const [comment, setComment] = useState("");
  const [override, setOverride] = useState(false);

  const canReviewAll =
    hasPermission(PERMISSIONS.OVERTIME_READ_ALL) || hasPermission(PERMISSIONS.OVERTIME_MANAGE);
  const statuses = canReviewAll
    ? "PENDING_MANAGER_APPROVAL,PENDING_HR_APPROVAL"
    : "PENDING_MANAGER_APPROVAL";
  const params = new URLSearchParams({
    statuses,
    page: String(page),
    pageSize: String(OVERTIME_PAGE_SIZE),
  });

  const queueQuery = useQuery({
    queryKey: ["overtime", "approvals", statuses, page],
    queryFn: () =>
      apiRequest<PaginatedResponse<OvertimeRequestListItem>>(
        `/overtime/requests?${params.toString()}`,
      ),
  });

  const decisionMutation = useMutation({
    mutationFn: () => {
      if (!target) throw new Error("No request selected");
      return apiRequest<OvertimeRequest>(
        `/overtime/requests/${target.request.id}/${target.decision}`,
        {
          method: "POST",
          body: { comment: comment || null, override },
        },
      );
    },
    onSuccess: () => {
      toast.success(target?.decision === "approve" ? "Overtime approved" : "Overtime rejected");
      closeDialog();
      void queryClient.invalidateQueries({ queryKey: ["overtime", "requests"] });
      void queryClient.invalidateQueries({ queryKey: ["overtime", "approvals"] });
      void queryClient.invalidateQueries({ queryKey: ["overtime", "dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["overtime", "verification"] });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiRequestError ? error.message : "Could not update the request",
      ),
  });

  const closeDialog = () => {
    setTarget(null);
    setComment("");
    setOverride(false);
  };

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Overtime approvals"
        description="Requests waiting for a manager or HR decision in your scope"
        actions={
          <Stack direction="row" spacing={8} wrap>
            <Button variant="outlined" onClick={() => navigate("/overtime/team")}>
              All team requests
            </Button>
            {hasPermission(PERMISSIONS.OVERTIME_VERIFY) ? (
              <Button variant="outlined" onClick={() => navigate("/overtime/verification")}>
                Verification queue
              </Button>
            ) : null}
          </Stack>
        }
      />

      <Card variant="elevated" padding="lg">
        <CardBody>
          {queueQuery.isPending ? (
            <Stack direction="row" spacing={12} align="center">
              <Spinner />
              <Typography variant="bodySmall" color="neutral">
                Loading approval inbox…
              </Typography>
            </Stack>
          ) : queueQuery.isError ? (
            <Alert tone="error" title="Could not load the approval inbox">
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
                        {row.employeeNumber} · {row.department?.name ?? "No department"}
                      </Typography>
                    </Stack>
                  ),
                },
                { key: "date", header: "Work date", render: (row) => row.workDate },
                {
                  key: "window",
                  header: "Planned window",
                  render: (row) =>
                    `${formatDateTime(row.plannedStartAt)} – ${formatDateTime(row.plannedEndAt)}`,
                },
                {
                  key: "category",
                  header: "Category",
                  render: (row) => categoryLabel(row.category),
                },
                {
                  key: "requested",
                  header: "Requested",
                  render: (row) => formatMinutes(row.requestedMinutes),
                },
                {
                  key: "stage",
                  header: "Waiting on",
                  render: (row) => row.approvalStage?.toLowerCase() ?? "—",
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
                    <Stack direction="row" spacing={4} justify="end">
                      <Button
                        variant="text"
                        size="sm"
                        onClick={() => {
                          setTarget({ request: row, decision: "approve" });
                          setComment("");
                          setOverride(false);
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
                        onClick={() => navigate(`/overtime/requests/${row.id}`)}
                      >
                        Detail
                      </Button>
                    </Stack>
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
              emptyText="No overtime requests are waiting for your decision."
            />
          )}
        </CardBody>
      </Card>

      <Modal
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        title={target?.decision === "approve" ? "Approve overtime" : "Reject overtime"}
        size="sm"
        footer={
          <>
            <Button variant="outlined" onClick={closeDialog}>
              Cancel
            </Button>
            <LoadingButton
              loading={decisionMutation.isPending}
              disabled={target?.decision === "reject" && comment.trim().length < 3}
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
              {target.request.employeeName} · {target.request.workDate} ·{" "}
              {formatMinutes(target.request.requestedMinutes)}
            </Typography>
            <Typography variant="caption" color="neutral">
              {target.decision === "reject"
                ? "The request closes and the employee sees this reason."
                : "The request advances to the next stage or becomes ready for actual recording."}
            </Typography>
            <Textarea
              label={target.decision === "reject" ? "Rejection reason" : "Comment"}
              rows={3}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              fullWidth
            />
            {hasPermission(PERMISSIONS.OVERTIME_MANAGE) ? (
              <Checkbox
                label="Override the remaining approval stage (HR only)"
                checked={override}
                onChange={(event) => setOverride(event.target.checked)}
              />
            ) : null}
          </Stack>
        ) : null}
      </Modal>
    </Stack>
  );
}
