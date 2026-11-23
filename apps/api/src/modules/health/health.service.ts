import { Inject, Injectable, Logger } from "@nestjs/common";
import type { HealthResponse, HealthStatus } from "@peopleops/shared-types";
import { ENV, type ServerEnv } from "../../config/env";
import { PrismaService } from "../../prisma/prisma.service";

const SERVICE_NAME = "peopleops-api";
const SERVICE_VERSION = "0.1.0";

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: ServerEnv,
  ) {}

  async check(): Promise<{ status: HealthStatus; body: HealthResponse }> {
    const database = await this.probeDatabase();
    const status: HealthStatus = database.status === "up" ? "ok" : "degraded";

    return {
      status,
      body: {
        status,
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        environment: this.env.NODE_ENV,
        timezone: this.env.COMPANY_TIMEZONE,
        uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
        timestamp: new Date().toISOString(),
        checks: { database },
      },
    };
  }

  private async probeDatabase(): Promise<HealthResponse["checks"]["database"]> {
    const startedAt = performance.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "up", latencyMs: Math.round(performance.now() - startedAt) };
    } catch (error) {
      this.logger.error(
        "Database health probe failed",
        error instanceof Error ? error.stack : String(error),
      );
      return {
        status: "down",
        latencyMs: null,
        message: "Database connection failed",
      };
    }
  }
}
