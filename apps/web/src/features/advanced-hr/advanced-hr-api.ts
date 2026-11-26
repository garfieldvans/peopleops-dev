import { useQuery } from "@tanstack/react-query";
import type {
  AttendanceLeaveReport,
  EmployeeListItem,
  EmployeeOffboarding,
  EmployeeOffboardingDetail,
  EmployeeOnboarding,
  EmployeeOnboardingDetail,
  EmployeeReport,
  HrDashboard,
  LearningReport,
  OffboardingReport,
  OffboardingTemplate,
  OnboardingReport,
  OnboardingTemplate,
  OvertimePayrollReport,
  PaginatedResponse,
  PerformanceCycle,
  PerformanceGoal,
  PerformanceGoalDetail,
  PerformanceReport,
  PerformanceReview,
  TrainingEnrollment,
  TrainingProgram,
  TrainingProgramDetail,
  UserSummary,
} from "@peopleops/shared-types";
import { apiRequest } from "../../lib/http";

export const HR_PAGE_SIZE = 20;

export function pageQuery(params: URLSearchParams): string {
  return params.toString();
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatMoney(value: string, currency = "IDR"): string {
  const numeric = Number(value);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder}m`;
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (character) => character.toUpperCase());
}

export function todayKey(): string {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function monthStartKey(): string {
  return `${todayKey().slice(0, 7)}-01`;
}

export function statusColor(
  status: string,
): "neutral" | "primary" | "success" | "warning" | "error" {
  if (["COMPLETED", "PUBLISHED", "APPROVED", "ACHIEVED", "ACTIVE", "ONGOING"].includes(status))
    return "success";
  if (["CANCELLED", "REJECTED", "FAILED", "TERMINATED", "MISSED"].includes(status)) return "error";
  if (["IN_PROGRESS", "REVIEW_IN_PROGRESS", "SUBMITTED", "REQUESTED", "PENDING"].includes(status))
    return "warning";
  if (["ENROLLED", "INITIATED", "NOT_STARTED", "DRAFT"].includes(status)) return "neutral";
  return "primary";
}

export function useEmployees(enabled = true) {
  return useQuery({
    queryKey: ["employees", "advanced-hr-options"],
    queryFn: () =>
      apiRequest<PaginatedResponse<EmployeeListItem>>("/employees?pageSize=100&sortBy=name"),
    enabled,
    staleTime: 60_000,
  });
}

export function employeeOptions(data: EmployeeListItem[] | undefined) {
  return (
    data?.map((employee) => ({
      label: `${employee.fullName} · ${employee.employeeNumber}`,
      value: employee.id,
      description: [employee.department?.name, employee.position?.name].filter(Boolean).join(" · "),
    })) ?? []
  );
}

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: ["users", "advanced-hr-options"],
    queryFn: () => apiRequest<PaginatedResponse<UserSummary>>("/users?pageSize=100"),
    enabled,
    staleTime: 60_000,
  });
}

export function userOptions(data: UserSummary[] | undefined) {
  return data?.map((user) => ({ label: user.name, value: user.id })) ?? [];
}

export function useOnboardingTemplates(params: URLSearchParams, enabled = true) {
  return useQuery({
    queryKey: ["advanced-hr", "onboarding", "templates", pageQuery(params)],
    queryFn: () =>
      apiRequest<PaginatedResponse<OnboardingTemplate>>(
        `/onboarding/templates?${params.toString()}`,
      ),
    enabled,
  });
}

export function useOnboardingRecords(params: URLSearchParams) {
  return useQuery({
    queryKey: ["advanced-hr", "onboarding", "records", pageQuery(params)],
    queryFn: () =>
      apiRequest<PaginatedResponse<EmployeeOnboarding>>(`/onboarding/records?${params.toString()}`),
  });
}

export function useOnboardingRecord(id: string | undefined) {
  return useQuery({
    queryKey: ["advanced-hr", "onboarding", "records", id],
    queryFn: () => apiRequest<EmployeeOnboardingDetail>(`/onboarding/records/${id}`),
    enabled: Boolean(id),
  });
}

export function useOffboardingTemplates(params: URLSearchParams, enabled = true) {
  return useQuery({
    queryKey: ["advanced-hr", "offboarding", "templates", pageQuery(params)],
    queryFn: () =>
      apiRequest<PaginatedResponse<OffboardingTemplate>>(
        `/offboarding/templates?${params.toString()}`,
      ),
    enabled,
  });
}

export function useOffboardingRecords(params: URLSearchParams) {
  return useQuery({
    queryKey: ["advanced-hr", "offboarding", "records", pageQuery(params)],
    queryFn: () =>
      apiRequest<PaginatedResponse<EmployeeOffboarding>>(
        `/offboarding/records?${params.toString()}`,
      ),
  });
}

export function useOffboardingRecord(id: string | undefined) {
  return useQuery({
    queryKey: ["advanced-hr", "offboarding", "records", id],
    queryFn: () => apiRequest<EmployeeOffboardingDetail>(`/offboarding/records/${id}`),
    enabled: Boolean(id),
  });
}

export function usePerformanceCycles(params: URLSearchParams) {
  return useQuery({
    queryKey: ["advanced-hr", "performance", "cycles", pageQuery(params)],
    queryFn: () =>
      apiRequest<PaginatedResponse<PerformanceCycle>>(`/performance/cycles?${params.toString()}`),
  });
}

export function usePerformanceCycle(id: string | undefined) {
  return useQuery({
    queryKey: ["advanced-hr", "performance", "cycles", id],
    queryFn: () => apiRequest<PerformanceCycle>(`/performance/cycles/${id}`),
    enabled: Boolean(id),
  });
}

export function usePerformanceGoals(params: URLSearchParams) {
  return useQuery({
    queryKey: ["advanced-hr", "performance", "goals", pageQuery(params)],
    queryFn: () =>
      apiRequest<PaginatedResponse<PerformanceGoal>>(`/performance/goals?${params.toString()}`),
  });
}

export function usePerformanceGoal(id: string | undefined) {
  return useQuery({
    queryKey: ["advanced-hr", "performance", "goals", id],
    queryFn: () => apiRequest<PerformanceGoalDetail>(`/performance/goals/${id}`),
    enabled: Boolean(id),
  });
}

export function usePerformanceReviews(params: URLSearchParams) {
  return useQuery({
    queryKey: ["advanced-hr", "performance", "reviews", pageQuery(params)],
    queryFn: () =>
      apiRequest<PaginatedResponse<PerformanceReview>>(`/performance/reviews?${params.toString()}`),
  });
}

export function usePerformanceReview(id: string | undefined) {
  return useQuery({
    queryKey: ["advanced-hr", "performance", "reviews", id],
    queryFn: () => apiRequest<PerformanceReview>(`/performance/reviews/${id}`),
    enabled: Boolean(id),
  });
}

export function useTrainingPrograms(params: URLSearchParams) {
  return useQuery({
    queryKey: ["advanced-hr", "learning", "programs", pageQuery(params)],
    queryFn: () =>
      apiRequest<PaginatedResponse<TrainingProgram>>(`/learning/programs?${params.toString()}`),
  });
}

export function useTrainingProgram(id: string | undefined) {
  return useQuery({
    queryKey: ["advanced-hr", "learning", "programs", id],
    queryFn: () => apiRequest<TrainingProgramDetail>(`/learning/programs/${id}`),
    enabled: Boolean(id),
  });
}

export function useTrainingEnrollments(params: URLSearchParams, enabled = true) {
  return useQuery({
    queryKey: ["advanced-hr", "learning", "enrollments", pageQuery(params)],
    queryFn: () =>
      apiRequest<PaginatedResponse<TrainingEnrollment>>(
        `/learning/enrollments?${params.toString()}`,
      ),
    enabled,
  });
}

export function useMyLearning(enabled = true) {
  return useQuery({
    queryKey: ["advanced-hr", "learning", "my"],
    queryFn: () =>
      apiRequest<{
        enrollments: TrainingEnrollment[];
        certificates: TrainingProgramDetail["documents"];
      }>("/learning/my"),
    enabled,
  });
}

export function useHrDashboard() {
  return useQuery({
    queryKey: ["advanced-hr", "reports", "hr-dashboard"],
    queryFn: () => apiRequest<HrDashboard>("/reports/hr-dashboard"),
  });
}

export function useEmployeeReport(params: URLSearchParams) {
  return useQuery({
    queryKey: ["advanced-hr", "reports", "employees", pageQuery(params)],
    queryFn: () => apiRequest<EmployeeReport>(`/reports/employees?${params.toString()}`),
  });
}

export function useAttendanceLeaveReport(params: URLSearchParams) {
  return useQuery({
    queryKey: ["advanced-hr", "reports", "attendance-leave", pageQuery(params)],
    queryFn: () =>
      apiRequest<AttendanceLeaveReport>(`/reports/attendance?${params.toString()}`),
  });
}

export function useOvertimePayrollReport(params: URLSearchParams) {
  return useQuery({
    queryKey: ["advanced-hr", "reports", "overtime-payroll", pageQuery(params)],
    queryFn: () => apiRequest<OvertimePayrollReport>(`/reports/overtime?${params.toString()}`),
  });
}

export function useOnboardingReport(params: URLSearchParams) {
  return useQuery({
    queryKey: ["advanced-hr", "reports", "onboarding", pageQuery(params)],
    queryFn: () => apiRequest<OnboardingReport>(`/reports/onboarding?${params.toString()}`),
  });
}

export function useOffboardingReport(params: URLSearchParams) {
  return useQuery({
    queryKey: ["advanced-hr", "reports", "offboarding", pageQuery(params)],
    queryFn: () => apiRequest<OffboardingReport>(`/reports/offboarding?${params.toString()}`),
  });
}

export function usePerformanceReport(params: URLSearchParams) {
  return useQuery({
    queryKey: ["advanced-hr", "reports", "performance", pageQuery(params)],
    queryFn: () => apiRequest<PerformanceReport>(`/reports/performance?${params.toString()}`),
  });
}

export function useLearningReport(params: URLSearchParams) {
  return useQuery({
    queryKey: ["advanced-hr", "reports", "learning", pageQuery(params)],
    queryFn: () => apiRequest<LearningReport>(`/reports/learning?${params.toString()}`),
  });
}
