import type { Prisma } from "@peopleops/database";

export const roleWithPermissionsInclude = {
  permissions: { include: { permission: true } },
  _count: { select: { users: true } },
} satisfies Prisma.RoleInclude;

export type RoleWithPermissions = Prisma.RoleGetPayload<{
  include: typeof roleWithPermissionsInclude;
}>;
