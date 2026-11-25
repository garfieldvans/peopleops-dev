import { useQuery } from "@tanstack/react-query";
import type {
  LeaveAccrualMethod,
  LeaveApprovalMode,
  LeaveBalance,
  LeaveHalfDayPeriod,
  LeavePolicy,
  LeaveRequestMode,
  LeaveRequestStatus,
  LeaveTransactionType,
  LeaveType,
  PaginatedResponse,
} from "@peopleops/shared-types";
import { apiRequest } from "../../lib/http";

export const LEAVE_PAGE_SIZE = 10;

export function todayKey(): string {
  return new Date().toLocaleDateString("en-CA");
}

export function currentMonthKey(): string {
  return todayKey().slice(0, 7);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatQuantity(value: number, unit: "DAY" | "HOUR" = "DAY"): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded} ${unit === "HOUR" ? "hour" : "day"}${rounded === 1 ? "" : "s"}`;
}

export function statusLabel(status: LeaveRequestStatus): string {
  const labels: Record<LeaveRequestStatus, string> = {
    DRAFT: "Draft",
    PENDING: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
    WITHDRAWN: "Withdrawn",
  };
  return labels[status];
}

export function statusColor(
  status: LeaveRequestStatus,
): "success" | "warning" | "error" | "neutral" | "primary" {
  if (status === "APPROVED") return "success";
  if (status === "PENDING") return "warning";
  if (status === "REJECTED") return "error";
  if (status === "DRAFT") return "primary";
  return "neutral";
}

export function requestModeLabel(mode: LeaveRequestMode): string {
  if (mode === "HALF_DAY") return "Half day";
  if (mode === "HOURLY") return "Hourly";
  return "Full day";
}

export function halfDayLabel(period: LeaveHalfDayPeriod | null): string {
  if (period === "FIRST_HALF") return "First half";
  if (period === "SECOND_HALF") return "Second half";
  return "—";
}

export function transactionTypeLabel(type: LeaveTransactionType): string {
  const labels: Record<LeaveTransactionType, string> = {
    OPENING_BALANCE: "Opening balance",
    ENTITLEMENT: "Entitlement",
    ACCRUAL: "Accrual",
    LEAVE_DEDUCTION: "Leave deduction",
    LEAVE_REVERSAL: "Leave reversal",
    CARRY_OVER: "Carry over",
    EXPIRATION: "Expiration",
    ADJUSTMENT: "Adjustment",
  };
  return labels[type];
}

export function accrualMethodLabel(method: LeaveAccrualMethod): string {
  const labels: Record<LeaveAccrualMethod, string> = {
    GRANTED_UPFRONT: "Granted upfront",
    MONTHLY_ACCRUAL: "Monthly accrual",
    ANNUAL_ACCRUAL: "Annual accrual",
    MANUAL_GRANT: "Manual grant",
  };
  return labels[method];
}

export function approvalModeLabel(mode: LeaveApprovalMode): string {
  const labels: Record<LeaveApprovalMode, string> = {
    MANAGER: "Manager",
    HR: "HR",
    MANAGER_AND_HR: "Manager, then HR",
  };
  return labels[mode];
}

export function balanceForType(
  balances: LeaveBalance[] | undefined,
  leaveTypeId: string,
): LeaveBalance | undefined {
  return balances?.find((balance) => balance.leaveType.id === leaveTypeId);
}

export function useLeaveTypes(enabled = true) {
  return useQuery({
    queryKey: ["leave", "types", "active"],
    queryFn: () => apiRequest<LeaveType[]>("/leave-types/active"),
    enabled,
    staleTime: 60_000,
  });
}

export function useLeavePolicies(enabled = true) {
  return useQuery({
    queryKey: ["leave", "policies", "active"],
    queryFn: () => apiRequest<LeavePolicy[]>("/leave-policies/active"),
    enabled,
    staleTime: 60_000,
  });
}

export function useMyLeaveBalances(enabled = true) {
  return useQuery({
    queryKey: ["leave", "balances", "me"],
    queryFn: () => apiRequest<LeaveBalance[]>("/leave-balances/me"),
    enabled,
  });
}

export function useLeaveTypesPaged(params: URLSearchParams) {
  return useQuery({
    queryKey: ["leave", "types", "list", params.toString()],
    queryFn: () => apiRequest<PaginatedResponse<LeaveType>>(`/leave-types?${params.toString()}`),
  });
}

export function monthLabel(month: string): string {
  const year = Number(month.slice(0, 4));
  const value = Number(month.slice(5, 7));
  if (!year || !value) return month;
  return new Date(year, value - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

export function daysInMonth(month: string): number {
  const year = Number(month.slice(0, 4));
  const value = Number(month.slice(5, 7));
  return new Date(year, value, 0).getDate();
}

export function weekdayHeaders(): string[] {
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
}
