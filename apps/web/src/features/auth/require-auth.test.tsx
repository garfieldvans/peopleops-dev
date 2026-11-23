import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { RequireAuth, RequirePermission } from "./require-auth";

const authState = vi.hoisted(() => ({
  status: "anonymous" as "anonymous" | "authenticated",
  user: null,
  login: vi.fn(),
  logout: vi.fn(),
  hasPermission: vi.fn<(permission: string) => boolean>(() => false),
}));

vi.mock("./auth-context", () => ({ useAuth: () => authState }));

describe("route guards", () => {
  it("redirects anonymous visitors to the login page", () => {
    authState.status = "anonymous";
    render(
      <MemoryRouter initialEntries={["/users"]}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/users" element={<div>users page</div>} />
          </Route>
          <Route path="/login" element={<div>login screen</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("login screen")).toBeInTheDocument();
    expect(screen.queryByText("users page")).not.toBeInTheDocument();
  });

  it("sends authenticated users without the permission to the forbidden page", () => {
    authState.status = "authenticated";
    authState.hasPermission.mockReturnValue(false);
    render(
      <MemoryRouter initialEntries={["/users"]}>
        <Routes>
          <Route path="/forbidden" element={<div>forbidden page</div>} />
          <Route
            path="/users"
            element={
              <RequirePermission permission="user.read">
                <div>users page</div>
              </RequirePermission>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("forbidden page")).toBeInTheDocument();
  });
});
