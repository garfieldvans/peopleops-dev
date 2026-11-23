import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Checkbox, Modal, Spinner, Stack } from "@nemo-ui/ui";
import { useEffect, useState } from "react";
import type { PermissionSummary, RoleDetail } from "@peopleops/shared-types";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";

interface Props {
  role: RoleDetail | null;
  onOpenChange: (open: boolean) => void;
}

export function RolePermissionsDialog({ role, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [permissionIds, setPermissionIds] = useState<string[]>([]);

  useEffect(() => {
    setPermissionIds(role?.permissions.map((permission) => permission.id) ?? []);
  }, [role]);

  const permissionsQuery = useQuery({
    queryKey: ["permissions"],
    queryFn: () => apiRequest<PermissionSummary[]>("/permissions"),
    enabled: role !== null,
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest<RoleDetail>(`/roles/${role?.id}/permissions`, {
        method: "PUT",
        body: { permissionIds },
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
      title="Role permissions"
      description={`${role.name} (${role.code})`}
      footer={
        <>
          <Button variant="outlined" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton onClick={() => mutation.mutate()} loading={mutation.isPending}>
            Save permissions
          </LoadingButton>
        </>
      }
    >
      <Stack spacing={8}>
        {role.isSystem ? (
          <Alert tone="warning" title="Protected role">
            The permissions of a system role cannot be changed.
          </Alert>
        ) : null}
        {mutation.isError ? (
          <Alert tone="error" title="Could not update permissions">
            {mutation.error instanceof ApiRequestError ? mutation.error.message : "Unexpected error"}
          </Alert>
        ) : null}
        {permissionsQuery.isPending ? (
          <Spinner />
        ) : (
          permissionsQuery.data?.map((permission) => (
            <Checkbox
              key={permission.id}
              label={permission.name}
              helperText={permission.code}
              disabled={role.isSystem}
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
    </Modal>
  );
}
