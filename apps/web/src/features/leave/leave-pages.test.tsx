import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@nemo-ui/ui";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeaveBalance, LeaveDashboard } from "@peopleops/shared-types";
import { LeaveDashboardPage } from "./leave-dashboard-page";
import { MyLeaveBalancePage } from "./my-leave-balance-page";

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

const balance: LeaveBalance = {
  employeeId: "emp-1",
  employeeNumber: "EMP-0002",
  employeeName: "Rina Lestari",
  leaveType: { id: "lt-1", name: "Annual Leave", code: "ANNUAL", isPaid: true },
  periodStart: "2026-01-01",
  periodEnd: "2026-12-31",
  entitled: 12,
  used: 2,
  reserved: 1,
  available: 9,
  unit: "DAY",
  policy: { id: "pol-1", name: "Annual Policy", code: "ANNUAL-POL" },
};

const dashboard: LeaveDashboard = {
  date: "2026-11-24",
  balances: [balance],
  pendingRequests: 2,
  approvedThisMonth: 3,
  upcoming: [],
  inboxCount: 1,
};

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ToastProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>
    </ToastProvider>,
  );
}

describe("Leave pages", () => {
  beforeEach(() => {
    authState.hasPermission.mockReturnValue(true);
    apiRequestMock.mockReset();
  });

  it("renders dashboard counts, balances, and permission-aware actions", async () => {
    apiRequestMock.mockResolvedValueOnce(dashboard);

    renderWithProviders(<LeaveDashboardPage />);

    expect(await screen.findByText("Annual Leave")).toBeInTheDocument();
    expect(screen.getByText("Awaiting your review")).toBeInTheDocument();
    expect(screen.getByText("Request leave")).toBeInTheDocument();
    expect(screen.getByText("Approval inbox (1)")).toBeInTheDocument();
    expect(screen.getByText("No upcoming leave.")).toBeInTheDocument();
    expect(apiRequestMock).toHaveBeenCalledWith("/leave-requests/dashboard");
  });

  it("shows an empty balance state when no policy is assigned", async () => {
    apiRequestMock.mockResolvedValueOnce([]);

    renderWithProviders(<MyLeaveBalancePage />);

    expect(await screen.findByText("No leave balance yet")).toBeInTheDocument();
    expect(screen.queryByText("Balance details")).not.toBeInTheDocument();
  });

  it("renders ledger totals for the signed-in employee", async () => {
    apiRequestMock.mockResolvedValueOnce([balance]);

    renderWithProviders(<MyLeaveBalancePage />);

    expect(await screen.findByText("Balance details")).toBeInTheDocument();
    expect(screen.getAllByText("Annual Leave")).toHaveLength(2);
    expect(screen.getAllByText("9").length).toBeGreaterThan(0);
    expect(screen.getByText("1 day")).toBeInTheDocument();
  });

  it("shows an error state when balances cannot be loaded", async () => {
    apiRequestMock.mockRejectedValueOnce(new Error("Service unavailable"));

    renderWithProviders(<MyLeaveBalancePage />);

    expect(await screen.findByText("Could not load your leave balances")).toBeInTheDocument();
  });
});
