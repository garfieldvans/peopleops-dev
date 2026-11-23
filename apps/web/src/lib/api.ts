import type { HealthResponse } from "@peopleops/shared-types";
import { clientEnvSchema, healthResponseSchema } from "@peopleops/validators";

const env = clientEnvSchema.parse({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL || undefined,
});

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${env.VITE_API_BASE_URL}/health`, {
    signal,
    headers: { Accept: "application/json" },
    credentials: "include",
  });

  if (!response.ok) {
    throw new ApiRequestError(`Health check failed with status ${response.status}`, response.status);
  }

  const payload: unknown = await response.json();
  return healthResponseSchema.parse(payload);
}
