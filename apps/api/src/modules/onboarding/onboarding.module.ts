import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { EmployeeModule } from "../employee/employee.module";
import { OffboardingController } from "./offboarding.controller";
import { OffboardingService } from "./offboarding.service";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";

@Module({
  imports: [AuditModule, EmployeeModule],
  controllers: [OnboardingController, OffboardingController],
  providers: [OnboardingService, OffboardingService],
  exports: [OnboardingService, OffboardingService],
})
export class OnboardingModule {}
