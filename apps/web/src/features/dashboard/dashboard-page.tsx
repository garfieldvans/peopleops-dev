import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Card,
  CardBody,
  Divider,
  Spinner,
  Stack,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { Link } from "react-router-dom";
import {
  PERMISSIONS,
  type AttendanceDashboard,
  type AttendanceOverview,
} from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import { formatLocal, formatMinutes } from "../attendance/attendance-utils";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card variant="outlined" padding="md">
      <CardBody>
        <Stack spacing={4}>
          <Typography variant="caption" color="neutral">
            {label}
          </Typography>
          <Typography variant="h5">{value}</Typography>
        </Stack>
      </CardBody>
    </Card>
  );
}

function stateLabel(state: AttendanceDashboard["state"]): string {
  const labels: Record<AttendanceDashboard["state"], string> = {
    NOT_CLOCKED_IN: "Not clocked in",
    WORKING: "Working",
    ON_BREAK: "On break",
    CLOCKED_OUT: "Clocked out",
    DAY_OFF: "Day off",
    HOLIDAY: "Holiday",
    ON_LEAVE: "On leave",
    NO_EMPLOYEE: "No employee profile",
  };
  return labels[state];
}

function stateColor(
  state: AttendanceDashboard["state"],
): "success" | "warning" | "error" | "neutral" | "primary" {
  if (state === "WORKING") return "success";
  if (state === "ON_BREAK" || state === "NOT_CLOCKED_IN") return "warning";
  if (state === "HOLIDAY" || state === "ON_LEAVE") return "primary";
  if (state === "CLOCKED_OUT") return "primary";
  return "neutral";
}

