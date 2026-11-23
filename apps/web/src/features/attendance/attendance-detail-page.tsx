import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Card,
  CardBody,
  Input,
  Spinner,
  Stack,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  PERMISSIONS,
  type AttendanceRecord,
} from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import {
  formatLocal,
  formatMinutes,
  statusColor,
  statusLabel,
} from "./attendance-utils";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack spacing={2}>
      <Typography variant="caption" color="neutral">
        {label}
      </Typography>
      <Typography variant="bodySmall">{value ?? "—"}</Typography>
    </Stack>
  );
}

export function AttendanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const recordQuery = useQuery({
    queryKey: ["attendance", "detail", id],
    queryFn: () => apiRequest<AttendanceRecord>(`/attendance/${id}`),
  });

  const record = recordQuery.data;

  useEffect(() => {
    if (!record) return;
    setClockIn(record.clockInLocal?.slice(0, 16) ?? "");
    setClockOut(record.clockOutLocal?.slice(0, 16) ?? "");
  }, [record]);

  const mutation = useMutation({
    mutationFn: () => {
      if (reason.trim().length < 5) {
        throw new ApiRequestError("Provide a reason of at least 5 characters", 400, "REASON_REQUIRED");
      }
      return apiRequest<AttendanceRecord>(`/attendance/${id}`, {
        method: "PATCH",
        body: {
          clockInAt: clockIn ? new Date(clockIn).toISOString() : null,
          clockOutAt: clockOut ? new Date(clockOut).toISOString() : null,
          reason,
        },
      });
    },
    onSuccess: () => {
      toast.success("Attendance updated");
      setReason("");
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (error) => {
      const message =
        error instanceof ApiRequestError ? error.message : "Could not update attendance";
      setFormError(message);
      toast.error(message);
    },
  });

  if (recordQuery.isPending) {
    return (
      <Stack direction="row" spacing={12} align="center">
        <Spinner />
        <Typography variant="bodySmall" color="neutral">
          Loading record…
        </Typography>
      </Stack>
    );
  }

  if (recordQuery.isError || !record) {
    return (
      <Alert tone="error" title="Could not load this attendance record">
        {recordQuery.error instanceof ApiRequestError
          ? recordQuery.error.message
          : "Unexpected error"}
      </Alert>
    );
  }

  return (
    <Stack spacing={20}>
      <Stack direction="row" justify="between" align="start" wrap spacing={12}>
        <Stack spacing={4}>
          <Link to="/attendance" className="text-sm text-[var(--nemo-primary-700)] underline">
            ← Attendance
          </Link>
          <Typography variant="h4" as="h1">
            {record.employeeName}
          </Typography>
          <Typography variant="bodySmall" color="neutral">
            {record.employeeNumber} · {record.workDate} · {record.timezone}
          </Typography>
        </Stack>
        <Badge variant="filled" color={statusColor(record.status)}>
          {statusLabel(record.status)}
        </Badge>
      </Stack>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card variant="outlined">
          <CardBody>
            <Stack spacing={12}>
              <Typography variant="h6">Attendance</Typography>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Scheduled start" value={formatLocal(record.scheduledStartLocal)} />
                <Field label="Scheduled end" value={formatLocal(record.scheduledEndLocal)} />
                <Field label="Clock-in" value={formatLocal(record.clockInLocal)} />
                <Field label="Clock-out" value={formatLocal(record.clockOutLocal)} />
                <Field label="Worked" value={formatMinutes(record.workedMinutes)} />
                <Field
                  label="Break taken"
                  value={`${formatMinutes(record.breakMinutesTaken)} / ${formatMinutes(record.expectedBreakMinutes)} expected`}
                />
                <Field label="Late" value={`${record.lateMinutes} minutes`} />
                <Field label="Early leave" value={`${record.earlyLeaveMinutes} minutes`} />
                <Field label="Schedule" value={record.workSchedule?.name} />
                <Field label="Shift" value={record.shift?.name} />
                <Field label="Correction applied" value={record.isCorrected ? "Yes" : "No"} />
                <Field
                  label="Pending correction"
                  value={record.hasPendingCorrection ? "Yes" : "No"}
                />
              </div>
              {record.breaks.length > 0 ? (
                <>
                  <Typography variant="h6">Breaks</Typography>
                  {record.breaks.map((entry) => (
                    <Typography key={entry.id} variant="bodySmall">
                      {new Date(entry.startedAt).toLocaleString()} –{" "}
                      {entry.endedAt ? new Date(entry.endedAt).toLocaleString() : "running"}{" "}
                      {entry.durationMinutes !== null
                        ? `(${formatMinutes(entry.durationMinutes)})`
                        : ""}
                    </Typography>
                  ))}
                </>
              ) : null}
            </Stack>
          </CardBody>
        </Card>

        {hasPermission(PERMISSIONS.ATTENDANCE_MANAGE) ? (
          <Card variant="outlined">
            <CardBody>
              <Stack spacing={12}>
                <Typography variant="h6">Manual correction</Typography>
                <Typography variant="caption" color="neutral">
                  Times are interpreted in your browser timezone. The API recalculates late,
                  early-leave, break and worked minutes.
                </Typography>
                {formError ? (
                  <Alert tone="error" title="Could not save">
                    {formError}
                  </Alert>
                ) : null}
                <div>
                  <Typography variant="caption" color="neutral">
                    Clock-in
                  </Typography>
                  <Input
                    type="datetime-local"
                    value={clockIn}
                    onChange={(event) => setClockIn(event.target.value)}
                    fullWidth
                  />
                </div>
                <div>
                  <Typography variant="caption" color="neutral">
                    Clock-out
                  </Typography>
                  <Input
                    type="datetime-local"
                    value={clockOut}
                    onChange={(event) => setClockOut(event.target.value)}
                    fullWidth
                  />
                </div>
                <div>
                  <Typography variant="caption" color="neutral">
                    Reason
                  </Typography>
                  <Input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Why is this record being changed?"
                    fullWidth
                  />
                </div>
                <LoadingButton
                  loading={mutation.isPending}
                  onClick={() => mutation.mutate()}
                >
                  Save correction
                </LoadingButton>
              </Stack>
            </CardBody>
          </Card>
        ) : null}
      </div>
    </Stack>
  );
}
