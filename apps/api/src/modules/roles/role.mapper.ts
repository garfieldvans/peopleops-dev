import type { RoleDetail } from "@peopleops/shared-types";
import type { RoleWithPermissions } from "./roles.types";

export function toRoleDetail(role: RoleWithPermissions): RoleDetail {
  return {
    id: role.id,
    name: role.name,
    code: role.code,
    description: role.description,
    isSystem: role.isSystem,
    permissions: role.permissions
      .map((rolePermission) => ({
        id: rolePermission.permission.id,
        name: rolePermission.permission.name,
        code: rolePermission.permission.code,
        description: rolePermission.permission.description,
      }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    userCount: role._count.users,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  };
}
