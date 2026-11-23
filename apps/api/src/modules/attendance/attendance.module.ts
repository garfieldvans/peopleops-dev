import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { EmployeeModule } from "../employee/employee.module";
import { AttendanceController } from "./attendance.controller";
import { AttendanceCorrectionsController } from "./attendance-corrections.controller";
import { AttendanceCorrectionsService } from "./attendance-corrections.service";
import { AttendanceService } from "./attendance.service";
import { EmployeeSchedulesController, EmployeeScheduleHistoryController } from "./employee-schedules.controller";
import { EmployeeSchedulesService } from "./employee-schedules.service";
import { HolidaysController } from "./holidays.controller";
import { HolidaysService } from "./holidays.service";
import { ShiftsController } from "./shifts.controller";
import { ShiftsService } from "./shifts.service";
import { WorkSchedulesController } from "./work-schedules.controller";
import { WorkSchedulesService } from "./work-schedules.service";

@Module({
  imports: [AuditModule, EmployeeModule],
  controllers: [
    WorkSchedulesController,
    ShiftsController,
    EmployeeSchedulesController,
    EmployeeScheduleHistoryController,
    HolidaysController,
    AttendanceCorrectionsController,
    AttendanceController,
  ],
  providers: [
    WorkSchedulesService,
    ShiftsService,
    EmployeeSchedulesService,
    HolidaysService,
    AttendanceService,
    AttendanceCorrectionsService,
  ],
  exports: [AttendanceService],
})
export class AttendanceModule {}
