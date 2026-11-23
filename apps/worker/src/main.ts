import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { config } from "dotenv";
import { createPrismaClient } from "@peopleops/database";
import { serverEnvSchema } from "@peopleops/validators";
import { WorkerModule } from "./worker.module";

async function bootstrap(): Promise<void> {
  config({ path: ["../../.env", ".env"], quiet: true });

  const logger = new Logger("Worker");
  const parsedEnv = serverEnvSchema.safeParse(process.env);

  if (!parsedEnv.success) {
    const issues = parsedEnv.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    logger.error(`Invalid environment configuration:\n${issues}`);
    process.exitCode = 1;
    return;
  }

  const env = parsedEnv.data;
  const app = await NestFactory.createApplicationContext(WorkerModule);
  const prisma = createPrismaClient({ connectionString: env.DATABASE_URL });

  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.log(
      `Database reachable (environment: ${env.NODE_ENV}, timezone: ${env.COMPANY_TIMEZONE})`,
    );
  } catch (error) {
    logger.error(
      "Database connectivity check failed",
      error instanceof Error ? error.stack : String(error),
    );
    await prisma.$disconnect();
    await app.close();
    process.exitCode = 1;
    return;
  }

  await prisma.$disconnect();
  await app.close();
  logger.log("No jobs are registered in Phase 1 — worker finished.");
}

bootstrap().catch((error: unknown) => {
  Logger.error("Worker failed to start", error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
