import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Spinner,
  Stack,
  Table,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useState } from "react";
import type {
  AttendanceCalendar,
  AttendanceCorrection,
  AttendanceRecord,
  PaginatedResponse,
} from "@peopleops/shared-types";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import { AttendanceCalendarGrid } from "./attendance-calendar";
import { AttendanceCorrectionDialog } from "./attendance-correction-dialog";
import {
  formatLocal,
  formatMinutes,
  statusColor,
  statusLabel,
} from "./attendance-utils";

export function MyAttendancePage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [month, setMonth] = useState(() => new Date().toLocaleDateString("en-CA").slice(0, 7));
  const [correctionRecord, setCorrectionRecord] = useState<AttendanceRecord | null>(null);

  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year ?? 2026, monthNumber ?? 1, 0).getDate();
  const from = `${month}-01`;
  const to = `${month}-${String(lastDay).padStart(2, "0")}`;

  const calendarQuery = useQuery({
    queryKey: ["attendance", "calendar", "me", month],
    queryFn: () =>
      apiRequest<AttendanceCalendar>(`/attendance/me/calendar?month=${month}`),
  });

  const recordsQuery = useQuery({
    queryKey: ["attendance", "me", month],
    queryFn: () =>
      apiRequest<PaginatedResponse<AttendanceRecord>>(
        `/attendance/me?from=${from}&to=${to}&pageSize=100`,
      ),
  });

  const correctionsQuery = useQuery({
    queryKey: ["attendance-corrections", "me", "PENDING"],
    queryFn: () =>
      apiRequest<PaginatedResponse<AttendanceCorrection>>(
        "/attendance/corrections?status=PENDING&pageSize=100",
      ),
  });

  const cancelMutation = useMutation({
    mutationFn: (correctionId: string) =>
      apiRequest<AttendanceCorrection>(`/attendance/corrections/${correctionId}/cancel`, {
        method: "PATCH",
        body: { reason: "Cancelled by employee" },
      }),
    onSuccess: () => {
      toast.success("Correction request cancelled");
      void queryClient.invalidateQueries({ queryKey: ["attendance-corrections"] });
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not cancel"),
  });

  const records = recordsQuery.data?.items ?? [];
  const pending = correctionsQuery.data?.items ?? [];

  return (
    <Stack spacing={20}>
      <Stack spacing={4}>
        <Typography variant="h4" as="h1">
          My attendance
        </Typography>
        <Typography variant="bodySmall" color="neutral">
          Clock-in history, calendar, and correction requests
        </Typography>
      </Stack>

      <AttendanceCalendarGrid
        calendar={calendarQuery.data}
        month={month}
        onMonthChange={setMonth}
        loading={calendarQuery.isPending}
        error={
          calendarQuery.error instanceof ApiRequestError
            ? calendarQuery.error
            : calendarQuery.error
              ? new Error("Could not load calendar")
              : null
        }
      />

      {pending.length > 0 ? (
        <Card variant="outlined">
          <CardBody>
            <Stack spacing={12}>
              <Typography variant="h6">Pending corrections</Typography>
              {pending.map((correction) => (
                <Stack
                  key={correction.id}
                  direction="row"
                  justify="between"
                  align="center"
                  wrap
                  spacing={8}
                >
                  <Stack spacing={2}>
                    <Typography variant="bodySmall">
                      {correction.workDate} · {correction.type.replace("_", " ").toLowerCase()}
                    </Typography>
                    <Typography variant="caption" color="neutral">
                      {formatLocal(correction.requestedClockInLocal)} →{" "}
                      {formatLocal(correction.requestedClockOutLocal)} · {correction.reason}
                    </Typography>
                  </Stack>
                  <LoadingButton
                    variant="outlined"
                    size="sm"
                    loading={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(correction.id)}
                  >
                    Cancel
                  </LoadingButton>
                </Stack>
              ))}
            </Stack>
          </CardBody>
        </Card>
      ) : null}

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <Typography variant="h6">Records in {month}</Typography>
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
                  { key: "date", header: "Date", render: (row) => row.workDate },
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
                      <Badge variant="filled" color={statusColor(row.status)}>
                        {statusLabel(row.status)}
                      </Badge>
                    ),
                  },
                  {
                    key: "worked",
                    header: "Worked",
                    render: (row) => formatMinutes(row.workedMinutes),
                  },
                  {
                    key: "late",
                    header: "Late",
                    render: (row) => `${row.lateMinutes}m`,
                  },
                  {
                    key: "actions",
                    header: "",
                    align: "right",
                    render: (row) => (
                      <Button
                        variant="text"
                        size="sm"
                        disabled={row.hasPendingCorrection}
                        onClick={() => setCorrectionRecord(row)}
                      >
                        {row.hasPendingCorrection ? "Pending" : "Correct"}
                      </Button>
                    ),
                  },
                ]}
                data={records}
                rowKey={(row) => row.id}
                emptyText="No attendance records in this month."
              />
            )}
          </Stack>
        </CardBody>
      </Card>

      <AttendanceCorrectionDialog
        record={correctionRecord}
        open={correctionRecord !== null}
        onClose={() => setCorrectionRecord(null)}
      />
    </Stack>
  );
}
