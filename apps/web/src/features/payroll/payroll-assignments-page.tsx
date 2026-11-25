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
  Spinner,
  Stack,
  Table,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { EmployeePayrollAssignment } from "@peopleops/shared-types";
import { PERMISSIONS } from "@peopleops/shared-types";
import { FormDatePicker } from "../../components/form-date-picker";
import { FormInput } from "../../components/form-input";
import { FormSelect } from "../../components/form-select";
import { LoadingButton } from "../../components/loading-button";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { useAuth } from "../auth/auth-context";
import {
  employeeOptions,
  formatDate,
  formatMoney,
  PAYROLL_PAGE_SIZE,
  useActivePayrollComponents,
  usePayrollAssignments,
  usePayrollEmployeeOptions,
} from "./payroll-utils";
import { ConfirmDialog, EmptyState, PageHeading, PermissionNotice } from "./payroll-ui";

const assignmentSchema = z
  .object({
    employeeId: z.string().min(1, "Choose an employee"),
    componentId: z.string().min(1, "Choose a component"),
    amountOverride: z.string().optional(),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Effective date is required"),
    effectiveTo: z.string().optional(),
    notes: z.string().max(500).optional(),
  })
  .refine((value) => !value.amountOverride || /^\d+(\.\d+)?$/.test(value.amountOverride), {
    message: "Enter a non-negative amount",
    path: ["amountOverride"],
  })
  .refine((value) => !value.effectiveTo || value.effectiveTo >= value.effectiveFrom, {
    message: "End date cannot be before the start date",
    path: ["effectiveTo"],
  });

type AssignmentInput = z.input<typeof assignmentSchema>;
type AssignmentValues = z.output<typeof assignmentSchema>;

function emptyForm(): AssignmentInput {
  return {
    employeeId: "",
    componentId: "",
    amountOverride: "",
    effectiveFrom: "",
    effectiveTo: "",
    notes: "",
  };
}

