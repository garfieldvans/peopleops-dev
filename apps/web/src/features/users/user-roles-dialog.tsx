import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Checkbox, Modal, Spinner, Stack } from "@nemo-ui/ui";
import { useEffect, useState } from "react";
import type { PaginatedResponse, RoleDetail, UserSummary } from "@peopleops/shared-types";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";

interface Props {
  user: UserSummary | null;
  onOpenChange: (open: boolean) => void;
}

export function UserRolesDialog({ user, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [roleIds, setRoleIds] = useState<string[]>([]);

  useEffect(() => {
    setRoleIds(user?.roles.map((role) => role.id) ?? []);
  }, [user]);

  const rolesQuery = useQuery({
    queryKey: ["roles", "options"],
    queryFn: () => apiRequest<PaginatedResponse<RoleDetail>>("/roles?pageSize=100"),
    enabled: user !== null,
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest<UserSummary>(`/users/${user?.id}/roles`, {
        method: "PUT",
        body: { roleIds },
      }),
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
      title="Assign roles"
      description={user.email}
      footer={
        <>
          <Button variant="outlined" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton onClick={() => mutation.mutate()} loading={mutation.isPending}>
            Save roles
          </LoadingButton>
        </>
      }
    >
      <Stack spacing={12}>
        {mutation.isError ? (
          <Alert tone="error" title="Could not update roles">
            {mutation.error instanceof ApiRequestError ? mutation.error.message : "Unexpected error"}
          </Alert>
        ) : null}
        {rolesQuery.isPending ? (
          <Spinner />
        ) : (
          rolesQuery.data?.items.map((role) => (
            <Checkbox
              key={role.id}
              label={`${role.name} (${role.code})`}
              checked={roleIds.includes(role.id)}
              onChange={() =>
                setRoleIds((current) =>
                  current.includes(role.id)
                    ? current.filter((id) => id !== role.id)
                    : [...current, role.id],
                )
              }
            />
          ))
        )}
      </Stack>
    </Modal>
  );
}
