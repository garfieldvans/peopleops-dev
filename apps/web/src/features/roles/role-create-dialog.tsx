import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Checkbox,
  Modal,
  Spinner,
  Stack,
  Typography,
} from "@nemo-ui/ui";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { PermissionSummary, RoleDetail } from "@peopleops/shared-types";
import { roleFormSchema, type RoleFormInput } from "@peopleops/validators";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import { FormInput } from "../../components/form-input";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoleCreateDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [permissionIds, setPermissionIds] = useState<string[]>([]);

  const permissionsQuery = useQuery({
    queryKey: ["permissions"],
    queryFn: () => apiRequest<PermissionSummary[]>("/permissions"),
    enabled: open,
  });

  const {
    control,
    handleSubmit,
    reset,
  } = useForm<RoleFormInput>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: { name: "", code: "", description: "" },
  });

  useEffect(() => {
    if (!open) {
      reset();
      setPermissionIds([]);
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: RoleFormInput) =>
      apiRequest<RoleDetail>("/roles", {
        method: "POST",
        body: {
          name: values.name,
          code: values.code,
          description: values.description || undefined,
          permissionIds,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
      onOpenChange(false);
    },
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Create role"
      description="Custom roles can be granted any subset of permissions."
      footer={
        <>
          <Button variant="outlined" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton type="submit" form="create-role-form" loading={mutation.isPending}>
            Create role
          </LoadingButton>
        </>
      }
    >
      <form
        id="create-role-form"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <Stack spacing={16}>
          {mutation.isError ? (
            <Alert tone="error" title="Could not create the role">
              {mutation.error instanceof ApiRequestError ? mutation.error.message : "Unexpected error"}
            </Alert>
          ) : null}
          <FormInput control={control} name="name" label="Name" fullWidth required />
          <FormInput
            control={control}
            name="code"
            label="Code"
            fullWidth
            required
            helperText="Uppercase letters, digits and underscores, e.g. RECRUITER"
          />
          <FormInput control={control} name="description" label="Description" fullWidth />

          <Stack spacing={8}>
            <Typography variant="bodySmall" className="font-medium">
              Permissions
            </Typography>
            {permissionsQuery.isPending ? (
              <Spinner />
            ) : (
              permissionsQuery.data?.map((permission) => (
                <Checkbox
                  key={permission.id}
                  label={permission.name}
                  helperText={permission.code}
                  checked={permissionIds.includes(permission.id)}
                  onChange={() =>
                    setPermissionIds((current) =>
                      current.includes(permission.id)
                        ? current.filter((id) => id !== permission.id)
                        : [...current, permission.id],
                    )
                  }
                />
              ))
            )}
          </Stack>
        </Stack>
      </form>
    </Modal>
  );
}
