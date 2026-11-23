import type { UserStatus } from "@peopleops/shared-types";

export interface AuthenticatedUserRole {
  id: string;
  code: string;
  name: string;
}

/** Attached to the request by JwtAuthGuard and returned by @CurrentUser(). */
export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  roles: AuthenticatedUserRole[];
  permissions: string[];
  sessionId: string;
  sessionExpiresAt: Date;
  sessionCreatedAt: Date;
}

export interface AuthenticatedRequest {
  user?: AuthenticatedUser;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}
