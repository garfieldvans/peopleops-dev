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
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  PERMISSIONS,
  type EmployeeOffboarding,
  type EmployeeOffboardingDetail,
  type OffboardingReasonCategory,
  type OffboardingTask,
} from "@peopleops/shared-types";
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
  useOffboardingRecord,
  useOffboardingRecords,
  useOffboardingTemplates,
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

const REASONS: OffboardingReasonCategory[] = [
  "RESIGNATION",
  "CONTRACT_END",
  "TERMINATION",
  "RETIREMENT",
  "OTHER",
];

export function OffboardingDashboardPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [resignationDate, setResignationDate] = useState(todayKey());
  const [lastWorkingDate, setLastWorkingDate] = useState(todayKey());
  const [reasonCategory, setReasonCategory] =
    useState<OffboardingReasonCategory>("RESIGNATION");
  const [reason, setReason] = useState("");
  const [exitInterviewNotes, setExitInterviewNotes] = useState("");

  const params = new URLSearchParams({ page: String(page), pageSize: String(HR_PAGE_SIZE) });
  if (status) params.set("status", status);
  const records = useOffboardingRecords(params);
  const templates = useOffboardingTemplates(
    new URLSearchParams({ pageSize: "100", isActive: "true" }),
    hasPermission(PERMISSIONS.OFFBOARDING_MANAGE),
  );
  const employees = useEmployees(hasPermission(PERMISSIONS.OFFBOARDING_MANAGE));

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest<EmployeeOffboarding>("/offboarding/records", {
        method: "POST",
        body: {
          employeeId,
          templateId: templateId || null,
          resignationDate,
          lastWorkingDate,
          reasonCategory,
          reason: reason || null,
          exitInterviewNotes: exitInterviewNotes || null,
        },
      }),
    onSuccess: () => {
      toast.success("Offboarding initiated");
      setOpen(false);
      setEmployeeId("");
      setTemplateId("");
      setReason("");
      setExitInterviewNotes("");
      void queryClient.invalidateQueries({ queryKey: ["advanced-hr", "offboarding"] });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiRequestError ? error.message : "Could not initiate offboarding",
      ),
  });

  if (!hasPermission(PERMISSIONS.OFFBOARDING_READ)) {
    return <PermissionNotice>Ask HR for offboarding access.</PermissionNotice>;
  }
  const items = records.data?.items ?? [];

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Offboarding"
        description="Manage exit checklists without deleting employee or payroll history."
        actions={
          hasPermission(PERMISSIONS.OFFBOARDING_MANAGE) ? (
            <Button onClick={() => setOpen(true)}>Initiate offboarding</Button>
          ) : undefined
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Initiated"
          value={items.filter((row) => row.status === "INITIATED").length}
        />
        <MetricCard
          label="In progress"
          value={items.filter((row) => row.status === "IN_PROGRESS").length}
        />
        <MetricCard
          label="Completed"
          value={items.filter((row) => row.status === "COMPLETED").length}
        />
        <MetricCard
          label="Overdue tasks"
          value={items.reduce((sum, row) => sum + row.progress.overdue, 0)}
        />
      </div>
      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="grid gap-3 md:grid-cols-3">
              <Select
                aria-label="Filter offboarding status"
                value={status}
                onChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
                options={[
                  { label: "All statuses", value: "" },
                  { label: "Initiated", value: "INITIATED" },
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
              <LoadingBlock label="Loading offboarding records…" />
            ) : records.isError ? (
              <ErrorBlock title="Could not load offboarding records" error={records.error} />
            ) : (
              <Table
                data={items}
                rowKey={(row) => row.id}
                emptyText={
                  <EmptyState
                    title="No offboarding records"
                    description="Initiate offboarding when an employee gives notice."
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
                        <Link to={`/offboarding/records/${row.id}`} className="underline">
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
                    key: "lastDay",
                    header: "Last working date",
                    render: (row) => formatDate(row.lastWorkingDate),
                  },
                  {
                    key: "reason",
                    header: "Reason",
                    render: (row) => titleCase(row.reasonCategory),
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
                      <Link to={`/offboarding/records/${row.id}`}>
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
        open={open}
        onOpenChange={setOpen}
        title="Initiate offboarding"
        description="This creates an exit checklist and integration notes. It does not change payroll."
        size="lg"
        footer={
          <Stack direction="row" justify="end" spacing={8}>
            <Button variant="outlined" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <LoadingButton
              loading={createMutation.isPending}
              disabled={!employeeId || !resignationDate || !lastWorkingDate}
              onClick={() => createMutation.mutate()}
            >
              Initiate
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
            label="Checklist template"
            value={templateId}
            onChange={setTemplateId}
            options={[
              { label: "No template", value: "" },
              ...(templates.data?.items.map((template) => ({
                label: template.name,
                value: template.id,
              })) ?? []),
            ]}
            fullWidth
          />
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Resignation date"
              type="date"
              value={resignationDate}
              onChange={(event) => setResignationDate(event.target.value)}
              fullWidth
            />
            <Input
              label="Last working date"
              type="date"
              value={lastWorkingDate}
              onChange={(event) => setLastWorkingDate(event.target.value)}
              fullWidth
            />
          </div>
          <Select
            label="Reason category"
            value={reasonCategory}
            onChange={(value) => setReasonCategory(value as OffboardingReasonCategory)}
            options={REASONS.map((reason) => ({ label: titleCase(reason), value: reason }))}
            fullWidth
          />
          <Textarea
            label="Reason"
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            fullWidth
          />
          {hasPermission(PERMISSIONS.OFFBOARDING_SENSITIVE_READ) ? (
            <Textarea
              label="Exit interview notes (restricted)"
              rows={3}
              value={exitInterviewNotes}
              onChange={(event) => setExitInterviewNotes(event.target.value)}
              fullWidth
            />
          ) : null}
        </Stack>
      </Modal>
    </Stack>
  );
}

export function EmployeeOffboardingDetailPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const record = useOffboardingRecord(id);
  const users = useUsers(hasPermission(PERMISSIONS.OFFBOARDING_TASK_UPDATE));
  const [task, setTask] = useState<OffboardingTask | null>(null);
  const [taskStatus, setTaskStatus] = useState<"PENDING" | "IN_PROGRESS" | "COMPLETED">("PENDING");
  const [taskNotes, setTaskNotes] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [completeOpen, setCompleteOpen] = useState(false);

  const taskMutation = useMutation({
    mutationFn: () =>
      apiRequest<OffboardingTask>(`/offboarding/tasks/${task?.id}`, {
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
      void queryClient.invalidateQueries({ queryKey: ["advanced-hr", "offboarding"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not update task"),
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      apiRequest<EmployeeOffboardingDetail>(`/offboarding/records/${id}/complete`, {
        method: "POST",
        body: { comment: "Completed from offboarding detail" },
      }),
    onSuccess: () => {
      toast.success("Offboarding completed. Employee history is preserved.");
      setCompleteOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["advanced-hr", "offboarding"] });
      void queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiRequestError ? error.message : "Could not complete offboarding",
      ),
  });

  if (!hasPermission(PERMISSIONS.OFFBOARDING_READ)) {
    return <PermissionNotice>Ask HR for offboarding access.</PermissionNotice>;
  }
  if (record.isPending) return <LoadingBlock label="Loading offboarding record…" />;
  if (record.isError) {
    return <ErrorBlock title="Could not load offboarding record" error={record.error} />;
  }
  const data = record.data;

  return (
    <Stack spacing={16}>
      <PageHeading
        title={data.employee.fullName}
        description={`Last working date ${formatDate(data.lastWorkingDate)} · ${titleCase(data.reasonCategory)}`}
        actions={
          <Stack direction="row" spacing={8} wrap>
            <Link to="/offboarding">
              <Button variant="outlined">Back</Button>
            </Link>
            {hasPermission(PERMISSIONS.OFFBOARDING_MANAGE) &&
            data.status !== "COMPLETED" &&
            data.status !== "CANCELLED" ? (
              <Button onClick={() => setCompleteOpen(true)}>Complete offboarding</Button>
            ) : null}
          </Stack>
        }
      />

      <Alert tone="warning" title="History is preserved">
        Completing offboarding updates the employee status and employment history. It does not
        delete records or alter published payroll.
      </Alert>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card variant="elevated" padding="lg">
          <CardBody>
            <Stack spacing={16}>
              <Stack direction="row" justify="between" align="center" wrap>
                <Typography variant="h6">Exit checklist</Typography>
                <StatusBadge status={data.status} />
              </Stack>
              <ProgressSummary progress={data.progress} />
              <Table
                data={data.tasks}
                rowKey={(row) => row.id}
                emptyText={<EmptyState title="No tasks" description="No checklist was attached." />}
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
                      hasPermission(PERMISSIONS.OFFBOARDING_TASK_UPDATE) ? (
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
        <Stack spacing={16}>
          <Card variant="outlined" padding="lg">
            <CardBody>
              <Stack spacing={12}>
                <Typography variant="h6">Details</Typography>
                <DetailRow label="Employee number" value={data.employee.employeeNumber} />
                <DetailRow label="Department" value={data.employee.department ?? "—"} />
                <DetailRow label="Resignation date" value={formatDate(data.resignationDate)} />
                <DetailRow label="Checklist" value={data.template?.name ?? "No template"} />
                <DetailRow label="Completed at" value={formatDateTime(data.completedAt)} />
                <DetailRow label="Reason" value={data.reason ?? "—"} />
              </Stack>
            </CardBody>
          </Card>
          {hasPermission(PERMISSIONS.OFFBOARDING_SENSITIVE_READ) ? (
            <Card variant="outlined" padding="lg">
              <CardBody>
                <Stack spacing={12}>
                  <Typography variant="h6">Restricted exit information</Typography>
                  <DetailRow
                    label="Exit interview"
                    value={data.sensitive.exitInterviewNotes ?? "—"}
                  />
                  <DetailRow
                    label="Equipment return"
                    value={data.sensitive.equipmentReturnNotes ?? "—"}
                  />
                  <DetailRow
                    label="Access review"
                    value={data.sensitive.accessReviewNotes ?? "—"}
                  />
                </Stack>
              </CardBody>
            </Card>
          ) : (
            <Alert tone="info" title="Restricted information">
              Exit interview and access review notes require the offboarding sensitive-read
              permission.
            </Alert>
          )}
          <Card variant="outlined" padding="lg">
            <CardBody>
              <Stack spacing={8}>
                <Typography variant="h6">Integration impact</Typography>
                {data.integrationNotes.length === 0 ? (
                  <Typography variant="bodySmall" color="neutral">
                    No attendance or payroll overlap was detected.
                  </Typography>
                ) : (
                  data.integrationNotes.map((note) => (
                    <Typography key={note} variant="bodySmall">
                      • {note}
                    </Typography>
                  ))
                )}
              </Stack>
            </CardBody>
          </Card>
        </Stack>
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
        title="Complete offboarding?"
        description="The employee status becomes resigned or terminated based on the reason. Published payroll is not changed."
        confirmLabel="Complete offboarding"
        tone="warning"
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
