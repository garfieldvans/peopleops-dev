import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Drawer,
  Input,
  Modal,
  Select,
  Spinner,
  Stack,
  Table,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { EmployeeCompensation } from "@peopleops/shared-types";
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
  useCompensationHistory,
  useCompensationList,
  usePayrollEmployeeOptions,
} from "./payroll-utils";
import { EmptyState, PageHeading, PermissionNotice } from "./payroll-ui";

const compensationSchema = z
  .object({
    employeeId: z.string().min(1, "Choose an employee"),
    baseSalary: z.string().regex(/^\d+(\.\d+)?$/, "Enter a non-negative amount"),
    currency: z.string().min(3).max(3),
    paymentFrequency: z.enum(["MONTHLY", "SEMI_MONTHLY", "BIWEEKLY", "WEEKLY"]),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Effective date is required"),
    effectiveTo: z.string().optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]),
    notes: z.string().max(500).optional(),
  })
  .refine((value) => !value.effectiveTo || value.effectiveTo >= value.effectiveFrom, {
    message: "End date cannot be before the start date",
    path: ["effectiveTo"],
  });

type CompensationInput = z.input<typeof compensationSchema>;
type CompensationValues = z.output<typeof compensationSchema>;

function emptyForm(): CompensationInput {
  return {
    employeeId: "",
    baseSalary: "",
    currency: "IDR",
    paymentFrequency: "MONTHLY",
    effectiveFrom: "",
    effectiveTo: "",
    status: "ACTIVE",
    notes: "",
  };
}

function formFrom(row: EmployeeCompensation): CompensationInput {
  return {
    employeeId: row.employee.id,
    baseSalary: row.baseSalary,
    currency: row.currency,
    paymentFrequency: row.paymentFrequency,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo ?? "",
    status: row.status,
    notes: row.notes ?? "",
  };
}

