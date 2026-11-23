export const REFRESH_COOKIE_NAME = "peopleops_refresh";
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  type: "access";
}
