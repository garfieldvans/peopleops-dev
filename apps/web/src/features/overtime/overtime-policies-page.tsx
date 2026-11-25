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
  Select,
  Spinner,
  Stack,
  Table,
  Textarea,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useEffect, useState } from "react";
import {
  EMPLOYMENT_STATUSES,
  MASTER_STATUSES,
  OVERTIME_APPROVAL_MODES,
  OVERTIME_ROUNDING_STRATEGIES,
  PERMISSIONS,
  type EmploymentStatus,
  type MasterStatus,
  type OvertimeApprovalMode,
  type OvertimePolicy,
  type OvertimeRoundingStrategy,
  type PaginatedResponse,
} from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import { PageHeading } from "./overtime-ui";
import { OVERTIME_PAGE_SIZE, approvalModeLabel, roundingLabel, todayKey } from "./overtime-utils";

interface PolicyForm {
  name: string;
  code: string;
  description: string;
  status: MasterStatus;
  effectiveFrom: string;
  effectiveTo: string;
  minMinutes: string;
  maxMinutes: string;
  roundingStrategy: OvertimeRoundingStrategy;
  roundingMinutes: string;
  approvalMode: OvertimeApprovalMode;
  requiresAttachment: boolean;
  allowWeekend: boolean;
  allowHoliday: boolean;
  eligibleEmploymentStatuses: EmploymentStatus[];
}

const emptyForm = (): PolicyForm => ({
  name: "",
  code: "",
  description: "",
  status: "ACTIVE",
  effectiveFrom: todayKey(),
  effectiveTo: "",
  minMinutes: "30",
  maxMinutes: "240",
  roundingStrategy: "NONE",
  roundingMinutes: "15",
  approvalMode: "MANAGER_AND_HR",
  requiresAttachment: false,
  allowWeekend: true,
  allowHoliday: true,
  eligibleEmploymentStatuses: ["ACTIVE", "PROBATION"],
});

function formFrom(policy: OvertimePolicy): PolicyForm {
  return {
    name: policy.name,
    code: policy.code,
    description: policy.description ?? "",
    status: policy.status,
    effectiveFrom: policy.effectiveFrom,
    effectiveTo: policy.effectiveTo ?? "",
    minMinutes: String(policy.minMinutes),
    maxMinutes: String(policy.maxMinutes),
    roundingStrategy: policy.roundingStrategy,
    roundingMinutes: String(policy.roundingMinutes),
    approvalMode: policy.approvalMode,
    requiresAttachment: policy.requiresAttachment,
    allowWeekend: policy.allowWeekend,
    allowHoliday: policy.allowHoliday,
    eligibleEmploymentStatuses: policy.eligibleEmploymentStatuses,
  };
}

