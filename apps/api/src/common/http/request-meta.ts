import type { Request } from "express";

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export function requestMeta(request: Request): RequestMeta {
  const forwarded = request.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]?.trim();
  const ip = forwardedIp || request.ip || request.socket.remoteAddress || null;
  const userAgent = request.headers["user-agent"] ?? null;
  return { ip, userAgent };
}
