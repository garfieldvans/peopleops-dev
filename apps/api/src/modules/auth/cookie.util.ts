import type { Response } from "express";
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from "./auth.constants";

interface CookieOptions {
  secure: boolean;
}

export function setRefreshCookie(
  response: Response,
  token: string,
  expiresAt: Date,
  options: CookieOptions,
): void {
  response.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: options.secure,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    expires: expiresAt,
  });
}

export function clearRefreshCookie(response: Response, options: CookieOptions): void {
  response.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: options.secure,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
  });
}
