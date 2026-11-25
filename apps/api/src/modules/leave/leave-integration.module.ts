import { Module } from "@nestjs/common";
import { LeaveIntegrationService } from "./leave-integration.service";

@Module({
  providers: [LeaveIntegrationService],
  exports: [LeaveIntegrationService],
})
export class LeaveIntegrationModule {}
