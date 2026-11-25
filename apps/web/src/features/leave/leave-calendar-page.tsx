import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Input,
  Select,
  Spinner,
  Stack,
  Typography,
} from "@nemo-ui/ui";
import { useMemo, useState } from "react";
import { PERMISSIONS, type LeaveCalendar, type LeaveCalendarEntry } from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LeaveStatusBadge, PageHeading } from "./leave-ui";
import { currentMonthKey, daysInMonth, monthLabel, weekdayHeaders } from "./leave-utils";

type CalendarScope = "me" | "team" | "organisation";

export function LeaveCalendarPage() {
  const { hasPermission } = useAuth();
  const [month, setMonth] = useState(currentMonthKey());
  const [scope, setScope] = useState<CalendarScope>("me");

  const scopeOptions = useMemo(() => {
    const options = [{ label: "My leave", value: "me" }];
    if (hasPermission(PERMISSIONS.LEAVE_REQUEST_READ_TEAM)) {
      options.push({ label: "My team", value: "team" });
    }
    if (hasPermission(PERMISSIONS.LEAVE_REQUEST_READ_ALL)) {
      options.push({ label: "Organisation", value: "organisation" });
    }
    return options;
  }, [hasPermission]);

  const path =
    scope === "me"
      ? "/leave-calendar/me"
      : scope === "team"
        ? "/leave-calendar/team"
        : "/leave-calendar";

  const calendarQuery = useQuery({
    queryKey: ["leave", "calendar", scope, month],
    queryFn: () => apiRequest<LeaveCalendar>(`${path}?month=${month}`),
  });

  const days = daysInMonth(month);
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const firstWeekday = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: days }, (_, index) => index + 1),
  ];

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Leave calendar"
        description="Approved and pending leave, grouped by date"
      />

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <Input
                label="Month"
                type="month"
                value={month}
                onChange={(event) => event.target.value && setMonth(event.target.value)}
                fullWidth
              />
              <Select
                label="Calendar scope"
                value={scope}
                onChange={(value) => setScope(value as CalendarScope)}
                options={scopeOptions}
                fullWidth
              />
              <div className="flex items-end">
                <Button variant="outlined" onClick={() => setMonth(currentMonthKey())}>
                  This month
                </Button>
              </div>
            </div>

            {calendarQuery.isPending ? (
              <Stack direction="row" spacing={12} align="center">
                <Spinner />
                <Typography variant="bodySmall" color="neutral">
                  Loading leave calendar…
                </Typography>
              </Stack>
            ) : calendarQuery.isError ? (
              <Alert tone="error" title="Could not load the leave calendar">
                {calendarQuery.error instanceof ApiRequestError
                  ? calendarQuery.error.message
                  : "Unexpected error"}
              </Alert>
            ) : (
              <>
                <Typography variant="h6">{monthLabel(month)}</Typography>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {weekdayHeaders().map((day) => (
                    <Typography key={day} variant="caption" color="neutral">
                      {day}
                    </Typography>
                  ))}
                  {cells.map((day, index) => (
                    <CalendarCell
                      key={`${month}-${index}`}
                      day={day}
                      entries={
                        day === null
                          ? []
                          : entriesForDay(
                              calendarQuery.data.entries,
                              `${month}-${String(day).padStart(2, "0")}`,
                            )
                      }
                    />
                  ))}
                </div>
                <Stack spacing={8}>
                  <Typography variant="caption" color="neutral">
                    Leave in {monthLabel(month)} ({calendarQuery.data.entries.length})
                  </Typography>
                  {calendarQuery.data.entries.length === 0 ? (
                    <Typography variant="bodySmall" color="neutral">
                      No leave entries for this month.
                    </Typography>
                  ) : (
                    calendarQuery.data.entries.map((entry) => (
                      <Stack
                        key={entry.id}
                        direction="row"
                        justify="between"
                        align="center"
                        wrap
                        spacing={8}
                        className="rounded-md border border-[var(--nemo-neutral-200)] px-3 py-2"
                      >
                        <Stack spacing={1}>
                          <Typography variant="bodySmall" className="font-medium">
                            {entry.employeeName} · {entry.leaveType.name}
                          </Typography>
                          <Typography variant="caption" color="neutral">
                            {entry.startDate} – {entry.endDate}
                          </Typography>
                        </Stack>
                        <LeaveStatusBadge status={entry.status} />
                      </Stack>
                    ))
                  )}
                </Stack>
              </>
            )}
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  );
}

function CalendarCell({ day, entries }: { day: number | null; entries: LeaveCalendarEntry[] }) {
  if (day === null) return <div className="min-h-20 rounded-md bg-[var(--nemo-neutral-50)]" />;
  return (
    <div className="min-h-20 rounded-md border border-[var(--nemo-neutral-200)] p-1 text-left align-top">
      <Typography variant="caption" color="neutral">
        {day}
      </Typography>
      <Stack spacing={1}>
        {entries.slice(0, 3).map((entry) => (
          <span
            key={entry.id}
            title={`${entry.employeeName} · ${entry.leaveType.name}`}
            className="block truncate rounded bg-[var(--nemo-primary-50)] px-1 py-0.5 text-[10px] text-[var(--nemo-primary-700)]"
          >
            {entry.employeeName.split(" ")[0]} · {entry.leaveType.code}
          </span>
        ))}
        {entries.length > 3 ? (
          <Typography variant="caption" color="neutral">
            +{entries.length - 3} more
          </Typography>
        ) : null}
      </Stack>
    </div>
  );
}

function entriesForDay(entries: LeaveCalendarEntry[], date: string): LeaveCalendarEntry[] {
  return entries.filter((entry) => entry.startDate <= date && entry.endDate >= date);
}
