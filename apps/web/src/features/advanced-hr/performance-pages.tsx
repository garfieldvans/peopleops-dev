import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Input,
  Modal,
  Select,
  Stack,
  Table,
  Textarea,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useParams } from "react-router-dom";
import { z } from "zod";
import {
  PERMISSIONS,
  type PerformanceCycle,
  type PerformanceGoal,
  type PerformanceReview,
  type PerformanceReviewItem,
} from "@peopleops/shared-types";
import { FormInput } from "../../components/form-input";
import { LoadingButton } from "../../components/loading-button";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { useAuth } from "../auth/auth-context";
import {
  employeeOptions,
  formatDate,
  formatDateTime,
  HR_PAGE_SIZE,
  titleCase,
  useEmployees,
  usePerformanceCycle,
  usePerformanceCycles,
  usePerformanceGoals,
  usePerformanceReview,
  usePerformanceReviews,
} from "./advanced-hr-api";
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  MetricCard,
  PageHeading,
  PermissionNotice,
  StatusBadge,
} from "./advanced-hr-ui";

const cycleSchema = z
  .object({
    name: z.string().trim().min(2, "Cycle name is required").max(160),
    description: z.string().max(1000).optional(),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    reviewStartDate: z.string().min(1, "Review start date is required"),
    reviewEndDate: z.string().min(1, "Review end date is required"),
  })
  .refine((value) => value.endDate >= value.startDate, {
    path: ["endDate"],
    message: "End date must be after the start date",
  })
  .refine((value) => value.reviewEndDate >= value.reviewStartDate, {
    path: ["reviewEndDate"],
    message: "Review end date must be after the review start date",
  });

type CycleFormValues = z.infer<typeof cycleSchema>;

function emptyCycle(): CycleFormValues {
  return {
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    reviewStartDate: "",
    reviewEndDate: "",
  };
}

function cyclePayload(values: CycleFormValues) {
  return { ...values, description: values.description || null };
}

export function PerformanceDashboardPage() {
  const { hasPermission } = useAuth();
  const cycles = usePerformanceCycles(new URLSearchParams({ pageSize: "100" }));
  const reviews = usePerformanceReviews(new URLSearchParams({ pageSize: "100" }));
  const goals = usePerformanceGoals(new URLSearchParams({ pageSize: "100" }));

  if (!hasPermission(PERMISSIONS.PERFORMANCE_CYCLES_READ)) {
    return <PermissionNotice>Ask HR for performance access.</PermissionNotice>;
  }
  if (cycles.isPending || reviews.isPending) {
    return <LoadingBlock label="Loading performance dashboard…" />;
  }
  if (cycles.isError) {
    return <ErrorBlock title="Could not load performance dashboard" error={cycles.error} />;
  }
  const cycleItems = cycles.data?.items ?? [];
  const reviewItems = reviews.data?.items ?? [];
  const goalItems = goals.data?.items ?? [];

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Performance"
        description="Cycles, goals, self reviews, manager reviews, and completion."
        actions={
          hasPermission(PERMISSIONS.PERFORMANCE_CYCLES_MANAGE) ? (
            <Link to="/performance/cycles">
              <Button>Manage cycles</Button>
            </Link>
          ) : undefined
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active cycles"
          value={cycleItems.filter((cycle) => cycle.status === "ACTIVE").length}
        />
        <MetricCard
          label="Review in progress"
          value={cycleItems.filter((cycle) => cycle.status === "REVIEW_IN_PROGRESS").length}
        />
        <MetricCard label="Goals" value={goalItems.length} hint="Visible goals" />
        <MetricCard
          label="Reviews completed"
          value={reviewItems.filter((review) => review.status === "COMPLETED").length}
          hint={`${reviewItems.length} total visible`}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card variant="elevated" padding="lg">
          <CardBody>
            <Stack spacing={12}>
              <Stack direction="row" justify="between" align="center">
                <Typography variant="h6">Cycles</Typography>
                <Link to="/performance/cycles">
                  <Button variant="text" size="sm">
                    View all
                  </Button>
                </Link>
              </Stack>
              <Table
                data={cycleItems.slice(0, 5)}
                rowKey={(row) => row.id}
                emptyText={
                  <EmptyState title="No cycles" description="Create a cycle to begin reviews." />
                }
                columns={[
                  {
                    key: "name",
                    header: "Cycle",
                    render: (row) => (
                      <Link to={`/performance/cycles/${row.id}`} className="underline">
                        {row.name}
                      </Link>
                    ),
                  },
                  {
                    key: "period",
                    header: "Period",
                    render: (row) => `${formatDate(row.startDate)} – ${formatDate(row.endDate)}`,
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => <StatusBadge status={row.status} />,
                  },
                ]}
              />
            </Stack>
          </CardBody>
        </Card>
        <Card variant="elevated" padding="lg">
          <CardBody>
            <Stack spacing={12}>
              <Typography variant="h6">My review shortcuts</Typography>
              <Link to="/performance/goals" className="underline">
                <Typography variant="bodySmall">Goals and KPI management</Typography>
              </Link>
              <Link to="/performance/self-review" className="underline">
                <Typography variant="bodySmall">Self performance review</Typography>
              </Link>
              {hasPermission(PERMISSIONS.PERFORMANCE_REVIEWS_SUBMIT_MANAGER) ? (
                <Link to="/performance/manager-review" className="underline">
                  <Typography variant="bodySmall">Manager performance review</Typography>
                </Link>
              ) : null}
              <Link to="/performance/history" className="underline">
                <Typography variant="bodySmall">Performance review history</Typography>
              </Link>
              <Alert tone="info" title="Restricted notes">
                HR internal notes are shown only to users with the internal-notes permission.
              </Alert>
            </Stack>
          </CardBody>
        </Card>
      </div>
    </Stack>
  );
}

