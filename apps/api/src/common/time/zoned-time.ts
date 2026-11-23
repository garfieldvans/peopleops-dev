import { DateTime } from "luxon";

/**
 * All attendance wall-clock values are interpreted in the company timezone.
 * Instants are persisted as UTC `Date` values; date-only business values use
 * `YYYY-MM-DD` strings and never pass through `new Date("YYYY-MM-DD")`.
 */

export const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDateKey(value: string): boolean {
  if (!DATE_KEY_PATTERN.test(value)) return false;
  return DateTime.fromISO(value, { zone: "utc" }).isValid;
}

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

export function dateKeyOf(date: Date, timezone: string): string {
  return DateTime.fromJSDate(date, { zone: timezone }).toFormat("yyyy-MM-dd");
}

export function timeOf(date: Date, timezone: string): string {
  return DateTime.fromJSDate(date, { zone: timezone }).toFormat("HH:mm");
}

export function localDateTimeOf(date: Date, timezone: string): string {
  return DateTime.fromJSDate(date, { zone: timezone }).toFormat("yyyy-MM-dd'T'HH:mm:ss");
}

/** Combines a local date and `HH:mm` time into a UTC instant. */
export function zonedDateTimeToUtc(dateKey: string, time: string, timezone: string): Date {
  const value = DateTime.fromISO(`${dateKey}T${time}`, { zone: timezone });
  if (!value.isValid) {
    throw new Error(`Invalid zoned date-time: ${dateKey} ${time} (${timezone})`);
  }
  return value.toUTC().toJSDate();
}

/** Adds calendar days to a date-only key without involving the server timezone. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  return DateTime.fromISO(dateKey, { zone: "utc" }).plus({ days }).toFormat("yyyy-MM-dd");
}

/** ISO weekday (1 = Monday … 7 = Sunday) for a date-only key. */
export function isoWeekday(dateKey: string): number {
  return DateTime.fromISO(dateKey, { zone: "utc" }).weekday;
}

export function daysInMonth(dateKey: string): string[] {
  const start = DateTime.fromISO(dateKey, { zone: "utc" }).startOf("month");
  const days: string[] = [];
  const count = start.daysInMonth ?? 30;
  for (let day = 0; day < count; day += 1) {
    days.push(start.plus({ days: day }).toFormat("yyyy-MM-dd"));
  }
  return days;
}

export function monthKeyOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function minutesBetween(from: Date, to: Date): number {
  return Math.trunc((to.getTime() - from.getTime()) / 60_000);
}

/** Wall-clock difference in minutes for an overnight shift. */
export function shiftDurationMinutes(startTime: string, endTime: string): number {
  const [startHour = 0, startMinute = 0] = startTime.split(":").map(Number);
  const [endHour = 0, endMinute = 0] = endTime.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  return end > start ? end - start : end + 24 * 60 - start;
}

export function isOvernight(startTime: string, endTime: string): boolean {
  return endTime <= startTime;
}
