import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { CronExpression, SchedulerRegistry } from "@nestjs/schedule";
import { CronJob } from "cron";
import type { PrismaClient } from "@peopleops/database";
import { getCompanyTimezone } from "./company-timezone";
import { PRISMA_CLIENT } from "./prisma.provider";

const STALE_CALCULATION_MINUTES = 30;
const STALE_REVIEW_DAYS = 7;
const APPROVED_UNPUBLISHED_DAYS = 3;

@Injectable()
export class PayrollJobsService implements OnModuleInit {
  private readonly logger = new Logger(PayrollJobsService.name);

  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    @Inject(SchedulerRegistry) private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    const timezone = await getCompanyTimezone(this.prisma);
    const job = new CronJob(
      CronExpression.EVERY_DAY_AT_3AM,
      () => {
        void this.runDaily();
      },
      null,
      false,
      timezone,
    );
    this.schedulerRegistry.addCronJob("payroll-daily", job);
    job.start();
    this.logger.log(`Payroll housekeeping scheduled daily at 03:00 ${timezone}`);
  }

  /**
   * Read-only housekeeping. Calculation is synchronous and transactional, so
   * the worker never mutates a run; it only surfaces runs that need a human.
   * The same counts are safe to recompute on every execution.
   */
  async runDaily(): Promise<void> {
    try {
      const now = new Date();
      const staleCalculationBefore = new Date(
        now.getTime() - STALE_CALCULATION_MINUTES * 60 * 1000,
      );
      const staleReviewBefore = new Date(
        now.getTime() - STALE_REVIEW_DAYS * 24 * 60 * 60 * 1000,
      );
      const approvedUnpublishedBefore = new Date(
        now.getTime() - APPROVED_UNPUBLISHED_DAYS * 24 * 60 * 60 * 1000,
      );

      const [staleCalculations, staleReviews, approvedUnpublished] = await Promise.all([
        this.prisma.payrollRun.count({
          where: { status: "CALCULATING", updatedAt: { lt: staleCalculationBefore } },
        }),
        this.prisma.payrollRun.count({
          where: { status: "UNDER_REVIEW", updatedAt: { lt: staleReviewBefore } },
        }),
        this.prisma.payrollRun.count({
          where: { status: "APPROVED", updatedAt: { lt: approvedUnpublishedBefore } },
        }),
      ]);

      this.logger.log(
        `Payroll housekeeping: staleCalculations=${staleCalculations}, staleReviews=${staleReviews}, approvedUnpublished=${approvedUnpublished}`,
      );
    } catch (error) {
      this.logger.error(
        "Payroll housekeeping failed",
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
