import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Modal,
  Spinner,
  Stack,
  Table,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useState } from "react";
import {
  PERMISSIONS,
  type PaginatedResponse,
  type RoleDetail,
} from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import { RoleCreateDialog } from "./role-create-dialog";
import { RoleEditDialog } from "./role-edit-dialog";
import { RolePermissionsDialog } from "./role-permissions-dialog";

export function RolesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<RoleDetail | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<RoleDetail | null>(null);
  const [deleting, setDeleting] = useState<RoleDetail | null>(null);

  const rolesQuery = useQuery({
    queryKey: ["roles", "list"],
    queryFn: () => apiRequest<PaginatedResponse<RoleDetail>>("/roles?pageSize=100"),
  });

  const deleteMutation = useMutation({
    mutationFn: (role: RoleDetail) => apiRequest<void>(`/roles/${role.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Role deleted");
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiRequestError ? error.message : "Could not delete the role");
    },
  });

  return (
    <Stack spacing={20}>
      <Stack direction="row" justify="between" align="center" wrap spacing={12}>
        <Stack spacing={4}>
          <Typography variant="h4" as="h1">
            Roles & permissions
          </Typography>
          <Typography variant="bodySmall" color="neutral">
            Roles bundle permissions; users receive one or more roles.
          </Typography>
        </Stack>
        {hasPermission(PERMISSIONS.ROLE_CREATE) ? (
          <Button onClick={() => setCreateOpen(true)}>Create role</Button>
        ) : null}
      </Stack>

      <Card variant="elevated" padding="lg">
        <CardBody>
          {rolesQuery.isPending ? (
            <Stack direction="row" spacing={12} align="center">
              <Spinner />
              <Typography variant="bodySmall" color="neutral">
                Loading roles…
              </Typography>
            </Stack>
          ) : rolesQuery.isError ? (
            <Alert tone="error" title="Could not load roles">
              {rolesQuery.error instanceof ApiRequestError
                ? rolesQuery.error.message
                : "Unexpected error"}
            </Alert>
          ) : (
            <Table
              columns={[
                {
                  key: "name",
                  header: "Role",
                  render: (role) => (
                    <Stack spacing={2}>
                      <Typography variant="bodySmall" className="font-medium">
                        {role.name}
                      </Typography>
                      <Typography variant="caption" color="neutral">
                        {role.description ?? "No description"}
                      </Typography>
                    </Stack>
                  ),
                },
                {
                  key: "code",
                  header: "Code",
                  render: (role) => (
                    <Stack direction="row" spacing={4} align="center">
                      <Typography variant="caption">{role.code}</Typography>
                      {role.isSystem ? (
                        <Badge variant="outlined" color="primary">
                          protected
                        </Badge>
                      ) : null}
                    </Stack>
                  ),
                },
                {
                  key: "permissions",
                  header: "Permissions",
                  render: (role) => role.permissions.length,
                },
                {
                  key: "userCount",
                  header: "Users",
                  render: (role) => role.userCount,
                },
                {
                  key: "actions",
                  header: "",
                  align: "right",
                  render: (role) => (
                    <Stack direction="row" spacing={4} justify="end" wrap>
                      {hasPermission(PERMISSIONS.ROLE_UPDATE) ? (
                        <>
                          <Button variant="text" size="sm" onClick={() => setEditing(role)}>
                            Edit
                          </Button>
                          <Button
                            variant="text"
                            size="sm"
                            onClick={() => setEditingPermissions(role)}
                          >
                            Permissions
                          </Button>
                        </>
                      ) : null}
                      {hasPermission(PERMISSIONS.ROLE_DELETE) && !role.isSystem ? (
                        <Button
                          variant="text"
                          size="sm"
                          color="error"
                          onClick={() => setDeleting(role)}
                        >
                          Delete
                        </Button>
                      ) : null}
                    </Stack>
                  ),
                },
              ]}
              data={rolesQuery.data.items}
              rowKey={(role) => role.id}
              emptyText="No roles yet."
            />
          )}
        </CardBody>
      </Card>

      <RoleCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <RoleEditDialog role={editing} onOpenChange={(open) => !open && setEditing(null)} />
      <RolePermissionsDialog
        role={editingPermissions}
        onOpenChange={(open) => !open && setEditingPermissions(null)}
      />

      <Modal
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete role"
        description={deleting ? `${deleting.name} (${deleting.code})` : undefined}
        footer={
          <>
            <Button variant="outlined" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <LoadingButton
              color="error"
              loading={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting)}
            >
              Delete role
            </LoadingButton>
          </>
        }
      >
        <Typography variant="bodySmall">
          The role is removed permanently. Roles that are still assigned to users cannot be
          deleted.
        </Typography>
      </Modal>
    </Stack>
  );
}
