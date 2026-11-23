import type { CurrentUser, UserSummary } from "@peopleops/shared-types";
import type { UserSession } from "@peopleops/database";
import { effectivePermissions, type UserWithRoles } from "./users.types";

export function toUserSummary(user: UserWithRoles): UserSummary {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    roles: user.roles.map((userRole) => ({
      id: userRole.role.id,
      code: userRole.role.code,
      name: userRole.role.name,
    })),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function toCurrentUser(user: UserWithRoles, session: UserSession): CurrentUser {
  return {
    ...toUserSummary(user),
    permissions: effectivePermissions(user),
    session: {
      id: session.id,
      expiresAt: session.expiresAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
    },
  };
}
