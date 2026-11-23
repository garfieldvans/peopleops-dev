import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "peopleops:permissions";

/** All listed permission codes are required (AND semantics). */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
