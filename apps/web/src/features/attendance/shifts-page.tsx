import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
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
  type Shift,
} from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";

interface ShiftForm {
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  breakMinutes: string;
  graceLateMinutes: string;
  graceEarlyMinutes: string;
  description: string;
}

function formFrom(shift?: Shift): ShiftForm {
  return {
    name: shift?.name ?? "",
    code: shift?.code ?? "",
    startTime: shift?.startTime ?? "22:00",
    endTime: shift?.endTime ?? "06:00",
    breakMinutes: String(shift?.breakMinutes ?? 30),
    graceLateMinutes: String(shift?.graceLateMinutes ?? 0),
    graceEarlyMinutes: String(shift?.graceEarlyMinutes ?? 0),
    description: shift?.description ?? "",
  };
}

export function ShiftsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<Shift | "create" | null>(null);
  const [form, setForm] = useState<ShiftForm>(formFrom());
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (dialog === "create") setForm(formFrom());
    if (dialog && dialog !== "create") setForm(formFrom(dialog));
    setFormError(null);
  }, [dialog]);

  const shiftsQuery = useQuery({
    queryKey: ["shifts", search],
    queryFn: () => {
      const params = new URLSearchParams({ page: "1", pageSize: "100" });
      if (search) params.set("search", search);
      return apiRequest<PaginatedResponse<Shift>>(`/shifts?${params.toString()}`);
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        code: form.code,
        startTime: form.startTime,
        endTime: form.endTime,
        breakMinutes: Number(form.breakMinutes) || 0,
        graceLateMinutes: Number(form.graceLateMinutes) || 0,
        graceEarlyMinutes: Number(form.graceEarlyMinutes) || 0,
        description: form.description || null,
      };
      return dialog && dialog !== "create"
        ? apiRequest<Shift>(`/shifts/${dialog.id}`, { method: "PATCH", body })
        : apiRequest<Shift>("/shifts", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(dialog === "create" ? "Shift created" : "Shift updated");
      void queryClient.invalidateQueries({ queryKey: ["shifts"] });
      setDialog(null);
    },
    onError: (error) => {
      const message = error instanceof ApiRequestError ? error.message : "Could not save the shift";
      setFormError(message);
      toast.error(message);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiRequest<Shift>(`/shifts/${id}/deactivate`, { method: "PATCH" }),
    onSuccess: () => {
      toast.success("Shift deactivated");
      void queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not deactivate"),
  });

  return (
    <Stack spacing={20}>
      <Stack direction="row" justify="between" align="center" wrap spacing={12}>
        <Stack spacing={4}>
          <Typography variant="h4" as="h1">
            Shifts
          </Typography>
          <Typography variant="bodySmall" color="neutral">
            Shift hours override the weekly schedule, including overnight shifts
          </Typography>
        </Stack>
        {hasPermission(PERMISSIONS.SHIFT_CREATE) ? (
          <Button onClick={() => setDialog("create")}>Add shift</Button>
        ) : null}
      </Stack>

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="max-w-sm">
              <Input
                placeholder="Search shift name or code"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                clearable
                onClear={() => setSearchInput("")}
                fullWidth
              />
            </div>
            {shiftsQuery.isPending ? (
              <Stack direction="row" spacing={12} align="center">
                <Spinner />
                <Typography variant="bodySmall" color="neutral">
                  Loading shifts…
                </Typography>
              </Stack>
            ) : shiftsQuery.isError ? (
              <Alert tone="error" title="Could not load shifts">
                {shiftsQuery.error instanceof ApiRequestError
                  ? shiftsQuery.error.message
                  : "Unexpected error"}
              </Alert>
            ) : (
              <Table
                columns={[
                  {
                    key: "name",
                    header: "Shift",
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
                    key: "hours",
                    header: "Hours",
                    render: (row) => (
                      <Stack direction="row" spacing={4} align="center" wrap>
                        <Typography variant="bodySmall">
                          {row.startTime}–{row.endTime}
                        </Typography>
                        {row.endTime <= row.startTime ? (
                          <Badge variant="outlined" color="primary">
                            overnight
                          </Badge>
                        ) : null}
                      </Stack>
                    ),
                  },
                  { key: "break", header: "Break", render: (row) => `${row.breakMinutes}m` },
                  {
                    key: "grace",
                    header: "Grace",
                    render: (row) => `${row.graceLateMinutes}m late / ${row.graceEarlyMinutes}m early`,
                  },
                  { key: "assignments", header: "Assignments", render: (row) => row.assignmentCount },
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
                        {hasPermission(PERMISSIONS.SHIFT_UPDATE) ? (
                          <Button variant="text" size="sm" onClick={() => setDialog(row)}>
                            Edit
                          </Button>
                        ) : null}
                        {hasPermission(PERMISSIONS.SHIFT_DEACTIVATE) && row.status === "ACTIVE" ? (
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
                data={shiftsQuery.data.items}
                rowKey={(row) => row.id}
                emptyText="No shifts yet."
              />
            )}
          </Stack>
        </CardBody>
      </Card>

      <Modal
        open={dialog !== null}
        onOpenChange={(next) => !next && setDialog(null)}
        title={dialog === "create" ? "Add shift" : "Edit shift"}
        size="md"
        footer={
          <>
            <Button variant="outlined" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <LoadingButton type="submit" form="shift-form" loading={saveMutation.isPending}>
              Save shift
            </LoadingButton>
          </>
        }
      >
        <form
          id="shift-form"
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate();
          }}
        >
          <Stack spacing={16}>
            {formError ? (
              <Alert tone="error" title="Could not save the shift">
                {formError}
              </Alert>
            ) : null}
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
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label="Start time"
                type="time"
                value={form.startTime}
                onChange={(event) => setForm({ ...form, startTime: event.target.value })}
                required
                fullWidth
              />
              <Input
                label="End time"
                type="time"
                value={form.endTime}
                onChange={(event) => setForm({ ...form, endTime: event.target.value })}
                required
                fullWidth
              />
              <Input
                label="Break minutes"
                type="number"
                value={form.breakMinutes}
                onChange={(event) => setForm({ ...form, breakMinutes: event.target.value })}
                fullWidth
              />
              <Input
                label="Late grace minutes"
                type="number"
                value={form.graceLateMinutes}
                onChange={(event) => setForm({ ...form, graceLateMinutes: event.target.value })}
                fullWidth
              />
              <Input
                label="Early-leave grace minutes"
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
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
