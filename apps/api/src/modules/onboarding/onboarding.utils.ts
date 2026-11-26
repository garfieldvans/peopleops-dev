import type { Employee } from "@peopleops/database";

export function dateKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function isoDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function displayName(employee: Pick<Employee, "firstName" | "middleName" | "lastName">): string {
  return [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(" ");
}

export function isOverdue(dueDate: Date | null, status: string, today: string): boolean {
  return Boolean(dueDate) && status !== "COMPLETED" && isoDate(dueDate)! < today;
}
