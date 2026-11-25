import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@nemo-ui/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PayrollPayslip, PayrollRunDetail } from "@peopleops/shared-types";
import { MyPayslipsPage } from "./my-payslips-page";
import { PayrollReportsPage } from "./payroll-reports-page";
import { PayrollRunDetailPage } from "./payroll-run-detail-page";

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
  downloadFile: vi.fn(),
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

function page<T>(items: T[]) {
  return { items, page: 1, pageSize: 20, total: items.length, totalPages: 1 };
}

function payslip(overrides: Partial<PayrollPayslip> = {}): PayrollPayslip {
  return {
    id: "payslip-1",
    runId: "run-1",
    period: {
      id: "period-1",
      name: "November 2026",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      paymentDate: "2026-11-30",
    },
    employeeId: "employee-1",
    employeeNumber: "EMP-0001",
    employeeName: "Prita Payroll",
    department: "Finance",
    position: "Payroll Specialist",
    currency: "IDR",
    baseSalary: "10000000.00",
    grossPay: "11000000.00",
    totalDeductions: "250000.00",
    employerContributions: "0.00",
    netPay: "10750000.00",
    warnings: [],
    publishedAt: "2026-11-30T10:00:00.000Z",
    createdAt: "2026-11-30T09:00:00.000Z",
    ...overrides,
  };
}

function run(overrides: Partial<PayrollRunDetail> = {}): PayrollRunDetail {
  return {
    id: "run-1",
    period: {
      id: "period-1",
      name: "November 2026",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      paymentDate: "2026-11-30",
      status: "OPEN",
    },
    runNumber: 1,
    status: "UNDER_REVIEW",
    calculationVersion: 2,
    currency: "IDR",
    grossTotal: "11000000.00",
    deductionTotal: "250000.00",
    netTotal: "10750000.00",
    employerContributionTotal: "0.00",
    warnings: [],
    employeeCount: 1,
    calculatedAt: "2026-11-30T09:00:00.000Z",
    reviewedAt: "2026-11-30T09:30:00.000Z",
    approvedAt: null,
    publishedAt: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: "2026-11-30T08:00:00.000Z",
    updatedAt: "2026-11-30T09:30:00.000Z",
    approvals: [],
    ...overrides,
  };
}

function renderWithProviders(ui: ReactNode, initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ToastProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>
      </QueryClientProvider>
    </ToastProvider>,
  );
}

describe("Payroll screens", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    authState.hasPermission.mockReturnValue(true);
  });

  it("renders a permission-denied state without payslip permission", () => {
    authState.hasPermission.mockReturnValue(false);
    renderWithProviders(<MyPayslipsPage />, "/payroll/payslips");
    expect(screen.getByText(/do not have access/i)).toBeInTheDocument();
  });

  it("lists published payslips with net pay and a PDF action", async () => {
    apiRequestMock.mockResolvedValue(page([payslip()]));
    renderWithProviders(<MyPayslipsPage />, "/payroll/payslips");
    expect(await screen.findByText("Prita Payroll")).toBeInTheDocument();
    expect(screen.getByText("Rp 10.750.000,00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PDF" })).toBeInTheDocument();
  });

  it("shows range-wide register totals with server pagination", async () => {
    const user = userEvent.setup();
    apiRequestMock.mockImplementation((path: string) => {
      if (path.startsWith("/payroll/reports/summary")) {
        return Promise.resolve({
          from: "2026-03-01",
          to: "2026-03-31",
          runCount: 1,
          payslipCount: 2,
          grossTotal: "37581502.89",
          deductionTotal: "3000000.00",
          netTotal: "34581502.89",
          employerContributionTotal: "500000.00",
          rows: [],
        });
      }
      if (path.startsWith("/payroll/reports/components")) {
        return Promise.resolve({ from: "2026-03-01", to: "2026-03-31", rows: [] });
      }
      if (path.startsWith("/payroll/reports/register")) {
        return Promise.resolve({
          from: "2026-03-01",
          to: "2026-03-31",
          rows: [
            {
              payslipId: "payslip-1",
              employeeId: "employee-1",
              employeeNumber: "EMP-0001",
              employeeName: "Prita Payroll",
              department: "Finance",
              position: "Payroll Specialist",
              currency: "IDR",
              grossPay: "13000000.00",
              totalDeductions: "0.00",
              netPay: "13000000.00",
              employerContributions: "0.00",
              status: "PUBLISHED",
              paymentDate: "2026-03-31",
            },
          ],
          totals: {
            grossPay: "37581502.89",
            totalDeductions: "3000000.00",
            netPay: "34581502.89",
            employerContributions: "500000.00",
          },
          page: 1,
          pageSize: 20,
          total: 2,
          totalPages: 2,
        });
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });

    renderWithProviders(<PayrollReportsPage />, "/payroll/reports");
    await user.click(await screen.findByRole("tab", { name: "Register" }));
    expect(await screen.findByText("Prita Payroll")).toBeInTheDocument();
    expect(screen.getByText(/Totals for all 2 rows/)).toBeInTheDocument();
  });

  it("shows approval only for a run under review and hides publish", async () => {
    apiRequestMock.mockImplementation((path: string) => {
      if (path === "/payroll/runs/run-1") return Promise.resolve(run());
      if (path.startsWith("/payroll/payslips?")) return Promise.resolve(page([]));
      if (path.startsWith("/payroll/adjustments?")) return Promise.resolve(page([]));
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });

    renderWithProviders(
      <Routes>
        <Route path="/payroll/runs/:id" element={<PayrollRunDetailPage />} />
      </Routes>,
      "/payroll/runs/run-1",
    );

    expect(await screen.findByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    expect(screen.getByText("UNDER REVIEW")).toBeInTheDocument();
  });
});
