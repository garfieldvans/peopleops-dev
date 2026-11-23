import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Modal,
  Select,
  Spinner,
  Stack,
  Table,
  Textarea,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useState } from "react";
import {
  ATTENDANCE_CORRECTION_STATUSES,
  PERMISSIONS,
  type AttendanceCorrection,
  type PaginatedResponse,
} from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import { formatLocal } from "./attendance-utils";

function correctionColor(
  status: AttendanceCorrection["status"],
): "warning" | "success" | "error" | "neutral" {
  if (status === "PENDING") return "warning";
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "error";
  return "neutral";
}

export function AttendanceCorrectionsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState("PENDING");
  const [review, setReview] = useState<{
    correction: AttendanceCorrection;
    decision: "approve" | "reject";
  } | null>(null);
  const [notes, setNotes] = useState("");

  const query = useQuery({
    queryKey: ["attendance-corrections", status],
    queryFn: () =>
      apiRequest<PaginatedResponse<AttendanceCorrection>>(
        `/attendance/corrections?status=${status}&page=1&pageSize=100`,
      ),
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      apiRequest<AttendanceCorrection>(
        `/attendance/corrections/${review!.correction.id}/${review!.decision}`,
        { method: "PATCH", body: { reviewNotes: notes || null } },
      ),
    onSuccess: () => {
      toast.success(review?.decision === "approve" ? "Correction approved" : "Correction rejected");
      void queryClient.invalidateQueries({ queryKey: ["attendance-corrections"] });
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
      setReview(null);
      setNotes("");
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not review"),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<AttendanceCorrection>(`/attendance/corrections/${id}/cancel`, {
        method: "PATCH",
        body: { reason: "Cancelled from the correction list" },
      }),
    onSuccess: () => {
      toast.success("Correction cancelled");
      void queryClient.invalidateQueries({ queryKey: ["attendance-corrections"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not cancel"),
  });

  const canReview = hasPermission(PERMISSIONS.ATTENDANCE_CORRECTION_REVIEW);

  return (
    <Stack spacing={20}>
      <Stack spacing={4}>
        <Typography variant="h4" as="h1">
          Attendance corrections
        </Typography>
        <Typography variant="bodySmall" color="neutral">
          Review time corrections with an auditable approval trail
        </Typography>
      </Stack>

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="max-w-xs">
              <Select
                aria-label="Filter corrections by status"
                value={status}
                onChange={setStatus}
                options={[
                  { label: "All statuses", value: "" },
                  ...ATTENDANCE_CORRECTION_STATUSES.map((entry) => ({
                    label: entry.toLowerCase(),
                    value: entry,
                  })),
                ]}
                fullWidth
              />
            </div>

            {query.isPending ? (
              <Stack direction="row" spacing={12} align="center">
                <Spinner />
                <Typography variant="bodySmall" color="neutral">
                  Loading corrections…
                </Typography>
              </Stack>
            ) : query.isError ? (
              <Alert tone="error" title="Could not load corrections">
                {query.error instanceof ApiRequestError
                  ? query.error.message
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
                          {row.employeeNumber} · {row.workDate}
                        </Typography>
                      </Stack>
                    ),
                  },
                  {
                    key: "type",
                    header: "Type",
                    render: (row) => row.type.replace("_", " ").toLowerCase(),
                  },
                  {
                    key: "original",
                    header: "Original",
                    render: (row) =>
                      `${formatLocal(row.originalClockInLocal)} → ${formatLocal(row.originalClockOutLocal)}`,
                  },
                  {
                    key: "requested",
                    header: "Requested",
                    render: (row) =>
                      `${formatLocal(row.requestedClockInLocal)} → ${formatLocal(row.requestedClockOutLocal)}`,
                  },
                  {
                    key: "reason",
                    header: "Reason",
                    render: (row) => (
                      <Typography variant="caption" className="max-w-xs">
                        {row.reason}
                      </Typography>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => (
                      <Badge variant="filled" color={correctionColor(row.status)}>
                        {row.status.toLowerCase()}
                      </Badge>
                    ),
                  },
                  {
                    key: "actions",
                    header: "",
                    align: "right",
                    render: (row) =>
                      row.status === "PENDING" ? (
                        <Stack direction="row" spacing={4} justify="end">
                          {canReview ? (
                            <>
                              <Button
                                variant="text"
                                size="sm"
                                onClick={() => {
                                  setReview({ correction: row, decision: "approve" });
                                  setNotes("");
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="text"
                                size="sm"
                                onClick={() => {
                                  setReview({ correction: row, decision: "reject" });
                                  setNotes("");
                                }}
                              >
                                Reject
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="text"
                              size="sm"
                              onClick={() => cancelMutation.mutate(row.id)}
                            >
                              Cancel
                            </Button>
                          )}
                        </Stack>
                      ) : (
                        <Typography variant="caption" color="neutral">
                          {row.reviewer?.name ?? "—"}
                        </Typography>
                      ),
                  },
                ]}
                data={query.data.items}
                rowKey={(row) => row.id}
                emptyText="No corrections match this filter."
              />
            )}
          </Stack>
        </CardBody>
      </Card>

      <Modal
        open={review !== null}
        onOpenChange={(next) => !next && setReview(null)}
        title={review?.decision === "approve" ? "Approve correction" : "Reject correction"}
        size="md"
        footer={
          <>
            <Button variant="outlined" onClick={() => setReview(null)}>
              Cancel
            </Button>
            <LoadingButton
              loading={reviewMutation.isPending}
              onClick={() => reviewMutation.mutate()}
            >
              {review?.decision === "approve" ? "Approve" : "Reject"}
            </LoadingButton>
          </>
        }
      >
        <Stack spacing={12}>
          {review ? (
            <Typography variant="bodySmall" color="neutral">
              {review.correction.employeeName} requested a{" "}
              {review.correction.type.replace("_", " ").toLowerCase()} correction for{" "}
              {review.correction.workDate}:{" "}
              {formatLocal(review.correction.requestedClockInLocal)} →{" "}
              {formatLocal(review.correction.requestedClockOutLocal)}.
            </Typography>
          ) : null}
          <Textarea
            label="Review notes"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            fullWidth
          />
        </Stack>
      </Modal>
    </Stack>
  );
}
