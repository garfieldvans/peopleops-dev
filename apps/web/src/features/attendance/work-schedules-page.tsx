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
  Table,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useEffect, useState } from "react";
import {
  PERMISSIONS,
  type PaginatedResponse,
  type WorkSchedule,
} from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface DayForm {
  isWorkingDay: boolean;
  startTime: string;
  endTime: string;
  breakMinutes: string;
}

interface ScheduleForm {
  name: string;
  code: string;
  description: string;
  graceLateMinutes: string;
  graceEarlyMinutes: string;
  days: DayForm[];
}

function defaultForm(schedule?: WorkSchedule): ScheduleForm {
  return {
    name: schedule?.name ?? "",
    code: schedule?.code ?? "",
    description: schedule?.description ?? "",
    graceLateMinutes: String(schedule?.graceLateMinutes ?? 0),
    graceEarlyMinutes: String(schedule?.graceEarlyMinutes ?? 0),
    days: DAY_LABELS.map((_, index) => {
      const day = schedule?.days.find((entry) => entry.dayOfWeek === index + 1);
      return {
        isWorkingDay: day?.isWorkingDay ?? index < 5,
        startTime: day?.startTime ?? "08:00",
        endTime: day?.endTime ?? "17:00",
        breakMinutes: String(day?.breakMinutes ?? (index < 5 ? 60 : 0)),
      };
    }),
  };
}

