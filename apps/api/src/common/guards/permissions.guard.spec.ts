import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionsGuard } from "./permissions.guard";

function contextWithPermissions(permissions: string[]): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({ user: { permissions } }),
    }),
  } as unknown as ExecutionContext;
}

describe("PermissionsGuard", () => {
  it("allows requests whose user holds every required permission", () => {
    const reflector = { getAllAndOverride: () => ["user.read"] } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(guard.canActivate(contextWithPermissions(["user.read", "role.read"]))).toBe(true);
  });

  it("rejects requests missing a required permission", () => {
    const reflector = { getAllAndOverride: () => ["user.read", "role.read"] } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(() => guard.canActivate(contextWithPermissions(["user.read"]))).toThrow(
      ForbiddenException,
    );
  });

  it("passes through routes without permission metadata", () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(guard.canActivate(contextWithPermissions([]))).toBe(true);
  });
});
