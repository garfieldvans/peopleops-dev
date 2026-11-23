import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

const authState = vi.hoisted(() => ({
  status: "authenticated" as const,
  user: {
    id: "user-1",
    name: "HR Admin",
    email: "hr@example.com",
    status: "ACTIVE" as const,
    roles: [{ id: "role-1", code: "HR_ADMIN", name: "HR Administrator" }],
    permissions: ["user.read"],
    lastLoginAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    session: {
      id: "session-1",
      expiresAt: "2026-01-02T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  },
  login: vi.fn(),
  logout: vi.fn(),
  hasPermission: vi.fn<(permission: string) => boolean>(
    (permission: string) => permission === "user.read",
  ),
}));

vi.mock("../features/auth/auth-context", () => ({ useAuth: () => authState }));

describe("AppShell navigation", () => {
  it("shows only navigation items the user may access", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<div>overview</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Roles" })).not.toBeInTheDocument();
    expect(screen.getByText("HR Administrator")).toBeInTheDocument();
  });
});
