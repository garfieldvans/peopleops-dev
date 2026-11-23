import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import type { AuthenticatedRequest } from "../types/authenticated-user";
import { AuthService } from "../../modules/auth/auth.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest & Request>();
    const header = request.headers.authorization;
    const token =
      typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7).trim() : null;

    if (!token) {
      throw new UnauthorizedException({
        code: "UNAUTHENTICATED",
        message: "Authentication required",
      });
    }

    request.user = await this.auth.authenticate(token);
    return true;
  }
}
