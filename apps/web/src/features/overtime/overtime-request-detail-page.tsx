import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
  Input,
  Modal,
  Spinner,
  Stack,
  Textarea,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PERMISSIONS, type OvertimeRequest } from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, apiUpload, ApiRequestError, downloadFile } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import { OvertimeStatusBadge, PageHeading } from "./overtime-ui";
import { categoryLabel, formatDateTime, formatMinutes, toLocalInputValue } from "./overtime-utils";

type ActionKind = "approve" | "reject" | "withdraw" | "cancel" | "complete" | "verify" | "correct";

export function OvertimeRequestDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { hasPermission, user } = useAuth();
  const [action, setAction] = useState<ActionKind | null>(null);
  const [comment, setComment] = useState("");
  const [override, setOverride] = useState(false);
  const [actualStartAt, setActualStartAt] = useState("");
  const [actualEndAt, setActualEndAt] = useState("");
  const [actualBreakMinutes, setActualBreakMinutes] = useState("0");
  const [verifiedMinutes, setVerifiedMinutes] = useState("");
  const [correctedMinutes, setCorrectedMinutes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const requestQuery = useQuery({
    queryKey: ["overtime", "request", id],
    queryFn: () => apiRequest<OvertimeRequest>(`/overtime/requests/${id}`),
    enabled: Boolean(id),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["overtime", "request", id] });
    void queryClient.invalidateQueries({ queryKey: ["overtime", "requests"] });
    void queryClient.invalidateQueries({ queryKey: ["overtime", "dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["overtime", "approvals"] });
    void queryClient.invalidateQueries({ queryKey: ["overtime", "verification"] });
  };

  const actionMutation = useMutation({
    mutationFn: async (kind: ActionKind) => {
      if (kind === "approve" || kind === "reject") {
        return apiRequest<OvertimeRequest>(`/overtime/requests/${id}/${kind}`, {
          method: "POST",
          body: { comment: comment || null, override },
        });
      }
      if (kind === "withdraw") {
        return apiRequest<OvertimeRequest>(`/overtime/requests/${id}/withdraw`, { method: "POST" });
      }
      if (kind === "cancel") {
        return apiRequest<OvertimeRequest>(`/overtime/requests/${id}/cancel`, {
          method: "POST",
          body: { reason: comment },
        });
      }
      if (kind === "complete") {
        return apiRequest<OvertimeRequest>(`/overtime/requests/${id}/complete`, {
          method: "POST",
          body: {
            ...(actualStartAt ? { actualStartAt: new Date(actualStartAt).toISOString() } : {}),
            ...(actualEndAt ? { actualEndAt: new Date(actualEndAt).toISOString() } : {}),
            actualBreakMinutes: Number(actualBreakMinutes || 0),
          },
        });
      }
      if (kind === "verify") {
        return apiRequest<OvertimeRequest>(`/overtime/requests/${id}/verify`, {
          method: "POST",
          body: {
            ...(verifiedMinutes ? { verifiedMinutes: Number(verifiedMinutes) } : {}),
            reason: comment || null,
          },
        });
      }
      return apiRequest<OvertimeRequest>(`/overtime/requests/${id}/correct`, {
        method: "POST",
        body: { correctedMinutes: Number(correctedMinutes), reason: comment },
      });
    },
    onSuccess: () => {
      toast.success("Overtime request updated");
      closeAction();
      invalidate();
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiRequestError ? error.message : "Could not update the request",
      ),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      apiRequest<OvertimeRequest>(`/overtime/requests/${id}/submit`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Overtime request submitted");
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not submit"),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a file first");
      const body = new FormData();
      body.append("file", file);
      return apiUpload<OvertimeRequest>(`/overtime/requests/${id}/attachments`, body);
    },
    onSuccess: () => {
      toast.success("Attachment uploaded");
      setFile(null);
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not upload the file"),
  });

  const removeAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) =>
      apiRequest<OvertimeRequest>(`/overtime/requests/${id}/attachments/${attachmentId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Attachment removed");
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not remove the file"),
  });

  const closeAction = () => {
    setAction(null);
    setComment("");
    setOverride(false);
    setActualStartAt("");
    setActualEndAt("");
    setActualBreakMinutes("0");
    setVerifiedMinutes("");
    setCorrectedMinutes("");
  };

  const openAction = (kind: ActionKind, request: OvertimeRequest) => {
    setAction(kind);
    setComment("");
    setOverride(false);
    setActualStartAt(toLocalInputValue(request.actualStartAt));
    setActualEndAt(toLocalInputValue(request.actualEndAt));
    setActualBreakMinutes(String(request.actualBreakMinutes ?? request.plannedBreakMinutes));
    setVerifiedMinutes(String(request.verifiedMinutes ?? request.actualMinutes ?? ""));
    setCorrectedMinutes(String(request.verifiedMinutes ?? ""));
  };

  if (requestQuery.isPending) {
    return (
      <Stack direction="row" spacing={12} align="center">
        <Spinner />
        <Typography variant="bodySmall" color="neutral">
          Loading overtime request…
        </Typography>
      </Stack>
    );
  }

  if (requestQuery.isError) {
    return (
      <Stack spacing={12}>
        <Alert tone="error" title="Could not load the overtime request">
          {requestQuery.error instanceof ApiRequestError
            ? requestQuery.error.message
            : "Unexpected error"}
        </Alert>
        <Button variant="outlined" onClick={() => navigate("/overtime/requests")}>
          Back to requests
        </Button>
      </Stack>
    );
  }

  const request = requestQuery.data;
  const pending = request.status.startsWith("PENDING");
  const isOwner = user?.employeeId === request.employeeId;
  const canManage = hasPermission(PERMISSIONS.OVERTIME_MANAGE);
  const canReviewAll =
    hasPermission(PERMISSIONS.OVERTIME_READ_ALL) || hasPermission(PERMISSIONS.OVERTIME_MANAGE);
  const canReviewStage = canReviewAll || request.approvalStage === "MANAGER";
  const canReview = pending && canReviewStage && hasPermission(PERMISSIONS.OVERTIME_APPROVE);
  const canReject = pending && canReviewStage && hasPermission(PERMISSIONS.OVERTIME_REJECT);
  const canWithdraw =
    pending && isOwner && hasPermission(PERMISSIONS.OVERTIME_WITHDRAW_SELF);
  const canCancel =
    ["APPROVED", "PENDING_VERIFICATION", "VERIFIED"].includes(request.status) &&
    ((isOwner && hasPermission(PERMISSIONS.OVERTIME_WITHDRAW_SELF)) || canManage);
  const canComplete =
    ["APPROVED", "PENDING_VERIFICATION"].includes(request.status) &&
    ((isOwner && hasPermission(PERMISSIONS.OVERTIME_UPDATE_SELF)) || canManage);
  const canVerify =
    request.status === "PENDING_VERIFICATION" && hasPermission(PERMISSIONS.OVERTIME_VERIFY);
  const canCorrect = request.status === "VERIFIED" && hasPermission(PERMISSIONS.OVERTIME_CORRECT);
  const canEditAttachments =
    (request.status === "DRAFT" || pending) &&
    ((isOwner && hasPermission(PERMISSIONS.OVERTIME_UPDATE_SELF)) || canManage);

  return (
    <Stack spacing={16}>
      <PageHeading
        title={`Overtime · ${request.workDate}`}
        description={`${request.employeeName} · ${request.employeeNumber}`}
        actions={
          <Stack direction="row" spacing={8} wrap>
            <Button variant="outlined" onClick={() => navigate("/overtime/requests")}>
              Back
            </Button>
            {request.status === "DRAFT" && isOwner && hasPermission(PERMISSIONS.OVERTIME_CREATE) ? (
              <LoadingButton
                loading={submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
              >
                Submit
              </LoadingButton>
            ) : null}
            {canWithdraw ? (
              <Button variant="outlined" onClick={() => openAction("withdraw", request)}>
                Withdraw
              </Button>
            ) : null}
            {canCancel ? (
              <Button variant="outlined" onClick={() => openAction("cancel", request)}>
                Cancel
              </Button>
            ) : null}
            {canReview ? (
              <Button onClick={() => openAction("approve", request)}>Approve</Button>
            ) : null}
            {canReject ? (
              <Button variant="outlined" onClick={() => openAction("reject", request)}>
                Reject
              </Button>
            ) : null}
            {canComplete ? (
              <Button variant="outlined" onClick={() => openAction("complete", request)}>
                Record actual
              </Button>
            ) : null}
            {canVerify ? (
              <Button onClick={() => openAction("verify", request)}>Verify</Button>
            ) : null}
            {canCorrect ? (
              <Button variant="outlined" onClick={() => openAction("correct", request)}>
                Correct
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
                  <OvertimeStatusBadge status={request.status} />
                </Stack>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Detail
                    label="Policy"
                    value={`${request.policy.name} (${request.policy.code})`}
                  />
                  <Detail label="Category" value={categoryLabel(request.category)} />
                  <Detail
                    label="Planned window"
                    value={`${formatDateTime(request.plannedStartAt)} – ${formatDateTime(request.plannedEndAt)}`}
                  />
                  <Detail
                    label="Planned break"
                    value={formatMinutes(request.plannedBreakMinutes)}
                  />
                  <Detail label="Requested" value={formatMinutes(request.requestedMinutes)} />
                  <Detail label="Approved" value={formatMinutes(request.approvedMinutes)} />
                  <Detail label="Actual" value={formatMinutes(request.actualMinutes)} />
                  <Detail label="Verified" value={formatMinutes(request.verifiedMinutes)} />
                  <Detail label="Approval stage" value={request.approvalStage ?? "—"} />
                  <Detail label="Submitted" value={formatDateTime(request.submittedAt)} />
                  <Detail label="Completed" value={formatDateTime(request.completedAt)} />
                  <Detail label="Verified at" value={formatDateTime(request.verifiedAt)} />
                  <Detail label="Verifier" value={request.verifier?.name ?? "—"} />
                  <Detail label="Cancelled at" value={formatDateTime(request.cancelledAt)} />
                </div>
                <Stack spacing={4}>
                  <Typography variant="caption" color="neutral">
                    Reason
                  </Typography>
                  <Typography variant="bodySmall">{request.reason}</Typography>
                </Stack>
                {request.cancellationReason ? (
                  <Alert tone="warning" title="Cancellation reason">
                    {request.cancellationReason}
                  </Alert>
                ) : null}
                {request.attendanceRecordId ? (
                  <Typography variant="caption" color="neutral">
                    Attendance record linked: {request.attendanceRecordId}
                  </Typography>
                ) : null}
              </Stack>
            </CardBody>
          </Card>

          <Card variant="elevated" padding="lg">
            <CardBody>
              <Stack spacing={12}>
                <Typography variant="h6">Approval history</Typography>
                {request.approvals.length === 0 ? (
                  <Typography variant="bodySmall" color="neutral">
                    No decisions recorded yet.
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
                        {entry.approverName} · {formatDateTime(entry.createdAt)}
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
        </Stack>

        <Stack spacing={16}>
          <Card variant="outlined" padding="lg">
            <CardBody>
              <Stack spacing={12}>
                <Typography variant="h6">Corrections</Typography>
                {request.corrections.length === 0 ? (
                  <Typography variant="bodySmall" color="neutral">
                    No verified-duration corrections.
                  </Typography>
                ) : (
                  request.corrections.map((entry) => (
                    <Stack key={entry.id} spacing={2}>
                      <Typography variant="bodySmall" className="font-medium">
                        {formatMinutes(entry.previousValue)} → {formatMinutes(entry.correctedValue)}
                      </Typography>
                      <Typography variant="caption" color="neutral">
                        {entry.correctedBy?.name ?? "HR"} · {formatDateTime(entry.createdAt)}
                      </Typography>
                      <Typography variant="bodySmall">{entry.reason}</Typography>
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
                              `/overtime/requests/${request.id}/attachments/${attachment.id}`,
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
                            onClick={() => removeAttachmentMutation.mutate(attachment.id)}
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
                      aria-label="Overtime attachment"
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
        </Stack>
      </div>

      <Modal
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) closeAction();
        }}
        title={dialogTitle(action)}
        size="sm"
        footer={
          <>
            <Button variant="outlined" onClick={closeAction}>
              Cancel
            </Button>
            <LoadingButton
              loading={actionMutation.isPending}
              disabled={
                (action === "reject" && comment.trim().length < 3) ||
                (action === "cancel" && comment.trim().length < 5) ||
                (action === "correct" && comment.trim().length < 5)
              }
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
          {action === "approve" || action === "reject" ? (
            <>
              <Textarea
                label={action === "reject" ? "Rejection reason" : "Comment"}
                rows={3}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                fullWidth
              />
              {canManage ? (
                <Checkbox
                  label="Override the remaining approval stage (HR only)"
                  checked={override}
                  onChange={(event) => setOverride(event.target.checked)}
                />
              ) : null}
            </>
          ) : null}
          {action === "cancel" ? (
            <Textarea
              label="Cancellation reason"
              rows={3}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              fullWidth
            />
          ) : null}
          {action === "complete" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Actual start"
                  type="datetime-local"
                  value={actualStartAt}
                  onChange={(event) => setActualStartAt(event.target.value)}
                  helperText="Leave both times empty to derive from attendance"
                  fullWidth
                />
                <Input
                  label="Actual end"
                  type="datetime-local"
                  value={actualEndAt}
                  onChange={(event) => setActualEndAt(event.target.value)}
                  fullWidth
                />
              </div>
              <Input
                label="Actual break (minutes)"
                type="number"
                min="0"
                max="240"
                value={actualBreakMinutes}
                onChange={(event) => setActualBreakMinutes(event.target.value)}
                fullWidth
              />
            </>
          ) : null}
          {action === "verify" ? (
            <>
              <Input
                label="Verified minutes"
                type="number"
                min="0"
                value={verifiedMinutes}
                onChange={(event) => setVerifiedMinutes(event.target.value)}
                helperText={`Actual: ${formatMinutes(request.actualMinutes)}`}
                fullWidth
              />
              <Textarea
                label="Reason for difference"
                rows={3}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                helperText="Required when the verified value differs from actual"
                fullWidth
              />
            </>
          ) : null}
          {action === "correct" ? (
            <>
              <Input
                label="Corrected verified minutes"
                type="number"
                min="0"
                value={correctedMinutes}
                onChange={(event) => setCorrectedMinutes(event.target.value)}
                fullWidth
              />
              <Textarea
                label="Correction reason"
                rows={3}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                fullWidth
              />
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
  if (action === "approve") return "Approve overtime";
  if (action === "reject") return "Reject overtime";
  if (action === "withdraw") return "Withdraw overtime";
  if (action === "cancel") return "Cancel overtime";
  if (action === "complete") return "Record actual overtime";
  if (action === "verify") return "Verify overtime";
  if (action === "correct") return "Correct verified overtime";
  return "Update overtime";
}

function dialogDescription(action: ActionKind | null, request: OvertimeRequest): string {
  if (action === "approve")
    return `Approve ${formatMinutes(request.requestedMinutes)} for ${request.employeeName}?`;
  if (action === "reject")
    return "The request will close and the employee will see the rejection reason.";
  if (action === "withdraw")
    return "The request will be withdrawn before a decision. It can be edited and resubmitted.";
  if (action === "cancel")
    return "The request will be cancelled. History and approval decisions are preserved.";
  if (action === "complete")
    return "Actual overtime must be recorded after the work date. Leave both times empty to use the attendance clock-out.";
  if (action === "verify")
    return "Verification makes the duration payroll-eligible for a future phase.";
  if (action === "correct")
    return "A correction preserves the previous verified value and requires a reason.";
  return "";
}
