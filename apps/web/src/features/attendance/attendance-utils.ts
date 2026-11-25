import { useQuery } from "@tanstack/react-query";
import type {
  AttendanceDayStatus,
  EmployeeListItem,
  PaginatedResponse,
} from "@peopleops/shared-types";
import { apiRequest } from "../../lib/http";

export const ATTENDANCE_PAGE_SIZE = 10;

export function todayKey(): string {
  return new Date().toLocaleDateString("en-CA");
}

export function currentMonthKey(): string {
  return todayKey().slice(0, 7);
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return `${hours}h ${String(rest).padStart(2, "0")}m`;
}

export function formatLocal(local: string | null): string {
  if (!local) return "—";
  return local.slice(0, 16).replace("T", " ");
}

export function timeFromLocal(local: string | null): string {
  return local?.slice(11, 16) ?? "";
}

export function statusLabel(status: AttendanceDayStatus): string {
  const labels: Record<AttendanceDayStatus, string> = {
    PRESENT: "Present",
    LATE: "Late",
    EARLY_LEAVE: "Early leave",
    LATE_AND_EARLY_LEAVE: "Late & early",
    ABSENT: "Absent",
    HALF_DAY: "Half day",
    INCOMPLETE: "Incomplete",
    ON_LEAVE: "On leave",
    HOLIDAY: "Holiday",
    OFF: "Day off",
    NO_RECORD: "No record",
  };
  return labels[status];
}

export function statusColor(
  status: AttendanceDayStatus,
): "success" | "warning" | "error" | "neutral" | "primary" {
  if (status === "PRESENT") return "success";
  if (status === "LATE" || status === "LATE_AND_EARLY_LEAVE" || status === "HALF_DAY") {
    return "warning";
  }
  if (status === "ABSENT" || status === "INCOMPLETE") return "error";
  if (status === "ON_LEAVE") return "primary";
  if (status === "HOLIDAY") return "primary";
  if (status === "NO_RECORD") return "primary";
  return "neutral";
}

export function useAttendanceEmployees(enabled = true) {
  return useQuery({
    queryKey: ["employees", "attendance-options"],
    queryFn: () =>
      apiRequest<PaginatedResponse<EmployeeListItem>>(
        "/employees?page=1&pageSize=100&sortBy=name&sortDir=asc",
      ),
    enabled,
  });
}
