import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { CronExpression, SchedulerRegistry } from "@nestjs/schedule";
import { CronJob } from "cron";
import type { PrismaClient } from "@peopleops/database";
import { getCompanyTimezone } from "./company-timezone";
import { PRISMA_CLIENT } from "./prisma.provider";

const STALE_APPROVAL_DAYS = 3;
const AWAITING_ACTUAL_DAYS = 2;

@Injectable()
export class OvertimeJobsService implements OnModuleInit {
  private readonly logger = new Logger(OvertimeJobsService.name);

  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    @Inject(SchedulerRegistry) private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    const timezone = await getCompanyTimezone(this.prisma);
    const job = new CronJob(
      CronExpression.EVERY_DAY_AT_2AM,
      () => {
        void this.runDaily();
      },
      null,
      false,
      timezone,
    );
    this.schedulerRegistry.addCronJob("overtime-daily", job);
    job.start();
    this.logger.log(`Overtime jobs scheduled daily at 02:00 ${timezone}`);
  }

  /**
   * Read-only housekeeping. Overtime completion needs an explicit actual
   * window, so this job never advances a request into verification on its own.
   * It only surfaces requests that need a human decision.
   */
  async runDaily(): Promise<void> {
    try {
      const now = new Date();
      const staleApprovalBefore = new Date(
        now.getTime() - STALE_APPROVAL_DAYS * 24 * 60 * 60 * 1000,
      );
      const awaitingActualBefore = new Date(
        now.getTime() - AWAITING_ACTUAL_DAYS * 24 * 60 * 60 * 1000,
      );

      const [staleApprovals, awaitingActual] = await Promise.all([
        this.prisma.overtimeRequest.count({
          where: {
            status: { in: ["PENDING_MANAGER_APPROVAL", "PENDING_HR_APPROVAL"] },
            submittedAt: { lt: staleApprovalBefore },
          },
        }),
        this.prisma.overtimeRequest.count({
          where: {
            status: "APPROVED",
            plannedEndAt: { lt: awaitingActualBefore },
          },
        }),
      ]);

      this.logger.log(
        `Overtime jobs: staleApprovals=${staleApprovals}, awaitingActual=${awaitingActual}`,
      );
    } catch (error) {
      this.logger.error(
        "Overtime jobs failed",
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