export function WorkSchedulesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<WorkSchedule | "create" | null>(null);
  const [form, setForm] = useState<ScheduleForm>(defaultForm());
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (dialog === "create") setForm(defaultForm());
    if (dialog && dialog !== "create") setForm(defaultForm(dialog));
    setFormError(null);
  }, [dialog]);

  const schedulesQuery = useQuery({
    queryKey: ["work-schedules", search],
    queryFn: () => {
      const params = new URLSearchParams({ page: "1", pageSize: "100" });
      if (search) params.set("search", search);
      return apiRequest<PaginatedResponse<WorkSchedule>>(`/work-schedules?${params.toString()}`);
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        code: form.code,
        description: form.description || null,
        graceLateMinutes: Number(form.graceLateMinutes) || 0,
        graceEarlyMinutes: Number(form.graceEarlyMinutes) || 0,
        days: form.days.map((day, index) => ({
          dayOfWeek: index + 1,
          isWorkingDay: day.isWorkingDay,
          startTime: day.isWorkingDay ? day.startTime : null,
          endTime: day.isWorkingDay ? day.endTime : null,
          breakMinutes: day.isWorkingDay ? Number(day.breakMinutes) || 0 : 0,
        })),
      };
      return dialog && dialog !== "create"
        ? apiRequest<WorkSchedule>(`/work-schedules/${dialog.id}`, { method: "PATCH", body })
        : apiRequest<WorkSchedule>("/work-schedules", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(dialog === "create" ? "Work schedule created" : "Work schedule updated");
      void queryClient.invalidateQueries({ queryKey: ["work-schedules"] });
      setDialog(null);
    },
    onError: (error) => {
      const message =
        error instanceof ApiRequestError ? error.message : "Could not save the schedule";
      setFormError(message);
      toast.error(message);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<WorkSchedule>(`/work-schedules/${id}/deactivate`, { method: "PATCH" }),
    onSuccess: () => {
      toast.success("Work schedule deactivated");
      void queryClient.invalidateQueries({ queryKey: ["work-schedules"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not deactivate"),
  });

  const updateDay = (index: number, patch: Partial<DayForm>) => {
    setForm((current) => ({
      ...current,
      days: current.days.map((day, dayIndex) =>
        dayIndex === index ? { ...day, ...patch } : day,
      ),
    }));
  };

  return (
    <Stack spacing={20}>
      <Stack direction="row" justify="between" align="center" wrap spacing={12}>
        <Stack spacing={4}>
          <Typography variant="h4" as="h1">
            Work schedules
          </Typography>
          <Typography variant="bodySmall" color="neutral">
            Weekly working days, hours, breaks, and grace periods
          </Typography>
        </Stack>
        {hasPermission(PERMISSIONS.WORK_SCHEDULE_CREATE) ? (
          <Button onClick={() => setDialog("create")}>Add schedule</Button>
        ) : null}
      </Stack>

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="max-w-sm">
              <Input
                placeholder="Search schedule name or code"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                clearable
                onClear={() => setSearchInput("")}
                fullWidth
              />
            </div>
            {schedulesQuery.isPending ? (
              <Stack direction="row" spacing={12} align="center">
                <Spinner />
                <Typography variant="bodySmall" color="neutral">
                  Loading schedules…
                </Typography>
              </Stack>
            ) : schedulesQuery.isError ? (
              <Alert tone="error" title="Could not load work schedules">
                {schedulesQuery.error instanceof ApiRequestError
                  ? schedulesQuery.error.message
                  : "Unexpected error"}
              </Alert>
            ) : (
              <Table
                columns={[
                  {
                    key: "name",
                    header: "Schedule",
                    render: (row) => (
                      <Stack spacing={2}>
                        <Typography variant="bodySmall" className="font-medium">
                          {row.name}
                        </Typography>
                        <Typography variant="caption" color="neutral">
                          {row.code}
                        </Typography>
                      </Stack>
                    ),
                  },
                  {
                    key: "days",
                    header: "Working days",
                    render: (row) =>
                      row.days
                        .filter((day) => day.isWorkingDay)
                        .map((day) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day.dayOfWeek - 1])
                        .join(", ") || "None",
                  },
                  {
                    key: "hours",
                    header: "Hours",
                    render: (row) => {
                      const first = row.days.find((day) => day.isWorkingDay);
                      return first ? `${first.startTime}–${first.endTime}` : "—";
                    },
                  },
                  {
                    key: "break",
                    header: "Break",
                    render: (row) => {
                      const first = row.days.find((day) => day.isWorkingDay);
                      return first ? `${first.breakMinutes}m` : "—";
                    },
                  },
                  {
                    key: "grace",
                    header: "Grace",
                    render: (row) => `${row.graceLateMinutes}m late / ${row.graceEarlyMinutes}m early`,
                  },
                  {
                    key: "assignments",
                    header: "Assignments",
                    render: (row) => row.assignmentCount,
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => (
                      <Badge variant="filled" color={row.status === "ACTIVE" ? "success" : "neutral"}>
                        {row.status.toLowerCase()}
                      </Badge>
                    ),
                  },
                  {
                    key: "actions",
                    header: "",
                    align: "right",
                    render: (row) => (
                      <Stack direction="row" spacing={4} justify="end">
                        {hasPermission(PERMISSIONS.WORK_SCHEDULE_UPDATE) ? (
                          <Button variant="text" size="sm" onClick={() => setDialog(row)}>
                            Edit
                          </Button>
                        ) : null}
                        {hasPermission(PERMISSIONS.WORK_SCHEDULE_DEACTIVATE) &&
                        row.status === "ACTIVE" ? (
                          <Button
                            variant="text"
                            size="sm"
                            onClick={() => deactivateMutation.mutate(row.id)}
                          >
                            Deactivate
                          </Button>
                        ) : null}
                      </Stack>
                    ),
                  },
                ]}
                data={schedulesQuery.data.items}
                rowKey={(row) => row.id}
                emptyText="No work schedules yet."
              />
            )}
          </Stack>
        </CardBody>
      </Card>

      <Modal
        open={dialog !== null}
        onOpenChange={(next) => !next && setDialog(null)}
        title={dialog === "create" ? "Add work schedule" : "Edit work schedule"}
        size="lg"
        footer={
          <>
            <Button variant="outlined" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <LoadingButton
              type="submit"
              form="work-schedule-form"
              loading={saveMutation.isPending}
            >
              Save schedule
            </LoadingButton>
          </>
        }
      >
        <form
          id="work-schedule-form"
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate();
          }}
        >
          <Stack spacing={16}>
            {formError ? (
              <Alert tone="error" title="Could not save the schedule">
                {formError}
              </Alert>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label="Name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                fullWidth
              />
              <Input
                label="Code"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
                required
                fullWidth
              />
              <Input
                label="Late grace (minutes)"
                type="number"
                value={form.graceLateMinutes}
                onChange={(event) => setForm({ ...form, graceLateMinutes: event.target.value })}
                fullWidth
              />
              <Input
                label="Early-leave grace (minutes)"
                type="number"
                value={form.graceEarlyMinutes}
                onChange={(event) => setForm({ ...form, graceEarlyMinutes: event.target.value })}
                fullWidth
              />
            </div>
            <Input
              label="Description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              fullWidth
            />
            <Stack spacing={8}>
              <Typography variant="bodySmall" className="font-medium">
                Working days
              </Typography>
              {form.days.map((day, index) => (
                <div
                  key={DAY_LABELS[index]}
                  className="grid items-center gap-2 rounded-md border border-[var(--nemo-neutral-200)] p-2 md:grid-cols-[140px_1fr_1fr_100px]"
                >
                  <Checkbox
                    label={DAY_LABELS[index]!}
                    checked={day.isWorkingDay}
                    onChange={(event) => updateDay(index, { isWorkingDay: event.target.checked })}
                  />
                  <Input
                    aria-label={`${DAY_LABELS[index]} start`}
                    type="time"
                    value={day.startTime}
                    disabled={!day.isWorkingDay}
                    onChange={(event) => updateDay(index, { startTime: event.target.value })}
                    fullWidth
                  />
                  <Input
                    aria-label={`${DAY_LABELS[index]} end`}
                    type="time"
                    value={day.endTime}
                    disabled={!day.isWorkingDay}
                    onChange={(event) => updateDay(index, { endTime: event.target.value })}
                    fullWidth
                  />
                  <Input
                    aria-label={`${DAY_LABELS[index]} break`}
                    type="number"
                    value={day.breakMinutes}
                    disabled={!day.isWorkingDay}
                    onChange={(event) => updateDay(index, { breakMinutes: event.target.value })}
                    fullWidth
                  />
                </div>
              ))}
            </Stack>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
