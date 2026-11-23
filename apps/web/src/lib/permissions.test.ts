import { describe, expect, it } from "vitest";
import { userHasPermission } from "./permissions";

describe("userHasPermission", () => {
  it("grants a permission the user holds", () => {
    expect(userHasPermission({ permissions: ["user.read"] }, "user.read")).toBe(true);
  });

  it("denies a permission the user does not hold", () => {
    expect(userHasPermission({ permissions: ["user.read"] }, "role.read")).toBe(false);
  });

  it("denies everything for anonymous users", () => {
    expect(userHasPermission(null, "user.read")).toBe(false);
  });
});
