import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  PERMISSIONS,
  type DepartmentTreeNode,
  type JobLevel,
  type PaginatedResponse,
  type Position,
} from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { FormInput } from "../../components/form-input";
import { FormSelect } from "../../components/form-select";
import { LoadingButton } from "../../components/loading-button";
import {
  nullifyEmpty,
  positionSchema,
  type PositionFormInput,
} from "./organization-schemas";

const PAGE_SIZE = 10;

export function departmentOptions(
  nodes: DepartmentTreeNode[],
  depth = 0,
): { label: string; value: string }[] {
  return nodes.flatMap((node) => [
    { label: `${"— ".repeat(depth)}${node.name}`, value: node.id },
    ...departmentOptions(node.children, depth + 1),
  ]);
}

export function PositionsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; position: Position } | null>(
    null,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const positionsQuery = useQuery({
    queryKey: ["positions", page, search],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set("search", search);
      return apiRequest<PaginatedResponse<Position>>(`/positions?${params.toString()}`);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (position: Position) =>
      apiRequest<void>(`/positions/${position.id}`, { method: "DELETE" }),
    onSuccess: (_, position) => {
      toast.success(`${position.title} deleted`);
      void queryClient.invalidateQueries({ queryKey: ["positions"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not delete"),
  });

  return (
    <Stack spacing={20}>
      <Stack direction="row" justify="between" align="center" wrap spacing={12}>
        <Stack spacing={4}>
          <Typography variant="h4" as="h1">
            Positions
          </Typography>
          <Typography variant="bodySmall" color="neutral">
            Organization settings / Positions
          </Typography>
        </Stack>
        {hasPermission(PERMISSIONS.POSITION_CREATE) ? (
          <Button onClick={() => setDialog({ mode: "create" })}>Add position</Button>
        ) : null}
      </Stack>

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="max-w-sm">
              <Input
                placeholder="Search title or code"
                aria-label="Search positions"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                clearable
                onClear={() => setSearchInput("")}
                fullWidth
              />
            </div>

            {positionsQuery.isPending ? (
              <Stack direction="row" spacing={12} align="center">
                <Spinner />
                <Typography variant="bodySmall" color="neutral">
                  Loading positions…
                </Typography>
              </Stack>
            ) : positionsQuery.isError ? (
              <Alert tone="error" title="Could not load positions">
                {positionsQuery.error instanceof ApiRequestError
                  ? positionsQuery.error.message
                  : "Unexpected error"}
              </Alert>
            ) : (
              <Table
                columns={[
                  {
                    key: "title",
                    header: "Position",
                    render: (position) => (
                      <Stack spacing={2}>
                        <Typography variant="bodySmall" className="font-medium">
                          {position.title}
                        </Typography>
                        <Typography variant="caption" color="neutral">
                          {position.code}
                        </Typography>
                      </Stack>
                    ),
                  },
                  {
                    key: "department",
                    header: "Department",
                    render: (position) => position.department.name,
                  },
                  {
                    key: "jobLevel",
                    header: "Job level",
                    render: (position) =>
                      position.jobLevel ? (
                        <Badge variant="outlined" color="neutral">
                          {position.jobLevel.name}
                        </Badge>
                      ) : (
                        "—"
                      ),
                  },
                  {
                    key: "employees",
                    header: "Employees",
                    render: (position) => position.employeeCount,
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (position) => (
                      <Badge
                        variant="filled"
                        color={position.status === "ACTIVE" ? "success" : "neutral"}
                      >
                        {position.status.toLowerCase()}
                      </Badge>
                    ),
                  },
                  {
                    key: "actions",
                    header: "",
                    align: "right",
                    render: (position) => (
                      <Stack direction="row" spacing={4} justify="end">
                        {hasPermission(PERMISSIONS.POSITION_UPDATE) ? (
                          <Button
                            variant="text"
                            size="sm"
                            onClick={() => setDialog({ mode: "edit", position })}
                          >
                            Edit
                          </Button>
                        ) : null}
                        {hasPermission(PERMISSIONS.POSITION_DELETE) ? (
                          <LoadingButton
                            variant="text"
                            size="sm"
                            color="error"
                            loading={
                              removeMutation.isPending &&
                              removeMutation.variables?.id === position.id
                            }
                            onClick={() => removeMutation.mutate(position)}
                          >
                            Delete
                          </LoadingButton>
                        ) : null}
                      </Stack>
                    ),
                  },
                ]}
                data={positionsQuery.data.items}
                rowKey={(position) => position.id}
                pagination={{
                  page,
                  pageSize: PAGE_SIZE,
                  pageCount: positionsQuery.data.totalPages,
                  total: positionsQuery.data.total,
                  onChange: setPage,
                }}
                emptyText="No positions match this search."
              />
            )}
          </Stack>
        </CardBody>
      </Card>

      <PositionDialog dialog={dialog} onClose={() => setDialog(null)} />
    </Stack>
  );
}

function PositionDialog({
  dialog,
  onClose,
}: {
  dialog: { mode: "create" } | { mode: "edit"; position: Position } | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const open = dialog !== null;
  const editing = dialog?.mode === "edit" ? dialog.position : null;

  const departmentsQuery = useQuery({
    queryKey: ["departments", "tree"],
    queryFn: () => apiRequest<DepartmentTreeNode[]>("/departments/tree"),
    enabled: open,
  });
  const jobLevelsQuery = useQuery({
    queryKey: ["job-levels", "options"],
    queryFn: () => apiRequest<JobLevel[]>("/job-levels?status=ACTIVE"),
    enabled: open,
  });

  const { control, handleSubmit, reset, formState } = useForm<PositionFormInput>({
    resolver: zodResolver(positionSchema),
  });

  useEffect(() => {
    if (!open) return;
    reset(
      editing
        ? {
            title: editing.title,
            code: editing.code,
            description: editing.description ?? "",
            departmentId: editing.departmentId,
            jobLevelId: editing.jobLevelId,
          }
        : {
            title: "",
            code: "",
            description: "",
            departmentId: departmentsQuery.data?.[0]?.id ?? "",
            jobLevelId: null,
          },
    );
    // Intentionally depends on the dialog session, not on the queried options.
  }, [open, editing, reset]);

  const mutation = useMutation({
    mutationFn: (values: PositionFormInput) => {
      const body = nullifyEmpty(values as Record<string, unknown>);
      return editing
        ? apiRequest<Position>(`/positions/${editing.id}`, { method: "PATCH", body })
        : apiRequest<Position>("/positions", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(editing ? "Position updated" : "Position created");
      void queryClient.invalidateQueries({ queryKey: ["positions"] });
      onClose();
    },
  });

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={editing ? "Edit position" : "Add position"}
      description="Every position belongs to a department."
      size="md"
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            form="position-form"
            loading={mutation.isPending || formState.isSubmitting}
          >
            {editing ? "Save changes" : "Create position"}
          </LoadingButton>
        </>
      }
    >
      <form id="position-form" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
        <Stack spacing={16}>
          {mutation.isError ? (
            <Alert tone="error" title="Could not save the position">
              {mutation.error instanceof ApiRequestError
                ? mutation.error.message
                : "Unexpected error"}
            </Alert>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput control={control} name="title" label="Title" fullWidth required />
            <FormInput control={control} name="code" label="Code" fullWidth required />
          </div>
          <FormSelect
            control={control}
            name="departmentId"
            label="Department"
            options={departmentOptions(departmentsQuery.data ?? [])}
            fullWidth
            required
          />
          <FormSelect
            control={control}
            name="jobLevelId"
            label="Job level"
            options={[
              { label: "No job level", value: "" },
              ...(jobLevelsQuery.data?.map((level) => ({ label: level.name, value: level.id })) ??
                []),
            ]}
            fullWidth
          />
          <FormInput control={control} name="description" label="Description" fullWidth />
        </Stack>
      </form>
    </Modal>
  );
}