export function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  const selfQuery = useQuery({
    queryKey: ["attendance", "dashboard"],
    queryFn: () => apiRequest<AttendanceDashboard>("/attendance/dashboard"),
    enabled: hasPermission(PERMISSIONS.ATTENDANCE_READ),
    retry: false,
  });

  const overviewQuery = useQuery({
    queryKey: ["attendance", "overview"],
    queryFn: () => apiRequest<AttendanceOverview>("/attendance/overview"),
    enabled: hasPermission(PERMISSIONS.ATTENDANCE_READ_ALL),
  });

  const actionMutation = useMutation({
    mutationFn: (action: "clock-in" | "clock-out" | "breaks/start" | "breaks/end") =>
      apiRequest(`/attendance/${action}`, { method: "POST" }),
    onSuccess: (_, action) => {
      const label =
        action === "clock-in"
          ? "Clocked in"
          : action === "clock-out"
            ? "Clocked out"
            : action === "breaks/start"
              ? "Break started"
              : "Break ended";
      toast.success(label);
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Attendance action failed"),
  });

  const self = selfQuery.data;
  const unlinked = selfQuery.error instanceof ApiRequestError && selfQuery.error.status === 404;
  const overview = overviewQuery.data;

  return (
    <Stack spacing={24}>
      <Stack spacing={4}>
        <Typography variant="h4" as="h1">
          Welcome, {user?.name}
        </Typography>
        <Typography variant="bodySmall" color="neutral">
          Today&apos;s attendance and people operations overview
        </Typography>
      </Stack>

      {overview ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="Scheduled today" value={overview.scheduledEmployees} />
          <Stat label="Present" value={overview.present} />
          <Stat label="Late" value={overview.late} />
          <Stat label="On leave" value={overview.onLeave} />
          <Stat label="Incomplete" value={overview.incomplete} />
          <Stat label="Pending corrections" value={overview.pendingCorrections} />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {hasPermission(PERMISSIONS.ATTENDANCE_READ) ? (
          <Card variant="elevated" padding="lg">
            <CardBody>
              <Stack spacing={16}>
                <Stack direction="row" justify="between" align="start" wrap spacing={8}>
                  <Stack spacing={4}>
                    <Typography variant="h6">My attendance</Typography>
                    <Typography variant="caption" color="neutral">
                      {self?.date ?? "Today"} · {self?.timezone ?? "Company timezone"}
                    </Typography>
                  </Stack>
                  {self ? (
                    <Badge variant="filled" color={stateColor(self.state)}>
                      {stateLabel(self.state)}
                    </Badge>
                  ) : null}
                </Stack>

                {selfQuery.isPending ? (
                  <Stack direction="row" spacing={12} align="center">
                    <Spinner />
                    <Typography variant="bodySmall" color="neutral">
                      Loading today&apos;s attendance…
                    </Typography>
                  </Stack>
                ) : unlinked ? (
                  <Typography variant="bodySmall" color="neutral">
                    This account is not linked to an employee record.
                  </Typography>
                ) : selfQuery.isError ? (
                  <Alert tone="error" title="Could not load attendance">
                    {selfQuery.error instanceof ApiRequestError
                      ? selfQuery.error.message
                      : "Unexpected error"}
                  </Alert>
                ) : self ? (
                  <Stack spacing={14}>
                    <Stack spacing={4}>
                      <Typography variant="bodySmall">
                        {self.schedule?.workSchedule.name ?? "No working schedule"}
                        {self.schedule?.shift ? ` · ${self.schedule.shift.name}` : ""}
                      </Typography>
                      <Typography variant="caption" color="neutral">
                        {self.schedule
                          ? `${formatLocal(self.schedule.scheduledStartLocal)} → ${formatLocal(self.schedule.scheduledEndLocal)}`
                          : "Enjoy your day off."}
                      </Typography>
                      {self.holiday ? (
                        <Typography variant="caption" color="neutral">
                          Holiday: {self.holiday.name}
                        </Typography>
                      ) : null}
                      {self.leave ? (
                        <Typography variant="caption" color="neutral">
                          On leave: {self.leave.leaveType.name}
                          {self.leave.requestMode === "HALF_DAY"
                            ? ` (${self.leave.halfDayPeriod === "FIRST_HALF" ? "first half" : "second half"})`
                            : ""}
                        </Typography>
                      ) : null}
                    </Stack>

                    <Stack direction="row" spacing={8} wrap>
                      {self.state === "NOT_CLOCKED_IN" &&
                      hasPermission(PERMISSIONS.ATTENDANCE_CLOCK_IN) ? (
                        <LoadingButton
                          loading={actionMutation.isPending}
                          onClick={() => actionMutation.mutate("clock-in")}
                        >
                          Clock in
                        </LoadingButton>
                      ) : null}
                      {(self.state === "WORKING" || self.state === "ON_BREAK") &&
                      hasPermission(PERMISSIONS.ATTENDANCE_CLOCK_OUT) ? (
                        <LoadingButton
                          variant="outlined"
                          loading={actionMutation.isPending}
                          onClick={() => actionMutation.mutate("clock-out")}
                        >
                          Clock out
                        </LoadingButton>
                      ) : null}
                      {self.state === "WORKING" &&
                      hasPermission(PERMISSIONS.ATTENDANCE_CLOCK_IN) ? (
                        <LoadingButton
                          variant="outlined"
                          loading={actionMutation.isPending}
                          onClick={() => actionMutation.mutate("breaks/start")}
                        >
                          Start break
                        </LoadingButton>
                      ) : null}
                      {self.state === "ON_BREAK" &&
                      hasPermission(PERMISSIONS.ATTENDANCE_CLOCK_OUT) ? (
                        <LoadingButton
                          loading={actionMutation.isPending}
                          onClick={() => actionMutation.mutate("breaks/end")}
                        >
                          End break
                        </LoadingButton>
                      ) : null}
                      <Link
                        to="/attendance/me"
                        className="self-center text-sm text-[var(--nemo-primary-700)] underline"
                      >
                        My attendance
                      </Link>
                    </Stack>

                    {self.record ? (
                      <>
                        <Divider />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Stack spacing={2}>
                            <Typography variant="caption" color="neutral">
                              Clock-in
                            </Typography>
                            <Typography variant="bodySmall">
                              {formatLocal(self.record.clockInLocal)}
                            </Typography>
                          </Stack>
                          <Stack spacing={2}>
                            <Typography variant="caption" color="neutral">
                              Clock-out
                            </Typography>
                            <Typography variant="bodySmall">
                              {formatLocal(self.record.clockOutLocal)}
                            </Typography>
                          </Stack>
                          <Stack spacing={2}>
                            <Typography variant="caption" color="neutral">
                              Worked
                            </Typography>
                            <Typography variant="bodySmall">
                              {formatMinutes(self.record.workedMinutes)}
                            </Typography>
                          </Stack>
                          <Stack spacing={2}>
                            <Typography variant="caption" color="neutral">
                              Late / early leave
                            </Typography>
                            <Typography variant="bodySmall">
                              {self.record.lateMinutes}m / {self.record.earlyLeaveMinutes}m
                            </Typography>
                          </Stack>
                        </div>
                      </>
                    ) : null}
                  </Stack>
                ) : null}
              </Stack>
            </CardBody>
          </Card>
        ) : null}

        <Card variant="elevated" padding="lg">
          <CardBody>
            <Stack spacing={12}>
              <Typography variant="h6">PeopleOps</Typography>
              <Typography variant="bodySmall" color="neutral">
                Jump into the modules available for your role.
              </Typography>
              {hasPermission(PERMISSIONS.ATTENDANCE_READ_ALL) ||
              hasPermission(PERMISSIONS.ATTENDANCE_READ_TEAM) ? (
                <Link to="/attendance" className="text-sm text-[var(--nemo-primary-700)] underline">
                  Attendance management
                </Link>
              ) : null}
              {hasPermission(PERMISSIONS.ATTENDANCE_CORRECTION_READ) ? (
                <Link
                  to="/attendance/corrections"
                  className="text-sm text-[var(--nemo-primary-700)] underline"
                >
                  Attendance corrections
                </Link>
              ) : null}
              {hasPermission(PERMISSIONS.EMPLOYEE_READ) ||
              hasPermission(PERMISSIONS.EMPLOYEE_READ_TEAM) ? (
                <Link to="/employees" className="text-sm text-[var(--nemo-primary-700)] underline">
                  Employee directory
                </Link>
              ) : null}
              {hasPermission(PERMISSIONS.WORK_SCHEDULE_READ) ? (
                <Link
                  to="/attendance/schedules"
                  className="text-sm text-[var(--nemo-primary-700)] underline"
                >
                  Work schedules
                </Link>
              ) : null}
              {hasPermission(PERMISSIONS.HOLIDAY_READ) ? (
                <Link
                  to="/attendance/holidays"
                  className="text-sm text-[var(--nemo-primary-700)] underline"
                >
                  Holiday calendar
                </Link>
              ) : null}
              {hasPermission(PERMISSIONS.LEAVE_REQUEST_READ) ? (
                <Link to="/leave" className="text-sm text-[var(--nemo-primary-700)] underline">
                  Leave management
                </Link>
              ) : null}
            </Stack>
          </CardBody>
        </Card>
      </div>
    </Stack>
  );
}
