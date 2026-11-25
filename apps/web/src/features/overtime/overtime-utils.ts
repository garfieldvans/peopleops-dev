import { useQuery } from "@tanstack/react-query";
import type {
  OvertimeApprovalMode,
  OvertimeCategory,
  OvertimePolicy,
  OvertimeRoundingStrategy,
  OvertimeStatus,
} from "@peopleops/shared-types";
import { apiRequest } from "../../lib/http";

export const OVERTIME_PAGE_SIZE = 10;

export function todayKey(): string {
  return new Date().toLocaleDateString("en-CA");
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

export function formatMinutes(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function statusLabel(status: OvertimeStatus): string {
  const labels: Record<OvertimeStatus, string> = {
    DRAFT: "Draft",
    PENDING_MANAGER_APPROVAL: "Manager approval",
    PENDING_HR_APPROVAL: "HR approval",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    WITHDRAWN: "Withdrawn",
    PENDING_VERIFICATION: "Pending verification",
    VERIFIED: "Verified",
    CANCELLED: "Cancelled",
  };
  return labels[status];
}

export function statusColor(
  status: OvertimeStatus,
): "success" | "warning" | "error" | "neutral" | "primary" {
  if (status === "VERIFIED") return "success";
  if (status === "APPROVED") return "primary";
  if (status.startsWith("PENDING")) return "warning";
  if (status === "REJECTED") return "error";
  if (status === "CANCELLED" || status === "WITHDRAWN") return "neutral";
  return "primary";
}

export function categoryLabel(category: OvertimeCategory): string {
  const labels: Record<OvertimeCategory, string> = {
    WEEKDAY: "Weekday",
    WEEKEND: "Weekend",
    HOLIDAY: "Holiday",
    REST_DAY: "Rest day",
  };
  return labels[category];
}

export function approvalModeLabel(mode: OvertimeApprovalMode): string {
  const labels: Record<OvertimeApprovalMode, string> = {
    MANAGER: "Manager",
    HR: "HR",
    MANAGER_AND_HR: "Manager, then HR",
  };
  return labels[mode];
}

export function roundingLabel(strategy: OvertimeRoundingStrategy): string {
  const labels: Record<OvertimeRoundingStrategy, string> = {
    NONE: "No rounding",
    ROUND_DOWN: "Round down",
    ROUND_UP: "Round up",
    NEAREST: "Nearest",
  };
  return labels[strategy];
}

export function toIsoInstant(value: string): string {
  return new Date(value).toISOString();
}

export function toLocalInputValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function useOvertimePolicies(enabled = true) {
  return useQuery({
    queryKey: ["overtime", "policies", "active"],
    queryFn: () => apiRequest<OvertimePolicy[]>("/overtime/policies/active"),
    enabled,
    staleTime: 60_000,
  });
}
