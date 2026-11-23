import { ForbiddenException, Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { ENV, type ServerEnv } from "../../config/env";

/**
 * CSRF mitigation for the cookie endpoints: browsers always send Origin on
 * cross-site POSTs, so a disallowed Origin is rejected. Requests without an
 * Origin header (CLI, server-to-server) are allowed and still need a valid
 * refresh cookie.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowedOrigins: Set<string>;

  constructor(@Inject(ENV) env: ServerEnv) {
    this.allowedOrigins = new Set(env.CORS_ORIGIN.split(",").map((origin) => origin.trim()));
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.headers.origin;

    if (origin && !this.allowedOrigins.has(origin)) {
      throw new ForbiddenException({
        code: "INVALID_ORIGIN",
        message: "Request origin is not allowed",
      });
    }

    return true;
  }
}
