import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
  Modal,
  Spinner,
  Stack,
  Textarea,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PERMISSIONS, type LeaveRequest } from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, apiUpload, ApiRequestError, downloadFile } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import { LeaveStatusBadge, PageHeading } from "./leave-ui";
import {
  formatDate,
  formatDateTime,
  formatQuantity,
  halfDayLabel,
  requestModeLabel,
} from "./leave-utils";

type ActionKind = "approve" | "reject" | "cancel" | "withdraw";

export function LeaveRequestDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { hasPermission, user } = useAuth();
  const [action, setAction] = useState<ActionKind | null>(null);
  const [comment, setComment] = useState("");
  const [override, setOverride] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const requestQuery = useQuery({
    queryKey: ["leave", "request", id],
    queryFn: () => apiRequest<LeaveRequest>(`/leave-requests/${id}`),
    enabled: Boolean(id),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["leave"] });
  };

  const actionMutation = useMutation({
    mutationFn: async (kind: ActionKind) => {
      if (kind === "withdraw") {
        return apiRequest<LeaveRequest>(`/leave-requests/${id}/withdraw`, { method: "POST" });
      }
      if (kind === "cancel") {
        return apiRequest<LeaveRequest>(`/leave-requests/${id}/cancel`, {
          method: "POST",
          body: { reason: comment },
        });
      }
      return apiRequest<LeaveRequest>(`/leave-requests/${id}/${kind}`, {
        method: "POST",
        body: { comment: comment || null, override },
      });
    },
    onSuccess: () => {
      toast.success("Leave request updated");
      setAction(null);
      setComment("");
      setOverride(false);
      invalidate();
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiRequestError ? error.message : "Could not update the request",
      ),
  });

  const submitMutation = useMutation({
    mutationFn: () => apiRequest<LeaveRequest>(`/leave-requests/${id}/submit`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Leave request submitted");
      invalidate();
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiRequestError ? error.message : "Could not submit the request",
      ),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a file first");
      const body = new FormData();
      body.append("file", file);
      return apiUpload<LeaveRequest>(`/leave-requests/${id}/attachments`, body);
    },
    onSuccess: () => {
      toast.success("Attachment uploaded");
      setFile(null);
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not upload the file"),
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) =>
      apiRequest<LeaveRequest>(`/leave-requests/${id}/attachments/${attachmentId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Attachment removed");
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not remove the file"),
  });

  if (requestQuery.isPending) {
    return (
      <Stack direction="row" spacing={12} align="center">
        <Spinner />
        <Typography variant="bodySmall" color="neutral">
          Loading leave request…
        </Typography>
      </Stack>
    );
  }

  if (requestQuery.isError) {
    return (
      <Stack spacing={12}>
        <Alert tone="error" title="Could not load the leave request">
          {requestQuery.error instanceof ApiRequestError
            ? requestQuery.error.message
            : "Unexpected error"}
        </Alert>
        <Button variant="outlined" onClick={() => navigate("/leave/requests")}>
          Back to requests
        </Button>
      </Stack>
    );
  }

  const request = requestQuery.data;
  const isOwner = user?.employeeId === request.employeeId;
  const canReview =
    request.status === "PENDING" && hasPermission(PERMISSIONS.LEAVE_REQUEST_APPROVE);
  const canReject = request.status === "PENDING" && hasPermission(PERMISSIONS.LEAVE_REQUEST_REJECT);
  const canWithdraw =
    request.status === "PENDING" &&
    isOwner &&
    hasPermission(PERMISSIONS.LEAVE_REQUEST_WITHDRAW);
  const canCancel =
    request.status === "APPROVED" &&
    (isOwner || hasPermission(PERMISSIONS.LEAVE_REQUEST_READ_ALL)) &&
    hasPermission(PERMISSIONS.LEAVE_REQUEST_CANCEL);
  const canEditAttachments =
    (request.status === "DRAFT" || request.status === "PENDING") &&
    isOwner &&
    hasPermission(PERMISSIONS.LEAVE_REQUEST_CREATE);

  return (
    <Stack spacing={16}>
      <PageHeading
        title={`${request.leaveType.name} request`}
        description={`${request.employeeName} · ${request.employeeNumber}`}
        actions={
          <Stack direction="row" spacing={8} wrap>
            <Button variant="outlined" onClick={() => navigate("/leave/requests")}>
              Back
            </Button>
            {request.status === "DRAFT" &&
            isOwner &&
            hasPermission(PERMISSIONS.LEAVE_REQUEST_SUBMIT) ? (
              <LoadingButton
                loading={submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
              >
                Submit request
              </LoadingButton>
            ) : null}
            {canWithdraw ? (
              <Button variant="outlined" onClick={() => setAction("withdraw")}>
                Withdraw
              </Button>
            ) : null}
            {canCancel ? (
              <Button variant="outlined" onClick={() => setAction("cancel")}>
                Cancel leave
              </Button>
            ) : null}
            {canReview ? <Button onClick={() => setAction("approve")}>Approve</Button> : null}
            {canReject ? (
              <Button variant="outlined" onClick={() => setAction("reject")}>
                Reject
              </Button>
            ) : null}
          </Stack>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Stack spacing={16}>
          <Card variant="elevated" padding="lg">
            <CardBody>
              <Stack spacing={14}>
                <Stack direction="row" justify="between" align="center" wrap spacing={8}>
                  <Typography variant="h6">Request details</Typography>
                  <LeaveStatusBadge status={request.status} />
                </Stack>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Detail label="Leave type" value={request.leaveType.name} />
                  <Detail
                    label="Dates"
                    value={`${formatDate(request.startDate)} – ${formatDate(request.endDate)}`}
                  />
                  <Detail
                    label="Duration"
                    value={formatQuantity(request.duration, request.durationUnit)}
                  />
                  <Detail label="Mode" value={requestModeLabel(request.requestMode)} />
                  {request.requestMode === "HALF_DAY" ? (
                    <Detail label="Half day" value={halfDayLabel(request.halfDayPeriod)} />
                  ) : null}
                  <Detail label="Submitted" value={formatDateTime(request.submittedAt)} />
                  <Detail
                    label="Approval stage"
                    value={request.approvalStage ? request.approvalStage.toLowerCase() : "—"}
                  />
                  <Detail label="Paid leave" value={request.leaveType.isPaid ? "Yes" : "No"} />
                </div>
                <Stack spacing={4}>
                  <Typography variant="caption" color="neutral">
                    Reason
                  </Typography>
                  <Typography variant="bodySmall">{request.reason}</Typography>
                </Stack>
                {request.reviewComments ? (
                  <Stack spacing={4}>
                    <Typography variant="caption" color="neutral">
                      Latest review comment
                    </Typography>
                    <Typography variant="bodySmall">{request.reviewComments}</Typography>
                  </Stack>
                ) : null}
                {request.cancellationReason ? (
                  <Alert tone="warning" title="Cancellation reason">
                    {request.cancellationReason}
                  </Alert>
                ) : null}
              </Stack>
            </CardBody>
          </Card>

          <Card variant="elevated" padding="lg">
            <CardBody>
              <Stack spacing={12}>
                <Typography variant="h6">Requested days</Typography>
                <div className="flex flex-wrap gap-2">
                  {request.days.map((day) => (
                    <span
                      key={day.date}
                      className="rounded-md border border-[var(--nemo-neutral-200)] px-2 py-1 text-xs"
                    >
                      {formatDate(day.date)} · {day.duration}{" "}
                      {day.halfDayPeriod ? `(${halfDayLabel(day.halfDayPeriod)})` : ""}
                    </span>
                  ))}
                </div>
              </Stack>
            </CardBody>
          </Card>
        </Stack>

        <Stack spacing={16}>
          <Card variant="outlined" padding="lg">
            <CardBody>
              <Stack spacing={12}>
                <Typography variant="h6">Approval history</Typography>
                {request.approvals.length === 0 ? (
                  <Typography variant="bodySmall" color="neutral">
                    No approval decisions recorded yet.
                  </Typography>
                ) : (
                  request.approvals.map((entry) => (
                    <Stack key={entry.id} spacing={3}>
                      <Stack direction="row" spacing={8} align="center" wrap>
                        <Typography variant="bodySmall" className="font-medium">
                          {entry.stage}
                        </Typography>
                        <Badge
                          variant="filled"
                          color={entry.decision === "APPROVED" ? "success" : "error"}
                        >
                          {entry.decision.toLowerCase()}
                          {entry.isOverride ? " · override" : ""}
                        </Badge>
                      </Stack>
                      <Typography variant="caption" color="neutral">
                        {entry.actorName} · {formatDateTime(entry.createdAt)}
                      </Typography>
                      {entry.comment ? (
                        <Typography variant="bodySmall">{entry.comment}</Typography>
                      ) : null}
                    </Stack>
                  ))
                )}
              </Stack>
            </CardBody>
          </Card>

          <Card variant="outlined" padding="lg">
            <CardBody>
              <Stack spacing={12}>
                <Typography variant="h6">Attachments</Typography>
                {request.attachments.length === 0 ? (
                  <Typography variant="bodySmall" color="neutral">
                    No attachments.
                  </Typography>
                ) : (
                  request.attachments.map((attachment) => (
                    <Stack
                      key={attachment.id}
                      direction="row"
                      justify="between"
                      align="center"
                      spacing={8}
                    >
                      <Stack spacing={1}>
                        <Typography variant="bodySmall">{attachment.fileName}</Typography>
                        <Typography variant="caption" color="neutral">
                          {Math.ceil(attachment.sizeBytes / 1024)} KB
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={4}>
                        <Button
                          variant="text"
                          size="sm"
                          onClick={() =>
                            void downloadFile(
                              `/leave-requests/${request.id}/attachments/${attachment.id}`,
                              attachment.fileName,
                            )
                          }
                        >
                          Download
                        </Button>
                        {canEditAttachments ? (
                          <Button
                            variant="text"
                            size="sm"
                            onClick={() => deleteAttachmentMutation.mutate(attachment.id)}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </Stack>
                    </Stack>
                  ))
                )}
                {canEditAttachments ? (
                  <Stack spacing={8}>
                    <input
                      type="file"
                      aria-label="Leave attachment"
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                      className="text-sm"
                    />
                    <LoadingButton
                      variant="outlined"
                      loading={uploadMutation.isPending}
                      disabled={!file}
                      onClick={() => uploadMutation.mutate()}
                    >
                      Upload attachment
                    </LoadingButton>
                  </Stack>
                ) : null}
              </Stack>
            </CardBody>
          </Card>

          <Link to="/leave/calendar" className="text-sm text-[var(--nemo-primary-700)] underline">
            Open leave calendar
          </Link>
        </Stack>
      </div>

      <Modal
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAction(null);
            setComment("");
            setOverride(false);
          }
        }}
        title={dialogTitle(action)}
        size="sm"
        footer={
          <>
            <Button
              variant="outlined"
              onClick={() => {
                setAction(null);
                setComment("");
                setOverride(false);
              }}
            >
              Cancel
            </Button>
            <LoadingButton
              loading={actionMutation.isPending}
              disabled={action === "cancel" && comment.trim().length < 5}
              onClick={() => action && actionMutation.mutate(action)}
            >
              Confirm
            </LoadingButton>
          </>
        }
      >
        <Stack spacing={12}>
          <Typography variant="bodySmall" color="neutral">
            {dialogDescription(action, request)}
          </Typography>
          {action === "cancel" ? (
            <Textarea
              label="Cancellation reason"
              rows={3}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              fullWidth
            />
          ) : action === "approve" || action === "reject" ? (
            <>
              <Textarea
                label="Comment"
                rows={3}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                fullWidth
              />
              {hasPermission(PERMISSIONS.LEAVE_REQUEST_OVERRIDE) ? (
                <Checkbox
                  label="Override the remaining approval stage (HR only)"
                  checked={override}
                  onChange={(event) => setOverride(event.target.checked)}
                />
              ) : null}
            </>
          ) : null}
        </Stack>
      </Modal>
    </Stack>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={2}>
      <Typography variant="caption" color="neutral">
        {label}
      </Typography>
      <Typography variant="bodySmall">{value}</Typography>
    </Stack>
  );
}

function dialogTitle(action: ActionKind | null): string {
  if (action === "approve") return "Approve leave request";
  if (action === "reject") return "Reject leave request";
  if (action === "cancel") return "Cancel approved leave";
  if (action === "withdraw") return "Withdraw leave request";
  return "Update leave request";
}

function dialogDescription(action: ActionKind | null, request: LeaveRequest): string {
  if (action === "approve") {
    return `Approve ${request.duration} ${request.durationUnit.toLowerCase()}(s) for ${request.employeeName}?`;
  }
  if (action === "reject") return "The reserved balance will be released and the request closed.";
  if (action === "cancel") {
    return "The balance deduction will be reversed. This action is recorded in the audit log.";
  }
  if (action === "withdraw") return "The request will be withdrawn and any reservation released.";
  return "";
}
