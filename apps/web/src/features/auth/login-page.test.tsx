import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../lib/http";
import { LoginPage } from "./login-page";

const authState = vi.hoisted(() => ({
  status: "anonymous" as "anonymous" | "authenticated",
  user: null,
  login: vi.fn<(email: string, password: string) => Promise<void>>(),
  logout: vi.fn(),
  hasPermission: vi.fn(() => false),
}));

vi.mock("./auth-context", () => ({ useAuth: () => authState }));

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>overview</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    authState.status = "anonymous";
    authState.login.mockReset();
  });

  it("validates required fields before calling the API", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findAllByText(/required/i);
    expect(authState.login).not.toHaveBeenCalled();
  });

  it("shows the API error when credentials are rejected", async () => {
    const user = userEvent.setup();
    authState.login.mockRejectedValue(
      new ApiRequestError("Invalid email or password", 401, "INVALID_CREDENTIALS"),
    );
    renderLogin();

    await user.type(screen.getByLabelText("Email"), "admin@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
    });
  });

  it("navigates to the overview after a successful sign-in", async () => {
    const user = userEvent.setup();
    authState.login.mockResolvedValue(undefined);
    renderLogin();

    await user.type(screen.getByLabelText("Email"), "admin@example.com");
    await user.type(screen.getByLabelText("Password"), "CorrectPassword123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByText("overview")).toBeInTheDocument();
    });
  });
});
