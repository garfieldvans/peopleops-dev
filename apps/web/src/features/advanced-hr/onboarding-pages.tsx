import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Checkbox,
  Input,
  Modal,
  Select,
  Stack,
  Table,
  Textarea,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import {
  PERMISSIONS,
  type EmployeeOnboarding,
  type EmployeeOnboardingDetail,
  type OnboardingTask,
  type OnboardingTaskCategory,
  type OnboardingTemplate,
} from "@peopleops/shared-types";
import { FormDatePicker } from "../../components/form-date-picker";
import { FormInput } from "../../components/form-input";
import { FormSelect } from "../../components/form-select";
import { LoadingButton } from "../../components/loading-button";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { useAuth } from "../auth/auth-context";
import {
  employeeOptions,
  formatDate,
  formatDateTime,
  HR_PAGE_SIZE,
  titleCase,
  todayKey,
  useEmployees,
  useOnboardingRecord,
  useOnboardingRecords,
  useOnboardingTemplates,
  userOptions,
  useUsers,
} from "./advanced-hr-api";
import {
  ConfirmDialog,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  MetricCard,
  PageHeading,
  PermissionNotice,
  ProgressSummary,
  StatusBadge,
} from "./advanced-hr-ui";

const TASK_CATEGORIES: OnboardingTaskCategory[] = [
  "DOCUMENTATION",
  "HR_ADMINISTRATION",
  "IT_SETUP",
  "EQUIPMENT",
  "ORIENTATION",
  "DEPARTMENT_INTRODUCTION",
  "OTHER",
];

function categoryOptions() {
  return TASK_CATEGORIES.map((category) => ({ label: titleCase(category), value: category }));
}

