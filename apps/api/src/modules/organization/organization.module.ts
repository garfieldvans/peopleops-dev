import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CompanyController } from "./company/company.controller";
import { CompanyService } from "./company/company.service";
import { BranchesController } from "./branches/branches.controller";
import { BranchesService } from "./branches/branches.service";
import { DepartmentsController } from "./departments/departments.controller";
import { DepartmentsService } from "./departments/departments.service";
import { JobLevelsController } from "./job-levels/job-levels.controller";
import { JobLevelsService } from "./job-levels/job-levels.service";
import { PositionsController } from "./positions/positions.controller";
import { PositionsService } from "./positions/positions.service";

@Module({
  imports: [AuditModule],
  controllers: [
    CompanyController,
    BranchesController,
    DepartmentsController,
    JobLevelsController,
    PositionsController,
  ],
  providers: [CompanyService, BranchesService, DepartmentsService, JobLevelsService, PositionsService],
})
export class OrganizationModule {}
