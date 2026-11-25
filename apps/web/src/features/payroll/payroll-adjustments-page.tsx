import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Modal,
  Select,
  Spinner,
  Stack,
  Table,
  Textarea,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { PayrollAdjustment } from "@peopleops/shared-types";
import { PERMISSIONS } from "@peopleops/shared-types";
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
  useOpenPayrollPeriods,
  usePayrollAdjustments,
  usePayrollEmployeeOptions,
} from "./payroll-utils";
import {
  AdjustmentStatusBadge,
  EmptyState,
  PageHeading,
  PermissionNotice,
} from "./payroll-ui";

const adjustmentSchema = z.object({
  periodId: z.string().min(1, "Choose a payroll period"),
  employeeId: z.string().min(1, "Choose an employee"),
  componentId: z.string().min(1, "Choose a component"),
  amount: z.string().regex(/^\d+(\.\d+)?$/, "Enter a non-negative amount"),
  reason: z.string().min(5, "Give at least 5 characters").max(500),
});

type AdjustmentInput = z.input<typeof adjustmentSchema>;
type AdjustmentValues = z.output<typeof adjustmentSchema>;

function emptyForm(): AdjustmentInput {
  return { periodId: "", employeeId: "", componentId: "", amount: "", reason: "" };
}

export function PayrollAdjustmentsPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("PENDING");
  const [periodFilter, setPeriodFilter] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [reviewing, setReviewing] = useState<{
    row: PayrollAdjustment;
    status: "APPROVED" | "REJECTED";
  } | null>(null);
  const [reviewComment, setReviewComment] = useState("");

  const form = useForm<AdjustmentInput, unknown, AdjustmentValues>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: emptyForm(),
  });

  const periodsQuery = useOpenPayrollPeriods();
  const employeeQuery = usePayrollEmployeeOptions(createOpen);
  const componentQuery = useActivePayrollComponents();
  const employees = useMemo(() => employeeOptions(employeeQuery.data?.items), [employeeQuery.data]);
  const components = useMemo(
    () =>
      componentQuery.data
        ?.filter((component) => component.componentType !== "INFORMATIONAL")
        .map((component) => ({
          label: `${component.name} · ${component.code}`,
          value: component.id,
          description: `${component.componentType.replaceAll("_", " ").toLowerCase()} · ${component.calculationType.replaceAll("_", " ").toLowerCase()}`,
        })) ?? [],
    [componentQuery.data],
  );
  const periodOptions =
    periodsQuery.data?.items.map((period) => ({
      label: `${period.name} · ${formatDate(period.startDate)} – ${formatDate(period.endDate)}`,
      value: period.id,
    })) ?? [];

  useEffect(() => {
    setPage(1);
  }, [status, periodFilter]);

  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(PAYROLL_PAGE_SIZE),
  });
  if (status) params.set("status", status);
  if (periodFilter) params.set("periodId", periodFilter);
  const listQuery = usePayrollAdjustments(params);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["payroll", "adjustments"] });
  };

  const createMutation = useMutation({
    mutationFn: (values: AdjustmentValues) =>
      apiRequest<PayrollAdjustment>("/payroll/adjustments", { method: "POST", body: values }),
    onSuccess: () => {
      toast.success("Adjustment created and awaiting review");
      setCreateOpen(false);
      form.reset(emptyForm());
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not create adjustment"),
  });

  const reviewMutation = useMutation({
    mutationFn: () => {
      if (!reviewing) throw new Error("No adjustment selected");
      return apiRequest<PayrollAdjustment>(`/payroll/adjustments/${reviewing.row.id}/review`, {
        method: "POST",
        body: { status: reviewing.status, comment: reviewComment.trim() || null },
      });
    },
    onSuccess: () => {
      toast.success(reviewing?.status === "APPROVED" ? "Adjustment approved" : "Adjustment rejected");
      setReviewing(null);
      setReviewComment("");
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not review adjustment"),
  });

  if (!hasPermission(PERMISSIONS.PAYROLL_ADJUSTMENTS_READ)) {
    return <PermissionNotice>Ask payroll for adjustment access.</PermissionNotice>;
  }

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Payroll adjustments"
        description="One-off earnings and deductions. Only approved adjustments enter the calculation."
        actions={
          hasPermission(PERMISSIONS.PAYROLL_ADJUSTMENTS_CREATE) ? (
            <Button onClick={() => setCreateOpen(true)}>Add adjustment</Button>
          ) : undefined
        }
      />

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="grid gap-3 md:grid-cols-3">
              <Select
                aria-label="Filter adjustment status"
                value={status}
                onChange={(value) => setStatus(value)}
                options={[
                  { label: "All statuses", value: "" },
                  { label: "Pending", value: "PENDING" },
                  { label: "Approved", value: "APPROVED" },
                  { label: "Rejected", value: "REJECTED" },
                ]}
                fullWidth
              />
              <Select
                aria-label="Filter adjustment period"
                value={periodFilter}
                onChange={(value) => setPeriodFilter(value)}
                options={[
                  { label: "All open periods", value: "" },
                  ...(periodsQuery.data?.items.map((period) => ({
                    label: period.name,
                    value: period.id,
                  })) ?? []),
                ]}
                searchable
                fullWidth
              />
              <Button
                variant="outlined"
                onClick={() => {
                  setStatus("PENDING");
                  setPeriodFilter("");
                }}
              >
                Reset filters
              </Button>
            </div>

            {listQuery.isPending ? (
              <Stack direction="row" spacing={12} align="center">
                <Spinner />
                <Typography variant="bodySmall" color="neutral">
                  Loading adjustments…
                </Typography>
              </Stack>
            ) : listQuery.isError ? (
              <Alert tone="error" title="Could not load adjustments">
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
                    title="No adjustments"
                    description="Create a one-off adjustment for a payroll period."
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
                          {row.employee.employeeNumber} · {row.period.name}
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
                          {row.component.componentType.toLowerCase()}
                        </Typography>
                      </Stack>
                    ),
                  },
                  {
                    key: "amount",
                    header: "Amount",
                    align: "right",
                    render: (row) => formatMoney(row.amount),
                  },
                  { key: "reason", header: "Reason", render: (row) => row.reason },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => <AdjustmentStatusBadge status={row.status} />,
                  },
                  {
                    key: "actions",
                    header: "",
                    align: "right",
                    render: (row) =>
                      row.status === "PENDING" &&
                      hasPermission(PERMISSIONS.PAYROLL_ADJUSTMENTS_APPROVE) ? (
                        <Stack direction="row" spacing={4} justify="end">
                          <Button
                            variant="text"
                            size="sm"
                            color="success"
                            onClick={() => {
                              setReviewComment("");
                              setReviewing({ row, status: "APPROVED" });
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="text"
                            size="sm"
                            color="error"
                            onClick={() => {
                              setReviewComment("");
                              setReviewing({ row, status: "REJECTED" });
                            }}
                          >
                            Reject
                          </Button>
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
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) form.reset(emptyForm());
        }}
        title="Add payroll adjustment"
        description="The adjustment starts as pending. A reviewer must approve it before calculation."
        size="md"
        footer={
          <Stack direction="row" justify="end" spacing={8}>
            <Button variant="outlined" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <LoadingButton
              loading={createMutation.isPending}
              onClick={() => void form.handleSubmit((values) => createMutation.mutate(values))()}
            >
              Create adjustment
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
              name="periodId"
              label="Payroll period"
              options={periodOptions}
              searchable
              fullWidth
            />
          </div>
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
            name="amount"
            label="Amount"
            inputMode="decimal"
            fullWidth
          />
          <div className="md:col-span-2">
            <FormInput
              control={form.control}
              name="reason"
              label="Reason"
              placeholder="Explain why this adjustment is needed"
              fullWidth
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={reviewing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReviewing(null);
            setReviewComment("");
          }
        }}
        title={reviewing?.status === "APPROVED" ? "Approve adjustment" : "Reject adjustment"}
        description={
          reviewing
            ? `${reviewing.row.employee.fullName} · ${formatMoney(reviewing.row.amount)}`
            : ""
        }
        size="sm"
        footer={
          <Stack direction="row" justify="end" spacing={8}>
            <Button
              variant="outlined"
              onClick={() => {
                setReviewing(null);
                setReviewComment("");
              }}
            >
              Close
            </Button>
            <LoadingButton
              color={reviewing?.status === "APPROVED" ? "success" : "error"}
              loading={reviewMutation.isPending}
              onClick={() => reviewMutation.mutate()}
            >
              {reviewing?.status === "APPROVED" ? "Approve" : "Reject"}
            </LoadingButton>
          </Stack>
        }
      >
        <Textarea
          label="Review comment (optional)"
          value={reviewComment}
          onChange={(event) => setReviewComment(event.target.value)}
          rows={3}
          fullWidth
        />
      </Modal>
    </Stack>
  );
}
