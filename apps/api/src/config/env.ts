import { serverEnvSchema, type ServerEnv } from "@peopleops/validators";

/** Injection token for the validated server environment. */
export const ENV = "PEOPLESOPS_ENV";

export type { ServerEnv };

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const result = serverEnvSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return result.data;
}
