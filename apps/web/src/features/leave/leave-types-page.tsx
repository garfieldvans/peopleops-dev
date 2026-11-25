import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
  Input,
  Modal,
  Select,
  Spinner,
  Stack,
  Table,
  Textarea,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useEffect, useState } from "react";
import { PERMISSIONS, type LeaveType } from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import { PageHeading } from "./leave-ui";
import { LEAVE_PAGE_SIZE, useLeaveTypesPaged } from "./leave-utils";

interface TypeForm {
  name: string;
  code: string;
  description: string;
  isPaid: boolean;
  requiresApproval: boolean;
  requiresAttachment: boolean;
  allowHalfDay: boolean;
  allowPastDates: boolean;
  allowFutureDates: boolean;
  requiresBalance: boolean;
}

function emptyForm(): TypeForm {
  return {
    name: "",
    code: "",
    description: "",
    isPaid: true,
    requiresApproval: true,
    requiresAttachment: false,
    allowHalfDay: false,
    allowPastDates: false,
    allowFutureDates: true,
    requiresBalance: true,
  };
}

function formFrom(type: LeaveType): TypeForm {
  return {
    name: type.name,
    code: type.code,
    description: type.description ?? "",
    isPaid: type.isPaid,
    requiresApproval: type.requiresApproval,
    requiresAttachment: type.requiresAttachment,
    allowHalfDay: type.allowHalfDay,
    allowPastDates: type.allowPastDates,
    allowFutureDates: type.allowFutureDates,
    requiresBalance: type.requiresBalance,
  };
}

