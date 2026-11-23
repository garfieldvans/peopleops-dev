import type { ApiErrorResponse, LoginResponse } from "@peopleops/shared-types";
import { clientEnvSchema } from "@peopleops/validators";

const env = clientEnvSchema.parse({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL || undefined,
});

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/**
 * The access token lives in memory only: XSS cannot read it from storage, and a
 * reload restores the session through the httpOnly refresh cookie.
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

async function execute(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const isFormData = options.body instanceof FormData;
  if (options.body !== undefined && !isFormData) {
    headers["Content-Type"] = "application/json";
  }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return fetch(`${env.VITE_API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body:
      options.body === undefined
        ? undefined
        : isFormData
          ? (options.body as FormData)
          : JSON.stringify(options.body),
    credentials: "include",
    signal: options.signal,
  });
}

let refreshInFlight: Promise<LoginResponse | null> | null = null;

/** Single-flight refresh: concurrent 401s share one rotation request. */
export function refreshSession(): Promise<LoginResponse | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const response = await fetch(`${env.VITE_API_BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        accessToken = null;
        return null;
      }

      const payload = (await response.json()) as LoginResponse;
      accessToken = payload.accessToken;
      return payload;
    })()
      .catch(() => {
        accessToken = null;
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

export async function apiUpload<T>(path: string, body: FormData): Promise<T> {
  return apiRequest<T>(path, { method: "POST", body });
}

/** Downloads an authorized binary through fetch so the bearer token is sent. */
export async function downloadFile(path: string, fileName: string): Promise<void> {
  let response = await execute(path, {});
  if (response.status === 401 && accessToken) {
    const refreshed = await refreshSession();
    if (refreshed) response = await execute(path, {});
  }
  if (!response.ok) {
    throw new ApiRequestError("Download failed", response.status, "DOWNLOAD_FAILED");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await execute(path, options);

  if (response.status === 401 && accessToken) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await execute(path, options);
    }
  }

  const body = await parseBody(response);

  if (!response.ok) {
    const error = body as Partial<ApiErrorResponse> | undefined;
    throw new ApiRequestError(
      error?.message ?? `Request failed with status ${response.status}`,
      response.status,
      error?.code ?? "REQUEST_FAILED",
      error?.details,
    );
  }

  return body as T;
}
