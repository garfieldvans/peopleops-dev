import type { Prisma } from "@peopleops/database";

export const userWithRolesInclude = {
  employee: { select: { id: true } },
  roles: {
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

export type UserWithRoles = Prisma.UserGetPayload<{ include: typeof userWithRolesInclude }>;

export function effectivePermissions(user: UserWithRoles): string[] {
  const codes = new Set<string>();
  for (const userRole of user.roles) {
    for (const rolePermission of userRole.role.permissions) {
      codes.add(rolePermission.permission.code);
    }
  }
  return [...codes].sort();
}

export function hasRole(user: UserWithRoles, code: string): boolean {
  return user.roles.some((userRole) => userRole.role.code === code);
}
