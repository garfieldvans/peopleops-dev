import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@nemo-ui/ui";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmployeeDetail, EmploymentHistoryEntry } from "@peopleops/shared-types";
import { EmployeeDetailPage } from "./employee-detail-page";

const apiRequestMock = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  status: "authenticated" as const,
  user: null as null | { id: string },
  login: vi.fn(),
  logout: vi.fn(),
  hasPermission: vi.fn<(permission: string) => boolean>(() => true),
}));

vi.mock("../../lib/http", () => ({
  apiRequest: apiRequestMock,
  downloadFile: vi.fn(),
  apiUpload: vi.fn(),
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

const employee: EmployeeDetail = {
  id: "emp-1",
  employeeNumber: "EMP-0002",
  firstName: "Rina",
  middleName: null,
  lastName: "Lestari",
  preferredName: null,
  fullName: "Rina Lestari",
  photoUrl: null,
  workEmail: "rina@peopleops.local",
  personalEmail: "rina@example.com",
  branch: { id: "branch-1", name: "Jakarta HQ" },
  department: { id: "dept-1", name: "Engineering" },
  position: { id: "pos-1", name: "Frontend Engineer" },
  jobLevel: { id: "level-1", name: "Senior" },
  employmentType: "PERMANENT",
  employmentStatus: "ACTIVE",
  joinDate: "2025-01-06",
  manager: {
    id: "emp-0",
    employeeNumber: "EMP-0001",
    fullName: "Dimas Pratama",
    photoUrl: null,
  },
  gender: "FEMALE",
  birthDate: "1996-04-12",
  placeOfBirth: "Bandung",
  maritalStatus: "SINGLE",
  nationality: "Indonesia",
  phone: "+62 812 0000 1111",
  addressLine: "Jl. Merdeka 1",
  city: "Jakarta",
  province: "DKI Jakarta",
  postalCode: "10110",
  country: "Indonesia",
  probationEndDate: null,
  contractStartDate: null,
  contractEndDate: null,
  user: { id: "user-1", name: "Rina Lestari", email: "employee@peopleops.local" },
  emergencyContactCount: 1,
  documentCount: 2,
  createdAt: "2025-01-06T00:00:00.000Z",
  updatedAt: "2025-06-01T00:00:00.000Z",
};

const history: EmploymentHistoryEntry[] = [
  {
    id: "history-2",
    effectiveFrom: "2025-06-01",
    effectiveTo: null,
    employmentType: "PERMANENT",
    employmentStatus: "ACTIVE",
    branch: { id: "branch-1", name: "Jakarta HQ" },
    department: { id: "dept-1", name: "Engineering" },
    position: { id: "pos-2", name: "Senior Frontend Engineer" },
    jobLevel: { id: "level-1", name: "Senior" },
    manager: null,
    changeReason: "Promotion",
    notes: null,
    createdBy: { id: "user-2", name: "HR Admin" },
    createdAt: "2025-06-01T00:00:00.000Z",
  },
];

function renderProfile(self = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[self ? "/employees/me" : "/employees/emp-1"]}>
          <Routes>
            <Route
              path={self ? "/employees/me" : "/employees/:id"}
              element={<EmployeeDetailPage self={self} />}
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("EmployeeDetailPage", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    authState.user = { id: "user-2" };
    authState.hasPermission.mockReturnValue(true);
    apiRequestMock.mockImplementation((path: string) => {
      if (path === "/employees/emp-1" || path === "/employees/me") {
        return Promise.resolve(employee);
      }
      if (path.endsWith("/history")) return Promise.resolve(history);
      if (path.endsWith("/emergency-contacts")) {
        return Promise.resolve([
          {
            id: "contact-1",
            employeeId: "emp-1",
            fullName: "Budi Lestari",
            relationship: "Father",
            phone: "+62 811 0000 2222",
            email: null,
            address: null,
            isPrimary: true,
            createdAt: "2025-01-06T00:00:00.000Z",
            updatedAt: "2025-01-06T00:00:00.000Z",
          },
        ]);
      }
      if (path.endsWith("/documents")) return Promise.resolve([]);
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
  });

  it("renders the employee header and employment overview", async () => {
    renderProfile();

    expect(await screen.findByRole("heading", { name: "Rina Lestari" })).toBeInTheDocument();
    expect(screen.getByText("EMP-0002 · Frontend Engineer · Engineering")).toBeInTheDocument();
    expect(screen.getAllByText("active").length).toBeGreaterThan(0);
    expect(screen.getByText("Jakarta HQ")).toBeInTheDocument();
    expect(screen.getByText("Dimas Pratama")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit employee" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deactivate" })).toBeInTheDocument();
  });

  it("shows personal data on the personal tab", async () => {
    const user = userEvent.setup();
    renderProfile();

    await screen.findByRole("heading", { name: "Rina Lestari" });
    await user.click(screen.getByRole("tab", { name: "Personal" }));

    expect(await screen.findByText("1996-04-12")).toBeInTheDocument();
    expect(screen.getByText("+62 812 0000 1111")).toBeInTheDocument();
    expect(screen.getByText("Bandung")).toBeInTheDocument();
  });

  it("shows effective-dated employment history", async () => {
    const user = userEvent.setup();
    renderProfile();

    await screen.findByRole("heading", { name: "Rina Lestari" });
    await user.click(screen.getByRole("tab", { name: "History" }));

    expect(await screen.findByText("Senior Frontend Engineer · Engineering")).toBeInTheDocument();
    expect(screen.getByText(/Promotion/)).toBeInTheDocument();
    expect(screen.getByText(/2025-06-01 → present/)).toBeInTheDocument();
  });

  it("hides management actions from a read-only viewer", async () => {
    authState.hasPermission.mockImplementation(
      (permission: string) => permission === "employee.read",
    );
    renderProfile();

    await screen.findByRole("heading", { name: "Rina Lestari" });
    expect(screen.queryByRole("button", { name: "Edit employee" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deactivate" })).not.toBeInTheDocument();
  });

  it("offers self-service contact editing only on the signed-in user's profile", async () => {
    authState.user = { id: "user-1" };
    authState.hasPermission.mockImplementation((permission: string) =>
      ["employee.read_self", "employee.update_self"].includes(permission),
    );
    renderProfile(true);

    await screen.findByRole("heading", { name: "Rina Lestari" });
    expect(
      screen.getByRole("button", { name: "Edit my contact details" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit employee" })).not.toBeInTheDocument();
  });
});
