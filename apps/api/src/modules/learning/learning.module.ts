import { Module } from "@nestjs/common";
import { StorageModule } from "../../common/storage/storage.module";
import { AuditModule } from "../audit/audit.module";
import { EmployeeModule } from "../employee/employee.module";
import { LearningController } from "./learning.controller";
import { LearningService } from "./learning.service";

@Module({
  imports: [AuditModule, EmployeeModule, StorageModule],
  controllers: [LearningController],
  providers: [LearningService],
  exports: [LearningService],
})
export class LearningModule {}
