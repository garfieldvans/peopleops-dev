import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@nemo-ui/ui";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { Control, FieldValues } from "react-hook-form";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  LeaveBalance,
  LeaveCalendar,
  LeaveRequest,
  LeaveRequestPreview,
  LeaveType,
  PaginatedResponse,
} from "@peopleops/shared-types";
import { LeaveApprovalInboxPage } from "./leave-approval-inbox-page";
import { LeaveCalendarPage } from "./leave-calendar-page";
import { LeaveRequestDetailPage } from "./leave-request-detail-page";
import { LeaveRequestFormPage } from "./leave-request-form-page";
import { MyLeaveRequestsPage } from "./my-leave-requests-page";
import { currentMonthKey, monthLabel } from "./leave-utils";

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
  apiUpload: vi.fn(),
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

// The real Nemo date picker and select are controlled widgets. These lightweight
// bindings keep the form rules, preview, and submit flow under test.
vi.mock("../../components/form-date-picker", async () => {
  const { useController } = await import("react-hook-form");
  return {
    FormDatePicker: ({
      control,
      name,
      label,
    }: {
      control: Control<FieldValues>;
      name: string;
      label: string;
    }) => {
      const { field, fieldState } = useController({ control, name });
      return (
        <label>
          {label}
          <input
            aria-label={label}
            value={typeof field.value === "string" ? field.value : ""}
            onChange={(event) => field.onChange(event.target.value)}
          />
          {fieldState.error?.message ? <span>{fieldState.error.message}</span> : null}
        </label>
      );
    },
  };
});

vi.mock("../../components/form-select", async () => {
  const { useController } = await import("react-hook-form");
  return {
    FormSelect: ({
      control,
      name,
      label,
      options,
      placeholder,
    }: {
      control: Control<FieldValues>;
      name: string;
      label: string;
      options: { label: string; value: string }[];
      placeholder?: string;
    }) => {
      const { field, fieldState } = useController({ control, name });
      return (
        <label>
          {label}
          <select
            aria-label={label}
            value={typeof field.value === "string" ? field.value : ""}
            onChange={(event) => field.onChange(event.target.value)}
          >
            <option value="">{placeholder ?? "Choose"}</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {fieldState.error?.message ? <span>{fieldState.error.message}</span> : null}
        </label>
      );
    },
  };
});

const leaveType: LeaveType = {
  id: "lt-1",
  name: "Annual Leave",
  code: "ANNUAL",
  description: null,
  isPaid: true,
  requiresApproval: true,
  requiresAttachment: false,
  allowHalfDay: false,
  allowPastDates: false,
  allowFutureDates: true,
  requiresBalance: true,
  status: "ACTIVE",
  policyCount: 1,
  requestCount: 2,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

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

const preview: LeaveRequestPreview = {
  startDate: "2026-11-30",
  endDate: "2026-12-01",
  duration: 2,
  durationUnit: "DAY",
  requestMode: "FULL_DAY",
  halfDayPeriod: null,
  days: [
    { date: "2026-11-30", duration: 1, isWorkingDay: true, halfDayPeriod: null },
    { date: "2026-12-01", duration: 1, isWorkingDay: true, halfDayPeriod: null },
  ],
  balance,
  estimatedRemaining: 7,
  requiresAttachment: false,
};

function makeRequest(overrides: Partial<LeaveRequest> = {}): LeaveRequest {
  return {
    id: "req-1",
    employeeId: "emp-1",
    employeeNumber: "EMP-0002",
    employeeName: "Rina Lestari",
    leaveType: {
      id: "lt-1",
      name: "Annual Leave",
      code: "ANNUAL",
      isPaid: true,
      requiresAttachment: false,
      requiresApproval: true,
      requiresBalance: true,
    },
    startDate: "2026-11-30",
    endDate: "2026-12-01",
    duration: 2,
    durationUnit: "DAY",
    requestMode: "FULL_DAY",
    halfDayPeriod: null,
    reason: "Family trip",
    status: "PENDING",
    approvalStage: "MANAGER",
    submittedAt: "2026-11-20T03:00:00.000Z",
    reviewedBy: null,
    reviewedAt: null,
    reviewComments: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    withdrawnAt: null,
    days: [
      { date: "2026-11-30", duration: 1, halfDayPeriod: null },
      { date: "2026-12-01", duration: 1, halfDayPeriod: null },
    ],
    approvals: [],
    attachments: [],
    createdAt: "2026-11-20T02:55:00.000Z",
    updatedAt: "2026-11-20T03:00:00.000Z",
    ...overrides,
  };
}

const pendingRequest = makeRequest();
const draftRequest = makeRequest({ id: "req-1", status: "DRAFT", submittedAt: null });

function page(items: LeaveRequest[]): PaginatedResponse<LeaveRequest> {
  return {
    items,
    page: 1,
    pageSize: 10,
    total: items.length,
    totalPages: items.length === 0 ? 0 : 1,
  };
}

const month = currentMonthKey();
const calendar: LeaveCalendar = {
  month,
  entries: [
    {
      id: "req-1",
      employeeId: "emp-1",
      employeeNumber: "EMP-0002",
      employeeName: "Rina Lestari",
      leaveType: { id: "lt-1", name: "Annual Leave", code: "ANNUAL" },
      startDate: "2026-11-30",
      endDate: "2026-12-01",
      duration: 2,
      status: "APPROVED",
      requestMode: "FULL_DAY",
      halfDayPeriod: null,
    },
  ],
};

function renderWithProviders(ui: ReactNode, initialPath = "/leave") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ToastProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>
      </QueryClientProvider>
    </ToastProvider>,
  );
}

