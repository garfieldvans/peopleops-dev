import Decimal from "decimal.js";

export type PayrollActor = {
  actorUserId: string;
  actorEmail: string;
  meta: { ip: string | null; userAgent: string | null };
};

export function dateKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function decimal(value: string | number | Decimal | null | undefined): Decimal {
  if (value === null || value === undefined || value === "") return new Decimal(0);
  return new Decimal(value.toString());
}

export type PayrollRounding = "HALF_UP" | "ROUND_DOWN" | "ROUND_UP";

function roundingMode(mode: PayrollRounding): Decimal.Rounding {
  if (mode === "ROUND_DOWN") return Decimal.ROUND_DOWN;
  if (mode === "ROUND_UP") return Decimal.ROUND_UP;
  return Decimal.ROUND_HALF_UP;
}

export function money(value: Decimal, scale = 2, mode: PayrollRounding = "HALF_UP"): Decimal {
  return value.toDecimalPlaces(scale, roundingMode(mode));
}

export function moneyString(
  value: Decimal,
  scale = 2,
  mode: PayrollRounding = "HALF_UP",
): string {
  return money(value, scale, mode).toFixed(scale);
}

export function displayName(row: {
  firstName: string;
  lastName: string;
  preferredName: string | null;
}): string {
  return row.preferredName?.trim() || `${row.firstName} ${row.lastName}`.trim();
}

export function periodMonthRange(today: string): { from: string; to: string } {
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

export function percentOf(base: Decimal, percentage: Decimal): Decimal {
  return base.mul(percentage).div(100);
}
