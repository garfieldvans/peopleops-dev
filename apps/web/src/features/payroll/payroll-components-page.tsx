import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  Switch,
  Table,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import type { PayrollComponent, PayrollSetting } from "@peopleops/shared-types";
import { PERMISSIONS } from "@peopleops/shared-types";
import { FormDatePicker } from "../../components/form-date-picker";
import { FormInput } from "../../components/form-input";
import { FormSelect } from "../../components/form-select";
import { LoadingButton } from "../../components/loading-button";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { useAuth } from "../auth/auth-context";
import {
  formatDate,
  formatMoney,
  PAYROLL_PAGE_SIZE,
  usePayrollComponents,
  usePayrollSettings,
} from "./payroll-utils";
import { ConfirmDialog, EmptyState, PageHeading, PermissionNotice } from "./payroll-ui";

const componentSchema = z
  .object({
    code: z.string().min(2).max(40).regex(/^[A-Za-z0-9_.-]+$/, "Use letters, digits, dot, dash or underscore"),
    name: z.string().min(2).max(120),
    description: z.string().max(500).optional(),
    componentType: z.enum(["EARNING", "DEDUCTION", "EMPLOYER_CONTRIBUTION", "INFORMATIONAL"]),
    calculationType: z.enum(["FIXED_AMOUNT", "PERCENTAGE", "MANUAL_AMOUNT", "SOURCE_BASED"]),
    defaultAmount: z.string().regex(/^\d+(\.\d+)?$/, "Enter a non-negative amount"),
    percentage: z.string().optional(),
    rateMultiplier: z.string().optional(),
    sourceType: z.string().optional(),
    isTaxable: z.boolean(),
    isRecurring: z.boolean(),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Effective date is required"),
    effectiveTo: z.string().optional(),
  })
  .refine((value) => value.calculationType !== "PERCENTAGE" || Boolean(value.percentage), {
    message: "Percentage is required for percentage components",
    path: ["percentage"],
  })
  .refine((value) => value.calculationType !== "SOURCE_BASED" || Boolean(value.sourceType), {
    message: "Choose the source for a source-based component",
    path: ["sourceType"],
  })
  .refine((value) => !value.effectiveTo || value.effectiveTo >= value.effectiveFrom, {
    message: "End date cannot be before the start date",
    path: ["effectiveTo"],
  });

type ComponentInput = z.input<typeof componentSchema>;
type ComponentValues = z.output<typeof componentSchema>;

function emptyForm(): ComponentInput {
  return {
    code: "",
    name: "",
    description: "",
    componentType: "EARNING",
    calculationType: "FIXED_AMOUNT",
    defaultAmount: "0",
    percentage: "",
    rateMultiplier: "",
    sourceType: "",
    isTaxable: false,
    isRecurring: true,
    effectiveFrom: "",
    effectiveTo: "",
  };
}

function formFrom(row: PayrollComponent): ComponentInput {
  return {
    code: row.code,
    name: row.name,
    description: row.description ?? "",
    componentType: row.componentType,
    calculationType: row.calculationType,
    defaultAmount: row.defaultAmount,
    percentage: row.percentage ?? "",
    rateMultiplier: row.rateMultiplier ?? "",
    sourceType: row.sourceType ?? "",
    isTaxable: row.isTaxable,
    isRecurring: row.isRecurring,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo ?? "",
  };
}

