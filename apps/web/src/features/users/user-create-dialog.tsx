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
  useToast,
} from "@nemo-ui/ui";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { PaginatedResponse, RoleDetail, UserSummary } from "@peopleops/shared-types";
import { createUserSchema } from "@peopleops/validators";
import type { z } from "zod";

type CreateUserFormInput = z.input<typeof createUserSchema>;
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import { FormInput } from "../../components/form-input";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserCreateDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [roleIds, setRoleIds] = useState<string[]>([]);

  const rolesQuery = useQuery({
    queryKey: ["roles", "options"],
    queryFn: () => apiRequest<PaginatedResponse<RoleDetail>>("/roles?pageSize=100"),
    enabled: open,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<CreateUserFormInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: "", email: "", password: "", roleIds: [] },
  });

  useEffect(() => {
    if (!open) {
      reset();
      setRoleIds([]);
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: CreateUserFormInput) =>
      apiRequest<UserSummary>("/users", {
        method: "POST",
        body: { ...values, roleIds },
      }),
    onSuccess: (user) => {
      toast.success(`Account created for ${user.email}`);
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      onOpenChange(false);
    },
  });

  function toggleRole(id: string) {
    setRoleIds((current) =>
      current.includes(id) ? current.filter((roleId) => roleId !== id) : [...current, id],
    );
  }

  async function onSubmit(values: CreateUserFormInput) {
    try {
      await mutation.mutateAsync(values);
    } catch (error) {
      // Surfaced below the form.
      console.error(error);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Create user"
      description="The user signs in with this email and initial password."
      size="md"
      footer={
        <>
          <Button variant="outlined" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            form="create-user-form"
            loading={isSubmitting || mutation.isPending}
          >
            Create user
          </LoadingButton>
        </>
      }
    >
      <form id="create-user-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={16}>
          {mutation.isError ? (
            <Alert tone="error" title="Could not create the account">
              {mutation.error instanceof ApiRequestError
                ? mutation.error.message
                : "Unexpected error"}
            </Alert>
          ) : null}

          <FormInput control={control} name="name" label="Full name" fullWidth required />
          <FormInput
            control={control}
            name="email"
            label="Email"
            type="email"
            fullWidth
            required
          />
          <FormInput
            control={control}
            name="password"
            label="Initial password"
            type="password"
            fullWidth
            required
            helperText="At least 12 characters with a letter and a digit."
          />

          <Stack spacing={8}>
            <Typography variant="bodySmall" className="font-medium">
              Roles
            </Typography>
            {rolesQuery.isPending ? (
              <Spinner />
            ) : (
              rolesQuery.data?.items.map((role) => (
                <Checkbox
                  key={role.id}
                  label={`${role.name} (${role.code})`}
                  checked={roleIds.includes(role.id)}
                  onChange={() => toggleRole(role.id)}
                />
              ))
            )}
          </Stack>
        </Stack>
      </form>
    </Modal>
  );
}
