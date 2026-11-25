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
  LEAVE_ACCRUAL_METHODS,
  LEAVE_APPROVAL_MODES,
  PERMISSIONS,
  type LeavePolicy,
  type PaginatedResponse,
} from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import { PageHeading } from "./leave-ui";
import {
  LEAVE_PAGE_SIZE,
  accrualMethodLabel,
  approvalModeLabel,
  todayKey,
  useLeaveTypes,
} from "./leave-utils";

interface PolicyForm {
  name: string;
  code: string;
  description: string;
  leaveTypeId: string;
  entitlementAmount: string;
  entitlementUnit: "DAY" | "HOUR";
  accrualMethod: string;
  accrualFrequency: string;
  accrualStartRule: string;
  eligibilityMonths: string;
  maxBalance: string;
  carryOverEnabled: boolean;
  maxCarryOverAmount: string;
  carryOverExpirationMonths: string;
  minRequestDuration: string;
  maxRequestDuration: string;
  minAdvanceNoticeDays: string;
  allowNegativeBalance: boolean;
  allowHalfDay: boolean;
  allowUnpaidLeave: boolean;
  approvalMode: string;
  leaveYearStartMonth: string;
  cancellationCutoffDays: string;
  effectiveFrom: string;
  effectiveTo: string;
}

const emptyForm = (): PolicyForm => ({
  name: "",
  code: "",
  description: "",
  leaveTypeId: "",
  entitlementAmount: "12",
  entitlementUnit: "DAY",
  accrualMethod: "GRANTED_UPFRONT",
  accrualFrequency: "ANNUAL",
  accrualStartRule: "PERIOD_START",
  eligibilityMonths: "0",
  maxBalance: "",
  carryOverEnabled: false,
  maxCarryOverAmount: "",
  carryOverExpirationMonths: "",
  minRequestDuration: "",
  maxRequestDuration: "",
  minAdvanceNoticeDays: "0",
  allowNegativeBalance: false,
  allowHalfDay: false,
  allowUnpaidLeave: false,
  approvalMode: "MANAGER_AND_HR",
  leaveYearStartMonth: "1",
  cancellationCutoffDays: "0",
  effectiveFrom: todayKey(),
  effectiveTo: "",
});

function formFrom(policy: LeavePolicy): PolicyForm {
  return {
    name: policy.name,
    code: policy.code,
    description: policy.description ?? "",
    leaveTypeId: policy.leaveTypeId,
    entitlementAmount: String(policy.entitlementAmount),
    entitlementUnit: policy.entitlementUnit,
    accrualMethod: policy.accrualMethod,
    accrualFrequency: policy.accrualFrequency,
    accrualStartRule: policy.accrualStartRule,
    eligibilityMonths: String(policy.eligibilityMonths),
    maxBalance: policy.maxBalance === null ? "" : String(policy.maxBalance),
    carryOverEnabled: policy.carryOverEnabled,
    maxCarryOverAmount: policy.maxCarryOverAmount === null ? "" : String(policy.maxCarryOverAmount),
    carryOverExpirationMonths:
      policy.carryOverExpirationMonths === null ? "" : String(policy.carryOverExpirationMonths),
    minRequestDuration: policy.minRequestDuration === null ? "" : String(policy.minRequestDuration),
    maxRequestDuration: policy.maxRequestDuration === null ? "" : String(policy.maxRequestDuration),
    minAdvanceNoticeDays: String(policy.minAdvanceNoticeDays),
    allowNegativeBalance: policy.allowNegativeBalance,
    allowHalfDay: policy.allowHalfDay,
    allowUnpaidLeave: policy.allowUnpaidLeave,
    approvalMode: policy.approvalMode,
    leaveYearStartMonth: String(policy.leaveYearStartMonth),
    cancellationCutoffDays: String(policy.cancellationCutoffDays),
    effectiveFrom: policy.effectiveFrom,
    effectiveTo: policy.effectiveTo ?? "",
  };
}

