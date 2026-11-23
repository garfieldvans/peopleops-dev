import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { applyTestEnv, TEST_DATABASE_URL } from "./test-env";

// Jest runs through the package script, so the working directory is apps/api.
const apiDir = process.cwd();

export default function globalSetup(): void {
  applyTestEnv();

  const databaseDir = resolve(apiDir, "../../packages/database");
  const env = { ...process.env, DATABASE_URL: TEST_DATABASE_URL };

  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy", "--config", "prisma7.config.ts"], {
    cwd: databaseDir,
    env,
    stdio: "inherit",
  });

  execFileSync("pnpm", ["exec", "tsx", "prisma/seed.ts"], {
    cwd: apiDir,
    env,
    stdio: "inherit",
  });

  execFileSync("pnpm", ["exec", "tsx", "test/cleanup-test-data.ts"], {
    cwd: apiDir,
    env,
    stdio: "inherit",
  });
}
