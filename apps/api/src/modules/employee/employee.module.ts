import { Module } from "@nestjs/common";
import { StorageModule } from "../../common/storage/storage.module";
import { AuditModule } from "../audit/audit.module";
import { EmergencyContactsController } from "./emergency-contacts.controller";
import { EmergencyContactsService } from "./emergency-contacts.service";
import { EmployeeDocumentsController } from "./employee-documents.controller";
import { EmployeeDocumentsService } from "./employee-documents.service";
import { EmployeesController } from "./employees.controller";
import { EmployeesService } from "./employees.service";

@Module({
  imports: [AuditModule, StorageModule],
  controllers: [
    EmployeesController,
    EmergencyContactsController,
    EmployeeDocumentsController,
  ],
  providers: [EmployeesService, EmergencyContactsService, EmployeeDocumentsService],
  exports: [EmployeesService],
})
export class EmployeeModule {}
