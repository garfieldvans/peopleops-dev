import { resolve } from "node:path";
import { config } from "dotenv";

// Jest runs through the package script, so the working directory is apps/api.
const apiDir = process.cwd();
config({ path: [resolve(apiDir, "../../.env"), resolve(apiDir, ".env")], quiet: true });

function deriveTestDatabaseUrl(): string {
  const base = process.env["DATABASE_URL"];
  if (!base) {
    throw new Error("DATABASE_URL is required to run the e2e tests");
  }

  const url = new URL(base);
  url.searchParams.set("schema", "peopleops_test");
  return url.toString();
}

export const TEST_DATABASE_URL = deriveTestDatabaseUrl();
export const TEST_ADMIN_EMAIL = "admin@peopleops.test";
export const TEST_ADMIN_PASSWORD = "TestAdminPass123";

/** Called by globalSetup and by the worker setup file, before AppModule loads env. */
export function applyTestEnv(): void {
  process.env["NODE_ENV"] = "test";
  process.env["DATABASE_URL"] = TEST_DATABASE_URL;
  process.env["JWT_ACCESS_SECRET"] = "test-only-secret-value-with-more-than-32-chars";
  process.env["JWT_ACCESS_TTL_SECONDS"] = "900";
  process.env["REFRESH_TOKEN_TTL_DAYS"] = "1";
  process.env["COOKIE_SECURE"] = "false";
  process.env["CORS_ORIGIN"] = "http://localhost:5173";
  process.env["SEED_ADMIN_EMAIL"] = TEST_ADMIN_EMAIL;
  process.env["SEED_ADMIN_PASSWORD"] = TEST_ADMIN_PASSWORD;
}
