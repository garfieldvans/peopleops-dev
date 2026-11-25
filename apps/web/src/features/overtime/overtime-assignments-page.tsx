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
  type OvertimeAssignmentScope,
  type OvertimePolicyAssignment,
  type PaginatedResponse,
} from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import { useAttendanceEmployees } from "../attendance/attendance-utils";
import {
  departmentChoiceOptions,
  useBranchOptions,
  useDepartmentTree,
} from "../employees/employee-options";
import { PageHeading } from "./overtime-ui";
import { OVERTIME_PAGE_SIZE, todayKey, useOvertimePolicies } from "./overtime-utils";

interface AssignmentForm {
  scope: OvertimeAssignmentScope;
  policyId: string;
  targetId: string;
  effectiveFrom: string;
  effectiveTo: string;
  notes: string;
}

const emptyForm = (): AssignmentForm => ({
  scope: "EMPLOYEE",
  policyId: "",
  targetId: "",
  effectiveFrom: todayKey(),
  effectiveTo: "",
  notes: "",
});

const SCOPE_LABELS: Record<OvertimeAssignmentScope, string> = {
  EMPLOYEE: "Employee",
  DEPARTMENT: "Department",
  BRANCH: "Branch",
};

export function OvertimeAssignmentsPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<AssignmentForm>(emptyForm());
  const employeesQuery = useAttendanceEmployees();
  const policiesQuery = useOvertimePolicies();
  const branchesQuery = useBranchOptions();
  const departmentsQuery = useDepartmentTree();

  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(OVERTIME_PAGE_SIZE),
  });

  const assignmentsQuery = useQuery({
    queryKey: ["overtime", "assignments", "list", params.toString()],
    queryFn: () =>
      apiRequest<PaginatedResponse<OvertimePolicyAssignment>>(
        `/overtime/assignments?${params.toString()}`,
      ),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["overtime", "assignments"] });
    void queryClient.invalidateQueries({ queryKey: ["overtime", "policies"] });
  };

  const createMutation = useMutation({
    mutationFn: () => {
      const target =
        form.scope === "EMPLOYEE"
          ? { employeeId: form.targetId }
          : form.scope === "DEPARTMENT"
            ? { departmentId: form.targetId }
            : { branchId: form.targetId };
      return apiRequest<OvertimePolicyAssignment>("/overtime/assignments", {
        method: "POST",
        body: {
          policyId: form.policyId,
          ...target,
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo || null,
          notes: form.notes || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Overtime policy assigned");
      setDialogOpen(false);
      setForm(emptyForm());
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not assign the policy"),
  });

  const endMutation = useMutation({
    mutationFn: (assignment: OvertimePolicyAssignment) =>
      apiRequest<OvertimePolicyAssignment>(`/overtime/assignments/${assignment.id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Overtime assignment ended");
      invalidate();
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiRequestError ? error.message : "Could not end the assignment",
      ),
  });

  const targetOptions =
    form.scope === "EMPLOYEE"
      ? (employeesQuery.data?.items.map((employee) => ({
          label: `${employee.fullName} (${employee.employeeNumber})`,
          value: employee.id,
        })) ?? [])
      : form.scope === "DEPARTMENT"
        ? departmentChoiceOptions(departmentsQuery.data ?? [])
        : (branchesQuery.data?.items.map((branch) => ({
            label: branch.name,
            value: branch.id,
          })) ?? []);

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Overtime policy assignments"
        description="Resolve the right overtime policy by employee, department, or branch"
        actions={
          hasPermission(PERMISSIONS.OVERTIME_ASSIGNMENT_MANAGE) ? (
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
                Loading overtime assignments…
              </Typography>
            </Stack>
          ) : assignmentsQuery.isError ? (
            <Alert tone="error" title="Could not load overtime assignments">
              {assignmentsQuery.error instanceof ApiRequestError
                ? assignmentsQuery.error.message
                : "Unexpected error"}
            </Alert>
          ) : (
            <Table
              columns={[
                {
                  key: "policy",
                  header: "Policy",
                  render: (row) => (
                    <Stack spacing={1}>
                      <Typography variant="bodySmall" className="font-medium">
                        {row.policy.name}
                      </Typography>
                      <Typography variant="caption" color="neutral">
                        {row.policy.code}
                      </Typography>
                    </Stack>
                  ),
                },
                {
                  key: "scope",
                  header: "Scope",
                  render: (row) => (
                    <Badge variant="outlined" color="primary">
                      {SCOPE_LABELS[row.scope]}
                    </Badge>
                  ),
                },
                {
                  key: "target",
                  header: "Assigned to",
                  render: (row) =>
                    row.employee
                      ? `${row.employee.fullName} (${row.employee.employeeNumber})`
                      : (row.department?.name ?? row.branch?.name ?? "—"),
                },
                {
                  key: "effective",
                  header: "Effective",
                  render: (row) =>
                    `${row.effectiveFrom}${row.effectiveTo ? ` – ${row.effectiveTo}` : " onward"}`,
                },
                {
                  key: "notes",
                  header: "Notes",
                  render: (row) => row.notes ?? "—",
                },
                {
                  key: "actions",
                  header: "",
                  align: "right",
                  render: (row) =>
                    hasPermission(PERMISSIONS.OVERTIME_ASSIGNMENT_MANAGE) && !row.effectiveTo ? (
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
                pageSize: OVERTIME_PAGE_SIZE,
                pageCount: assignmentsQuery.data.totalPages,
                total: assignmentsQuery.data.total,
                onChange: setPage,
              }}
              emptyText="No overtime policies assigned yet."
            />
          )}
        </CardBody>
      </Card>

      <Modal
        open={dialogOpen}
        onOpenChange={(open) => setDialogOpen(open)}
        title="Assign overtime policy"
        size="md"
        footer={
          <>
            <Button variant="outlined" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <LoadingButton
              type="submit"
              form="overtime-assignment-form"
              loading={createMutation.isPending}
              disabled={!form.policyId || !form.targetId}
            >
              Assign
            </LoadingButton>
          </>
        }
      >
        <form
          id="overtime-assignment-form"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate();
          }}
        >
          <Stack spacing={14}>
            <Select
              label="Policy"
              value={form.policyId}
              onChange={(value) => setForm({ ...form, policyId: value })}
              options={
                policiesQuery.data?.map((policy) => ({
                  label: `${policy.name} (${policy.code})`,
                  value: policy.id,
                })) ?? []
              }
              fullWidth
            />
            <div className="grid gap-3 md:grid-cols-2">
              <Select
                label="Scope"
                value={form.scope}
                onChange={(value) =>
                  setForm({
                    ...form,
                    scope: value as OvertimeAssignmentScope,
                    targetId: "",
                  })
                }
                options={(Object.keys(SCOPE_LABELS) as OvertimeAssignmentScope[]).map((scope) => ({
                  label: SCOPE_LABELS[scope],
                  value: scope,
                }))}
                fullWidth
              />
              <Select
                label={SCOPE_LABELS[form.scope]}
                value={form.targetId}
                onChange={(value) => setForm({ ...form, targetId: value })}
                options={targetOptions}
                fullWidth
              />
            </div>
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
            <Typography variant="caption" color="neutral">
              Precedence is employee, then department, then branch when more than one assignment
              matches.
            </Typography>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
