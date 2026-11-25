import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Textarea,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useState } from "react";
import {
  PERMISSIONS,
  type LeavePolicyAssignment,
  type PaginatedResponse,
} from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import { useAttendanceEmployees } from "../attendance/attendance-utils";
import { PageHeading } from "./leave-ui";
import { LEAVE_PAGE_SIZE, todayKey, useLeavePolicies } from "./leave-utils";

interface AssignmentForm {
  employeeId: string;
  policyId: string;
  effectiveFrom: string;
  effectiveTo: string;
  notes: string;
}

const emptyForm = (): AssignmentForm => ({
  employeeId: "",
  policyId: "",
  effectiveFrom: todayKey(),
  effectiveTo: "",
  notes: "",
});

export function LeavePolicyAssignmentsPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<AssignmentForm>(emptyForm());
  const employeesQuery = useAttendanceEmployees();
  const policiesQuery = useLeavePolicies();

  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(LEAVE_PAGE_SIZE),
  });

  const assignmentsQuery = useQuery({
    queryKey: ["leave", "assignments", "list", params.toString()],
    queryFn: () =>
      apiRequest<PaginatedResponse<LeavePolicyAssignment>>(
        `/leave-policy-assignments?${params.toString()}`,
      ),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["leave"] });

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ assigned: number; employeeIds: string[] }>("/leave-policy-assignments", {
        method: "POST",
        body: {
          employeeIds: [form.employeeId],
          policyId: form.policyId,
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo || null,
          notes: form.notes || null,
        },
      }),
    onSuccess: () => {
      toast.success("Leave policy assigned");
      setDialogOpen(false);
      setForm(emptyForm());
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not assign the policy"),
  });

  const endMutation = useMutation({
    mutationFn: (assignment: LeavePolicyAssignment) =>
      apiRequest<LeavePolicyAssignment>(`/leave-policy-assignments/${assignment.id}`, {
        method: "PATCH",
        body: { effectiveTo: todayKey(), status: "INACTIVE" },
      }),
    onSuccess: () => {
      toast.success("Assignment ended");
      invalidate();
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiRequestError ? error.message : "Could not end the assignment",
      ),
  });

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Leave policy assignments"
        description="Assign an effective leave policy to each employee"
        actions={
          hasPermission(PERMISSIONS.LEAVE_POLICY_ASSIGN) ? (
            <Button
              onClick={() => {
                setForm(emptyForm());
                setDialogOpen(true);
              }}
            >
              Assign policy
            </Button>
          ) : undefined
        }
      />

      <Card variant="elevated" padding="lg">
        <CardBody>
          {assignmentsQuery.isPending ? (
            <Stack direction="row" spacing={12} align="center">
              <Spinner />
              <Typography variant="bodySmall" color="neutral">
                Loading assignments…
              </Typography>
            </Stack>
          ) : assignmentsQuery.isError ? (
            <Alert tone="error" title="Could not load leave assignments">
              {assignmentsQuery.error instanceof ApiRequestError
                ? assignmentsQuery.error.message
                : "Unexpected error"}
            </Alert>
          ) : (
            <Table
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
                  key: "policy",
                  header: "Policy",
                  render: (row) => (
                    <Stack spacing={1}>
                      <Typography variant="bodySmall">{row.policy.name}</Typography>
                      <Typography variant="caption" color="neutral">
                        {row.leaveType.name}
                      </Typography>
                    </Stack>
                  ),
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
                    <Badge variant="filled" color={row.status === "ACTIVE" ? "success" : "neutral"}>
                      {row.status.toLowerCase()}
                    </Badge>
                  ),
                },
                {
                  key: "actions",
                  header: "",
                  align: "right",
                  render: (row) =>
                    hasPermission(PERMISSIONS.LEAVE_POLICY_ASSIGN) && row.status === "ACTIVE" ? (
                      <Button variant="text" size="sm" onClick={() => endMutation.mutate(row)}>
                        End assignment
                      </Button>
                    ) : null,
                },
              ]}
              data={assignmentsQuery.data.items}
              rowKey={(row) => row.id}
              pagination={{
                page,
                pageSize: LEAVE_PAGE_SIZE,
                pageCount: assignmentsQuery.data.totalPages,
                total: assignmentsQuery.data.total,
                onChange: setPage,
              }}
              emptyText="No leave policies assigned yet."
            />
          )}
        </CardBody>
      </Card>

      <Modal
        open={dialogOpen}
        onOpenChange={(open) => setDialogOpen(open)}
        title="Assign leave policy"
        size="md"
        footer={
          <>
            <Button variant="outlined" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <LoadingButton
              type="submit"
              form="leave-assignment-form"
              loading={createMutation.isPending}
              disabled={!form.employeeId || !form.policyId}
            >
              Assign
            </LoadingButton>
          </>
        }
      >
        <form
          id="leave-assignment-form"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate();
          }}
        >
          <Stack spacing={14}>
            <Select
              label="Employee"
              value={form.employeeId}
              onChange={(value) => setForm({ ...form, employeeId: value })}
              options={
                employeesQuery.data?.items.map((employee) => ({
                  label: `${employee.fullName} (${employee.employeeNumber})`,
                  value: employee.id,
                })) ?? []
              }
              fullWidth
            />
            <Select
              label="Leave policy"
              value={form.policyId}
              onChange={(value) => setForm({ ...form, policyId: value })}
              options={
                policiesQuery.data?.map((policy) => ({
                  label: `${policy.name} · ${policy.leaveType.name}`,
                  value: policy.id,
                })) ?? []
              }
              fullWidth
            />
            <div className="grid gap-3 md:grid-cols-2">
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
            <Textarea
              label="Notes"
              rows={2}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              fullWidth
            />
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
