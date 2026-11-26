import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { EmployeeModule } from "../employee/employee.module";
import { PerformanceController } from "./performance.controller";
import { PerformanceService } from "./performance.service";

@Module({
  imports: [AuditModule, EmployeeModule],
  controllers: [PerformanceController],
  providers: [PerformanceService],
  exports: [PerformanceService],
})
export class PerformanceModule {}
