-- CreateIndex
CREATE INDEX "overtime_requests_employee_id_planned_start_at_planned_end__idx" ON "overtime_requests"("employee_id", "planned_start_at", "planned_end_at");