export function PayrollComponentsPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<PayrollComponent | "create" | null>(null);
  const [deactivating, setDeactivating] = useState<PayrollComponent | null>(null);
  const [editingSettings, setEditingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    standardMonthlyHours: "",
    standardMonthlyDays: "",
    roundingMode: "HALF_UP" as PayrollSetting["roundingMode"],
    currencyScale: "2",
  });

  const form = useForm<ComponentInput, unknown, ComponentValues>({
    resolver: zodResolver(componentSchema),
    defaultValues: emptyForm(),
  });
  const calculationType = form.watch("calculationType");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (dialog === "create") form.reset(emptyForm());
    else if (dialog) form.reset(formFrom(dialog));
  }, [dialog, form]);

  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(PAYROLL_PAGE_SIZE),
  });
  if (search) params.set("search", search);
  if (type) params.set("componentType", type);
  const listQuery = usePayrollComponents(params);
  const canReadSettings = hasPermission(PERMISSIONS.PAYROLL_SETTINGS_READ);
  const settingsQuery = usePayrollSettings(canReadSettings);

  useEffect(() => {
    const settings = settingsQuery.data;
    if (!settings || editingSettings) return;
    setSettingsForm({
      standardMonthlyHours: settings.standardMonthlyHours,
      standardMonthlyDays: settings.standardMonthlyDays,
      roundingMode: settings.roundingMode,
      currencyScale: String(settings.currencyScale),
    });
  }, [settingsQuery.data, editingSettings]);

  const settingsMutation = useMutation({
    mutationFn: () =>
      apiRequest<PayrollSetting>("/payroll/settings", {
        method: "PATCH",
        body: settingsForm,
      }),
    onSuccess: () => {
      toast.success("Payroll settings updated");
      setEditingSettings(false);
      void queryClient.invalidateQueries({ queryKey: ["payroll", "settings"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not save settings"),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["payroll", "components"] });
  };

  const saveMutation = useMutation({
    mutationFn: (values: ComponentValues) => {
      const body = {
        ...values,
        description: values.description || null,
        percentage: values.percentage || null,
        rateMultiplier: values.rateMultiplier || null,
        sourceType: values.calculationType === "SOURCE_BASED" ? values.sourceType || null : null,
        effectiveTo: values.effectiveTo || null,
      };
      return dialog && dialog !== "create"
        ? apiRequest<PayrollComponent>(`/payroll/components/${dialog.id}`, {
            method: "PATCH",
            body,
          })
        : apiRequest<PayrollComponent>("/payroll/components", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(dialog === "create" ? "Component created" : "Component updated");
      setDialog(null);
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not save component"),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<PayrollComponent>(`/payroll/components/${id}/deactivate`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Component deactivated");
      setDeactivating(null);
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not deactivate"),
  });

  if (!hasPermission(PERMISSIONS.PAYROLL_COMPONENTS_READ)) {
    return <PermissionNotice>Ask payroll for component configuration access.</PermissionNotice>;
  }

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Payroll components"
        description="Configure earnings, deductions, employer contributions, and source-based rules."
        actions={
          hasPermission(PERMISSIONS.PAYROLL_COMPONENTS_MANAGE) ? (
            <Button onClick={() => setDialog("create")}>Add component</Button>
          ) : undefined
        }
      />

      <Alert tone="info" title="No statutory calculations are hardcoded">
        Components are configurable. PPh 21, BPJS, THR, and statutory overtime multipliers are out of
        scope for this phase.
      </Alert>

      {canReadSettings ? (
        <Card variant="outlined" padding="lg">
          <CardBody>
            <Stack spacing={12}>
              <Stack direction="row" justify="between" align="center" wrap>
                <Stack spacing={2}>
                  <Typography variant="h5">Calculation settings</Typography>
                  <Typography variant="caption" color="neutral">
                    Used by new runs. Existing runs keep the snapshot taken when they were created.
                  </Typography>
                </Stack>
                {hasPermission(PERMISSIONS.PAYROLL_SETTINGS_MANAGE) ? (
                  <Button
                    variant={editingSettings ? "text" : "outlined"}
                    size="sm"
                    onClick={() => setEditingSettings((value) => !value)}
                  >
                    {editingSettings ? "Close" : "Edit settings"}
                  </Button>
                ) : null}
              </Stack>
              {settingsQuery.isPending ? (
                <Spinner />
              ) : settingsQuery.isError ? (
                <Alert tone="error" title="Could not load payroll settings">
                  Refresh the page to try again.
                </Alert>
              ) : editingSettings ? (
                <Stack spacing={12}>
                  <div className="grid gap-3 md:grid-cols-4">
                    <Input
                      label="Standard monthly hours"
                      value={settingsForm.standardMonthlyHours}
                      onChange={(event) =>
                        setSettingsForm((current) => ({
                          ...current,
                          standardMonthlyHours: event.target.value,
                        }))
                      }
                      fullWidth
                    />
                    <Input
                      label="Standard monthly days"
                      value={settingsForm.standardMonthlyDays}
                      onChange={(event) =>
                        setSettingsForm((current) => ({
                          ...current,
                          standardMonthlyDays: event.target.value,
                        }))
                      }
                      fullWidth
                    />
                    <Select
                      label="Rounding"
                      value={settingsForm.roundingMode}
                      onChange={(value) =>
                        setSettingsForm((current) => ({
                          ...current,
                          roundingMode: value as PayrollSetting["roundingMode"],
                        }))
                      }
                      options={[
                        { label: "Half up", value: "HALF_UP" },
                        { label: "Round down", value: "ROUND_DOWN" },
                        { label: "Round up", value: "ROUND_UP" },
                      ]}
                      fullWidth
                    />
                    <Input
                      label="Currency scale"
                      type="number"
                      min={0}
                      max={6}
                      value={settingsForm.currencyScale}
                      onChange={(event) =>
                        setSettingsForm((current) => ({
                          ...current,
                          currencyScale: event.target.value,
                        }))
                      }
                      fullWidth
                    />
                  </div>
                  <Stack direction="row" spacing={8} justify="end">
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setEditingSettings(false);
                        if (settingsQuery.data) {
                          setSettingsForm({
                            standardMonthlyHours: settingsQuery.data.standardMonthlyHours,
                            standardMonthlyDays: settingsQuery.data.standardMonthlyDays,
                            roundingMode: settingsQuery.data.roundingMode,
                            currencyScale: String(settingsQuery.data.currencyScale),
                          });
                        }
                      }}
                    >
                      Cancel
                    </Button>
                    <LoadingButton
                      loading={settingsMutation.isPending}
                      onClick={() => settingsMutation.mutate()}
                    >
                      Save settings
                    </LoadingButton>
                  </Stack>
                </Stack>
              ) : (
                <div className="grid gap-3 sm:grid-cols-4">
                  <div>
                    <Typography variant="caption" color="neutral">
                      Standard hours
                    </Typography>
                    <Typography variant="bodySmall">
                      {settingsQuery.data?.standardMonthlyHours}
                    </Typography>
                  </div>
                  <div>
                    <Typography variant="caption" color="neutral">
                      Standard days
                    </Typography>
                    <Typography variant="bodySmall">
                      {settingsQuery.data?.standardMonthlyDays}
                    </Typography>
                  </div>
                  <div>
                    <Typography variant="caption" color="neutral">
                      Rounding
                    </Typography>
                    <Typography variant="bodySmall">
                      {settingsQuery.data?.roundingMode.replaceAll("_", " ")}
                    </Typography>
                  </div>
                  <div>
                    <Typography variant="caption" color="neutral">
                      Currency scale
                    </Typography>
                    <Typography variant="bodySmall">
                      {settingsQuery.data?.currencyScale}
                    </Typography>
                  </div>
                </div>
              )}
            </Stack>
          </CardBody>
        </Card>
      ) : null}

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                aria-label="Search payroll components"
                placeholder="Search name or code"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                clearable
                onClear={() => setSearchInput("")}
                fullWidth
              />
              <Select
                aria-label="Filter component type"
                value={type}
                onChange={(value) => {
                  setType(value);
                  setPage(1);
                }}
                options={[
                  { label: "All component types", value: "" },
                  { label: "Earning", value: "EARNING" },
                  { label: "Deduction", value: "DEDUCTION" },
                  { label: "Employer contribution", value: "EMPLOYER_CONTRIBUTION" },
                  { label: "Informational", value: "INFORMATIONAL" },
                ]}
                fullWidth
              />
              <Button
                variant="outlined"
                onClick={() => {
                  setSearchInput("");
                  setType("");
                  setPage(1);
                }}
              >
                Reset filters
              </Button>
            </div>

            {listQuery.isPending ? (
              <Stack direction="row" spacing={12} align="center">
                <Spinner />
                <Typography variant="bodySmall" color="neutral">
                  Loading components…
                </Typography>
              </Stack>
            ) : listQuery.isError ? (
              <Alert tone="error" title="Could not load components">
                {listQuery.error instanceof ApiRequestError
                  ? listQuery.error.message
                  : "Unexpected error"}
              </Alert>
            ) : (
              <Table
                data={listQuery.data?.items ?? []}
                rowKey={(row) => row.id}
                emptyText={
                  <EmptyState
                    title="No payroll components"
                    description="Create the components that make up a payslip."
                  />
                }
                pagination={{
                  page,
                  pageSize: PAYROLL_PAGE_SIZE,
                  pageCount: listQuery.data?.totalPages ?? 1,
                  total: listQuery.data?.total ?? 0,
                  onChange: setPage,
                }}
                columns={[
                  {
                    key: "component",
                    header: "Component",
                    render: (row) => (
                      <Stack spacing={1}>
                        <Typography variant="bodySmall" className="font-medium">
                          {row.name}
                        </Typography>
                        <Typography variant="caption" color="neutral">
                          {row.code} · {row.componentType.replaceAll("_", " ").toLowerCase()}
                        </Typography>
                      </Stack>
                    ),
                  },
                  {
                    key: "calculation",
                    header: "Calculation",
                    render: (row) => (
                      <Stack spacing={1}>
                        <Typography variant="bodySmall">
                          {row.calculationType.replaceAll("_", " ")}
                        </Typography>
                        <Typography variant="caption" color="neutral">
                          {row.calculationType === "PERCENTAGE"
                            ? `${row.percentage ?? "0"}%`
                            : row.calculationType === "SOURCE_BASED"
                              ? `${row.sourceType ?? "source"} × ${row.rateMultiplier ?? "1"}`
                              : formatMoney(row.defaultAmount)}
                        </Typography>
                      </Stack>
                    ),
                  },
                  {
                    key: "effective",
                    header: "Effective",
                    render: (row) => (
                      <Typography variant="caption">
                        {formatDate(row.effectiveFrom)} –{" "}
                        {row.effectiveTo ? formatDate(row.effectiveTo) : "open"}
                      </Typography>
                    ),
                  },
                  { key: "assignments", header: "Assignments", render: (row) => row.assignmentCount },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => (
                      <Badge variant="filled" color={row.isActive ? "success" : "neutral"}>
                        {row.isActive ? "ACTIVE" : "INACTIVE"}
                      </Badge>
                    ),
                  },
                  {
                    key: "actions",
                    header: "",
                    align: "right",
                    render: (row) =>
                      hasPermission(PERMISSIONS.PAYROLL_COMPONENTS_MANAGE) ? (
                        <Stack direction="row" spacing={4} justify="end">
                          <Button variant="text" size="sm" onClick={() => setDialog(row)}>
                            Edit
                          </Button>
                          {row.isActive ? (
                            <Button
                              variant="text"
                              size="sm"
                              color="error"
                              onClick={() => setDeactivating(row)}
                            >
                              Deactivate
                            </Button>
                          ) : null}
                        </Stack>
                      ) : null,
                  },
                ]}
              />
            )}
          </Stack>
        </CardBody>
      </Card>

      <Modal
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={dialog === "create" ? "Add payroll component" : "Edit payroll component"}
        description="Changes apply to future calculations. Published payslips keep their snapshots."
        size="lg"
        footer={
          <Stack direction="row" justify="end" spacing={8}>
            <Button variant="outlined" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <LoadingButton
              loading={saveMutation.isPending}
              onClick={() => void form.handleSubmit((values) => saveMutation.mutate(values))()}
            >
              {dialog === "create" ? "Create" : "Save changes"}
            </LoadingButton>
          </Stack>
        }
      >
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
        >
          <FormInput control={form.control} name="code" label="Code" fullWidth />
          <FormInput control={form.control} name="name" label="Name" fullWidth />
          <FormSelect
            control={form.control}
            name="componentType"
            label="Component type"
            options={[
              { label: "Earning", value: "EARNING" },
              { label: "Deduction", value: "DEDUCTION" },
              { label: "Employer contribution", value: "EMPLOYER_CONTRIBUTION" },
              { label: "Informational", value: "INFORMATIONAL" },
            ]}
            fullWidth
          />
          <FormSelect
            control={form.control}
            name="calculationType"
            label="Calculation"
            options={[
              { label: "Fixed amount", value: "FIXED_AMOUNT" },
              { label: "Percentage of base", value: "PERCENTAGE" },
              { label: "Manual adjustment", value: "MANUAL_AMOUNT" },
              { label: "Source based", value: "SOURCE_BASED" },
            ]}
            fullWidth
          />
          <FormInput
            control={form.control}
            name="defaultAmount"
            label="Default amount"
            inputMode="decimal"
            fullWidth
          />
          {calculationType === "PERCENTAGE" ? (
            <FormInput
              control={form.control}
              name="percentage"
              label="Percentage"
              placeholder="10"
              inputMode="decimal"
              fullWidth
            />
          ) : null}
          {calculationType === "SOURCE_BASED" ? (
            <>
              <FormSelect
                control={form.control}
                name="sourceType"
                label="Source"
                options={[
                  { label: "Absence days", value: "ABSENCE" },
                  { label: "Late minutes", value: "LATE" },
                  { label: "Early leave minutes", value: "EARLY_LEAVE" },
                  { label: "Unpaid leave days", value: "UNPAID_LEAVE" },
                  { label: "Verified overtime hours", value: "OVERTIME" },
                ]}
                fullWidth
              />
              <FormInput
                control={form.control}
                name="rateMultiplier"
                label="Rate multiplier"
                placeholder="1"
                inputMode="decimal"
                fullWidth
              />
            </>
          ) : null}
          <FormDatePicker control={form.control} name="effectiveFrom" label="Effective from" />
          <FormDatePicker control={form.control} name="effectiveTo" label="Effective to" />
          <div className="flex items-center gap-6 md:col-span-2">
            <Controller
              control={form.control}
              name="isRecurring"
              render={({ field }) => (
                <Switch
                  label="Recurring"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.target.checked)}
                />
              )}
            />
            <Controller
              control={form.control}
              name="isTaxable"
              render={({ field }) => (
                <Switch
                  label="Taxable"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.target.checked)}
                />
              )}
            />
          </div>
          <div className="md:col-span-2">
            <FormInput
              control={form.control}
              name="description"
              label="Description"
              placeholder="Optional internal note"
              fullWidth
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(open) => {
          if (!open) setDeactivating(null);
        }}
        title="Deactivate payroll component"
        description={`${deactivating?.name ?? "This component"} will no longer be available for new assignments or calculations.`}
        confirmLabel="Deactivate"
        tone="error"
        busy={deactivateMutation.isPending}
        onConfirm={() => {
          if (deactivating) deactivateMutation.mutate(deactivating.id);
        }}
      >
        <Typography variant="bodySmall" color="neutral">
          Existing payslips and historical snapshots are not changed.
        </Typography>
      </ConfirmDialog>
    </Stack>
  );
}
