import { Module } from "@nestjs/common";
import { AttendanceModule } from "./modules/attendance/attendance.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthModule } from "./modules/health/health.module";
import { LeaveModule } from "./modules/leave/leave.module";
import { OvertimeModule } from "./modules/overtime/overtime.module";
import { EmployeeModule } from "./modules/employee/employee.module";
import { OrganizationModule } from "./modules/organization/organization.module";
import { PermissionsModule } from "./modules/permissions/permissions.module";
import { RolesModule } from "./modules/roles/roles.module";
import { UsersModule } from "./modules/users";
import { EnvModule } from "./config/env.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    EnvModule,
    PrismaModule,
    AuditModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    OrganizationModule,
    EmployeeModule,
    AttendanceModule,
    LeaveModule,
    OvertimeModule,
  ],
})
export class AppModule {}