export function LeaveTypesPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<LeaveType | "create" | null>(null);
  const [form, setForm] = useState<TypeForm>(emptyForm());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (dialog === "create") setForm(emptyForm());
    else if (dialog) setForm(formFrom(dialog));
  }, [dialog]);

  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(LEAVE_PAGE_SIZE),
  });
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  const typesQuery = useLeaveTypesPaged(params);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["leave"] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        description: form.description || null,
      };
      return dialog && dialog !== "create"
        ? apiRequest<LeaveType>(`/leave-types/${dialog.id}`, { method: "PATCH", body })
        : apiRequest<LeaveType>("/leave-types", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(dialog === "create" ? "Leave type created" : "Leave type updated");
      setDialog(null);
      invalidate();
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiRequestError ? error.message : "Could not save the leave type",
      ),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<LeaveType>(`/leave-types/${id}/deactivate`, { method: "PATCH" }),
    onSuccess: () => {
      toast.success("Leave type deactivated");
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not deactivate"),
  });

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Leave types"
        description="Define leave categories and their request requirements"
        actions={
          hasPermission(PERMISSIONS.LEAVE_TYPE_CREATE) ? (
            <Button onClick={() => setDialog("create")}>Add leave type</Button>
          ) : undefined
        }
      />

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                aria-label="Search leave types"
                placeholder="Search name or code"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                clearable
                onClear={() => setSearchInput("")}
                fullWidth
              />
              <Select
                aria-label="Filter leave type status"
                value={status}
                onChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
                options={[
                  { label: "All statuses", value: "" },
                  { label: "Active", value: "ACTIVE" },
                  { label: "Inactive", value: "INACTIVE" },
                ]}
                fullWidth
              />
              <Button
                variant="outlined"
                onClick={() => {
                  setSearchInput("");
                  setStatus("");
                  setPage(1);
                }}
              >
                Reset filters
              </Button>
            </div>

            {typesQuery.isPending ? (
              <Stack direction="row" spacing={12} align="center">
                <Spinner />
                <Typography variant="bodySmall" color="neutral">
                  Loading leave types…
                </Typography>
              </Stack>
            ) : typesQuery.isError ? (
              <Alert tone="error" title="Could not load leave types">
                {typesQuery.error instanceof ApiRequestError
                  ? typesQuery.error.message
                  : "Unexpected error"}
              </Alert>
            ) : (
              <Table
                columns={[
                  {
                    key: "name",
                    header: "Leave type",
                    render: (row) => (
                      <Stack spacing={1}>
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
                    key: "paid",
                    header: "Paid",
                    render: (row) => (row.isPaid ? "Yes" : "No"),
                  },
                  {
                    key: "requirements",
                    header: "Requirements",
                    render: (row) => (
                      <Stack direction="row" spacing={4} wrap>
                        {row.requiresApproval ? (
                          <Badge variant="outlined" color="primary">
                            approval
                          </Badge>
                        ) : null}
                        {row.requiresAttachment ? (
                          <Badge variant="outlined" color="warning">
                            document
                          </Badge>
                        ) : null}
                        {row.requiresBalance ? (
                          <Badge variant="outlined" color="neutral">
                            balance
                          </Badge>
                        ) : null}
                        {row.allowHalfDay ? (
                          <Badge variant="outlined" color="neutral">
                            half day
                          </Badge>
                        ) : null}
                      </Stack>
                    ),
                  },
                  { key: "policies", header: "Policies", render: (row) => row.policyCount },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => (
                      <Badge
                        variant="filled"
                        color={row.status === "ACTIVE" ? "success" : "neutral"}
                      >
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
                        {hasPermission(PERMISSIONS.LEAVE_TYPE_UPDATE) ? (
                          <Button variant="text" size="sm" onClick={() => setDialog(row)}>
                            Edit
                          </Button>
                        ) : null}
                        {hasPermission(PERMISSIONS.LEAVE_TYPE_DEACTIVATE) &&
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
                data={typesQuery.data.items}
                rowKey={(row) => row.id}
                pagination={{
                  page,
                  pageSize: LEAVE_PAGE_SIZE,
                  pageCount: typesQuery.data.totalPages,
                  total: typesQuery.data.total,
                  onChange: setPage,
                }}
                emptyText="No leave types found."
              />
            )}
          </Stack>
        </CardBody>
      </Card>

      <Modal
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog === "create" ? "Add leave type" : "Edit leave type"}
        size="md"
        footer={
          <>
            <Button variant="outlined" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <LoadingButton type="submit" form="leave-type-form" loading={saveMutation.isPending}>
              Save leave type
            </LoadingButton>
          </>
        }
      >
        <form
          id="leave-type-form"
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate();
          }}
        >
          <Stack spacing={14}>
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
                onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                helperText="Letters, digits, and underscores"
                required
                fullWidth
              />
            </div>
            <Textarea
              label="Description"
              rows={2}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              fullWidth
            />
            <div className="grid gap-2 md:grid-cols-2">
              <Checkbox
                label="Paid leave"
                checked={form.isPaid}
                onChange={(event) => setForm({ ...form, isPaid: event.target.checked })}
              />
              <Checkbox
                label="Requires approval"
                checked={form.requiresApproval}
                onChange={(event) => setForm({ ...form, requiresApproval: event.target.checked })}
              />
              <Checkbox
                label="Requires supporting document"
                checked={form.requiresAttachment}
                onChange={(event) => setForm({ ...form, requiresAttachment: event.target.checked })}
              />
              <Checkbox
                label="Uses a tracked balance"
                checked={form.requiresBalance}
                onChange={(event) => setForm({ ...form, requiresBalance: event.target.checked })}
              />
              <Checkbox
                label="Allow half-day requests"
                checked={form.allowHalfDay}
                onChange={(event) => setForm({ ...form, allowHalfDay: event.target.checked })}
              />
              <Checkbox
                label="Allow past dates"
                checked={form.allowPastDates}
                onChange={(event) => setForm({ ...form, allowPastDates: event.target.checked })}
              />
              <Checkbox
                label="Allow future dates"
                checked={form.allowFutureDates}
                onChange={(event) => setForm({ ...form, allowFutureDates: event.target.checked })}
              />
            </div>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
