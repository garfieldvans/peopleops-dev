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
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  PERMISSIONS,
  type Branch,
  type Department,
  type DepartmentTreeNode,
  type PaginatedResponse,
} from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { FormInput } from "../../components/form-input";
import { FormSelect } from "../../components/form-select";
import { LoadingButton } from "../../components/loading-button";
import {
  departmentSchema,
  nullifyEmpty,
  type DepartmentFormInput,
} from "./organization-schemas";

type FlatNode = Department & { depth: number };

function flatten(nodes: DepartmentTreeNode[], depth = 0): FlatNode[] {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flatten(node.children, depth + 1),
  ]);
}

function buildOptions(nodes: DepartmentTreeNode[], depth = 0): { label: string; value: string }[] {
  return nodes.flatMap((node) => [
    { label: `${"— ".repeat(depth)}${node.name}`, value: node.id },
    ...buildOptions(node.children, depth + 1),
  ]);
}

export function DepartmentsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<
    { mode: "create"; parentId?: string } | { mode: "edit"; department: Department } | null
  >(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const treeQuery = useQuery({
    queryKey: ["departments", "tree"],
    queryFn: () => apiRequest<DepartmentTreeNode[]>("/departments/tree"),
  });

  const removeMutation = useMutation({
    mutationFn: (department: Department) =>
      apiRequest<void>(`/departments/${department.id}`, { method: "DELETE" }),
    onSuccess: (_, department) => {
      toast.success(`${department.name} deleted`);
      void queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not delete"),
  });

  const nodes = flatten(treeQuery.data ?? []).filter((node) =>
    search ? `${node.name} ${node.code}`.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <Stack spacing={20}>
      <Stack direction="row" justify="between" align="center" wrap spacing={12}>
        <Stack spacing={4}>
          <Typography variant="h4" as="h1">
            Departments
          </Typography>
          <Typography variant="bodySmall" color="neutral">
            Organization settings / Departments
          </Typography>
        </Stack>
        {hasPermission(PERMISSIONS.DEPARTMENT_CREATE) ? (
          <Button onClick={() => setDialog({ mode: "create" })}>Add department</Button>
        ) : null}
      </Stack>

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="max-w-sm">
              <Input
                placeholder="Search name or code"
                aria-label="Search departments"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                clearable
                onClear={() => setSearchInput("")}
                fullWidth
              />
            </div>

            {treeQuery.isPending ? (
              <Stack direction="row" spacing={12} align="center">
                <Spinner />
                <Typography variant="bodySmall" color="neutral">
                  Loading departments…
                </Typography>
              </Stack>
            ) : treeQuery.isError ? (
              <Alert tone="error" title="Could not load departments">
                {treeQuery.error instanceof ApiRequestError
                  ? treeQuery.error.message
                  : "Unexpected error"}
              </Alert>
            ) : nodes.length === 0 ? (
              <Typography variant="bodySmall" color="neutral">
                No departments yet.
              </Typography>
            ) : (
              <Stack spacing={0}>
                {nodes.map((department) => (
                  <div
                    key={department.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--nemo-neutral-100)] py-3"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3" style={{ paddingLeft: department.depth * 24 }}>
                      <div
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          department.status === "ACTIVE"
                            ? "bg-[var(--nemo-success-500)]"
                            : "bg-[var(--nemo-neutral-300)]"
                        }`}
                      />
                      <Stack spacing={2} className="min-w-0">
                        <Typography variant="bodySmall" className="font-medium">
                          {department.name}
                        </Typography>
                        <Typography variant="caption" color="neutral">
                          {department.code}
                          {department.branch ? ` · ${department.branch.name}` : ""}
                          {department.head ? ` · Head: ${department.head.name}` : ""}
                        </Typography>
                      </Stack>
                    </div>
                    <Stack direction="row" spacing={8} align="center" wrap>
                      <Badge variant="outlined" color="neutral">
                        {department.positionCount} positions
                      </Badge>
                      <Badge variant="outlined" color="neutral">
                        {department.employeeCount} employees
                      </Badge>
                      {hasPermission(PERMISSIONS.DEPARTMENT_CREATE) ? (
                        <Button
                          variant="text"
                          size="sm"
                          onClick={() => setDialog({ mode: "create", parentId: department.id })}
                        >
                          Add child
                        </Button>
                      ) : null}
                      {hasPermission(PERMISSIONS.DEPARTMENT_UPDATE) ? (
                        <Button
                          variant="text"
                          size="sm"
                          onClick={() => setDialog({ mode: "edit", department })}
                        >
                          Edit
                        </Button>
                      ) : null}
                      {hasPermission(PERMISSIONS.DEPARTMENT_DELETE) ? (
                        <LoadingButton
                          variant="text"
                          size="sm"
                          color="error"
                          loading={
                            removeMutation.isPending &&
                            removeMutation.variables?.id === department.id
                          }
                          onClick={() => removeMutation.mutate(department)}
                        >
                          Delete
                        </LoadingButton>
                      ) : null}
                    </Stack>
                  </div>
                ))}
              </Stack>
            )}
          </Stack>
        </CardBody>
      </Card>

      <DepartmentDialog
        dialog={dialog}
        tree={treeQuery.data ?? []}
        onClose={() => setDialog(null)}
      />
    </Stack>
  );
}

function DepartmentDialog({
  dialog,
  tree,
  onClose,
}: {
  dialog: { mode: "create"; parentId?: string } | { mode: "edit"; department: Department } | null;
  tree: DepartmentTreeNode[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const open = dialog !== null;
  const editing = dialog?.mode === "edit" ? dialog.department : null;

  const branchesQuery = useQuery({
    queryKey: ["branches", "options"],
    queryFn: () => apiRequest<PaginatedResponse<Branch>>("/branches?page=1&pageSize=100"),
    enabled: open,
  });

  const { control, handleSubmit, reset, formState } = useForm<DepartmentFormInput>({
    resolver: zodResolver(departmentSchema),
  });

  useEffect(() => {
    if (!open) return;
    reset(
      editing
        ? {
            name: editing.name,
            code: editing.code,
            description: editing.description ?? "",
            branchId: editing.branchId,
            parentId: editing.parentId,
          }
        : {
            name: "",
            code: "",
            description: "",
            branchId: null,
            parentId: dialog?.mode === "create" ? (dialog.parentId ?? null) : null,
          },
    );
  }, [open, editing, dialog, reset]);

  const mutation = useMutation({
    mutationFn: (values: DepartmentFormInput) => {
      const body = nullifyEmpty(values as Record<string, unknown>);
      return editing
        ? apiRequest<Department>(`/departments/${editing.id}`, { method: "PATCH", body })
        : apiRequest<Department>("/departments", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(editing ? "Department updated" : "Department created");
      void queryClient.invalidateQueries({ queryKey: ["departments"] });
      onClose();
    },
  });

  const branchOptions = [
    { label: "No branch", value: "" },
    ...(branchesQuery.data?.items.map((branch) => ({ label: branch.name, value: branch.id })) ?? []),
  ];

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={editing ? "Edit department" : "Add department"}
      description="Departments form a hierarchy; pick a parent to nest the new department."
      size="md"
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            form="department-form"
            loading={mutation.isPending || formState.isSubmitting}
          >
            {editing ? "Save changes" : "Create department"}
          </LoadingButton>
        </>
      }
    >
      <form
        id="department-form"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <Stack spacing={16}>
          {mutation.isError ? (
            <Alert tone="error" title="Could not save the department">
              {mutation.error instanceof ApiRequestError
                ? mutation.error.message
                : "Unexpected error"}
            </Alert>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput control={control} name="name" label="Name" fullWidth required />
            <FormInput control={control} name="code" label="Code" fullWidth required />
          </div>
          <FormSelect
            control={control}
            name="branchId"
            label="Branch"
            options={branchOptions}
            fullWidth
          />
          <FormSelect
            control={control}
            name="parentId"
            label="Parent department"
            options={[{ label: "None (top level)", value: "" }, ...buildOptions(tree)]}
            fullWidth
          />
          <FormInput control={control} name="description" label="Description" fullWidth />
        </Stack>
      </form>
    </Modal>
  );
}
