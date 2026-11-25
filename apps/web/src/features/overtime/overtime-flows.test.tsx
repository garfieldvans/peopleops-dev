import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@nemo-ui/ui";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { Control } from "react-hook-form";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OvertimeRequest } from "@peopleops/shared-types";
import { OvertimeApprovalsPage } from "./overtime-approvals-page";
import { OvertimeRequestDetailPage } from "./overtime-request-detail-page";
import { OvertimeRequestFormPage } from "./overtime-request-form-page";

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

vi.mock("../../components/form-date-picker", async () => {
  const { useController } = await import("react-hook-form");
  return {
    FormDatePicker: ({
      control,
      name,
      label,
    }: {
      control: Control;
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

function makeRequest(overrides: Partial<OvertimeRequest> = {}): OvertimeRequest {
  return {
    id: "ot-1",
    employeeId: "emp-1",
    employeeNumber: "EMP-0002",
    employeeName: "Rina Lestari",
    department: { id: "dept-1", name: "Operations" },
    branch: { id: "branch-1", name: "Jakarta" },
    policy: { id: "pol-1", name: "Standard Overtime", code: "OT-STD" },
    policySnapshot: {
      policyId: "pol-1",
      code: "OT-STD",
      name: "Standard Overtime",
      approvalMode: "MANAGER_AND_HR",
      minMinutes: 30,
      maxMinutes: 240,
      roundingStrategy: "NONE",
      roundingMinutes: 15,
      requiresAttachment: false,
    },
    attendanceRecordId: null,
    workDate: "2026-11-25",
    category: "WEEKDAY",
    reason: "Month-end close",
    plannedStartAt: "2026-11-25T11:00:00.000Z",
    plannedEndAt: "2026-11-25T13:00:00.000Z",
    plannedBreakMinutes: 0,
    actualStartAt: null,
    actualEndAt: null,
    actualBreakMinutes: null,
    requestedMinutes: 120,
    actualMinutes: null,
    verifiedMinutes: null,
    approvedMinutes: null,
    status: "PENDING_MANAGER_APPROVAL",
    approvalStage: "MANAGER",
    submittedAt: "2026-11-24T03:00:00.000Z",
    completedAt: null,
    verifiedAt: null,
    verifier: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    approvals: [],
    corrections: [],
    attachments: [],
    createdAt: "2026-11-24T02:55:00.000Z",
    updatedAt: "2026-11-24T03:00:00.000Z",
    ...overrides,
  };
}

function page(items: OvertimeRequest[]) {
  return {
    items,
    page: 1,
    pageSize: 50,
    total: items.length,
    totalPages: items.length === 0 ? 0 : 1,
  };
}

function renderWithProviders(ui: ReactNode, initialPath = "/overtime") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ToastProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>
      </QueryClientProvider>
    </ToastProvider>,
  );
}

describe("Overtime flows", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    authState.hasPermission.mockReturnValue(true);
  });

  it("validates and submits an overtime request", async () => {
    const user = userEvent.setup();
    const draft = makeRequest({ status: "DRAFT", approvalStage: null, submittedAt: null });
    apiRequestMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === "/overtime/requests" && options?.method === "POST") {
        return Promise.resolve(draft);
      }
      if (path === "/overtime/requests/ot-1/submit") return Promise.resolve(makeRequest());
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });

    renderWithProviders(
      <Routes>
        <Route path="/overtime/requests/new" element={<OvertimeRequestFormPage />} />
        <Route path="/overtime/requests/:id" element={<div>Overtime detail destination</div>} />
      </Routes>,
      "/overtime/requests/new",
    );

    await user.click(await screen.findByRole("button", { name: "Submit request" }));
    expect(await screen.findByText("Choose the planned start")).toBeInTheDocument();
    expect(screen.getByText("Choose the planned end")).toBeInTheDocument();
    expect(screen.getByText("Give at least 5 characters")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Planned start/), "2026-11-25T18:00");
    await user.type(screen.getByLabelText(/Planned end/), "2026-11-25T20:00");
    await user.type(screen.getByLabelText("Reason"), "Month-end close");
    await user.click(screen.getByRole("button", { name: "Submit request" }));

    expect(await screen.findByText("Overtime detail destination")).toBeInTheDocument();
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/overtime/requests",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({
          workDate: expect.any(String),
          plannedBreakMinutes: 0,
          reason: "Month-end close",
          clientRequestId: expect.any(String),
        }),
      }),
    );
    expect(apiRequestMock).toHaveBeenCalledWith("/overtime/requests/ot-1/submit", {
      method: "POST",
    });
  });

  it("approves a manager-stage request with a comment", async () => {
    const user = userEvent.setup();
    apiRequestMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path.includes("statuses=PENDING_MANAGER_APPROVAL")) {
        return Promise.resolve(page([makeRequest()]));
      }
      if (path === "/overtime/requests/ot-1/approve" && options?.method === "POST") {
        return Promise.resolve(makeRequest({ status: "PENDING_HR_APPROVAL", approvalStage: "HR" }));
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });

    renderWithProviders(<OvertimeApprovalsPage />);

    expect(await screen.findByText("Rina Lestari")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await user.type(await screen.findByLabelText("Comment"), "Approved for month-end");
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/overtime/requests/ot-1/approve", {
        method: "POST",
        body: { comment: "Approved for month-end", override: false },
      });
    });
  });

  it("hides review actions when the user lacks approval permission", async () => {
    authState.hasPermission.mockImplementation(
      (permission: string) => permission === "overtime.read.self",
    );
    apiRequestMock.mockResolvedValue(makeRequest());

    renderWithProviders(
      <Routes>
        <Route path="/overtime/requests/:id" element={<OvertimeRequestDetailPage />} />
      </Routes>,
      "/overtime/requests/ot-1",
    );

    expect(await screen.findByText("Overtime · 2026-11-25")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Withdraw" })).not.toBeInTheDocument();
  });
});
