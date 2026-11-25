import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { CronExpression, SchedulerRegistry } from "@nestjs/schedule";
import { CronJob } from "cron";
import type { PrismaClient } from "@peopleops/database";
import { runLeaveJobs, todayKey } from "@peopleops/leave-engine";
import { getCompanyTimezone } from "./company-timezone";
import { PRISMA_CLIENT } from "./prisma.provider";

@Injectable()
export class LeaveJobsService implements OnModuleInit {
  private readonly logger = new Logger(LeaveJobsService.name);

  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    @Inject(SchedulerRegistry) private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    const timezone = await getCompanyTimezone(this.prisma);
    const job = new CronJob(
      CronExpression.EVERY_DAY_AT_1AM,
      () => {
        void this.runDaily();
      },
      null,
      false,
      timezone,
    );
    this.schedulerRegistry.addCronJob("leave-daily", job);
    job.start();
    this.logger.log(`Leave jobs scheduled daily at 01:00 ${timezone}`);
  }

  /**
   * Daily accrual, carry-over and expiry processing. All writes are keyed by
   * database-level unique source references, so overlapping workers are safe.
   */
  async runDaily(): Promise<void> {
    try {
      const timezone = await getCompanyTimezone(this.prisma);
      const result = await runLeaveJobs(this.prisma, todayKey(timezone));
      this.logger.log(
        `Leave jobs: periods=${result.periodsEnsured}, accruals=${result.accrualsCreated}, carryOvers=${result.carryOversCreated}, expirations=${result.expirationsCreated}`,
      );
    } catch (error) {
      this.logger.error(
        "Leave jobs failed",
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
