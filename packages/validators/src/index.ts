import { z } from "zod";

/** Server environment. Validated once at process start so misconfiguration fails fast. */
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(3001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  COMPANY_TIMEZONE: z.string().min(1).default("Asia/Jakarta"),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  /** HS256 signing key. Must be long and random; never committed. */
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().max(90).default(30),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

const healthCheckSchema = z.object({
  status: z.enum(["up", "down"]),
  latencyMs: z.number().nullable(),
  message: z.string().optional(),
});

/** Runtime guard for the health payload rendered by the web app. */
export const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  service: z.string(),
  version: z.string(),
  environment: z.string(),
  timezone: z.string(),
  uptimeSeconds: z.number(),
  timestamp: z.string(),
  checks: z.object({ database: healthCheckSchema }),
});

export type HealthResponseInput = z.infer<typeof healthResponseSchema>;

/** Client-safe environment (Vite exposes only VITE_* variables). */
export const clientEnvSchema = z.object({
  VITE_API_BASE_URL: z.string().min(1).default("/api/v1"),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

// ---------------------------------------------------------------------------
// Shared form schemas (web) — the API enforces the same rules in its DTOs.
// ---------------------------------------------------------------------------

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/** At least 12 characters with a letter and a digit. No forced symbol casing. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`)
  .regex(/[A-Za-z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one digit");

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(254)
  .email("Enter a valid email address")
  .transform((value) => value.toLowerCase());

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm the new password"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  email: emailSchema,
  password: passwordSchema,
  roleIds: z.array(z.string().uuid()).default([]),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  email: emailSchema,
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const roleFormSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  code: z
    .string()
    .trim()
    .min(2, "Code is required")
    .max(40)
    .regex(/^[A-Z0-9_]+$/, "Use uppercase letters, digits and underscores"),
  description: z.string().trim().max(255).optional(),
});

export type RoleFormInput = z.infer<typeof roleFormSchema>;
