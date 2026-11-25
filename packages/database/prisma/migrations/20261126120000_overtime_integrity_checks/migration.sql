-- Enforce invariants that the service already validates so direct writes cannot
-- create ambiguous scopes or impossible overtime windows.

ALTER TABLE "overtime_policies"
  ADD CONSTRAINT "overtime_policies_effective_range_check"
  CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from");

ALTER TABLE "overtime_policy_assignments"
  ADD CONSTRAINT "overtime_policy_assignments_scope_check"
  CHECK (
    (("employee_id" IS NOT NULL)::int +
     ("department_id" IS NOT NULL)::int +
     ("branch_id" IS NOT NULL)::int) = 1
  ),
  ADD CONSTRAINT "overtime_policy_assignments_effective_range_check"
  CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from");

ALTER TABLE "overtime_requests"
  ADD CONSTRAINT "overtime_requests_planned_window_check"
  CHECK ("planned_end_at" > "planned_start_at"),
  ADD CONSTRAINT "overtime_requests_planned_break_check"
  CHECK ("planned_break_minutes" >= 0),
  ADD CONSTRAINT "overtime_requests_actual_window_check"
  CHECK (
    ("actual_start_at" IS NULL AND "actual_end_at" IS NULL)
    OR (
      "actual_start_at" IS NOT NULL
      AND "actual_end_at" IS NOT NULL
      AND "actual_end_at" > "actual_start_at"
    )
  ),
  ADD CONSTRAINT "overtime_requests_actual_break_check"
  CHECK ("actual_break_minutes" IS NULL OR "actual_break_minutes" >= 0),
  ADD CONSTRAINT "overtime_requests_minutes_check"
  CHECK (
    "requested_minutes" >= 0
    AND ("actual_minutes" IS NULL OR "actual_minutes" >= 0)
    AND ("verified_minutes" IS NULL OR (
      "actual_minutes" IS NOT NULL
      AND "verified_minutes" >= 0
      AND "verified_minutes" <= "actual_minutes"
    ))
    AND ("approved_minutes" IS NULL OR "approved_minutes" >= 0)
  );
