import { useQuery } from "@tanstack/react-query";
import type {
  EmployeeCompensation,
  EmployeeListItem,
  EmployeePayrollAssignment,
  PaginatedResponse,
  PayrollAdjustment,
  PayrollComponent,
  PayrollComponentReport,
  PayrollDashboard,
  PayrollPeriod,
  PayrollPayslip,
  PayrollPayslipDetail,
  PayrollRegister,
  PayrollReportSummary,
  PayrollRun,
  PayrollRunDetail,
  PayrollRunStatus,
  PayrollSetting,
} from "@peopleops/shared-types";
import { apiRequest } from "../../lib/http";

export const PAYROLL_PAGE_SIZE = 20;

export function formatMoney(value: string, currency = "IDR"): string {
  const numeric = Number(value);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Number.isFinite(numeric) ? numeric : 0);
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

export function warningLabel(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (character) => character.toUpperCase());
}

export function runStatusColor(
  status: PayrollRunStatus,
): "neutral" | "primary" | "success" | "warning" | "error" {
  switch (status) {
    case "DRAFT":
      return "neutral";
    case "CALCULATING":
      return "warning";
    case "CALCULATED":
      return "primary";
    case "UNDER_REVIEW":
      return "warning";
    case "APPROVED":
    case "PUBLISHED":
      return "success";
    case "CANCELLED":
      return "error";
    default:
      return "neutral";
  }
}

export function adjustmentStatusColor(
  status: PayrollAdjustment["status"],
): "neutral" | "success" | "warning" | "error" {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "error";
  return "warning";
}

function pageQuery(params: URLSearchParams): string {
  return params.toString();
}

export function usePayrollSettings(enabled = true) {
  return useQuery({
    queryKey: ["payroll", "settings"],
    queryFn: () => apiRequest<PayrollSetting>("/payroll/settings"),
    enabled,
  });
}

export function usePayrollDashboard() {
  return useQuery({
    queryKey: ["payroll", "dashboard"],
    queryFn: () => apiRequest<PayrollDashboard>("/payroll/dashboard"),
  });
}

export function useCompensationList(params: URLSearchParams) {
  return useQuery({
    queryKey: ["payroll", "compensation", pageQuery(params)],
    queryFn: () =>
      apiRequest<PaginatedResponse<EmployeeCompensation>>(`/payroll/compensation?${params}`),
  });
}

export function useCompensationHistory(employeeId: string | null) {
  return useQuery({
    queryKey: ["payroll", "compensation", "history", employeeId],
    queryFn: () =>
      apiRequest<EmployeeCompensation[]>(`/payroll/compensation/employees/${employeeId}/history`),
    enabled: Boolean(employeeId),
  });
}

export function usePayrollComponents(params: URLSearchParams) {
  return useQuery({
    queryKey: ["payroll", "components", pageQuery(params)],
    queryFn: () => apiRequest<PaginatedResponse<PayrollComponent>>(`/payroll/components?${params}`),
  });
}

export function useActivePayrollComponents() {
  return useQuery({
    queryKey: ["payroll", "components", "active"],
    queryFn: () => apiRequest<PayrollComponent[]>("/payroll/components/active"),
    staleTime: 60_000,
  });
}

export function usePayrollAssignments(params: URLSearchParams) {
  return useQuery({
    queryKey: ["payroll", "assignments", pageQuery(params)],
    queryFn: () =>
      apiRequest<PaginatedResponse<EmployeePayrollAssignment>>(`/payroll/assignments?${params}`),
  });
}

export function usePayrollPeriods(params: URLSearchParams) {
  return useQuery({
    queryKey: ["payroll", "periods", pageQuery(params)],
    queryFn: () => apiRequest<PaginatedResponse<PayrollPeriod>>(`/payroll/periods?${params}`),
  });
}

export function useOpenPayrollPeriods() {
  return useQuery({
    queryKey: ["payroll", "periods", "open"],
    queryFn: () => apiRequest<PaginatedResponse<PayrollPeriod>>("/payroll/periods?pageSize=100&status=OPEN"),
    staleTime: 30_000,
  });
}

export function usePayrollRuns(params: URLSearchParams) {
  return useQuery({
    queryKey: ["payroll", "runs", pageQuery(params)],
    queryFn: () => apiRequest<PaginatedResponse<PayrollRun>>(`/payroll/runs?${params}`),
  });
}

export function usePayrollRun(id: string | undefined) {
  return useQuery({
    queryKey: ["payroll", "runs", id],
    queryFn: () => apiRequest<PayrollRunDetail>(`/payroll/runs/${id}`),
    enabled: Boolean(id),
  });
}

export function usePayrollAdjustments(params: URLSearchParams, enabled = true) {
  return useQuery({
    queryKey: ["payroll", "adjustments", pageQuery(params)],
    queryFn: () => apiRequest<PaginatedResponse<PayrollAdjustment>>(`/payroll/adjustments?${params}`),
    enabled,
  });
}

export function usePayslips(params: URLSearchParams, enabled = true) {
  return useQuery({
    queryKey: ["payroll", "payslips", pageQuery(params)],
    queryFn: () => apiRequest<PaginatedResponse<PayrollPayslip>>(`/payroll/payslips?${params}`),
    enabled,
  });
}

export function usePayslip(id: string | undefined) {
  return useQuery({
    queryKey: ["payroll", "payslips", id],
    queryFn: () => apiRequest<PayrollPayslipDetail>(`/payroll/payslips/${id}`),
    enabled: Boolean(id),
  });
}

export function usePayrollSummaryReport(from: string, to: string) {
  return useQuery({
    queryKey: ["payroll", "reports", "summary", from, to],
    queryFn: () =>
      apiRequest<PayrollReportSummary>(`/payroll/reports/summary?from=${from}&to=${to}`),
  });
}

export function usePayrollComponentReport(from: string, to: string) {
  return useQuery({
    queryKey: ["payroll", "reports", "components", from, to],
    queryFn: () =>
      apiRequest<PayrollComponentReport>(`/payroll/reports/components?from=${from}&to=${to}`),
  });
}

export function usePayrollRegisterReport(from: string, to: string, page = 1) {
  const params = new URLSearchParams({
    from,
    to,
    page: String(page),
    pageSize: String(PAYROLL_PAGE_SIZE),
  });
  return useQuery({
    queryKey: ["payroll", "reports", "register", from, to, page],
    queryFn: () => apiRequest<PayrollRegister>(`/payroll/reports/register?${params}`),
  });
}

export function usePayrollEmployeeOptions(enabled = true) {
  return useQuery({
    queryKey: ["employees", "payroll-options"],
    queryFn: () =>
      apiRequest<PaginatedResponse<EmployeeListItem>>("/employees?pageSize=100&sortBy=name"),
    enabled,
    staleTime: 60_000,
  });
}

export function employeeOptions(data: EmployeeListItem[] | undefined) {
  return (
    data
      ?.filter(
        (employee) =>
          employee.employmentStatus === "ACTIVE" || employee.employmentStatus === "PROBATION",
      )
      .map((employee) => ({
        label: `${employee.fullName} · ${employee.employeeNumber}`,
        value: employee.id,
        description: [employee.department?.name, employee.position?.name]
          .filter(Boolean)
          .join(" · "),
      })) ?? []
  );
}

export function todayKey(): string {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function monthStartKey(): string {
  return `${todayKey().slice(0, 7)}-01`;
}
