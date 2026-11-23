import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ANY_PERMISSIONS_KEY } from "../decorators/require-any-permission.decorator";
import { PERMISSIONS_KEY } from "../decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../types/authenticated-user";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const anyOf =
      this.reflector.getAllAndOverride<string[]>(ANY_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (required.length === 0 && anyOf.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException({
        code: "UNAUTHENTICATED",
        message: "Authentication required",
      });
    }

    const granted = new Set(user.permissions);
    const missing = required.filter((permission) => !granted.has(permission));

    if (missing.length > 0) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "You do not have permission to perform this action",
        details: { required: missing },
      });
    }

    if (anyOf.length > 0 && !anyOf.some((permission) => granted.has(permission))) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "You do not have permission to perform this action",
        details: { requiredAny: anyOf },
      });
    }

    return true;
  }
}
