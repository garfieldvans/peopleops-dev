import { Module } from "@nestjs/common";
import { StorageModule } from "../../common/storage/storage.module";
import { AttendanceModule } from "../attendance/attendance.module";
import { AuditModule } from "../audit/audit.module";
import { EmployeeModule } from "../employee/employee.module";
import { LeaveAssignmentsController } from "./leave-assignments.controller";
import { LeaveAssignmentsService } from "./leave-assignments.service";
import { LeaveAttachmentsService } from "./leave-attachments.service";
import { LeaveBalancesController, LeaveTransactionsController } from "./leave-balances.controller";
import { LeaveCalendarController } from "./leave-calendar.controller";
import { LeaveCalendarService } from "./leave-calendar.service";
import { LeaveDurationService } from "./leave-duration.service";
import { LeaveEntitlementService } from "./leave-entitlement.service";
import { LeaveIntegrationModule } from "./leave-integration.module";
import { LeavePoliciesController } from "./leave-policies.controller";
import { LeavePoliciesService } from "./leave-policies.service";
import { LeaveReportsController } from "./leave-reports.controller";
import { LeaveReportsService } from "./leave-reports.service";
import { LeaveRequestsController } from "./leave-requests.controller";
import { LeaveRequestsService } from "./leave-requests.service";
import { LeaveTypesController } from "./leave-types.controller";
import { LeaveTypesService } from "./leave-types.service";

@Module({
  imports: [AuditModule, EmployeeModule, AttendanceModule, StorageModule, LeaveIntegrationModule],
  controllers: [
    LeaveTypesController,
    LeavePoliciesController,
    LeaveAssignmentsController,
    LeaveBalancesController,
    LeaveTransactionsController,
    LeaveRequestsController,
    LeaveCalendarController,
    LeaveReportsController,
  ],
  providers: [
    LeaveTypesService,
    LeavePoliciesService,
    LeaveAssignmentsService,
    LeaveEntitlementService,
    LeaveDurationService,
    LeaveRequestsService,
    LeaveCalendarService,
    LeaveReportsService,
    LeaveAttachmentsService,
  ],
  exports: [LeaveEntitlementService, LeaveIntegrationModule],
})
export class LeaveModule {}
