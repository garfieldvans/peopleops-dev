import { Module } from "@nestjs/common";
import { StorageModule } from "../../common/storage/storage.module";
import { AttendanceModule } from "../attendance/attendance.module";
import { AuditModule } from "../audit/audit.module";
import { EmployeeModule } from "../employee/employee.module";
import { LeaveIntegrationModule } from "../leave/leave-integration.module";
import { OvertimeAssignmentsController } from "./overtime-assignments.controller";
import { OvertimeAssignmentsService } from "./overtime-assignments.service";
import { OvertimeAttachmentsService } from "./overtime-attachments.service";
import { OvertimeDashboardController } from "./overtime-dashboard.controller";
import { OvertimePoliciesController } from "./overtime-policies.controller";
import { OvertimePoliciesService } from "./overtime-policies.service";
import { OvertimeRequestsController } from "./overtime-requests.controller";
import { OvertimeRequestsService } from "./overtime-requests.service";

@Module({
  imports: [AuditModule, EmployeeModule, AttendanceModule, LeaveIntegrationModule, StorageModule],
  controllers: [
    OvertimePoliciesController,
    OvertimeAssignmentsController,
    OvertimeRequestsController,
    OvertimeDashboardController,
  ],
  providers: [
    OvertimePoliciesService,
    OvertimeAssignmentsService,
    OvertimeRequestsService,
    OvertimeAttachmentsService,
  ],
  exports: [OvertimeRequestsService],
})
export class OvertimeModule {}
