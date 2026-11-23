import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@nemo-ui/ui";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttendanceDashboard, AttendanceOverview } from "@peopleops/shared-types";
import { DashboardPage } from "./dashboard-page";

const apiRequestMock = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  status: "authenticated" as const,
  user: null,
  login: vi.fn(),
  logout: vi.fn(),
  hasPermission: vi.fn<(permission: string) => boolean>(() => true),
}));

vi.mock("../../lib/http", () => ({
  apiRequest: apiRequestMock,
  ApiRequestError: class ApiRequestError extends Error {
    constructor(
      message: string,
      readonly status = 500,
      readonly code = "REQUEST_FAILED",
    ) {
      super(message);
    }
  },
}));

vi.mock("../auth/auth-context", () => ({ useAuth: () => authState }));

const dashboard: AttendanceDashboard = {
  date: "2026-11-23",
  timezone: "Asia/Jakarta",
  employee: { id: "emp-1", employeeNumber: "EMP-0002", fullName: "Rina Lestari" },
  state: "NOT_CLOCKED_IN",
  schedule: {
    workSchedule: { id: "ws-1", name: "Standard Weekday", code: "WS-STANDARD" },
    shift: null,
    scheduledStartLocal: "2026-11-23T08:00:00",
    scheduledEndLocal: "2026-11-23T17:00:00",
  },
  holiday: null,
  record: null,
  pendingCorrections: 0,
};

const overview: AttendanceOverview = {
  date: "2026-11-23",
  timezone: "Asia/Jakarta",
  scheduledEmployees: 4,
  present: 3,
  late: 1,
  absent: 0,
  incomplete: 0,
  pendingCorrections: 2,
};

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ToastProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    </ToastProvider>,
  );
}

describe("DashboardPage attendance", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    authState.hasPermission.mockReturnValue(true);
    apiRequestMock.mockImplementation((path: string) => {
      if (path === "/attendance/dashboard") return Promise.resolve(dashboard);
      if (path === "/attendance/overview") return Promise.resolve(overview);
      if (path === "/attendance/clock-in") return Promise.resolve({});
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
  });

  it("shows today's schedule and HR overview", async () => {
    renderDashboard();

    expect(await screen.findByText("Standard Weekday")).toBeInTheDocument();
    expect(screen.getByText("Scheduled today")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("clocks in from the dashboard", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(await screen.findByRole("button", { name: "Clock in" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/attendance/clock-in", { method: "POST" });
    });
  });
});
