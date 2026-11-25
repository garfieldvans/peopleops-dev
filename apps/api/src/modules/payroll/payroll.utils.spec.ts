import Decimal from "decimal.js";
import { dateKey, decimal, isoDate, money, percentOf } from "./payroll.utils";

describe("payroll utilities", () => {
  it("keeps money arithmetic in Decimal instead of floating point", () => {
    expect(decimal("0.1").plus(decimal("0.2")).toString()).toBe("0.3");
    expect(decimal("10.005").toString()).toBe("10.005");
  });

  it("rounds HALF_UP by default", () => {
    expect(money(new Decimal("10.005"), 2).toFixed(2)).toBe("10.01");
    expect(money(new Decimal("10.004"), 2).toFixed(2)).toBe("10.00");
  });

  it("honours ROUND_DOWN and ROUND_UP", () => {
    expect(money(new Decimal("10.009"), 2, "ROUND_DOWN").toFixed(2)).toBe("10.00");
    expect(money(new Decimal("10.001"), 2, "ROUND_UP").toFixed(2)).toBe("10.01");
  });

  it("calculates percentages without binary drift", () => {
    expect(percentOf(decimal("10000000"), decimal("2.5")).toFixed(2)).toBe("250000.00");
  });

  it("round-trips date keys as UTC date-only values", () => {
    const date = dateKey("2026-02-01");
    expect(date.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(isoDate(date)).toBe("2026-02-01");
  });
});
