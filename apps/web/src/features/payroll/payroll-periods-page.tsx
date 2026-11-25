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
  Table,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { PayrollPeriod } from "@peopleops/shared-types";
import { PERMISSIONS } from "@peopleops/shared-types";
import { FormDatePicker } from "../../components/form-date-picker";
import { FormInput } from "../../components/form-input";
import { FormSelect } from "../../components/form-select";
import { LoadingButton } from "../../components/loading-button";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { useAuth } from "../auth/auth-context";
import { formatDate, PAYROLL_PAGE_SIZE, usePayrollPeriods } from "./payroll-utils";
import { EmptyState, PageHeading, PermissionNotice } from "./payroll-ui";

const periodSchema = z
  .object({
    name: z.string().min(2).max(120),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date is required"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date is required"),
    paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Payment date is required"),
    status: z.enum(["OPEN", "CLOSED"]),
    notes: z.string().max(500).optional(),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "End date cannot be before the start date",
    path: ["endDate"],
  })
  .refine((value) => value.paymentDate >= value.endDate, {
    message: "Payment date cannot be before the end date",
    path: ["paymentDate"],
  });

type PeriodInput = z.input<typeof periodSchema>;
type PeriodValues = z.output<typeof periodSchema>;

function emptyForm(): PeriodInput {
  return { name: "", startDate: "", endDate: "", paymentDate: "", status: "OPEN", notes: "" };
}

function formFrom(row: PayrollPeriod): PeriodInput {
  return {
    name: row.name,
    startDate: row.startDate,
    endDate: row.endDate,
    paymentDate: row.paymentDate,
    status: row.status,
    notes: row.notes ?? "",
  };
}

export function PayrollPeriodsPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<PayrollPeriod | "create" | null>(null);

  const form = useForm<PeriodInput, unknown, PeriodValues>({
    resolver: zodResolver(periodSchema),
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
  const listQuery = usePayrollPeriods(params);

  const saveMutation = useMutation({
    mutationFn: (values: PeriodValues) => {
      const body = { ...values, notes: values.notes || null };
      return dialog && dialog !== "create"
        ? apiRequest<PayrollPeriod>(`/payroll/periods/${dialog.id}`, { method: "PATCH", body })
        : apiRequest<PayrollPeriod>("/payroll/periods", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(dialog === "create" ? "Payroll period created" : "Payroll period updated");
      setDialog(null);
      void queryClient.invalidateQueries({ queryKey: ["payroll", "periods"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not save the period"),
  });

  if (!hasPermission(PERMISSIONS.PAYROLL_PERIODS_READ)) {
    return <PermissionNotice>Ask payroll for period access.</PermissionNotice>;
  }

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Payroll periods"
        description="Define non-overlapping date ranges and payment dates before creating a run."
        actions={
          hasPermission(PERMISSIONS.PAYROLL_PERIODS_MANAGE) ? (
            <Button onClick={() => setDialog("create")}>Add period</Button>
          ) : undefined
        }
      />

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                aria-label="Search payroll periods"
                placeholder="Search period name"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                clearable
                onClear={() => setSearchInput("")}
                fullWidth
              />
              <Select
                aria-label="Filter period status"
                value={status}
                onChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
                options={[
                  { label: "All statuses", value: "" },
                  { label: "Open", value: "OPEN" },
                  { label: "Closed", value: "CLOSED" },
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
                  Loading periods…
                </Typography>
              </Stack>
            ) : listQuery.isError ? (
              <Alert tone="error" title="Could not load periods">
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
                    title="No payroll periods"
                    description="Create a period before starting payroll."
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
                    key: "name",
                    header: "Period",
                    render: (row) => (
                      <Stack spacing={1}>
                        <Typography variant="bodySmall" className="font-medium">
                          {row.name}
                        </Typography>
                        <Typography variant="caption" color="neutral">
                          {formatDate(row.startDate)} – {formatDate(row.endDate)}
                        </Typography>
                      </Stack>
                    ),
                  },
                  {
                    key: "payment",
                    header: "Payment date",
                    render: (row) => formatDate(row.paymentDate),
                  },
                  { key: "runs", header: "Runs", render: (row) => row.runCount },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => (
                      <Badge variant="filled" color={row.status === "OPEN" ? "success" : "neutral"}>
                        {row.status}
                      </Badge>
                    ),
                  },
                  {
                    key: "actions",
                    header: "",
                    align: "right",
                    render: (row) =>
                      hasPermission(PERMISSIONS.PAYROLL_PERIODS_MANAGE) ? (
                        <Button variant="text" size="sm" onClick={() => setDialog(row)}>
                          Edit
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
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={dialog === "create" ? "Add payroll period" : "Edit payroll period"}
        description="Periods cannot overlap. Closing a period prevents new adjustments and runs."
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
            <FormInput control={form.control} name="name" label="Period name" fullWidth />
          </div>
          <FormDatePicker control={form.control} name="startDate" label="Start date" />
          <FormDatePicker control={form.control} name="endDate" label="End date" />
          <FormDatePicker control={form.control} name="paymentDate" label="Payment date" />
          <FormSelect
            control={form.control}
            name="status"
            label="Status"
            options={[
              { label: "Open", value: "OPEN" },
              { label: "Closed", value: "CLOSED" },
            ]}
            fullWidth
          />
          <div className="md:col-span-2">
            <FormInput control={form.control} name="notes" label="Notes" fullWidth />
          </div>
        </form>
      </Modal>
    </Stack>
  );
}