export function CompensationPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<EmployeeCompensation | "create" | null>(null);
  const [historyEmployee, setHistoryEmployee] = useState<EmployeeCompensation["employee"] | null>(
    null,
  );

  const form = useForm<CompensationInput, unknown, CompensationValues>({
    resolver: zodResolver(compensationSchema),
    defaultValues: emptyForm(),
  });

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
  if (status) params.set("status", status);
  const listQuery = useCompensationList(params);
  const employeeQuery = usePayrollEmployeeOptions(Boolean(dialog));
  const historyQuery = useCompensationHistory(historyEmployee?.id ?? null);

  const employeeChoices = useMemo(
    () => employeeOptions(employeeQuery.data?.items),
    [employeeQuery.data],
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["payroll", "compensation"] });
  };

  const saveMutation = useMutation({
    mutationFn: (values: CompensationValues) => {
      const body = {
        ...values,
        effectiveTo: values.effectiveTo || null,
        notes: values.notes || null,
      };
      return dialog && dialog !== "create"
        ? apiRequest<EmployeeCompensation>(`/payroll/compensation/${dialog.id}`, {
            method: "PATCH",
            body,
          })
        : apiRequest<EmployeeCompensation>("/payroll/compensation", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(dialog === "create" ? "Compensation created" : "Compensation updated");
      setDialog(null);
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not save compensation"),
  });

  const total = listQuery.data?.total ?? 0;
  const active = listQuery.data?.items.filter((row) => row.status === "ACTIVE").length ?? 0;

  if (!hasPermission(PERMISSIONS.PAYROLL_COMPENSATION_READ)) {
    return <PermissionNotice>Ask HR or payroll for compensation access.</PermissionNotice>;
  }

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Employee compensation"
        description="Effective-dated salary records. History is preserved; existing rows are never overwritten."
        actions={
          hasPermission(PERMISSIONS.PAYROLL_COMPENSATION_MANAGE) ? (
            <Button onClick={() => setDialog("create")}>Add compensation</Button>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card variant="outlined" padding="md">
          <CardBody>
            <Typography variant="caption" color="neutral">
              Records
            </Typography>
            <Typography variant="h5">{total}</Typography>
          </CardBody>
        </Card>
        <Card variant="outlined" padding="md">
          <CardBody>
            <Typography variant="caption" color="neutral">
              Active on this page
            </Typography>
            <Typography variant="h5">{active}</Typography>
          </CardBody>
        </Card>
        <Card variant="outlined" padding="md">
          <CardBody>
            <Typography variant="caption" color="neutral">
              Rule
            </Typography>
            <Typography variant="bodySmall">One active salary per employee at a time</Typography>
          </CardBody>
        </Card>
      </div>

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                aria-label="Search compensation"
                placeholder="Search employee name or number"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                clearable
                onClear={() => setSearchInput("")}
                fullWidth
              />
              <Select
                aria-label="Filter compensation status"
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

            {listQuery.isPending ? (
              <Stack direction="row" spacing={12} align="center">
                <Spinner />
                <Typography variant="bodySmall" color="neutral">
                  Loading compensation…
                </Typography>
              </Stack>
            ) : listQuery.isError ? (
              <Alert tone="error" title="Could not load compensation">
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
                    title="No compensation records"
                    description="Add a salary record before creating payroll."
                  />
                }
                pagination={{
                  page,
                  pageSize: PAYROLL_PAGE_SIZE,
                  pageCount: listQuery.data?.totalPages ?? 1,
                  total,
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
                          {row.employee.department ? ` · ${row.employee.department}` : ""}
                        </Typography>
                      </Stack>
                    ),
                  },
                  {
                    key: "salary",
                    header: "Base salary",
                    align: "right",
                    render: (row) => formatMoney(row.baseSalary, row.currency),
                  },
                  {
                    key: "frequency",
                    header: "Frequency",
                    render: (row) => row.paymentFrequency.replaceAll("_", " "),
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
                    render: (row) => (
                      <Stack direction="row" spacing={4} justify="end">
                        <Button
                          variant="text"
                          size="sm"
                          onClick={() => setHistoryEmployee(row.employee)}
                        >
                          History
                        </Button>
                        {hasPermission(PERMISSIONS.PAYROLL_COMPENSATION_MANAGE) ? (
                          <Button variant="text" size="sm" onClick={() => setDialog(row)}>
                            Edit
                          </Button>
                        ) : null}
                      </Stack>
                    ),
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
        title={dialog === "create" ? "Add compensation" : "Edit compensation"}
        description="Salary changes are effective-dated. Use a new row for a raise instead of editing history."
        size="md"
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
          <div className="md:col-span-2">
            <FormSelect
              control={form.control}
              name="employeeId"
              label="Employee"
              options={employeeChoices}
              searchable
              disabled={dialog !== "create"}
              fullWidth
            />
          </div>
          <FormInput
            control={form.control}
            name="baseSalary"
            label="Base salary"
            placeholder="7500000"
            inputMode="decimal"
            fullWidth
          />
          <FormSelect
            control={form.control}
            name="currency"
            label="Currency"
            options={[
              { label: "IDR", value: "IDR" },
              { label: "USD", value: "USD" },
              { label: "SGD", value: "SGD" },
            ]}
            fullWidth
          />
          <FormSelect
            control={form.control}
            name="paymentFrequency"
            label="Payment frequency"
            options={[
              { label: "Monthly", value: "MONTHLY" },
              { label: "Semi-monthly", value: "SEMI_MONTHLY" },
              { label: "Biweekly", value: "BIWEEKLY" },
              { label: "Weekly", value: "WEEKLY" },
            ]}
            fullWidth
          />
          <FormSelect
            control={form.control}
            name="status"
            label="Status"
            options={[
              { label: "Active", value: "ACTIVE" },
              { label: "Inactive", value: "INACTIVE" },
            ]}
            fullWidth
          />
          <FormDatePicker control={form.control} name="effectiveFrom" label="Effective from" />
          <FormDatePicker control={form.control} name="effectiveTo" label="Effective to" />
          <div className="md:col-span-2">
            <FormInput
              control={form.control}
              name="notes"
              label="Notes"
              placeholder="Optional context for this salary record"
              fullWidth
            />
          </div>
        </form>
      </Modal>

      <Drawer
        open={historyEmployee !== null}
        onOpenChange={(open) => {
          if (!open) setHistoryEmployee(null);
        }}
        title={historyEmployee ? `${historyEmployee.fullName} · compensation history` : "History"}
        size="md"
        placement="right"
      >
        {historyQuery.isPending ? (
          <Stack direction="row" spacing={12} align="center">
            <Spinner />
            <Typography variant="bodySmall" color="neutral">
              Loading history…
            </Typography>
          </Stack>
        ) : historyQuery.isError ? (
          <Alert tone="error" title="Could not load history">
            {historyQuery.error instanceof ApiRequestError
              ? historyQuery.error.message
              : "Unexpected error"}
          </Alert>
        ) : (
          <Table
            data={historyQuery.data ?? []}
            rowKey={(row) => row.id}
            emptyText={
              <EmptyState
                title="No history yet"
                description="Compensation records will appear here."
              />
            }
            columns={[
              {
                key: "range",
                header: "Effective range",
                render: (row) => (
                  <Typography variant="caption">
                    {formatDate(row.effectiveFrom)} – {row.effectiveTo ? formatDate(row.effectiveTo) : "open"}
                  </Typography>
                ),
              },
              {
                key: "salary",
                header: "Salary",
                align: "right",
                render: (row) => formatMoney(row.baseSalary, row.currency),
              },
              {
                key: "status",
                header: "Status",
                render: (row) => (
                  <Badge variant="outlined" color={row.status === "ACTIVE" ? "success" : "neutral"}>
                    {row.status}
                  </Badge>
                ),
              },
            ]}
          />
        )}
      </Drawer>
    </Stack>
  );
}