function numeric(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

export function LeavePoliciesPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<LeavePolicy | "create" | null>(null);
  const [form, setForm] = useState<PolicyForm>(emptyForm());
  const typesQuery = useLeaveTypes();

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

  const policiesQuery = useQuery({
    queryKey: ["leave", "policies", "list", params.toString()],
    queryFn: () =>
      apiRequest<PaginatedResponse<LeavePolicy>>(`/leave-policies?${params.toString()}`),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["leave"] });

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        code: form.code,
        description: form.description || null,
        leaveTypeId: form.leaveTypeId,
        entitlementAmount: Number(form.entitlementAmount),
        entitlementUnit: form.entitlementUnit,
        accrualMethod: form.accrualMethod,
        accrualFrequency: form.accrualFrequency,
        accrualStartRule: form.accrualStartRule,
        eligibilityMonths: Number(form.eligibilityMonths),
        maxBalance: numeric(form.maxBalance),
        carryOverEnabled: form.carryOverEnabled,
        maxCarryOverAmount: numeric(form.maxCarryOverAmount),
        carryOverExpirationMonths: numeric(form.carryOverExpirationMonths),
        minRequestDuration: numeric(form.minRequestDuration),
        maxRequestDuration: numeric(form.maxRequestDuration),
        minAdvanceNoticeDays: Number(form.minAdvanceNoticeDays),
        allowNegativeBalance: form.allowNegativeBalance,
        allowHalfDay: form.allowHalfDay,
        allowUnpaidLeave: form.allowUnpaidLeave,
        approvalMode: form.approvalMode,
        leaveYearStartMonth: Number(form.leaveYearStartMonth),
        cancellationCutoffDays: Number(form.cancellationCutoffDays),
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
      };
      return dialog && dialog !== "create"
        ? apiRequest<LeavePolicy>(`/leave-policies/${dialog.id}`, { method: "PATCH", body })
        : apiRequest<LeavePolicy>("/leave-policies", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(dialog === "create" ? "Leave policy created" : "Leave policy updated");
      setDialog(null);
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not save the policy"),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<LeavePolicy>(`/leave-policies/${id}/deactivate`, { method: "PATCH" }),
    onSuccess: () => {
      toast.success("Leave policy deactivated");
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not deactivate"),
  });

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Leave policies"
        description="Entitlement, accrual, carry-over, approval, and request rules"
        actions={
          hasPermission(PERMISSIONS.LEAVE_POLICY_CREATE) ? (
            <Button onClick={() => setDialog("create")}>Add policy</Button>
          ) : undefined
        }
      />

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                aria-label="Search leave policies"
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
                  Loading leave policies…
                </Typography>
              </Stack>
            ) : policiesQuery.isError ? (
              <Alert tone="error" title="Could not load leave policies">
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
                          {row.code} · {row.leaveType.name}
                        </Typography>
                      </Stack>
                    ),
                  },
                  {
                    key: "entitlement",
                    header: "Entitlement",
                    render: (row) =>
                      `${row.entitlementAmount} ${row.entitlementUnit.toLowerCase()}`,
                  },
                  {
                    key: "accrual",
                    header: "Accrual",
                    render: (row) => accrualMethodLabel(row.accrualMethod),
                  },
                  {
                    key: "carry",
                    header: "Carry-over",
                    render: (row) =>
                      row.carryOverEnabled
                        ? `${row.maxCarryOverAmount ?? "unlimited"} · expires ${row.carryOverExpirationMonths ?? "never"} mo`
                        : "Disabled",
                  },
                  {
                    key: "approval",
                    header: "Approval",
                    render: (row) => approvalModeLabel(row.approvalMode),
                  },
                  {
                    key: "effective",
                    header: "Effective",
                    render: (row) =>
                      `${row.effectiveFrom}${row.effectiveTo ? ` – ${row.effectiveTo}` : " onward"}`,
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
                        {hasPermission(PERMISSIONS.LEAVE_POLICY_UPDATE) ? (
                          <Button variant="text" size="sm" onClick={() => setDialog(row)}>
                            Edit
                          </Button>
                        ) : null}
                        {hasPermission(PERMISSIONS.LEAVE_POLICY_DEACTIVATE) &&
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
                  pageSize: LEAVE_PAGE_SIZE,
                  pageCount: policiesQuery.data.totalPages,
                  total: policiesQuery.data.total,
                  onChange: setPage,
                }}
                emptyText="No leave policies found."
              />
            )}
          </Stack>
        </CardBody>
      </Card>

      <Modal
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog === "create" ? "Add leave policy" : "Edit leave policy"}
        size="lg"
        footer={
          <>
            <Button variant="outlined" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <LoadingButton type="submit" form="leave-policy-form" loading={saveMutation.isPending}>
              Save policy
            </LoadingButton>
          </>
        }
      >
        <form
          id="leave-policy-form"
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
            <Select
              label="Leave type"
              value={form.leaveTypeId}
              onChange={(value) => setForm({ ...form, leaveTypeId: value })}
              options={
                typesQuery.data?.map((entry) => ({ label: entry.name, value: entry.id })) ?? []
              }
              fullWidth
            />
            <Textarea
              label="Description"
              rows={2}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              fullWidth
            />

            <div className="grid gap-3 md:grid-cols-3">
              <Input
                label="Entitlement amount"
                type="number"
                min="0"
                step="0.5"
                value={form.entitlementAmount}
                onChange={(event) => setForm({ ...form, entitlementAmount: event.target.value })}
                required
                fullWidth
              />
              <Select
                label="Unit"
                value={form.entitlementUnit}
                onChange={(value) => setForm({ ...form, entitlementUnit: value as "DAY" | "HOUR" })}
                options={[
                  { label: "Day", value: "DAY" },
                  { label: "Hour", value: "HOUR" },
                ]}
                fullWidth
              />
              <Input
                label="Eligibility (months)"
                type="number"
                min="0"
                value={form.eligibilityMonths}
                onChange={(event) => setForm({ ...form, eligibilityMonths: event.target.value })}
                fullWidth
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Select
                label="Accrual method"
                value={form.accrualMethod}
                onChange={(value) => {
                  const frequency =
                    value === "MONTHLY_ACCRUAL"
                      ? "MONTHLY"
                      : value === "ANNUAL_ACCRUAL"
                        ? "ANNUAL"
                        : value === "GRANTED_UPFRONT"
                          ? "ONE_TIME"
                          : form.accrualFrequency;
                  setForm({ ...form, accrualMethod: value, accrualFrequency: frequency });
                }}
                options={LEAVE_ACCRUAL_METHODS.map((entry) => ({
                  label: accrualMethodLabel(entry),
                  value: entry,
                }))}
                fullWidth
              />
              <Select
                label="Approval mode"
                value={form.approvalMode}
                onChange={(value) => setForm({ ...form, approvalMode: value })}
                options={LEAVE_APPROVAL_MODES.map((entry) => ({
                  label: approvalModeLabel(entry),
                  value: entry,
                }))}
                fullWidth
              />
              <Input
                label="Minimum notice (days)"
                type="number"
                min="0"
                value={form.minAdvanceNoticeDays}
                onChange={(event) => setForm({ ...form, minAdvanceNoticeDays: event.target.value })}
                fullWidth
              />
              <Input
                label="Cancellation cutoff (days)"
                type="number"
                min="0"
                value={form.cancellationCutoffDays}
                onChange={(event) =>
                  setForm({ ...form, cancellationCutoffDays: event.target.value })
                }
                fullWidth
              />
              <Input
                label="Minimum request duration"
                type="number"
                min="0"
                step="0.5"
                value={form.minRequestDuration}
                onChange={(event) => setForm({ ...form, minRequestDuration: event.target.value })}
                fullWidth
              />
              <Input
                label="Maximum request duration"
                type="number"
                min="0"
                step="0.5"
                value={form.maxRequestDuration}
                onChange={(event) => setForm({ ...form, maxRequestDuration: event.target.value })}
                fullWidth
              />
              <Input
                label="Maximum balance"
                type="number"
                min="0"
                step="0.5"
                value={form.maxBalance}
                onChange={(event) => setForm({ ...form, maxBalance: event.target.value })}
                helperText="Leave empty for no cap"
                fullWidth
              />
              <Input
                label="Leave year starts in month"
                type="number"
                min="1"
                max="12"
                value={form.leaveYearStartMonth}
                onChange={(event) => setForm({ ...form, leaveYearStartMonth: event.target.value })}
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
                fullWidth
              />
            </div>

            <Stack spacing={6}>
              <Checkbox
                label="Enable carry-over"
                checked={form.carryOverEnabled}
                onChange={(event) => setForm({ ...form, carryOverEnabled: event.target.checked })}
              />
              {form.carryOverEnabled ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    label="Maximum carry-over amount"
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.maxCarryOverAmount}
                    onChange={(event) =>
                      setForm({ ...form, maxCarryOverAmount: event.target.value })
                    }
                    helperText="Leave empty for no cap"
                    fullWidth
                  />
                  <Input
                    label="Carry-over expires after (months)"
                    type="number"
                    min="0"
                    value={form.carryOverExpirationMonths}
                    onChange={(event) =>
                      setForm({ ...form, carryOverExpirationMonths: event.target.value })
                    }
                    helperText="Leave empty for no expiry"
                    fullWidth
                  />
                </div>
              ) : null}
            </Stack>

            <div className="grid gap-2 md:grid-cols-2">
              <Checkbox
                label="Allow negative balance"
                checked={form.allowNegativeBalance}
                onChange={(event) =>
                  setForm({ ...form, allowNegativeBalance: event.target.checked })
                }
              />
              <Checkbox
                label="Allow half-day requests"
                checked={form.allowHalfDay}
                onChange={(event) => setForm({ ...form, allowHalfDay: event.target.checked })}
              />
              <Checkbox
                label="Allow unpaid leave"
                checked={form.allowUnpaidLeave}
                onChange={(event) => setForm({ ...form, allowUnpaidLeave: event.target.checked })}
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
