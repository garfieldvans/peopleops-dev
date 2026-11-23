import type { CurrentUser } from "@peopleops/shared-types";

export function userHasPermission(
  user: Pick<CurrentUser, "permissions"> | null | undefined,
  permission: string,
): boolean {
  return user?.permissions.includes(permission) ?? false;
}
