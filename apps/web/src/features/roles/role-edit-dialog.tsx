import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Modal, Stack } from "@nemo-ui/ui";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { RoleDetail } from "@peopleops/shared-types";
import { roleFormSchema, type RoleFormInput } from "@peopleops/validators";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import { FormInput } from "../../components/form-input";

interface Props {
  role: RoleDetail | null;
  onOpenChange: (open: boolean) => void;
}

export function RoleEditDialog({ role, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
  } = useForm<RoleFormInput>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: { name: "", code: "", description: "" },
  });

  useEffect(() => {
    if (role) {
      reset({ name: role.name, code: role.code, description: role.description ?? "" });
    }
  }, [role, reset]);

  const mutation = useMutation({
    mutationFn: (values: RoleFormInput) =>
      apiRequest<RoleDetail>(`/roles/${role?.id}`, {
        method: "PATCH",
        body: { name: values.name, description: values.description || undefined },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
      onOpenChange(false);
    },
  });

  if (!role) return null;

  return (
    <Modal
      open
      onOpenChange={onOpenChange}
      title="Edit role"
      description={role.code}
      footer={
        <>
          <Button variant="outlined" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton type="submit" form="edit-role-form" loading={mutation.isPending}>
            Save changes
          </LoadingButton>
        </>
      }
    >
      <form
        id="edit-role-form"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <Stack spacing={16}>
          {mutation.isError ? (
            <Alert tone="error" title="Could not update the role">
              {mutation.error instanceof ApiRequestError ? mutation.error.message : "Unexpected error"}
            </Alert>
          ) : null}
          <FormInput control={control} name="name" label="Name" fullWidth required />
          <FormInput control={control} name="code" label="Code" fullWidth disabled />
          <FormInput control={control} name="description" label="Description" fullWidth />
        </Stack>
      </form>
    </Modal>
  );
}