export function PerformanceCyclesPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<PerformanceCycle | "create" | null>(null);
  const form = useForm<CycleFormValues>({
    resolver: zodResolver(cycleSchema),
    defaultValues: emptyCycle(),
  });
  const params = new URLSearchParams({ page: String(page), pageSize: String(HR_PAGE_SIZE) });
  if (status) params.set("status", status);
  const cycles = usePerformanceCycles(params);

  const openCycle = (cycle: PerformanceCycle | "create") => {
    setDialog(cycle);
    form.reset(
      cycle === "create"
        ? emptyCycle()
        : {
            name: cycle.name,
            description: cycle.description ?? "",
            startDate: cycle.startDate,
            endDate: cycle.endDate,
            reviewStartDate: cycle.reviewStartDate,
            reviewEndDate: cycle.reviewEndDate,
          },
    );
  };

  const saveMutation = useMutation({
    mutationFn: (values: CycleFormValues) =>
      dialog && dialog !== "create"
        ? apiRequest<PerformanceCycle>(`/performance/cycles/${dialog.id}`, {
            method: "PATCH",
            body: cyclePayload(values),
          })
        : apiRequest<PerformanceCycle>("/performance/cycles", {
            method: "POST",
            body: cyclePayload(values),
          }),
    onSuccess: () => {
      toast.success(dialog === "create" ? "Cycle created" : "Cycle updated");
      setDialog(null);
      void queryClient.invalidateQueries({ queryKey: ["advanced-hr", "performance"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not save cycle"),
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) =>
      apiRequest<PerformanceCycle>(`/performance/cycles/${id}/transition`, {
        method: "POST",
        body: { status: next },
      }),
    onSuccess: () => {
      toast.success("Cycle status updated");
      void queryClient.invalidateQueries({ queryKey: ["advanced-hr", "performance"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not update cycle"),
  });

  if (!hasPermission(PERMISSIONS.PERFORMANCE_CYCLES_READ)) {
    return <PermissionNotice>Ask HR for performance access.</PermissionNotice>;
  }

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Performance cycles"
        description="Open and close review periods. Draft cycles can still be edited."
        actions={
          hasPermission(PERMISSIONS.PERFORMANCE_CYCLES_MANAGE) ? (
            <Button onClick={() => openCycle("create")}>New cycle</Button>
          ) : undefined
        }
      />
      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="grid gap-3 md:grid-cols-3">
              <Select
                aria-label="Filter cycle status"
                value={status}
                onChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
                options={[
                  { label: "All statuses", value: "" },
                  { label: "Draft", value: "DRAFT" },
                  { label: "Active", value: "ACTIVE" },
                  { label: "Review in progress", value: "REVIEW_IN_PROGRESS" },
                  { label: "Completed", value: "COMPLETED" },
                  { label: "Cancelled", value: "CANCELLED" },
                ]}
                fullWidth
              />
              <Link to="/performance">
                <Button variant="outlined" fullWidth>
                  Back to dashboard
                </Button>
              </Link>
            </div>
            {cycles.isPending ? (
              <LoadingBlock label="Loading cycles…" />
            ) : cycles.isError ? (
              <ErrorBlock title="Could not load cycles" error={cycles.error} />
            ) : (
              <Table
                data={cycles.data?.items ?? []}
                rowKey={(row) => row.id}
                emptyText={
                  <EmptyState title="No cycles" description="Create the first review cycle." />
                }
                pagination={{
                  page,
                  pageSize: HR_PAGE_SIZE,
                  pageCount: cycles.data?.totalPages ?? 1,
                  total: cycles.data?.total ?? 0,
                  onChange: setPage,
                }}
                columns={[
                  {
                    key: "name",
                    header: "Cycle",
                    render: (row) => (
                      <Link to={`/performance/cycles/${row.id}`} className="underline">
                        <Stack spacing={1}>
                          <Typography variant="bodySmall" className="font-medium">
                            {row.name}
                          </Typography>
                          <Typography variant="caption" color="neutral">
                            {formatDate(row.startDate)} – {formatDate(row.endDate)}
                          </Typography>
                        </Stack>
                      </Link>
                    ),
                  },
                  {
                    key: "review",
                    header: "Review window",
                    render: (row) =>
                      `${formatDate(row.reviewStartDate)} – ${formatDate(row.reviewEndDate)}`,
                  },
                  {
                    key: "progress",
                    header: "Reviews",
                    render: (row) => `${row.completedReviewCount ?? 0} / ${row.reviewCount ?? 0}`,
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => <StatusBadge status={row.status} />,
                  },
                  {
                    key: "actions",
                    header: "",
                    align: "right",
                    render: (row) =>
                      hasPermission(PERMISSIONS.PERFORMANCE_CYCLES_MANAGE) ? (
                        <Stack direction="row" spacing={4} justify="end" wrap>
                          {row.status === "DRAFT" ? (
                            <Button variant="text" size="sm" onClick={() => openCycle(row)}>
                              Edit
                            </Button>
                          ) : null}
                          {row.status === "DRAFT" ? (
                            <Button
                              variant="text"
                              size="sm"
                              onClick={() =>
                                transitionMutation.mutate({ id: row.id, next: "ACTIVE" })
                              }
                            >
                              Activate
                            </Button>
                          ) : null}
                          {row.status === "ACTIVE" ? (
                            <Button
                              variant="text"
                              size="sm"
                              onClick={() =>
                                transitionMutation.mutate({
                                  id: row.id,
                                  next: "REVIEW_IN_PROGRESS",
                                })
                              }
                            >
                              Start reviews
                            </Button>
                          ) : null}
                          {row.status === "REVIEW_IN_PROGRESS" ? (
                            <Button
                              variant="text"
                              size="sm"
                              onClick={() =>
                                transitionMutation.mutate({ id: row.id, next: "COMPLETED" })
                              }
                            >
                              Complete
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
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog === "create" ? "New performance cycle" : "Edit performance cycle"}
        size="lg"
        footer={
          <Stack direction="row" justify="end" spacing={8}>
            <Button variant="outlined" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <LoadingButton
              type="submit"
              form="cycle-form"
              loading={saveMutation.isPending}
            >
              Save cycle
            </LoadingButton>
          </Stack>
        }
      >
        <form
          id="cycle-form"
          onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
        >
          <Stack spacing={14}>
            <FormInput control={form.control} name="name" label="Cycle name" required />
            <Textarea
              label="Description"
              rows={2}
              value={form.watch("description") ?? ""}
              onChange={(event) =>
                form.setValue("description", event.target.value, { shouldDirty: true })
              }
              fullWidth
            />
            <div className="grid gap-3 md:grid-cols-2">
              <FormInput control={form.control} name="startDate" label="Start date" type="date" />
              <FormInput control={form.control} name="endDate" label="End date" type="date" />
              <FormInput
                control={form.control}
                name="reviewStartDate"
                label="Review start date"
                type="date"
              />
              <FormInput
                control={form.control}
                name="reviewEndDate"
                label="Review end date"
                type="date"
              />
            </div>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

export function PerformanceCycleDetailPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const cycle = usePerformanceCycle(id);
  const goals = usePerformanceGoals(
    new URLSearchParams({ cycleId: id ?? "", pageSize: "100" }),
  );
  const reviews = usePerformanceReviews(
    new URLSearchParams({ cycleId: id ?? "", pageSize: "100" }),
  );

  const transitionMutation = useMutation({
    mutationFn: (next: string) =>
      apiRequest<PerformanceCycle>(`/performance/cycles/${id}/transition`, {
        method: "POST",
        body: { status: next },
      }),
    onSuccess: () => {
      toast.success("Cycle status updated");
      void queryClient.invalidateQueries({ queryKey: ["advanced-hr", "performance"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not update cycle"),
  });

  if (!hasPermission(PERMISSIONS.PERFORMANCE_CYCLES_READ)) {
    return <PermissionNotice>Ask HR for performance access.</PermissionNotice>;
  }
  if (cycle.isPending) return <LoadingBlock label="Loading cycle…" />;
  if (cycle.isError) return <ErrorBlock title="Could not load cycle" error={cycle.error} />;
  const data = cycle.data;

  return (
    <Stack spacing={16}>
      <PageHeading
        title={data.name}
        description={`${formatDate(data.startDate)} – ${formatDate(data.endDate)} · reviews ${formatDate(data.reviewStartDate)} – ${formatDate(data.reviewEndDate)}`}
        actions={
          <Stack direction="row" spacing={8} wrap>
            <Link to="/performance/cycles">
              <Button variant="outlined">Back</Button>
            </Link>
            {hasPermission(PERMISSIONS.PERFORMANCE_CYCLES_MANAGE) ? (
              <>
                {data.status === "DRAFT" ? (
                  <Button onClick={() => transitionMutation.mutate("ACTIVE")}>Activate</Button>
                ) : null}
                {data.status === "ACTIVE" ? (
                  <Button onClick={() => transitionMutation.mutate("REVIEW_IN_PROGRESS")}>
                    Start reviews
                  </Button>
                ) : null}
                {data.status === "REVIEW_IN_PROGRESS" ? (
                  <Button onClick={() => transitionMutation.mutate("COMPLETED")}>Complete</Button>
                ) : null}
              </>
            ) : null}
          </Stack>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Status" value={titleCase(data.status)} />
        <MetricCard label="Goals" value={goals.data?.total ?? 0} />
        <MetricCard label="Reviews" value={reviews.data?.total ?? 0} />
        <MetricCard
          label="Completed reviews"
          value={(reviews.data?.items ?? []).filter((review) => review.status === "COMPLETED").length}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card variant="elevated" padding="lg">
          <CardBody>
            <Stack spacing={12}>
              <Stack direction="row" justify="between" align="center">
                <Typography variant="h6">Goals</Typography>
                <Link to={`/performance/goals?cycleId=${data.id}`}>
                  <Button variant="text" size="sm">
                    Manage goals
                  </Button>
                </Link>
              </Stack>
              <Table
                data={goals.data?.items ?? []}
                rowKey={(row) => row.id}
                emptyText={<EmptyState title="No goals" description="Add goals for this cycle." />}
                columns={[
                  {
                    key: "employee",
                    header: "Employee",
                    render: (row) => row.employee.fullName,
                  },
                  { key: "title", header: "Goal", render: (row) => row.title },
                  { key: "weight", header: "Weight", render: (row) => `${row.weight}%` },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => <StatusBadge status={row.status} />,
                  },
                ]}
              />
            </Stack>
          </CardBody>
        </Card>
        <Card variant="elevated" padding="lg">
          <CardBody>
            <Stack spacing={12}>
              <Stack direction="row" justify="between" align="center">
                <Typography variant="h6">Reviews</Typography>
                <Link to={`/performance/history?cycleId=${data.id}`}>
                  <Button variant="text" size="sm">
                    View history
                  </Button>
                </Link>
              </Stack>
              <Table
                data={reviews.data?.items ?? []}
                rowKey={(row) => row.id}
                emptyText={
                  <EmptyState title="No reviews" description="Reviews appear here as they start." />
                }
                columns={[
                  {
                    key: "employee",
                    header: "Employee",
                    render: (row) => row.employee.fullName,
                  },
                  {
                    key: "type",
                    header: "Type",
                    render: (row) => titleCase(row.reviewType),
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => <StatusBadge status={row.status} />,
                  },
                ]}
              />
            </Stack>
          </CardBody>
        </Card>
      </div>
    </Stack>
  );
}

export function EmployeeGoalsPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [cycleId, setCycleId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [weight, setWeight] = useState("20");
  const [targetValue, setTargetValue] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [category, setCategory] = useState("BUSINESS");
  const [measurementType, setMeasurementType] = useState("NUMERIC");
  const [updateGoal, setUpdateGoal] = useState<PerformanceGoal | null>(null);
  const [newValue, setNewValue] = useState("");
  const [updateComment, setUpdateComment] = useState("");

  const params = new URLSearchParams({ page: String(page), pageSize: String(HR_PAGE_SIZE) });
  if (cycleId) params.set("cycleId", cycleId);
  if (employeeId) params.set("employeeId", employeeId);
  if (status) params.set("status", status);
  const goals = usePerformanceGoals(params);
  const cycles = usePerformanceCycles(new URLSearchParams({ pageSize: "100" }));
  const employees = useEmployees(hasPermission(PERMISSIONS.PERFORMANCE_GOALS_MANAGE));

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest<PerformanceGoal>("/performance/goals", {
        method: "POST",
        body: {
          employeeId,
          cycleId,
          title,
          description: description || null,
          category,
          measurementType,
          targetValue: targetValue || null,
          currentValue: currentValue || null,
          weight,
        },
      }),
    onSuccess: () => {
      toast.success("Goal created");
      setOpen(false);
      setTitle("");
      setDescription("");
      void queryClient.invalidateQueries({ queryKey: ["advanced-hr", "performance"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not create goal"),
  });

  const progressMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/performance/goals/${updateGoal?.id}/updates`, {
        method: "POST",
        body: { newValue: newValue || null, comment: updateComment || null },
      }),
    onSuccess: () => {
      toast.success("Goal progress recorded");
      setUpdateGoal(null);
      setNewValue("");
      setUpdateComment("");
      void queryClient.invalidateQueries({ queryKey: ["advanced-hr", "performance"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not update progress"),
  });

  if (!hasPermission(PERMISSIONS.PERFORMANCE_GOALS_READ_SELF)) {
    return <PermissionNotice>Ask HR for performance goal access.</PermissionNotice>;
  }

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Goals and KPIs"
        description="Goals must total 100% weight before a review can be submitted."
        actions={
          hasPermission(PERMISSIONS.PERFORMANCE_GOALS_MANAGE) ? (
            <Button onClick={() => setOpen(true)}>Add goal</Button>
          ) : undefined
        }
      />
      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="grid gap-3 md:grid-cols-4">
              <Select
                aria-label="Filter goals by cycle"
                value={cycleId}
                onChange={(value) => {
                  setCycleId(value);
                  setPage(1);
                }}
                options={[
                  { label: "All cycles", value: "" },
                  ...(cycles.data?.items.map((cycle) => ({
                    label: cycle.name,
                    value: cycle.id,
                  })) ?? []),
                ]}
                fullWidth
              />
              <Select
                aria-label="Filter goals by employee"
                value={employeeId}
                onChange={(value) => {
                  setEmployeeId(value);
                  setPage(1);
                }}
                options={[{ label: "All employees", value: "" }, ...employeeOptions(employees.data?.items)]}
                searchable
                fullWidth
              />
              <Select
                aria-label="Filter goal status"
                value={status}
                onChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
                options={[
                  { label: "All statuses", value: "" },
                  { label: "Draft", value: "DRAFT" },
                  { label: "Active", value: "ACTIVE" },
                  { label: "Achieved", value: "ACHIEVED" },
                  { label: "Missed", value: "MISSED" },
                  { label: "Cancelled", value: "CANCELLED" },
                ]}
                fullWidth
              />
              <Button
                variant="outlined"
                onClick={() => {
                  setCycleId("");
                  setEmployeeId("");
                  setStatus("");
                  setPage(1);
                }}
              >
                Reset filters
              </Button>
            </div>
            {goals.isPending ? (
              <LoadingBlock label="Loading goals…" />
            ) : goals.isError ? (
              <ErrorBlock title="Could not load goals" error={goals.error} />
            ) : (
              <Table
                data={goals.data?.items ?? []}
                rowKey={(row) => row.id}
                emptyText={<EmptyState title="No goals" description="Add a goal for an employee." />}
                pagination={{
                  page,
                  pageSize: HR_PAGE_SIZE,
                  pageCount: goals.data?.totalPages ?? 1,
                  total: goals.data?.total ?? 0,
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
                          {row.cycle.name}
                        </Typography>
                      </Stack>
                    ),
                  },
                  {
                    key: "goal",
                    header: "Goal",
                    render: (row) => (
                      <Stack spacing={1}>
                        <Typography variant="bodySmall">{row.title}</Typography>
                        <Typography variant="caption" color="neutral">
                          {titleCase(row.category)} · {titleCase(row.measurementType)}
                        </Typography>
                      </Stack>
                    ),
                  },
                  {
                    key: "progress",
                    header: "Progress",
                    render: (row) => `${row.currentValue ?? "—"} / ${row.targetValue ?? "—"}`,
                  },
                  { key: "weight", header: "Weight", render: (row) => `${row.weight}%` },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => <StatusBadge status={row.status} />,
                  },
                  {
                    key: "actions",
                    header: "",
                    align: "right",
                    render: (row) =>
                      hasPermission(PERMISSIONS.PERFORMANCE_GOALS_MANAGE) ? (
                        <Button
                          variant="text"
                          size="sm"
                          onClick={() => {
                            setUpdateGoal(row);
                            setNewValue(row.currentValue ?? "");
                          }}
                        >
                          Update progress
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
        onOpenChange={setOpen}
        title="Add performance goal"
        size="lg"
        footer={
          <Stack direction="row" justify="end" spacing={8}>
            <Button variant="outlined" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <LoadingButton
              loading={createMutation.isPending}
              disabled={!employeeId || !cycleId || !title || !weight}
              onClick={() => createMutation.mutate()}
            >
              Create goal
            </LoadingButton>
          </Stack>
        }
      >
        <Stack spacing={14}>
          <Select
            label="Employee"
            value={employeeId}
            onChange={setEmployeeId}
            options={employeeOptions(employees.data?.items)}
            searchable
            fullWidth
          />
          <Select
            label="Cycle"
            value={cycleId}
            onChange={setCycleId}
            options={
              cycles.data?.items.map((cycle) => ({ label: cycle.name, value: cycle.id })) ?? []
            }
            fullWidth
          />
          <Input
            label="Goal title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            fullWidth
          />
          <Textarea
            label="Description"
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            fullWidth
          />
          <div className="grid gap-3 md:grid-cols-2">
            <Select
              label="Category"
              value={category}
              onChange={setCategory}
              options={["BUSINESS", "LEADERSHIP", "DEVELOPMENT", "BEHAVIORAL", "OTHER"].map(
                (value) => ({ label: titleCase(value), value }),
              )}
              fullWidth
            />
            <Select
              label="Measurement"
              value={measurementType}
              onChange={setMeasurementType}
              options={["NUMERIC", "PERCENTAGE", "BOOLEAN", "QUALITATIVE"].map((value) => ({
                label: titleCase(value),
                value,
              }))}
              fullWidth
            />
            <Input
              label="Target value"
              value={targetValue}
              onChange={(event) => setTargetValue(event.target.value)}
              fullWidth
            />
            <Input
              label="Current value"
              value={currentValue}
              onChange={(event) => setCurrentValue(event.target.value)}
              fullWidth
            />
            <Input
              label="Weight (%)"
              type="number"
              min={0}
              max={100}
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              helperText="Total goal weight cannot exceed 100"
              fullWidth
            />
          </div>
        </Stack>
      </Modal>

      <Modal
        open={updateGoal !== null}
        onOpenChange={(open) => !open && setUpdateGoal(null)}
        title="Record goal progress"
        description={updateGoal?.title}
        size="sm"
        footer={
          <Stack direction="row" justify="end" spacing={8}>
            <Button variant="outlined" onClick={() => setUpdateGoal(null)}>
              Cancel
            </Button>
            <LoadingButton loading={progressMutation.isPending} onClick={() => progressMutation.mutate()}>
              Save progress
            </LoadingButton>
          </Stack>
        }
      >
        <Stack spacing={12}>
          <Input
            label="New value"
            value={newValue}
            onChange={(event) => setNewValue(event.target.value)}
            fullWidth
          />
          <Textarea
            label="Comment"
            rows={3}
            value={updateComment}
            onChange={(event) => setUpdateComment(event.target.value)}
            fullWidth
          />
        </Stack>
      </Modal>
    </Stack>
  );
}

function ReviewEditor({
  review,
  onClose,
}: {
  review: PerformanceReview | undefined;
  onClose: () => void;
}) {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [summary, setSummary] = useState("");
  const [rating, setRating] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [items, setItems] = useState<Record<string, { rating: string; comments: string }>>({});
  const goals = usePerformanceGoals(
    new URLSearchParams({
      cycleId: review?.cycle.id ?? "",
      employeeId: review?.employee.id ?? "",
      pageSize: "100",
    }),
  );

  const editable = review?.status === "DRAFT";
  const canNotes = hasPermission(PERMISSIONS.PERFORMANCE_REVIEWS_INTERNAL_NOTES_READ);
  const current = useMemo(() => {
    if (!review) return { summary: "", rating: "", internalNotes: "", items: {} };
    const itemMap: Record<string, { rating: string; comments: string }> = {};
    for (const item of review.items) {
      if (item.goalId) {
        itemMap[item.goalId] = { rating: item.rating ?? "", comments: item.comments ?? "" };
      }
    }
    return {
      summary: review.summary ?? "",
      rating: review.overallRating ?? "",
      internalNotes: review.internalNotes ?? "",
      items: itemMap,
    };
  }, [review]);

  // Reset local state when the selected review changes.
  useMemo(() => {
    setSummary(current.summary);
    setRating(current.rating);
    setInternalNotes(current.internalNotes);
    setItems(current.items);
  }, [current]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest<PerformanceReview>(`/performance/reviews/${review?.id}`, {
        method: "PATCH",
        body: {
          summary: summary || null,
          overallRating: rating || null,
          ...(canNotes ? { internalNotes: internalNotes || null } : {}),
          items: (goals.data?.items ?? []).map((goal) => ({
            goalId: goal.id,
            rating: items[goal.id]?.rating || null,
            comments: items[goal.id]?.comments || null,
          })),
        },
      }),
    onSuccess: () => {
      toast.success("Review saved");
      void queryClient.invalidateQueries({ queryKey: ["advanced-hr", "performance"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not save review"),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      apiRequest<PerformanceReview>(`/performance/reviews/${review?.id}/submit`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast.success("Review submitted");
      onClose();
      void queryClient.invalidateQueries({ queryKey: ["advanced-hr", "performance"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not submit review"),
  });

  return (
    <Modal
      open={Boolean(review)}
      onOpenChange={(open) => !open && onClose()}
      title={`${review?.reviewType ? titleCase(review.reviewType) : "Review"} · ${review?.employee.fullName ?? ""}`}
      description={review ? `${review.cycle.name} · ${titleCase(review.status)}` : ""}
      size="lg"
      footer={
        <Stack direction="row" justify="end" spacing={8}>
          <Button variant="outlined" onClick={onClose}>
            Close
          </Button>
          {editable ? (
            <>
              <LoadingButton
                variant="outlined"
                loading={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                Save draft
              </LoadingButton>
              <LoadingButton
                loading={submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
              >
                Submit review
              </LoadingButton>
            </>
          ) : null}
        </Stack>
      }
    >
      <Stack spacing={14}>
        {!editable ? (
          <Alert tone="info" title="Review is locked">
            Submitted and completed reviews cannot be edited.
          </Alert>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Overall rating"
            type="number"
            min={0}
            max={5}
            step="0.1"
            value={rating}
            onChange={(event) => setRating(event.target.value)}
            disabled={!editable}
            fullWidth
          />
        </div>
        <Textarea
          label="Summary"
          rows={3}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          disabled={!editable}
          fullWidth
        />
        {canNotes ? (
          <Textarea
            label="Internal HR notes (restricted)"
            rows={3}
            value={internalNotes}
            onChange={(event) => setInternalNotes(event.target.value)}
            disabled={!editable}
            fullWidth
          />
        ) : null}
        <Typography variant="h6">Goal assessment</Typography>
        {goals.isPending ? (
          <LoadingBlock label="Loading goals…" />
        ) : (goals.data?.items ?? []).length === 0 ? (
          <Typography variant="bodySmall" color="neutral">
            No goals are defined for this employee and cycle.
          </Typography>
        ) : (
          <Stack spacing={10}>
            {(goals.data?.items ?? []).map((goal) => (
              <Card key={goal.id} variant="outlined" padding="sm">
                <CardBody>
                  <Stack spacing={8}>
                    <Stack direction="row" justify="between" align="center" wrap>
                      <Typography variant="bodySmall" className="font-medium">
                        {goal.title}
                      </Typography>
                      <Typography variant="caption" color="neutral">
                        weight {goal.weight}%
                      </Typography>
                    </Stack>
                    <div className="grid gap-3 md:grid-cols-[120px_1fr]">
                      <Input
                        label="Rating"
                        type="number"
                        min={0}
                        max={5}
                        step="0.1"
                        value={items[goal.id]?.rating ?? ""}
                        onChange={(event) =>
                          setItems((value) => ({
                            ...value,
                            [goal.id]: { ...value[goal.id], rating: event.target.value },
                          }))
                        }
                        disabled={!editable}
                        fullWidth
                      />
                      <Input
                        label="Comments"
                        value={items[goal.id]?.comments ?? ""}
                        onChange={(event) =>
                          setItems((value) => ({
                            ...value,
                            [goal.id]: { ...value[goal.id], comments: event.target.value },
                          }))
                        }
                        disabled={!editable}
                        fullWidth
                      />
                    </div>
                  </Stack>
                </CardBody>
              </Card>
            ))}
          </Stack>
        )}
        {review?.items.length ? (
          <Stack spacing={4}>
            <Typography variant="caption" color="neutral">
              Saved review items
            </Typography>
            {review.items.map((item: PerformanceReviewItem) => (
              <Typography key={item.id} variant="caption">
                {item.goalTitle ?? "General"} · rating {item.rating ?? "—"}
              </Typography>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Modal>
  );
}

export function SelfPerformanceReviewPage() {
  const { hasPermission, user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const reviews = usePerformanceReviews(
    new URLSearchParams({ reviewType: "SELF_REVIEW", pageSize: "100" }),
  );
  const cycles = usePerformanceCycles(new URLSearchParams({ pageSize: "100" }));
  const review = usePerformanceReview(selected ?? undefined);

  const createMutation = useMutation({
    mutationFn: (cycleId: string) =>
      apiRequest<PerformanceReview>("/performance/reviews", {
        method: "POST",
        body: {
          cycleId,
          employeeId: user?.employeeId,
          reviewType: "SELF_REVIEW",
        },
      }),
    onSuccess: (created) => {
      toast.success("Self review started");
      setSelected(created.id);
      void queryClient.invalidateQueries({ queryKey: ["advanced-hr", "performance"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not start review"),
  });

  if (!hasPermission(PERMISSIONS.PERFORMANCE_REVIEWS_SUBMIT_SELF)) {
    return <PermissionNotice>Ask HR for self-review access.</PermissionNotice>;
  }

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Self performance review"
        description="Write your self assessment against your goals for an open cycle."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(cycles.data?.items ?? [])
          .filter((cycle) => ["ACTIVE", "REVIEW_IN_PROGRESS"].includes(cycle.status))
          .map((cycle) => (
            <Card key={cycle.id} variant="outlined" padding="md">
              <CardBody>
                <Stack spacing={8}>
                  <Typography variant="h6">{cycle.name}</Typography>
                  <Typography variant="caption" color="neutral">
                    Review window {formatDate(cycle.reviewStartDate)} –{" "}
                    {formatDate(cycle.reviewEndDate)}
                  </Typography>
                  <Button
                    size="sm"
                    variant="outlined"
                    disabled={createMutation.isPending || !user?.employeeId}
                    onClick={() => createMutation.mutate(cycle.id)}
                  >
                    Start self review
                  </Button>
                </Stack>
              </CardBody>
            </Card>
          ))}
      </div>
      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={12}>
            <Typography variant="h6">My self reviews</Typography>
            {reviews.isPending ? (
              <LoadingBlock label="Loading self reviews…" />
            ) : reviews.isError ? (
              <ErrorBlock title="Could not load self reviews" error={reviews.error} />
            ) : (
              <Table
                data={reviews.data?.items ?? []}
                rowKey={(row) => row.id}
                emptyText={
                  <EmptyState
                    title="No self reviews"
                    description="Start one from an active cycle above."
                  />
                }
                columns={[
                  { key: "cycle", header: "Cycle", render: (row) => row.cycle.name },
                  {
                    key: "rating",
                    header: "Rating",
                    render: (row) => row.overallRating ?? "—",
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => <StatusBadge status={row.status} />,
                  },
                  {
                    key: "updated",
                    header: "Updated",
                    render: (row) => formatDateTime(row.updatedAt),
                  },
                  {
                    key: "actions",
                    header: "",
                    align: "right",
                    render: (row) => (
                      <Button variant="text" size="sm" onClick={() => setSelected(row.id)}>
                        {row.status === "DRAFT" ? "Continue" : "View"}
                      </Button>
                    ),
                  },
                ]}
              />
            )}
          </Stack>
        </CardBody>
      </Card>
      <ReviewEditor review={review.data} onClose={() => setSelected(null)} />
    </Stack>
  );
}

export function ManagerPerformanceReviewPage() {
  const { hasPermission, user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [cycleId, setCycleId] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const reviews = usePerformanceReviews(
    new URLSearchParams({ reviewType: "MANAGER_REVIEW", pageSize: "100" }),
  );
  const cycles = usePerformanceCycles(new URLSearchParams({ pageSize: "100" }));
  const employees = useEmployees(hasPermission(PERMISSIONS.PERFORMANCE_REVIEWS_SUBMIT_MANAGER));
  const review = usePerformanceReview(selected ?? undefined);

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest<PerformanceReview>("/performance/reviews", {
        method: "POST",
        body: {
          cycleId,
          employeeId,
          reviewType: "MANAGER_REVIEW",
          reviewerId: user?.id,
        },
      }),
    onSuccess: (created) => {
      toast.success("Manager review started");
      setOpen(false);
      setSelected(created.id);
      void queryClient.invalidateQueries({ queryKey: ["advanced-hr", "performance"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not start review"),
  });

  if (!hasPermission(PERMISSIONS.PERFORMANCE_REVIEWS_SUBMIT_MANAGER)) {
    return <PermissionNotice>Ask HR for manager review access.</PermissionNotice>;
  }

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Manager performance review"
        description="Review team members against their goals. Internal notes stay restricted."
        actions={<Button onClick={() => setOpen(true)}>Start manager review</Button>}
      />
      <Card variant="elevated" padding="lg">
        <CardBody>
          {reviews.isPending ? (
            <LoadingBlock label="Loading team reviews…" />
          ) : reviews.isError ? (
            <ErrorBlock title="Could not load team reviews" error={reviews.error} />
          ) : (
            <Table
              data={reviews.data?.items ?? []}
              rowKey={(row) => row.id}
              emptyText={
                <EmptyState
                  title="No manager reviews"
                  description="Start a review for a team member."
                />
              }
              columns={[
                {
                  key: "employee",
                  header: "Employee",
                  render: (row) => row.employee.fullName,
                },
                { key: "cycle", header: "Cycle", render: (row) => row.cycle.name },
                {
                  key: "rating",
                  header: "Rating",
                  render: (row) => row.overallRating ?? "—",
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => <StatusBadge status={row.status} />,
                },
                {
                  key: "updated",
                  header: "Updated",
                  render: (row) => formatDateTime(row.updatedAt),
                },
                {
                  key: "actions",
                  header: "",
                  align: "right",
                  render: (row) => (
                    <Button variant="text" size="sm" onClick={() => setSelected(row.id)}>
                      Open
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </CardBody>
      </Card>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Start manager review"
        size="md"
        footer={
          <Stack direction="row" justify="end" spacing={8}>
            <Button variant="outlined" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <LoadingButton
              loading={createMutation.isPending}
              disabled={!employeeId || !cycleId}
              onClick={() => createMutation.mutate()}
            >
              Start review
            </LoadingButton>
          </Stack>
        }
      >
        <Stack spacing={14}>
          <Select
            label="Employee"
            value={employeeId}
            onChange={setEmployeeId}
            options={employeeOptions(employees.data?.items)}
            searchable
            fullWidth
          />
          <Select
            label="Cycle"
            value={cycleId}
            onChange={setCycleId}
            options={
              cycles.data?.items
                .filter((cycle) => ["ACTIVE", "REVIEW_IN_PROGRESS"].includes(cycle.status))
                .map((cycle) => ({ label: cycle.name, value: cycle.id })) ?? []
            }
            fullWidth
          />
        </Stack>
      </Modal>
      <ReviewEditor review={review.data} onClose={() => setSelected(null)} />
    </Stack>
  );
}

export function PerformanceReviewHistoryPage() {
  const { hasPermission } = useAuth();
  const [cycleId, setCycleId] = useState("");
  const [status, setStatus] = useState("");
  const [reviewType, setReviewType] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const params = new URLSearchParams({ page: String(page), pageSize: String(HR_PAGE_SIZE) });
  if (cycleId) params.set("cycleId", cycleId);
  if (status) params.set("status", status);
  if (reviewType) params.set("reviewType", reviewType);
  const reviews = usePerformanceReviews(params);
  const cycles = usePerformanceCycles(new URLSearchParams({ pageSize: "100" }));
  const review = usePerformanceReview(selected ?? undefined);

  if (!hasPermission(PERMISSIONS.PERFORMANCE_REVIEWS_READ_SELF)) {
    return <PermissionNotice>Ask HR for performance review access.</PermissionNotice>;
  }

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Performance review history"
        description="Submitted and completed reviews remain available as performance history."
      />
      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="grid gap-3 md:grid-cols-4">
              <Select
                aria-label="Filter reviews by cycle"
                value={cycleId}
                onChange={(value) => {
                  setCycleId(value);
                  setPage(1);
                }}
                options={[
                  { label: "All cycles", value: "" },
                  ...(cycles.data?.items.map((cycle) => ({
                    label: cycle.name,
                    value: cycle.id,
                  })) ?? []),
                ]}
                fullWidth
              />
              <Select
                aria-label="Filter review type"
                value={reviewType}
                onChange={(value) => {
                  setReviewType(value);
                  setPage(1);
                }}
                options={[
                  { label: "All types", value: "" },
                  { label: "Self", value: "SELF_REVIEW" },
                  { label: "Manager", value: "MANAGER_REVIEW" },
                  { label: "HR", value: "HR_REVIEW" },
                ]}
                fullWidth
              />
              <Select
                aria-label="Filter review status"
                value={status}
                onChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
                options={[
                  { label: "All statuses", value: "" },
                  { label: "Draft", value: "DRAFT" },
                  { label: "Submitted", value: "SUBMITTED" },
                  { label: "Completed", value: "COMPLETED" },
                ]}
                fullWidth
              />
              <Button
                variant="outlined"
                onClick={() => {
                  setCycleId("");
                  setStatus("");
                  setReviewType("");
                  setPage(1);
                }}
              >
                Reset filters
              </Button>
            </div>
            {reviews.isPending ? (
              <LoadingBlock label="Loading review history…" />
            ) : reviews.isError ? (
              <ErrorBlock title="Could not load review history" error={reviews.error} />
            ) : (
              <Table
                data={reviews.data?.items ?? []}
                rowKey={(row) => row.id}
                emptyText={
                  <EmptyState
                    title="No reviews"
                    description="Reviews appear here once they are created."
                  />
                }
                pagination={{
                  page,
                  pageSize: HR_PAGE_SIZE,
                  pageCount: reviews.data?.totalPages ?? 1,
                  total: reviews.data?.total ?? 0,
                  onChange: setPage,
                }}
                columns={[
                  {
                    key: "employee",
                    header: "Employee",
                    render: (row) => row.employee.fullName,
                  },
                  { key: "cycle", header: "Cycle", render: (row) => row.cycle.name },
                  {
                    key: "type",
                    header: "Type",
                    render: (row) => titleCase(row.reviewType),
                  },
                  {
                    key: "rating",
                    header: "Rating",
                    render: (row) => row.overallRating ?? "—",
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => <StatusBadge status={row.status} />,
                  },
                  {
                    key: "completed",
                    header: "Completed",
                    render: (row) => formatDateTime(row.completedAt),
                  },
                  {
                    key: "actions",
                    header: "",
                    align: "right",
                    render: (row) => (
                      <Button variant="text" size="sm" onClick={() => setSelected(row.id)}>
                        View
                      </Button>
                    ),
                  },
                ]}
              />
            )}
          </Stack>
        </CardBody>
      </Card>
      <ReviewEditor review={review.data} onClose={() => setSelected(null)} />
    </Stack>
  );
}
