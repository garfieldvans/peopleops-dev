import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Input,
  Modal,
  Select,
  Spinner,
  Stack,
  Table,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useEffect, useState } from "react";
import {
  HOLIDAY_TYPES,
  PERMISSIONS,
  type Holiday,
  type HolidayType,
  type PaginatedResponse,
} from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import { useBranchOptions } from "../employees/employee-options";
import { todayKey } from "./attendance-utils";

interface HolidayForm {
  name: string;
  date: string;
  type: HolidayType;
  branchId: string;
  description: string;
}

function formFrom(holiday?: Holiday): HolidayForm {
  return {
    name: holiday?.name ?? "",
    date: holiday?.date ?? todayKey(),
    type: holiday?.type ?? "NATIONAL",
    branchId: holiday?.branchId ?? "",
    description: holiday?.description ?? "",
  };
}

export function HolidaysPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [dialog, setDialog] = useState<Holiday | "create" | null>(null);
  const [form, setForm] = useState<HolidayForm>(formFrom());
  const [formError, setFormError] = useState<string | null>(null);
  const branchesQuery = useBranchOptions();

  useEffect(() => {
    if (dialog === "create") setForm(formFrom());
    if (dialog && dialog !== "create") setForm(formFrom(dialog));
    setFormError(null);
  }, [dialog]);

  const holidaysQuery = useQuery({
    queryKey: ["holidays"],
    queryFn: () =>
      apiRequest<PaginatedResponse<Holiday>>("/holidays?page=1&pageSize=100"),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        date: form.date,
        type: form.type,
        branchId: form.type === "BRANCH" ? form.branchId || null : null,
        description: form.description || null,
      };
      return dialog && dialog !== "create"
        ? apiRequest<Holiday>(`/holidays/${dialog.id}`, { method: "PATCH", body })
        : apiRequest<Holiday>("/holidays", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(dialog === "create" ? "Holiday created" : "Holiday updated");
      void queryClient.invalidateQueries({ queryKey: ["holidays"] });
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
      setDialog(null);
    },
    onError: (error) => {
      const message =
        error instanceof ApiRequestError ? error.message : "Could not save the holiday";
      setFormError(message);
      toast.error(message);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<Holiday>(`/holidays/${id}/deactivate`, { method: "PATCH" }),
    onSuccess: () => {
      toast.success("Holiday deactivated");
      void queryClient.invalidateQueries({ queryKey: ["holidays"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not deactivate"),
  });

  return (
    <Stack spacing={20}>
      <Stack direction="row" justify="between" align="center" wrap spacing={12}>
        <Stack spacing={4}>
          <Typography variant="h4" as="h1">
            Holidays
          </Typography>
          <Typography variant="bodySmall" color="neutral">
            National, company, and branch holidays used by attendance and calendars
          </Typography>
        </Stack>
        {hasPermission(PERMISSIONS.HOLIDAY_CREATE) ? (
          <Button onClick={() => setDialog("create")}>Add holiday</Button>
        ) : null}
      </Stack>

      <Card variant="elevated" padding="lg">
        <CardBody>
          {holidaysQuery.isPending ? (
            <Stack direction="row" spacing={12} align="center">
              <Spinner />
              <Typography variant="bodySmall" color="neutral">
                Loading holidays…
              </Typography>
            </Stack>
          ) : holidaysQuery.isError ? (
            <Alert tone="error" title="Could not load holidays">
              {holidaysQuery.error instanceof ApiRequestError
                ? holidaysQuery.error.message
                : "Unexpected error"}
            </Alert>
          ) : (
            <Table
              columns={[
                { key: "date", header: "Date", render: (row) => row.date },
                {
                  key: "name",
                  header: "Holiday",
                  render: (row) => (
                    <Stack spacing={2}>
                      <Typography variant="bodySmall" className="font-medium">
                        {row.name}
                      </Typography>
                      <Typography variant="caption" color="neutral">
                        {row.description ?? "—"}
                      </Typography>
                    </Stack>
                  ),
                },
                {
                  key: "type",
                  header: "Type",
                  render: (row) => (
                    <Badge variant="outlined" color="primary">
                      {row.type.toLowerCase()}
                    </Badge>
                  ),
                },
                { key: "branch", header: "Scope", render: (row) => row.branch?.name ?? "All branches" },
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
                      {hasPermission(PERMISSIONS.HOLIDAY_UPDATE) ? (
                        <Button variant="text" size="sm" onClick={() => setDialog(row)}>
                          Edit
                        </Button>
                      ) : null}
                      {hasPermission(PERMISSIONS.HOLIDAY_UPDATE) && row.status === "ACTIVE" ? (
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
              data={holidaysQuery.data.items}
              rowKey={(row) => row.id}
              emptyText="No holidays configured yet."
            />
          )}
        </CardBody>
      </Card>

      <Modal
        open={dialog !== null}
        onOpenChange={(next) => !next && setDialog(null)}
        title={dialog === "create" ? "Add holiday" : "Edit holiday"}
        size="md"
        footer={
          <>
            <Button variant="outlined" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <LoadingButton type="submit" form="holiday-form" loading={saveMutation.isPending}>
              Save holiday
            </LoadingButton>
          </>
        }
      >
        <form
          id="holiday-form"
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate();
          }}
        >
          <Stack spacing={14}>
            {formError ? (
              <Alert tone="error" title="Could not save the holiday">
                {formError}
              </Alert>
            ) : null}
            <Input
              label="Holiday name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
              fullWidth
            />
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label="Date"
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
                required
                fullWidth
              />
              <Select
                label="Type"
                value={form.type}
                onChange={(value) => setForm({ ...form, type: value as HolidayType })}
                options={HOLIDAY_TYPES.map((entry) => ({
                  label: entry.toLowerCase(),
                  value: entry,
                }))}
                fullWidth
              />
            </div>
            {form.type === "BRANCH" ? (
              <Select
                label="Branch"
                placeholder="Choose a branch"
                value={form.branchId}
                onChange={(value) => setForm({ ...form, branchId: value })}
                options={
                  branchesQuery.data?.items.map((branch) => ({
                    label: branch.name,
                    value: branch.id,
                  })) ?? []
                }
                fullWidth
              />
            ) : null}
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
