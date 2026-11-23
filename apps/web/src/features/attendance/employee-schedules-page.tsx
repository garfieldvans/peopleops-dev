import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
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
import {
  PERMISSIONS,
  type BulkAssignmentResult,
  type EmployeeScheduleAssignment,
  type PaginatedResponse,
  type Shift,
  type WorkSchedule,
} from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import {
  departmentChoiceOptions,
  useBranchOptions,
  useDepartmentTree,
} from "../employees/employee-options";
import { todayKey, useAttendanceEmployees } from "./attendance-utils";

type TargetMode = "employee" | "branch" | "department";

export function EmployeeSchedulesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [targetMode, setTargetMode] = useState<TargetMode>("employee");
  const [targetId, setTargetId] = useState("");
  const [workScheduleId, setWorkScheduleId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(todayKey());
  const [effectiveTo, setEffectiveTo] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [closePrevious, setClosePrevious] = useState(true);
  const [branchFilter, setBranchFilter] = useState("");
  const [page, setPage] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);

  const branchesQuery = useBranchOptions();
  const departmentsQuery = useDepartmentTree();
  const employeesQuery = useAttendanceEmployees(dialogOpen);
  const schedulesQuery = useQuery({
    queryKey: ["work-schedules", "active-options"],
    queryFn: () =>
      apiRequest<PaginatedResponse<WorkSchedule>>(
        "/work-schedules?status=ACTIVE&page=1&pageSize=100",
      ),
    enabled: dialogOpen,
  });
  const shiftsQuery = useQuery({
    queryKey: ["shifts", "active-options"],
    queryFn: () =>
      apiRequest<PaginatedResponse<Shift>>("/shifts?status=ACTIVE&page=1&pageSize=100"),
    enabled: dialogOpen,
  });

  useEffect(() => {
    setTargetId("");
  }, [targetMode]);

  const params = new URLSearchParams({
    page: String(page),
    pageSize: "20",
    activeOn: todayKey(),
  });
  if (branchFilter) params.set("branchId", branchFilter);

  const assignmentsQuery = useQuery({
    queryKey: ["employee-schedules", params.toString()],
    queryFn: () =>
      apiRequest<PaginatedResponse<EmployeeScheduleAssignment>>(
        `/employee-schedules?${params.toString()}`,
      ),
  });

  const mutation = useMutation<EmployeeScheduleAssignment | BulkAssignmentResult, Error, void>({
    mutationFn: () => {
      if (!workScheduleId) throw new ApiRequestError("Choose a work schedule", 400, "INVALID");
      if (!targetId) throw new ApiRequestError("Choose an assignment target", 400, "INVALID");
      const common = {
        workScheduleId,
        shiftId: shiftId || null,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        changeReason: changeReason || null,
        closePrevious,
      };
      if (targetMode === "employee") {
        return apiRequest<EmployeeScheduleAssignment>(`/employees/${targetId}/schedules`, {
          method: "POST",
          body: common,
        });
      }
      return apiRequest<BulkAssignmentResult>("/employee-schedules/bulk", {
        method: "POST",
        body: {
          ...common,
          ...(targetMode === "branch" ? { branchId: targetId } : { departmentId: targetId }),
        },
      });
    },
    onSuccess: (result) => {
      const count = "assigned" in result ? result.assigned : 1;
      toast.success(`Schedule assigned to ${count} employee${count === 1 ? "" : "s"}`);
      void queryClient.invalidateQueries({ queryKey: ["employee-schedules"] });
      void queryClient.invalidateQueries({ queryKey: ["work-schedules"] });
      setDialogOpen(false);
      setTargetId("");
      setFormError(null);
    },
    onError: (error) => {
      const message =
        error instanceof ApiRequestError ? error.message : "Could not assign the schedule";
      setFormError(message);
      toast.error(message);
    },
  });

  const options = [
    ...(targetMode === "employee"
      ? employeesQuery.data?.items.map((employee) => ({
          label: `${employee.fullName} (${employee.employeeNumber})`,
          value: employee.id,
        })) ?? []
      : targetMode === "branch"
        ? branchesQuery.data?.items.map((branch) => ({
            label: branch.name,
            value: branch.id,
          })) ?? []
        : departmentChoiceOptions(departmentsQuery.data ?? [])),
  ];

  return (
    <Stack spacing={20}>
      <Stack direction="row" justify="between" align="center" wrap spacing={12}>
        <Stack spacing={4}>
          <Typography variant="h4" as="h1">
            Schedule assignments
          </Typography>
          <Typography variant="bodySmall" color="neutral">
            Effective-dated schedules by employee, branch, or department
          </Typography>
        </Stack>
        {hasPermission(PERMISSIONS.WORK_SCHEDULE_UPDATE) ? (
          <Button onClick={() => setDialogOpen(true)}>Assign schedule</Button>
        ) : null}
      </Stack>

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="max-w-sm">
              <Select
                aria-label="Filter assignments by branch"
                value={branchFilter}
                onChange={(value) => {
                  setBranchFilter(value);
                  setPage(1);
                }}
                options={[
                  { label: "All branches", value: "" },
                  ...(branchesQuery.data?.items.map((branch) => ({
                    label: branch.name,
                    value: branch.id,
                  })) ?? []),
                ]}
                fullWidth
              />
            </div>

            {assignmentsQuery.isPending ? (
              <Stack direction="row" spacing={12} align="center">
                <Spinner />
                <Typography variant="bodySmall" color="neutral">
                  Loading assignments…
                </Typography>
              </Stack>
            ) : assignmentsQuery.isError ? (
              <Alert tone="error" title="Could not load schedule assignments">
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
                      <Stack spacing={2}>
                        <Typography variant="bodySmall" className="font-medium">
                          {row.employee.fullName}
                        </Typography>
                        <Typography variant="caption" color="neutral">
                          {row.employee.employeeNumber}
                        </Typography>
                      </Stack>
                    ),
                  },
                  { key: "schedule", header: "Schedule", render: (row) => row.workSchedule.name },
                  {
                    key: "shift",
                    header: "Shift",
                    render: (row) =>
                      row.shift ? (
                        <Badge variant="outlined" color="primary">
                          {row.shift.name}
                        </Badge>
                      ) : (
                        "—"
                      ),
                  },
                  {
                    key: "effective",
                    header: "Effective",
                    render: (row) =>
                      `${row.effectiveFrom} → ${row.effectiveTo ?? "open-ended"}`,
                  },
                  { key: "reason", header: "Reason", render: (row) => row.changeReason ?? "—" },
                ]}
                data={assignmentsQuery.data.items}
                rowKey={(row) => row.id}
                pagination={{
                  page,
                  pageSize: 20,
                  pageCount: assignmentsQuery.data.totalPages,
                  total: assignmentsQuery.data.total,
                  onChange: setPage,
                }}
                emptyText="No active assignments match this filter."
              />
            )}
          </Stack>
        </CardBody>
      </Card>

      <Modal
        open={dialogOpen}
        onOpenChange={(next) => !next && setDialogOpen(false)}
        title="Assign schedule"
        size="md"
        footer={
          <>
            <Button variant="outlined" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <LoadingButton type="submit" form="assignment-form" loading={mutation.isPending}>
              Assign
            </LoadingButton>
          </>
        }
      >
        <form
          id="assignment-form"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <Stack spacing={14}>
            {formError ? (
              <Alert tone="error" title="Could not assign the schedule">
                {formError}
              </Alert>
            ) : null}
            <Select
              label="Assign to"
              value={targetMode}
              onChange={(value) => setTargetMode(value as TargetMode)}
              options={[
                { label: "One employee", value: "employee" },
                { label: "A branch", value: "branch" },
                { label: "A department", value: "department" },
              ]}
              fullWidth
            />
            <Select
              label={targetMode === "employee" ? "Employee" : targetMode === "branch" ? "Branch" : "Department"}
              placeholder="Choose a target"
              value={targetId}
              onChange={setTargetId}
              options={options}
              fullWidth
            />
            <Select
              label="Work schedule"
              placeholder="Choose a schedule"
              value={workScheduleId}
              onChange={setWorkScheduleId}
              options={
                schedulesQuery.data?.items.map((schedule) => ({
                  label: `${schedule.name} (${schedule.code})`,
                  value: schedule.id,
                })) ?? []
              }
              fullWidth
            />
            <Select
              label="Shift (optional)"
              placeholder="No shift override"
              value={shiftId}
              onChange={setShiftId}
              options={[
                { label: "No shift override", value: "" },
                ...(shiftsQuery.data?.items.map((shift) => ({
                  label: `${shift.name} (${shift.startTime}–${shift.endTime})`,
                  value: shift.id,
                })) ?? []),
              ]}
              fullWidth
            />
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label="Effective from"
                type="date"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
                required
                fullWidth
              />
              <Input
                label="Effective to (optional)"
                type="date"
                value={effectiveTo}
                onChange={(event) => setEffectiveTo(event.target.value)}
                fullWidth
              />
            </div>
            <Input
              label="Change reason"
              value={changeReason}
              onChange={(event) => setChangeReason(event.target.value)}
              fullWidth
            />
            <Checkbox
              label="Close the previous open assignment the day before"
              checked={closePrevious}
              onChange={(event) => setClosePrevious(event.target.checked)}
            />
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
