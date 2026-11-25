import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { LeaveJobsService } from "./leave-jobs.service";
import { OvertimeJobsService } from "./overtime-jobs.service";
import { PRISMA_CLIENT, prismaProvider } from "./prisma.provider";

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [prismaProvider, LeaveJobsService, OvertimeJobsService],
  exports: [PRISMA_CLIENT],
})
export class WorkerModule {}
