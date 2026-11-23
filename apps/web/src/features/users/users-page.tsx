import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Input,
  Spinner,
  Stack,
  Table,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useEffect, useState } from "react";
import { PERMISSIONS, type PaginatedResponse, type UserSummary } from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import { UserCreateDialog } from "./user-create-dialog";
import { UserEditDialog } from "./user-edit-dialog";
import { UserRolesDialog } from "./user-roles-dialog";

const PAGE_SIZE = 10;

function statusColor(status: UserSummary["status"]): "success" | "neutral" | "warning" {
  if (status === "ACTIVE") return "success";
  if (status === "SUSPENDED") return "warning";
  return "neutral";
}

export function UsersPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserSummary | null>(null);
  const [assigningRoles, setAssigningRoles] = useState<UserSummary | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const usersQuery = useQuery({
    queryKey: ["users", page, search],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set("search", search);
      return apiRequest<PaginatedResponse<UserSummary>>(`/users?${params.toString()}`);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ user, status }: { user: UserSummary; status: UserSummary["status"] }) =>
      apiRequest<UserSummary>(`/users/${user.id}/status`, {
        method: "PATCH",
        body: { status },
      }),
    onSuccess: (user) => {
      toast.success(`${user.name} is now ${user.status.toLowerCase()}`);
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiRequestError ? error.message : "Could not change status");
    },
  });

  return (
    <Stack spacing={20}>
      <Stack direction="row" justify="between" align="center" wrap spacing={12}>
        <Stack spacing={4}>
          <Typography variant="h4" as="h1">
            Users
          </Typography>
          <Typography variant="bodySmall" color="neutral">
            Accounts that can sign in to PeopleOps
          </Typography>
        </Stack>
        {hasPermission(PERMISSIONS.USER_CREATE) ? (
          <Button onClick={() => setCreateOpen(true)}>Create user</Button>
        ) : null}
      </Stack>

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="max-w-sm">
              <Input
                placeholder="Search name or email"
                aria-label="Search users"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                clearable
                onClear={() => setSearchInput("")}
                fullWidth
              />
            </div>

            {usersQuery.isPending ? (
              <Stack direction="row" spacing={12} align="center">
                <Spinner />
                <Typography variant="bodySmall" color="neutral">
                  Loading users…
                </Typography>
              </Stack>
            ) : usersQuery.isError ? (
              <Alert tone="error" title="Could not load users">
                {usersQuery.error instanceof ApiRequestError
                  ? usersQuery.error.message
                  : "Unexpected error"}
              </Alert>
            ) : (
              <Table
                columns={[
                  {
                    key: "name",
                    header: "Name",
                    render: (user) => (
                      <Stack spacing={2}>
                        <Typography variant="bodySmall" className="font-medium">
                          {user.name}
                        </Typography>
                        <Typography variant="caption" color="neutral">
                          {user.email}
                        </Typography>
                      </Stack>
                    ),
                  },
                  {
                    key: "roles",
                    header: "Roles",
                    render: (user) => (
                      <Stack direction="row" spacing={4} wrap>
                        {user.roles.length === 0 ? (
                          <Typography variant="caption" color="neutral">
                            No role
                          </Typography>
                        ) : (
                          user.roles.map((role) => (
                            <Badge key={role.id} variant="outlined" color="neutral">
                              {role.name}
                            </Badge>
                          ))
                        )}
                      </Stack>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (user) => (
                      <Badge variant="filled" color={statusColor(user.status)}>
                        {user.status.toLowerCase()}
                      </Badge>
                    ),
                  },
                  {
                    key: "lastLoginAt",
                    header: "Last sign-in",
                    render: (user) =>
                      user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never",
                  },
                  {
                    key: "actions",
                    header: "",
                    align: "right",
                    render: (user) => (
                      <Stack direction="row" spacing={4} justify="end" wrap>
                        {hasPermission(PERMISSIONS.USER_UPDATE) ? (
                          <Button variant="text" size="sm" onClick={() => setEditing(user)}>
                            Edit
                          </Button>
                        ) : null}
                        {hasPermission(PERMISSIONS.USER_ASSIGN_ROLE) ? (
                          <Button variant="text" size="sm" onClick={() => setAssigningRoles(user)}>
                            Roles
                          </Button>
                        ) : null}
                        {hasPermission(PERMISSIONS.USER_DEACTIVATE) ? (
                          <LoadingButton
                            variant="text"
                            size="sm"
                            color={user.status === "ACTIVE" ? "error" : "primary"}
                            loading={
                              statusMutation.isPending &&
                              statusMutation.variables?.user.id === user.id
                            }
                            onClick={() =>
                              statusMutation.mutate({
                                user,
                                status: user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                              })
                            }
                          >
                            {user.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          </LoadingButton>
                        ) : null}
                      </Stack>
                    ),
                  },
                ]}
                data={usersQuery.data.items}
                rowKey={(user) => user.id}
                pagination={{
                  page,
                  pageSize: PAGE_SIZE,
                  pageCount: usersQuery.data.totalPages,
                  total: usersQuery.data.total,
                  onChange: setPage,
                }}
                emptyText="No users match this search."
              />
            )}
          </Stack>
        </CardBody>
      </Card>

      <UserCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <UserEditDialog user={editing} onOpenChange={(open) => !open && setEditing(null)} />
      <UserRolesDialog
        user={assigningRoles}
        onOpenChange={(open) => !open && setAssigningRoles(null)}
      />
    </Stack>
  );
}
