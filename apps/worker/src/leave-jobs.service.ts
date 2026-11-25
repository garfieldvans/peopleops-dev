import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { PrismaClient } from "@peopleops/database";
import { runLeaveJobs, todayKey } from "@peopleops/leave-engine";
import { PRISMA_CLIENT } from "./prisma.provider";

@Injectable()
export class LeaveJobsService {
  private readonly logger = new Logger(LeaveJobsService.name);

  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  /**
   * Daily accrual, carry-over and expiry processing. All writes are keyed by
   * database-level unique source references, so overlapping workers are safe.
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM, { timeZone: "Asia/Jakarta" })
  async runDaily(): Promise<void> {
    try {
      const result = await runLeaveJobs(this.prisma, todayKey());
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
