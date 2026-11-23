import { Alert, Badge, Button, Card, CardBody, Spinner, Stack, Typography } from "@nemo-ui/ui";
import type { AttendanceCalendar } from "@peopleops/shared-types";
import { statusColor, statusLabel } from "./attendance-utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 2026, (monthNumber ?? 1) - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

export function AttendanceCalendarGrid({
  calendar,
  month,
  onMonthChange,
  loading,
  error,
}: {
  calendar: AttendanceCalendar | undefined;
  month: string;
  onMonthChange: (month: string) => void;
  loading: boolean;
  error: Error | null;
}) {
  const leading = calendar?.days[0]?.dayOfWeek ? calendar.days[0].dayOfWeek - 1 : 0;

  return (
    <Card variant="elevated" padding="lg">
      <CardBody>
        <Stack spacing={16}>
          <Stack direction="row" justify="between" align="center" wrap spacing={8}>
            <Stack spacing={2}>
              <Typography variant="h6">Attendance calendar</Typography>
              <Typography variant="caption" color="neutral">
                {calendar?.timezone ?? "Company timezone"}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={8} align="center">
              <Button variant="outlined" size="sm" onClick={() => onMonthChange(shiftMonth(month, -1))}>
                Previous
              </Button>
              <Typography variant="bodySmall" className="font-medium">
                {month}
              </Typography>
              <Button variant="outlined" size="sm" onClick={() => onMonthChange(shiftMonth(month, 1))}>
                Next
              </Button>
            </Stack>
          </Stack>

          {loading ? (
            <Stack direction="row" spacing={12} align="center">
              <Spinner />
              <Typography variant="bodySmall" color="neutral">
                Loading calendar…
              </Typography>
            </Stack>
          ) : error ? (
            <Alert tone="error" title="Could not load the calendar">
              {error.message}
            </Alert>
          ) : calendar ? (
            <>
              <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAYS.map((day) => (
                  <Typography key={day} variant="caption" color="neutral">
                    {day}
                  </Typography>
                ))}
                {Array.from({ length: leading }).map((_, index) => (
                  <div key={`blank-${index}`} />
                ))}
                {calendar.days.map((day) => (
                  <div
                    key={day.date}
                    className="min-h-20 rounded-md border border-[var(--nemo-neutral-200)] p-2 text-left"
                    title={day.holiday?.name ?? statusLabel(day.status)}
                  >
                    <Typography variant="caption" className="font-medium">
                      {Number(day.date.slice(8, 10))}
                    </Typography>
                    <div className="mt-1">
                      <Badge variant="filled" color={statusColor(day.status)}>
                        {statusLabel(day.status)}
                      </Badge>
                    </div>
                    {day.record ? (
                      <Typography variant="caption" color="neutral" className="mt-1 block">
                        {day.record.clockInLocal?.slice(11, 16) ?? "—"} –{" "}
                        {day.record.clockOutLocal?.slice(11, 16) ?? "—"}
                      </Typography>
                    ) : day.holiday ? (
                      <Typography variant="caption" color="neutral" className="mt-1 block">
                        {day.holiday.name}
                      </Typography>
                    ) : null}
                  </div>
                ))}
              </div>
              <Stack direction="row" spacing={12} wrap>
                <Typography variant="caption">Present: {calendar.summary.present}</Typography>
                <Typography variant="caption">Late: {calendar.summary.late}</Typography>
                <Typography variant="caption">Incomplete: {calendar.summary.incomplete}</Typography>
                <Typography variant="caption">Holiday: {calendar.summary.holiday}</Typography>
                <Typography variant="caption">Off: {calendar.summary.off}</Typography>
              </Stack>
            </>
          ) : null}
        </Stack>
      </CardBody>
    </Card>
  );
}
