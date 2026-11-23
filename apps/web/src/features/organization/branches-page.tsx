import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Divider,
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
  type PaginatedResponse,
} from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { FormInput } from "../../components/form-input";
import { LoadingButton } from "../../components/loading-button";
import { branchSchema, nullifyEmpty, type BranchFormInput } from "./organization-schemas";

export function BranchesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; branch: Branch } | null>(
    null,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const branchesQuery = useQuery({
    queryKey: ["branches", search],
    queryFn: () => {
      const params = new URLSearchParams({ page: "1", pageSize: "100" });
      if (search) params.set("search", search);
      return apiRequest<PaginatedResponse<Branch>>(`/branches?${params.toString()}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (branch: Branch) => apiRequest<void>(`/branches/${branch.id}`, { method: "DELETE" }),
    onSuccess: (_, branch) => {
      toast.success(`${branch.name} deleted`);
      void queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiRequestError ? error.message : "Could not delete the branch");
    },
  });

  const branches = branchesQuery.data?.items ?? [];
  const activeCount = branches.filter((branch) => branch.status === "ACTIVE").length;

  return (
    <Stack spacing={20}>
      <Stack direction="row" justify="between" align="center" wrap spacing={12}>
        <Stack spacing={4}>
          <Typography variant="h4" as="h1">
            Branches
          </Typography>
          <Typography variant="bodySmall" color="neutral">
            Organization settings / Branches
          </Typography>
        </Stack>
        {hasPermission(PERMISSIONS.BRANCH_CREATE) ? (
          <Button onClick={() => setDialog({ mode: "create" })}>Add branch</Button>
        ) : null}
      </Stack>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total branches" value={branches.length} />
        <Stat label="Active" value={activeCount} />
        <Stat label="Inactive" value={branches.length - activeCount} />
        <Stat
          label="Employees assigned"
          value={branches.reduce((total, branch) => total + branch.employeeCount, 0)}
        />
      </div>

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="max-w-sm">
              <Input
                placeholder="Search name, code or city"
                aria-label="Search branches"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                clearable
                onClear={() => setSearchInput("")}
                fullWidth
              />
            </div>

            {branchesQuery.isPending ? (
              <Stack direction="row" spacing={12} align="center">
                <Spinner />
                <Typography variant="bodySmall" color="neutral">
                  Loading branches…
                </Typography>
              </Stack>
            ) : branchesQuery.isError ? (
              <Alert tone="error" title="Could not load branches">
                {branchesQuery.error instanceof ApiRequestError
                  ? branchesQuery.error.message
                  : "Unexpected error"}
              </Alert>
            ) : branches.length === 0 ? (
              <Typography variant="bodySmall" color="neutral">
                No branches match this search.
              </Typography>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {branches.map((branch) => (
                  <Card key={branch.id} variant="outlined" padding="md">
                    <CardBody>
                      <Stack spacing={12}>
                        <Stack direction="row" justify="between" align="start" spacing={8}>
                          <Stack spacing={4}>
                            <Typography variant="bodySmall" className="font-semibold">
                              {branch.name}
                            </Typography>
                            <Typography variant="caption" color="neutral">
                              {branch.code}
                            </Typography>
                          </Stack>
                          <Badge
                            variant="filled"
                            color={branch.status === "ACTIVE" ? "success" : "neutral"}
                          >
                            {branch.status.toLowerCase()}
                          </Badge>
                        </Stack>
                        <Divider />
                        <Stack spacing={6}>
                          <Row label="City" value={branch.city} />
                          <Row label="Phone" value={branch.phone} />
                          <Row label="Departments" value={String(branch.departmentCount)} />
                          <Row label="Employees" value={String(branch.employeeCount)} />
                        </Stack>
                        <Stack direction="row" spacing={4} justify="end">
                          {hasPermission(PERMISSIONS.BRANCH_UPDATE) ? (
                            <Button
                              variant="text"
                              size="sm"
                              onClick={() => setDialog({ mode: "edit", branch })}
                            >
                              Edit
                            </Button>
                          ) : null}
                          {hasPermission(PERMISSIONS.BRANCH_DELETE) ? (
                            <LoadingButton
                              variant="text"
                              size="sm"
                              color="error"
                              loading={deleteMutation.isPending && deleteMutation.variables?.id === branch.id}
                              onClick={() => deleteMutation.mutate(branch)}
                            >
                              Delete
                            </LoadingButton>
                          ) : null}
                        </Stack>
                      </Stack>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </Stack>
        </CardBody>
      </Card>

      <BranchDialog dialog={dialog} onClose={() => setDialog(null)} />
    </Stack>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card variant="elevated" padding="md">
      <CardBody>
        <Stack spacing={4}>
          <Typography variant="caption" color="neutral">
            {label}
          </Typography>
          <Typography variant="h5" as="p">
            {value}
          </Typography>
        </Stack>
      </CardBody>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Typography variant="caption" color="neutral">
        {label}
      </Typography>
      <Typography variant="bodySmall">{value || "—"}</Typography>
    </div>
  );
}

function BranchDialog({
  dialog,
  onClose,
}: {
  dialog: { mode: "create" } | { mode: "edit"; branch: Branch } | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const open = dialog !== null;
  const editing = dialog?.mode === "edit" ? dialog.branch : null;

  const { control, handleSubmit, reset, formState } = useForm<BranchFormInput>({
    resolver: zodResolver(branchSchema),
  });

  useEffect(() => {
    if (!open) return;
    reset(
      editing
        ? {
            name: editing.name,
            code: editing.code,
            address: editing.address ?? "",
            city: editing.city ?? "",
            province: editing.province ?? "",
            postalCode: editing.postalCode ?? "",
            phone: editing.phone ?? "",
            email: editing.email ?? "",
          }
        : { name: "", code: "", address: "", city: "", province: "", postalCode: "", phone: "", email: "" },
    );
  }, [open, editing, reset]);

  const mutation = useMutation({
    mutationFn: (values: BranchFormInput) => {
      const body = nullifyEmpty(values as Record<string, unknown>);
      return editing
        ? apiRequest<Branch>(`/branches/${editing.id}`, { method: "PATCH", body })
        : apiRequest<Branch>("/branches", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(editing ? "Branch updated" : "Branch created");
      void queryClient.invalidateQueries({ queryKey: ["branches"] });
      onClose();
    },
  });

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={editing ? "Edit branch" : "Add branch"}
      description="Branches group departments and employees by location."
      size="md"
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            form="branch-form"
            loading={mutation.isPending || formState.isSubmitting}
          >
            {editing ? "Save changes" : "Create branch"}
          </LoadingButton>
        </>
      }
    >
      <form id="branch-form" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
        <Stack spacing={16}>
          {mutation.isError ? (
            <Alert tone="error" title="Could not save the branch">
              {mutation.error instanceof ApiRequestError
                ? mutation.error.message
                : "Unexpected error"}
            </Alert>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput control={control} name="name" label="Name" fullWidth required />
            <FormInput control={control} name="code" label="Code" fullWidth required />
            <FormInput control={control} name="city" label="City" fullWidth />
            <FormInput control={control} name="province" label="Province" fullWidth />
            <FormInput control={control} name="phone" label="Phone" fullWidth />
            <FormInput control={control} name="email" label="Email" type="email" fullWidth />
          </div>
          <FormInput control={control} name="address" label="Address" fullWidth />
        </Stack>
      </form>
    </Modal>
  );
}