export function PayrollAssignmentsPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [deactivating, setDeactivating] = useState<EmployeePayrollAssignment | null>(null);

  const form = useForm<AssignmentInput, unknown, AssignmentValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: emptyForm(),
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(PAYROLL_PAGE_SIZE),
  });
  if (search) params.set("search", search);
  const listQuery = usePayrollAssignments(params);
  const employeeQuery = usePayrollEmployeeOptions(open);
  const componentQuery = useActivePayrollComponents();
  const employees = useMemo(() => employeeOptions(employeeQuery.data?.items), [employeeQuery.data]);
  const components = useMemo(
    () =>
      componentQuery.data
        ?.filter((component) => component.calculationType !== "SOURCE_BASED")
        .map((component) => ({
          label: `${component.name} · ${component.code}`,
          value: component.id,
          description: `${component.componentType.replaceAll("_", " ").toLowerCase()} · ${component.calculationType.replaceAll("_", " ").toLowerCase()}`,
        })) ?? [],
    [componentQuery.data],
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["payroll", "assignments"] });
  };

  const createMutation = useMutation({
    mutationFn: (values: AssignmentValues) =>
      apiRequest<EmployeePayrollAssignment>("/payroll/assignments", {
        method: "POST",
        body: {
          ...values,
          amountOverride: values.amountOverride || null,
          effectiveTo: values.effectiveTo || null,
          notes: values.notes || null,
        },
      }),
    onSuccess: () => {
      toast.success("Payroll assignment created");
      setOpen(false);
      form.reset(emptyForm());
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not create assignment"),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<EmployeePayrollAssignment>(`/payroll/assignments/${id}/deactivate`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast.success("Assignment deactivated");
      setDeactivating(null);
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not deactivate"),
  });

  if (!hasPermission(PERMISSIONS.PAYROLL_COMPONENTS_READ)) {
    return <PermissionNotice>Ask payroll for assignment access.</PermissionNotice>;
  }

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Employee payroll assignments"
        description="Attach recurring earnings and deductions to employees with effective dates."
        actions={
          hasPermission(PERMISSIONS.PAYROLL_ASSIGNMENTS_MANAGE) ? (
            <Button onClick={() => setOpen(true)}>Assign component</Button>
          ) : undefined
        }
      />

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <Input
                aria-label="Search payroll assignments"
                placeholder="Search employee name or number"
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
                Reset
              </Button>
            </div>

            {listQuery.isPending ? (
              <Stack direction="row" spacing={12} align="center">
                <Spinner />
                <Typography variant="bodySmall" color="neutral">
                  Loading assignments…
                </Typography>
              </Stack>
            ) : listQuery.isError ? (
              <Alert tone="error" title="Could not load assignments">
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
                    title="No payroll assignments"
                    description="Assign allowances or deductions to employees here."
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
                    key: "employee",
                    header: "Employee",
                    render: (row) => (
                      <Stack spacing={1}>
                        <Typography variant="bodySmall" className="font-medium">
                          {row.employee.fullName}
                        </Typography>
                        <Typography variant="caption" color="neutral">
                          {row.employee.employeeNumber}
                        </Typography>
                      </Stack>
                    ),
                  },
                  {
                    key: "component",
                    header: "Component",
                    render: (row) => (
                      <Stack spacing={1}>
                        <Typography variant="bodySmall">{row.component.name}</Typography>
                        <Typography variant="caption" color="neutral">
                          {row.component.code} · {row.component.componentType.toLowerCase()}
                        </Typography>
                      </Stack>
                    ),
                  },
                  {
                    key: "override",
                    header: "Override",
                    align: "right",
                    render: (row) => (row.amountOverride ? formatMoney(row.amountOverride) : "Default"),
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
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => (
                      <Badge
                        variant="filled"
                        color={row.status === "ACTIVE" ? "success" : "neutral"}
                      >
                        {row.status}
                      </Badge>
                    ),
                  },
                  {
                    key: "actions",
                    header: "",
                    align: "right",
                    render: (row) =>
                      row.status === "ACTIVE" &&
                      hasPermission(PERMISSIONS.PAYROLL_ASSIGNMENTS_MANAGE) ? (
                        <Button
                          variant="text"
                          size="sm"
                          color="error"
                          onClick={() => setDeactivating(row)}
                        >
                          Deactivate
                        </Button>
                      ) : null,
                  },
                ]}
              />
            )}
          </Stack>
        </CardBody>
      </Card>

      <Modal
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) form.reset(emptyForm());
        }}
        title="Assign payroll component"
        description="Overlapping assignments for the same employee and component are rejected."
        size="md"
        footer={
          <Stack direction="row" justify="end" spacing={8}>
            <Button variant="outlined" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <LoadingButton
              loading={createMutation.isPending}
              onClick={() => void form.handleSubmit((values) => createMutation.mutate(values))()}
            >
              Assign
            </LoadingButton>
          </Stack>
        }
      >
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
        >
          <div className="md:col-span-2">
            <FormSelect
              control={form.control}
              name="employeeId"
              label="Employee"
              options={employees}
              searchable
              fullWidth
            />
          </div>
          <div className="md:col-span-2">
            <FormSelect
              control={form.control}
              name="componentId"
              label="Component"
              options={components}
              searchable
              fullWidth
            />
          </div>
          <FormInput
            control={form.control}
            name="amountOverride"
            label="Amount override"
            placeholder="Leave blank to use the component default"
            inputMode="decimal"
            fullWidth
          />
          <FormInput
            control={form.control}
            name="notes"
            label="Notes"
            placeholder="Optional"
            fullWidth
          />
          <FormDatePicker control={form.control} name="effectiveFrom" label="Effective from" />
          <FormDatePicker control={form.control} name="effectiveTo" label="Effective to" />
        </form>
      </Modal>

      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(next) => {
          if (!next) setDeactivating(null);
        }}
        title="Deactivate assignment"
        description={`${deactivating?.component.name ?? "This assignment"} will stop applying to future payroll runs.`}
        confirmLabel="Deactivate"
        tone="error"
        busy={deactivateMutation.isPending}
        onConfirm={() => {
          if (deactivating) deactivateMutation.mutate(deactivating.id);
        }}
      >
        <Typography variant="bodySmall" color="neutral">
          Historical payroll snapshots are unchanged.
        </Typography>
      </ConfirmDialog>
    </Stack>
  );
}
