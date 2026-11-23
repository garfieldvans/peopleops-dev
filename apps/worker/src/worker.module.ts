import { Module } from "@nestjs/common";

/**
 * Job modules are registered here as they are implemented. Phase 1 deliberately
 * contains no processors, queues or schedulers (ADR-013).
 */
@Module({})
export class WorkerModule {}
