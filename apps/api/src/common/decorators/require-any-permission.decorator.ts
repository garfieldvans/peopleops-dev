import { SetMetadata } from "@nestjs/common";

export const ANY_PERMISSIONS_KEY = "peopleops:anyPermissions";

/** At least one of the listed permission codes is required (OR semantics). */
export const RequireAnyPermission = (...permissions: string[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);