describe("Leave flows", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    authState.hasPermission.mockReturnValue(true);
    apiRequestMock.mockImplementation(
      (path: string, options?: { method?: string; body?: unknown }) => {
        if (path === "/leave-types/active") return Promise.resolve([leaveType]);
        if (path === "/leave-balances/me") return Promise.resolve([balance]);
        if (path === "/leave-requests/preview") return Promise.resolve(preview);
        if (path === "/leave-requests" && options?.method === "POST") {
          return Promise.resolve(draftRequest);
        }
        if (path === "/leave-requests/req-1/submit") return Promise.resolve(pendingRequest);
        if (path === "/leave-requests/req-1/approve") {
          return Promise.resolve({ ...pendingRequest, status: "APPROVED" });
        }
        if (path === "/leave-requests/req-1") return Promise.resolve(pendingRequest);
        if (path.startsWith("/leave-requests/me?")) return Promise.resolve(page([pendingRequest]));
        if (path.startsWith("/leave-requests?")) return Promise.resolve(page([pendingRequest]));
        if (path.startsWith("/leave-calendar/me?")) return Promise.resolve(calendar);
        return Promise.reject(new Error(`Unexpected request: ${path}`));
      },
    );
  });

  it("validates the leave request form before submitting", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/leave/requests/new" element={<LeaveRequestFormPage />} />
      </Routes>,
      "/leave/requests/new",
    );

    await user.click(await screen.findByRole("button", { name: "Submit request" }));

    expect(await screen.findByText("Start date is required")).toBeInTheDocument();
    expect(screen.getByText("End date is required")).toBeInTheDocument();
    expect(screen.getByText("Give at least 5 characters")).toBeInTheDocument();
    expect(apiRequestMock).not.toHaveBeenCalledWith("/leave-requests", expect.anything());
  });

  it("previews the server duration and submits the request", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/leave/requests/new" element={<LeaveRequestFormPage />} />
        <Route path="/leave/requests/:id" element={<div>Request detail destination</div>} />
      </Routes>,
      "/leave/requests/new",
    );

    await screen.findByRole("button", { name: "Submit request" });
    await user.selectOptions(screen.getByLabelText("Leave type"), "lt-1");
    await user.type(screen.getByLabelText("Start date"), "2026-11-30");
    await user.type(screen.getByLabelText("End date"), "2026-12-01");
    await user.type(screen.getByLabelText("Reason"), "Family trip");
    expect(screen.getByLabelText("Reason")).toHaveValue("Family trip");

    expect(
      await screen.findByText("Calculated duration", {}, { timeout: 2_000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Estimated remaining")).toBeInTheDocument();
    expect(screen.getByText("7 days")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit request" }));

    expect(await screen.findByText("Request detail destination")).toBeInTheDocument();
    expect(apiRequestMock).toHaveBeenCalledWith("/leave-requests", {
      method: "POST",
      body: {
        leaveTypeId: "lt-1",
        startDate: "2026-11-30",
        endDate: "2026-12-01",
        requestMode: "FULL_DAY",
        halfDayPeriod: null,
        reason: "Family trip",
      },
    });
    expect(apiRequestMock).toHaveBeenCalledWith("/leave-requests/req-1/submit", {
      method: "POST",
    });
  });

  it("approves a pending request from the inbox with a comment", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LeaveApprovalInboxPage />);

    expect(await screen.findByText("Rina Lestari")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await user.type(await screen.findByLabelText("Comment"), "Looks good");
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/leave-requests/req-1/approve", {
        method: "POST",
        body: { comment: "Looks good" },
      });
    });
  });

  it("hides review actions when the user lacks approval permission", async () => {
    authState.hasPermission.mockImplementation(
      (permission: string) => permission === "leave_request.read",
    );

    renderWithProviders(
      <Routes>
        <Route path="/leave/requests/:id" element={<LeaveRequestDetailPage />} />
      </Routes>,
      "/leave/requests/req-1",
    );

    expect(await screen.findByText("Annual Leave request")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Withdraw" })).not.toBeInTheDocument();
  });

  it("renders calendar entries and requests the selected month", async () => {
    renderWithProviders(<LeaveCalendarPage />);

    expect(await screen.findByText("Rina Lestari · Annual Leave")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText(`Leave in ${monthLabel(month)} (1)`)).toBeInTheDocument();
    expect(apiRequestMock).toHaveBeenCalledWith(`/leave-calendar/me?month=${month}`);
  });

  it("sends the history search to the server after the debounce", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyLeaveRequestsPage />);

    expect(await screen.findByText("Annual Leave")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search my leave requests"), "annual");

    await waitFor(
      () => {
        const calls = apiRequestMock.mock.calls.map(([path]) => String(path));
        expect(calls.some((path) => path.includes("search=annual"))).toBe(true);
      },
      { timeout: 2_000 },
    );
  });
});