export function OvertimePoliciesPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<OvertimePolicy | "create" | null>(null);
  const [form, setForm] = useState<PolicyForm>(emptyForm());

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
    pageSize: String(OVERTIME_PAGE_SIZE),
  });
  if (search) params.set("search", search);

  const policiesQuery = useQuery({
    queryKey: ["overtime", "policies", "list", params.toString()],
    queryFn: () =>
      apiRequest<PaginatedResponse<OvertimePolicy>>(`/overtime/policies?${params.toString()}`),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["overtime", "policies"] });
    void queryClient.invalidateQueries({ queryKey: ["overtime", "assignments"] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        code: form.code,
        description: form.description || null,
        status: form.status,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        minMinutes: Number(form.minMinutes),
        maxMinutes: Number(form.maxMinutes),
        roundingStrategy: form.roundingStrategy,
        roundingMinutes: Number(form.roundingMinutes),
        approvalMode: form.approvalMode,
        requiresAttachment: form.requiresAttachment,
        allowWeekend: form.allowWeekend,
        allowHoliday: form.allowHoliday,
        eligibleEmploymentStatuses: form.eligibleEmploymentStatuses,
      };
      return dialog && dialog !== "create"
        ? apiRequest<OvertimePolicy>(`/overtime/policies/${dialog.id}`, { method: "PATCH", body })
        : apiRequest<OvertimePolicy>("/overtime/policies", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(dialog === "create" ? "Overtime policy created" : "Overtime policy updated");
      setDialog(null);
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not save the policy"),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<OvertimePolicy>(`/overtime/policies/${id}/deactivate`, { method: "PATCH" }),
    onSuccess: () => {
      toast.success("Overtime policy deactivated");
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not deactivate"),
  });

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Overtime policies"
        description="Limits, rounding, eligibility, and approval routing for overtime"
        actions={
          hasPermission(PERMISSIONS.OVERTIME_POLICY_MANAGE) ? (
            <Button onClick={() => setDialog("create")}>Add policy</Button>
          ) : undefined
        }
      />

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                aria-label="Search overtime policies"
                placeholder="Search policy name or code"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                clearable
                onClear={() => setSearchInput("")}
                fullWidth
              />
              <Button
                variant="outlined"
                onClick={() => {
                  setSearchInput("");
                  setPage(1);
                }}
              >
                Reset filters
              </Button>
            </div>

            {policiesQuery.isPending ? (
              <Stack direction="row" spacing={12} align="center">
                <Spinner />
                <Typography variant="bodySmall" color="neutral">
                  Loading overtime policies…
                </Typography>
              </Stack>
            ) : policiesQuery.isError ? (
              <Alert tone="error" title="Could not load overtime policies">
                {policiesQuery.error instanceof ApiRequestError
                  ? policiesQuery.error.message
                  : "Unexpected error"}
              </Alert>
            ) : (
              <Table
                columns={[
                  {
                    key: "name",
                    header: "Policy",
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
                    key: "limits",
                    header: "Limits",
                    render: (row) => `${row.minMinutes}–${row.maxMinutes} min`,
                  },
                  {
                    key: "rounding",
                    header: "Rounding",
                    render: (row) =>
                      row.roundingStrategy === "NONE"
                        ? "None"
                        : `${roundingLabel(row.roundingStrategy)} · ${row.roundingMinutes} min`,
                  },
                  {
                    key: "approval",
                    header: "Approval",
                    render: (row) => approvalModeLabel(row.approvalMode),
                  },
                  {
                    key: "eligibility",
                    header: "Eligibility",
                    render: (row) => row.eligibleEmploymentStatuses.join(", "),
                  },
                  {
                    key: "effective",
                    header: "Effective",
                    render: (row) =>
                      `${row.effectiveFrom}${row.effectiveTo ? ` – ${row.effectiveTo}` : " onward"}`,
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
                        {hasPermission(PERMISSIONS.OVERTIME_POLICY_MANAGE) ? (
                          <Button variant="text" size="sm" onClick={() => setDialog(row)}>
                            Edit
                          </Button>
                        ) : null}
                        {hasPermission(PERMISSIONS.OVERTIME_POLICY_MANAGE) &&
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
                data={policiesQuery.data.items}
                rowKey={(row) => row.id}
                pagination={{
                  page,
                  pageSize: OVERTIME_PAGE_SIZE,
                  pageCount: policiesQuery.data.totalPages,
                  total: policiesQuery.data.total,
                  onChange: setPage,
                }}
                emptyText="No overtime policies found."
              />
            )}
          </Stack>
        </CardBody>
      </Card>

      <Modal
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog === "create" ? "Add overtime policy" : "Edit overtime policy"}
        size="lg"
        footer={
          <>
            <Button variant="outlined" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <LoadingButton
              type="submit"
              form="overtime-policy-form"
              loading={saveMutation.isPending}
            >
              Save policy
            </LoadingButton>
          </>
        }
      >
        <form
          id="overtime-policy-form"
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate();
          }}
        >
          <Stack spacing={14}>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label="Policy name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                fullWidth
              />
              <Input
                label="Policy code"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
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
            <div className="grid gap-3 md:grid-cols-3">
              <Select
                label="Status"
                value={form.status}
                onChange={(value) => setForm({ ...form, status: value as MasterStatus })}
                options={MASTER_STATUSES.map((entry) => ({
                  label: entry.toLowerCase(),
                  value: entry,
                }))}
                fullWidth
              />
              <Input
                label="Effective from"
                type="date"
                value={form.effectiveFrom}
                onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })}
                required
                fullWidth
              />
              <Input
                label="Effective to"
                type="date"
                value={form.effectiveTo}
                onChange={(event) => setForm({ ...form, effectiveTo: event.target.value })}
                helperText="Leave empty for open-ended"
                fullWidth
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label="Minimum overtime (minutes)"
                type="number"
                min="1"
                max="1440"
                value={form.minMinutes}
                onChange={(event) => setForm({ ...form, minMinutes: event.target.value })}
                required
                fullWidth
              />
              <Input
                label="Maximum overtime (minutes)"
                type="number"
                min="1"
                max="1440"
                value={form.maxMinutes}
                onChange={(event) => setForm({ ...form, maxMinutes: event.target.value })}
                required
                fullWidth
              />
              <Select
                label="Rounding strategy"
                value={form.roundingStrategy}
                onChange={(value) =>
                  setForm({ ...form, roundingStrategy: value as OvertimeRoundingStrategy })
                }
                options={OVERTIME_ROUNDING_STRATEGIES.map((entry) => ({
                  label: roundingLabel(entry),
                  value: entry,
                }))}
                fullWidth
              />
              <Input
                label="Rounding interval (minutes)"
                type="number"
                min="1"
                max="240"
                value={form.roundingMinutes}
                onChange={(event) => setForm({ ...form, roundingMinutes: event.target.value })}
                disabled={form.roundingStrategy === "NONE"}
                fullWidth
              />
              <Select
                label="Approval mode"
                value={form.approvalMode}
                onChange={(value) =>
                  setForm({ ...form, approvalMode: value as OvertimeApprovalMode })
                }
                options={OVERTIME_APPROVAL_MODES.map((entry) => ({
                  label: approvalModeLabel(entry),
                  value: entry,
                }))}
                fullWidth
              />
            </div>

            <Stack spacing={6}>
              <Typography variant="caption" color="neutral">
                Eligible employment statuses
              </Typography>
              <div className="grid gap-2 sm:grid-cols-3">
                {EMPLOYMENT_STATUSES.map((status) => (
                  <Checkbox
                    key={status}
                    label={status.toLowerCase()}
                    checked={form.eligibleEmploymentStatuses.includes(status)}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        eligibleEmploymentStatuses: event.target.checked
                          ? [...form.eligibleEmploymentStatuses, status]
                          : form.eligibleEmploymentStatuses.filter((entry) => entry !== status),
                      })
                    }
                  />
                ))}
              </div>
            </Stack>

            <div className="grid gap-2 md:grid-cols-3">
              <Checkbox
                label="Require an attachment"
                checked={form.requiresAttachment}
                onChange={(event) => setForm({ ...form, requiresAttachment: event.target.checked })}
              />
              <Checkbox
                label="Allow weekend overtime"
                checked={form.allowWeekend}
                onChange={(event) => setForm({ ...form, allowWeekend: event.target.checked })}
              />
              <Checkbox
                label="Allow holiday overtime"
                checked={form.allowHoliday}
                onChange={(event) => setForm({ ...form, allowHoliday: event.target.checked })}
              />
            </div>

            {saveMutation.isError ? (
              <Alert tone="error" title="Could not save the policy">
                {saveMutation.error instanceof ApiRequestError
                  ? saveMutation.error.message
                  : "Unexpected error"}
              </Alert>
            ) : null}
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
