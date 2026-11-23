import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Modal, Stack } from "@nemo-ui/ui";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { UserSummary } from "@peopleops/shared-types";
import { updateUserSchema, type UpdateUserInput } from "@peopleops/validators";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import { FormInput } from "../../components/form-input";

interface Props {
  user: UserSummary | null;
  onOpenChange: (open: boolean) => void;
}

export function UserEditDialog({ user, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
  } = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { name: "", email: "" },
  });

  useEffect(() => {
    if (user) {
      reset({ name: user.name, email: user.email });
    }
  }, [user, reset]);

  const mutation = useMutation({
    mutationFn: (values: UpdateUserInput) =>
      apiRequest<UserSummary>(`/users/${user?.id}`, { method: "PATCH", body: values }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      onOpenChange(false);
    },
  });

  if (!user) {
    return null;
  }

  return (
    <Modal
      open
      onOpenChange={onOpenChange}
      title="Edit user"
      description={user.email}
      footer={
        <>
          <Button variant="outlined" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton type="submit" form="edit-user-form" loading={mutation.isPending}>
            Save changes
          </LoadingButton>
        </>
      }
    >
      <form
        id="edit-user-form"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <Stack spacing={16}>
          {mutation.isError ? (
            <Alert tone="error" title="Could not update the account">
              {mutation.error instanceof ApiRequestError ? mutation.error.message : "Unexpected error"}
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
        </Stack>
      </form>
    </Modal>
  );
}