export function OnboardingDashboardPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [startOpen, setStartOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [startDate, setStartDate] = useState(todayKey());
  const [expectedCompletionDate, setExpectedCompletionDate] = useState("");

  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(HR_PAGE_SIZE),
  });
  if (status) params.set("status", status);
  const records = useOnboardingRecords(params);
  const templates = useOnboardingTemplates(
    new URLSearchParams({ pageSize: "100", isActive: "true" }),
    hasPermission(PERMISSIONS.ONBOARDING_MANAGE),
  );
  const employees = useEmployees(hasPermission(PERMISSIONS.ONBOARDING_MANAGE));

  const startMutation = useMutation({
    mutationFn: () =>
      apiRequest<EmployeeOnboarding>("/onboarding/records", {
        method: "POST",
        body: {
          employeeId,
          templateId,
          startDate,
          expectedCompletionDate: expectedCompletionDate || null,
        },
      }),
    onSuccess: () => {
      toast.success("Onboarding started");
      setStartOpen(false);
      setEmployeeId("");
      setTemplateId("");
      setExpectedCompletionDate("");
      void queryClient.invalidateQueries({ queryKey: ["advanced-hr", "onboarding"] });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiRequestError ? error.message : "Could not start onboarding",
      ),
  });

  if (!hasPermission(PERMISSIONS.ONBOARDING_READ)) {
    return <PermissionNotice>Ask HR for onboarding access.</PermissionNotice>;
  }

  const items = records.data?.items ?? [];
  return (
    <Stack spacing={16}>
      <PageHeading
        title="Onboarding"
        description="Track new-hire checklists, owners, due dates, and completion."
        actions={
          hasPermission(PERMISSIONS.ONBOARDING_MANAGE) ? (
            <Stack direction="row" spacing={8} wrap>
              <Link to="/onboarding/templates">
                <Button variant="outlined">Templates</Button>
              </Link>
              <Button onClick={() => setStartOpen(true)}>Start onboarding</Button>
            </Stack>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="In progress"
          value={items.filter((row) => row.status === "IN_PROGRESS").length}
          hint="Active checklists"
        />
        <MetricCard
          label="Not started"
          value={items.filter((row) => row.status === "NOT_STARTED").length}
        />
        <MetricCard
          label="Completed"
          value={items.filter((row) => row.status === "COMPLETED").length}
        />
        <MetricCard
          label="Overdue tasks"
          value={items.reduce((sum, row) => sum + row.progress.overdue, 0)}
          hint="Across visible records"
        />
      </div>

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="grid gap-3 md:grid-cols-3">
              <Select
                aria-label="Filter onboarding status"
                value={status}
                onChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
                options={[
                  { label: "All statuses", value: "" },
                  { label: "Not started", value: "NOT_STARTED" },
                  { label: "In progress", value: "IN_PROGRESS" },
                  { label: "Completed", value: "COMPLETED" },
                  { label: "Cancelled", value: "CANCELLED" },
                ]}
                fullWidth
              />
              <Button
                variant="outlined"
                onClick={() => {
                  setStatus("");
                  setPage(1);
                }}
              >
                Reset filter
              </Button>
            </div>
            {records.isPending ? (
              <LoadingBlock label="Loading onboarding records…" />
            ) : records.isError ? (
              <ErrorBlock title="Could not load onboarding records" error={records.error} />
            ) : (
              <Table
                data={items}
                rowKey={(row) => row.id}
                emptyText={
                  <EmptyState
                    title="No onboarding records"
                    description="Start onboarding for a new employee to generate the checklist."
                  />
                }
                pagination={{
                  page,
                  pageSize: HR_PAGE_SIZE,
                  pageCount: records.data?.totalPages ?? 1,
                  total: records.data?.total ?? 0,
                  onChange: setPage,
                }}
                columns={[
                  {
                    key: "employee",
                    header: "Employee",
                    render: (row) => (
                      <Stack spacing={1}>
                        <Link to={`/onboarding/records/${row.id}`} className="underline">
                          <Typography variant="bodySmall" className="font-medium">
                            {row.employee.fullName}
                          </Typography>
                        </Link>
                        <Typography variant="caption" color="neutral">
                          {row.employee.employeeNumber} · {row.employee.department ?? "No department"}
                        </Typography>
                      </Stack>
                    ),
                  },
                  {
                    key: "template",
                    header: "Template",
                    render: (row) => row.template.name,
                  },
                  {
                    key: "start",
                    header: "Start date",
                    render: (row) => formatDate(row.startDate),
                  },
                  {
                    key: "progress",
                    header: "Progress",
                    render: (row) => <ProgressSummary progress={row.progress} />,
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
                    render: (row) => (
                      <Link to={`/onboarding/records/${row.id}`}>
                        <Button variant="text" size="sm">
                          Open
                        </Button>
                      </Link>
                    ),
                  },
                ]}
              />
            )}
          </Stack>
        </CardBody>
      </Card>

      <Modal
        open={startOpen}
        onOpenChange={setStartOpen}
        title="Start onboarding"
        description="Tasks are generated from the selected template."
        size="md"
        footer={
          <Stack direction="row" justify="end" spacing={8}>
            <Button variant="outlined" onClick={() => setStartOpen(false)}>
              Cancel
            </Button>
            <LoadingButton
              loading={startMutation.isPending}
              disabled={!employeeId || !templateId || !startDate}
              onClick={() => startMutation.mutate()}
            >
              Start onboarding
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
            label="Onboarding template"
            value={templateId}
            onChange={setTemplateId}
            options={
              templates.data?.items.map((template) => ({
                label: template.name,
                value: template.id,
              })) ?? []
            }
            searchable
            fullWidth
          />
          <Input
            label="Start date"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            required
            fullWidth
          />
          <Input
            label="Expected completion date"
            type="date"
            value={expectedCompletionDate}
            onChange={(event) => setExpectedCompletionDate(event.target.value)}
            fullWidth
          />
        </Stack>
      </Modal>
    </Stack>
  );
}

export function OnboardingTemplatesPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: String(HR_PAGE_SIZE) });
  if (search) params.set("search", search);
  if (active) params.set("isActive", active);
  const templates = useOnboardingTemplates(params);

  const toggleMutation = useMutation({
    mutationFn: (template: OnboardingTemplate) =>
      apiRequest<OnboardingTemplate>(`/onboarding/templates/${template.id}`, {
        method: "PATCH",
        body: { isActive: !template.isActive },
      }),
    onSuccess: () => {
      toast.success("Template updated");
      void queryClient.invalidateQueries({ queryKey: ["advanced-hr", "onboarding"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not update template"),
  });

  if (!hasPermission(PERMISSIONS.ONBOARDING_READ)) {
    return <PermissionNotice>Ask HR for onboarding access.</PermissionNotice>;
  }

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Onboarding templates"
        description="Reusable task lists for new hires."
        actions={
          hasPermission(PERMISSIONS.ONBOARDING_MANAGE) ? (
            <Link to="/onboarding/templates/new">
              <Button>New template</Button>
            </Link>
          ) : undefined
        }
      />
      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                aria-label="Search onboarding templates"
                placeholder="Search template name"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                fullWidth
              />
              <Select
                aria-label="Filter template status"
                value={active}
                onChange={(value) => {
                  setActive(value);
                  setPage(1);
                }}
                options={[
                  { label: "All templates", value: "" },
                  { label: "Active", value: "true" },
                  { label: "Inactive", value: "false" },
                ]}
                fullWidth
              />
              <Link to="/onboarding">
                <Button variant="outlined" fullWidth>
                  Back to dashboard
                </Button>
              </Link>
            </div>
            {templates.isPending ? (
              <LoadingBlock label="Loading templates…" />
            ) : templates.isError ? (
              <ErrorBlock title="Could not load templates" error={templates.error} />
            ) : (
              <Table
                data={templates.data?.items ?? []}
                rowKey={(row) => row.id}
                emptyText={
                  <EmptyState
                    title="No templates"
                    description="Create a template with at least one task."
                  />
                }
                pagination={{
                  page,
                  pageSize: HR_PAGE_SIZE,
                  pageCount: templates.data?.totalPages ?? 1,
                  total: templates.data?.total ?? 0,
                  onChange: setPage,
                }}
                columns={[
                  {
                    key: "name",
                    header: "Template",
                    render: (row) => (
                      <Stack spacing={1}>
                        <Typography variant="bodySmall" className="font-medium">
                          {row.name}
                        </Typography>
                        <Typography variant="caption" color="neutral">
                          {row.description ?? "No description"}
                        </Typography>
                      </Stack>
                    ),
                  },
                  { key: "tasks", header: "Tasks", render: (row) => row.tasks.length },
                  {
                    key: "records",
                    header: "Used by",
                    render: (row) => `${row.recordCount ?? 0} records`,
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => (
                      <StatusBadge status={row.isActive ? "ACTIVE" : "INACTIVE"} />
                    ),
                  },
                  {
                    key: "actions",
                    header: "",
                    align: "right",
                    render: (row) =>
                      hasPermission(PERMISSIONS.ONBOARDING_MANAGE) ? (
                        <Stack direction="row" spacing={4} justify="end">
                          <Link to={`/onboarding/templates/${row.id}/edit`}>
                            <Button variant="text" size="sm">
                              Edit
                            </Button>
                          </Link>
                          <Button
                            variant="text"
                            size="sm"
                            onClick={() => toggleMutation.mutate(row)}
                          >
                            {row.isActive ? "Deactivate" : "Activate"}
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
    </Stack>
  );
}

const taskSchema = z.object({
  title: z.string().trim().min(2, "Task title is required").max(160),
  description: z.string().max(1000).optional(),
  category: z.enum([
    "DOCUMENTATION",
    "HR_ADMINISTRATION",
    "IT_SETUP",
    "EQUIPMENT",
    "ORIENTATION",
    "DEPARTMENT_INTRODUCTION",
    "OTHER",
  ]),
  assignedRole: z.string().max(80).optional(),
  dueOffsetDays: z.coerce.number().int().min(0).max(365),
  isRequired: z.boolean(),
  sortOrder: z.coerce.number().int().min(0),
});

const templateSchema = z.object({
  name: z.string().trim().min(2, "Template name is required").max(160),
  description: z.string().max(1000).optional(),
  isActive: z.boolean(),
  tasks: z.array(taskSchema).min(1, "Add at least one task"),
});

type TemplateFormValues = z.infer<typeof templateSchema>;

const emptyTemplate: TemplateFormValues = {
  name: "",
  description: "",
  isActive: true,
  tasks: [
    {
      title: "",
      description: "",
      category: "DOCUMENTATION",
      assignedRole: "HR",
      dueOffsetDays: 0,
      isRequired: true,
      sortOrder: 0,
    },
  ],
};

export function OnboardingTemplateFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const isEdit = Boolean(id);
  const templates = useOnboardingTemplates(new URLSearchParams({ pageSize: "100" }), isEdit);
  const template = templates.data?.items.find((row) => row.id === id);
  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: emptyTemplate,
  });
  const tasks = useFieldArray({ control: form.control, name: "tasks" });

  useEffect(() => {
    if (!template) return;
    form.reset({
      name: template.name,
      description: template.description ?? "",
      isActive: template.isActive,
      tasks: template.tasks.map((task, index) => ({
        title: task.title,
        description: task.description ?? "",
        category: task.category,
        assignedRole: task.assignedRole ?? "",
        dueOffsetDays: task.dueOffsetDays,
        isRequired: task.isRequired,
        sortOrder: task.sortOrder ?? index,
      })),
    });
  }, [form, template]);

  const saveMutation = useMutation({
    mutationFn: (values: TemplateFormValues) => {
      const body = {
        ...values,
        description: values.description || null,
        tasks: values.tasks.map((task, index) => ({
          ...task,
          description: task.description || null,
          assignedRole: task.assignedRole || null,
          sortOrder: index,
        })),
      };
      return isEdit
        ? apiRequest<OnboardingTemplate>(`/onboarding/templates/${id}`, {
            method: "PATCH",
            body,
          })
        : apiRequest<OnboardingTemplate>("/onboarding/templates", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(isEdit ? "Template updated" : "Template created");
      void queryClient.invalidateQueries({ queryKey: ["advanced-hr", "onboarding"] });
      navigate("/onboarding/templates");
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not save template"),
  });

  if (!hasPermission(PERMISSIONS.ONBOARDING_MANAGE)) {
    return <PermissionNotice>Ask HR to manage onboarding templates.</PermissionNotice>;
  }
  if (isEdit && templates.isPending) return <LoadingBlock label="Loading template…" />;
  if (isEdit && !template) {
    return <ErrorBlock title="Template not found" error={new Error("Unknown template")} />;
  }

  return (
    <Stack spacing={16}>
      <PageHeading
        title={isEdit ? "Edit onboarding template" : "New onboarding template"}
        description="Tasks are copied to each employee onboarding record when it starts."
        actions={
          <Link to="/onboarding/templates">
            <Button variant="outlined">Back</Button>
          </Link>
        }
      />
      <Card variant="elevated" padding="lg">
        <CardBody>
          <form onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
            <Stack spacing={16}>
              <div className="grid gap-3 md:grid-cols-2">
                <FormInput control={form.control} name="name" label="Template name" required />
                <FormSelect
                  control={form.control}
                  name="isActive"
                  label="Status"
                  options={[
                    { label: "Active", value: "true" },
                    { label: "Inactive", value: "false" },
                  ]}
                />
              </div>
              <Textarea
                label="Description"
                rows={2}
                value={form.watch("description") ?? ""}
                onChange={(event) =>
                  form.setValue("description", event.target.value, { shouldDirty: true })
                }
                fullWidth
              />
              <Stack direction="row" justify="between" align="center">
                <Typography variant="h6">Tasks</Typography>
                <Button
                  type="button"
                  variant="outlined"
                  size="sm"
                  onClick={() =>
                    tasks.append({
                      title: "",
                      description: "",
                      category: "OTHER",
                      assignedRole: "",
                      dueOffsetDays: 0,
                      isRequired: true,
                      sortOrder: tasks.fields.length,
                    })
                  }
                >
                  Add task
                </Button>
              </Stack>
              {tasks.fields.map((field, index) => (
                <Card key={field.id} variant="outlined" padding="md">
                  <CardBody>
                    <Stack spacing={12}>
                      <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
                        <FormInput
                          control={form.control}
                          name={`tasks.${index}.title`}
                          label={`Task ${index + 1}`}
                          required
                        />
                        <FormSelect
                          control={form.control}
                          name={`tasks.${index}.category`}
                          label="Category"
                          options={categoryOptions()}
                        />
                        <FormInput
                          control={form.control}
                          name={`tasks.${index}.dueOffsetDays`}
                          label="Due after start (days)"
                          type="number"
                          min={0}
                          max={365}
                        />
                      </div>
                      <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
                        <FormInput
                          control={form.control}
                          name={`tasks.${index}.description`}
                          label="Description"
                        />
                        <FormInput
                          control={form.control}
                          name={`tasks.${index}.assignedRole`}
                          label="Assigned role"
                          placeholder="HR, IT, Manager…"
                        />
                      </div>
                      <Stack direction="row" justify="between" align="center">
                        <Checkbox
                          label="Required"
                          checked={form.watch(`tasks.${index}.isRequired`)}
                          onChange={(event) =>
                            form.setValue(`tasks.${index}.isRequired`, event.target.checked)
                          }
                        />
                        <Button
                          type="button"
                          variant="text"
                          size="sm"
                          disabled={tasks.fields.length === 1}
                          onClick={() => tasks.remove(index)}
                        >
                          Remove
                        </Button>
                      </Stack>
                    </Stack>
                  </CardBody>
                </Card>
              ))}
              {form.formState.errors.tasks?.root ? (
                <Alert tone="error" title="Check the task list">
                  {form.formState.errors.tasks.root.message}
                </Alert>
              ) : null}
              <Stack direction="row" justify="end" spacing={8}>
                <Link to="/onboarding/templates">
                  <Button variant="outlined" type="button">
                    Cancel
                  </Button>
                </Link>
                <LoadingButton type="submit" loading={saveMutation.isPending}>
                  {isEdit ? "Save template" : "Create template"}
                </LoadingButton>
              </Stack>
            </Stack>
          </form>
        </CardBody>
      </Card>
    </Stack>
  );
}

export function EmployeeOnboardingDetailPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const record = useOnboardingRecord(id);
  const users = useUsers(hasPermission(PERMISSIONS.ONBOARDING_TASK_UPDATE));
  const [task, setTask] = useState<OnboardingTask | null>(null);
  const [taskStatus, setTaskStatus] = useState<"PENDING" | "IN_PROGRESS" | "COMPLETED">("PENDING");
  const [taskNotes, setTaskNotes] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [completeOpen, setCompleteOpen] = useState(false);

  const taskMutation = useMutation({
    mutationFn: () =>
      apiRequest<OnboardingTask>(`/onboarding/tasks/${task?.id}`, {
        method: "PATCH",
        body: {
          status: taskStatus,
          notes: taskNotes || null,
          dueDate: taskDueDate || null,
          assignedToId: taskAssignee || null,
        },
      }),
    onSuccess: () => {
      toast.success("Task updated");
      setTask(null);
      void queryClient.invalidateQueries({ queryKey: ["advanced-hr", "onboarding"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not update task"),
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      apiRequest<EmployeeOnboardingDetail>(`/onboarding/records/${id}/complete`, {
        method: "POST",
        body: { comment: "Completed from onboarding detail" },
      }),
    onSuccess: () => {
      toast.success("Onboarding completed");
      setCompleteOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["advanced-hr", "onboarding"] });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiRequestError ? error.message : "Could not complete onboarding",
      ),
  });

  if (!hasPermission(PERMISSIONS.ONBOARDING_READ)) {
    return <PermissionNotice>Ask HR for onboarding access.</PermissionNotice>;
  }
  if (record.isPending) return <LoadingBlock label="Loading onboarding record…" />;
  if (record.isError) {
    return <ErrorBlock title="Could not load onboarding record" error={record.error} />;
  }
  const data = record.data;

  return (
    <Stack spacing={16}>
      <PageHeading
        title={data.employee.fullName}
        description={`${data.template.name} · starts ${formatDate(data.startDate)}`}
        actions={
          <Stack direction="row" spacing={8} wrap>
            <Link to="/onboarding">
              <Button variant="outlined">Back</Button>
            </Link>
            {hasPermission(PERMISSIONS.ONBOARDING_MANAGE) &&
            data.status !== "COMPLETED" &&
            data.status !== "CANCELLED" ? (
              <Button onClick={() => setCompleteOpen(true)}>Complete onboarding</Button>
            ) : null}
          </Stack>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card variant="elevated" padding="lg">
          <CardBody>
            <Stack spacing={16}>
              <Stack direction="row" justify="between" align="center" wrap>
                <Typography variant="h6">Checklist</Typography>
                <StatusBadge status={data.status} />
              </Stack>
              <ProgressSummary progress={data.progress} />
              <Table
                data={data.tasks}
                rowKey={(row) => row.id}
                emptyText={<EmptyState title="No tasks" description="This template has no tasks." />}
                columns={[
                  {
                    key: "title",
                    header: "Task",
                    render: (row) => (
                      <Stack spacing={1}>
                        <Typography variant="bodySmall" className="font-medium">
                          {row.title}
                        </Typography>
                        <Typography variant="caption" color="neutral">
                          {titleCase(row.category)} · due {formatDate(row.dueDate)}
                        </Typography>
                        {row.overdue ? <StatusBadge status="OVERDUE" /> : null}
                      </Stack>
                    ),
                  },
                  {
                    key: "owner",
                    header: "Owner",
                    render: (row) => row.assignedTo?.name ?? "Unassigned",
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
                      hasPermission(PERMISSIONS.ONBOARDING_TASK_UPDATE) ? (
                        <Button
                          variant="text"
                          size="sm"
                          onClick={() => {
                            setTask(row);
                            setTaskStatus(row.status);
                            setTaskNotes(row.notes ?? "");
                            setTaskDueDate(row.dueDate ?? "");
                            setTaskAssignee(row.assignedTo?.id ?? "");
                          }}
                        >
                          Update
                        </Button>
                      ) : null,
                  },
                ]}
              />
            </Stack>
          </CardBody>
        </Card>
        <Card variant="outlined" padding="lg">
          <CardBody>
            <Stack spacing={12}>
              <Typography variant="h6">Details</Typography>
              <DetailRow label="Employee number" value={data.employee.employeeNumber} />
              <DetailRow label="Department" value={data.employee.department ?? "—"} />
              <DetailRow label="Expected completion" value={formatDate(data.expectedCompletionDate)} />
              <DetailRow label="Completed at" value={formatDateTime(data.completedAt)} />
              <DetailRow label="Notes" value={data.notes ?? "—"} />
            </Stack>
          </CardBody>
        </Card>
      </div>

      <Modal
        open={task !== null}
        onOpenChange={(open) => !open && setTask(null)}
        title="Update task"
        description={task?.title}
        size="md"
        footer={
          <Stack direction="row" justify="end" spacing={8}>
            <Button variant="outlined" onClick={() => setTask(null)}>
              Cancel
            </Button>
            <LoadingButton loading={taskMutation.isPending} onClick={() => taskMutation.mutate()}>
              Save task
            </LoadingButton>
          </Stack>
        }
      >
        <Stack spacing={14}>
          <Select
            label="Status"
            value={taskStatus}
            onChange={(value) => setTaskStatus(value as typeof taskStatus)}
            options={[
              { label: "Pending", value: "PENDING" },
              { label: "In progress", value: "IN_PROGRESS" },
              { label: "Completed", value: "COMPLETED" },
            ]}
            fullWidth
          />
          <Select
            label="Assigned user"
            value={taskAssignee}
            onChange={setTaskAssignee}
            options={[{ label: "Unassigned", value: "" }, ...userOptions(users.data?.items)]}
            searchable
            fullWidth
          />
          <Input
            label="Due date"
            type="date"
            value={taskDueDate}
            onChange={(event) => setTaskDueDate(event.target.value)}
            fullWidth
          />
          <Textarea
            label="Notes"
            rows={3}
            value={taskNotes}
            onChange={(event) => setTaskNotes(event.target.value)}
            fullWidth
          />
        </Stack>
      </Modal>

      <ConfirmDialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        title="Complete onboarding?"
        description="All required tasks should be complete. The record remains available as history."
        confirmLabel="Complete onboarding"
        tone="success"
        busy={completeMutation.isPending}
        onConfirm={() => completeMutation.mutate()}
      />
    </Stack>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={2}>
      <Typography variant="caption" color="neutral">
        {label}
      </Typography>
      <Typography variant="bodySmall">{value}</Typography>
    </Stack>
  );
}
