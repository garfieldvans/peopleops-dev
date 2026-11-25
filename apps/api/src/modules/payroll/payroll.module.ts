import { Module } from "@nestjs/common";
import { PayrollAdjustmentsService } from "./payroll-adjustments.service";
import { PayrollAssignmentsService } from "./payroll-assignments.service";
import { PayrollCalculationService } from "./payroll-calculation.service";
import { PayrollCompensationService } from "./payroll-compensation.service";
import { PayrollComponentsService } from "./payroll-components.service";
import { PayrollConfigController } from "./payroll-config.controller";
import { PayrollPeriodsService } from "./payroll-periods.service";
import { PayrollPayslipsController } from "./payroll-payslips.controller";
import { PayrollPayslipsService } from "./payroll-payslips.service";
import { PayrollReportsService } from "./payroll-reports.service";
import { PayrollRunsController } from "./payroll-runs.controller";
import { PayrollRunsService } from "./payroll-runs.service";
import { PayrollSettingsService } from "./payroll-settings.service";

@Module({
  controllers: [PayrollConfigController, PayrollRunsController, PayrollPayslipsController],
  providers: [
    PayrollSettingsService,
    PayrollCompensationService,
    PayrollComponentsService,
    PayrollAssignmentsService,
    PayrollPeriodsService,
    PayrollCalculationService,
    PayrollRunsService,
    PayrollAdjustmentsService,
    PayrollPayslipsService,
    PayrollReportsService,
  ],
  exports: [PayrollCalculationService, PayrollRunsService],
})
export class PayrollModule {}
