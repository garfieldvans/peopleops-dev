import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmployeeListItem, PaginatedResponse } from "@peopleops/shared-types";
import { EmployeesPage } from "./employees-page";

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

const employee: EmployeeListItem = {
  id: "emp-1",
  employeeNumber: "EMP-0001",
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
  manager: null,
};

function page(items: EmployeeListItem[]): PaginatedResponse<EmployeeListItem> {
  return {
    items,
    page: 1,
    pageSize: 10,
    total: items.length,
    totalPages: items.length === 0 ? 0 : 1,
  };
}

function renderDirectory() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/employees"]}>
        <EmployeesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("EmployeesPage", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    authState.hasPermission.mockReturnValue(true);
    apiRequestMock.mockImplementation((path: string) => {
      if (path.startsWith("/employees?")) return Promise.resolve(page([employee]));
      if (path.startsWith("/branches")) return Promise.resolve(page([]));
      if (path.startsWith("/departments/tree")) return Promise.resolve([]);
      if (path.startsWith("/positions")) return Promise.resolve(page([]));
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
  });

  it("renders directory rows from the server response", async () => {
    renderDirectory();

    expect(await screen.findByText("Rina Lestari")).toBeInTheDocument();
    expect(screen.getByText("EMP-0001")).toBeInTheDocument();
    expect(screen.getByText("Jakarta HQ")).toBeInTheDocument();
    expect(screen.getByText("Engineering")).toBeInTheDocument();
    expect(screen.getByText("Frontend Engineer")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("2025-01-06")).toBeInTheDocument();
  });

  it("searches on the server and shows the empty state when nothing matches", async () => {
    apiRequestMock.mockImplementation((path: string) => {
      if (path.startsWith("/employees?")) return Promise.resolve(page([]));
      if (path.startsWith("/branches")) return Promise.resolve(page([]));
      if (path.startsWith("/departments/tree")) return Promise.resolve([]);
      if (path.startsWith("/positions")) return Promise.resolve(page([]));
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    const user = userEvent.setup();
    renderDirectory();

    await screen.findByText("No employees match these filters.");

    await user.type(screen.getByLabelText("Search employees"), "nobody");

    await waitFor(() => {
      const calls = apiRequestMock.mock.calls.map(([path]) => String(path));
      expect(calls.some((path) => path.includes("search=nobody"))).toBe(true);
    });
    expect(await screen.findByText("No employees match these filters.")).toBeInTheDocument();
  });

  it("hides the add action when the user cannot create employees", async () => {
    authState.hasPermission.mockImplementation(
      (permission: string) => permission !== "employee.create",
    );
    renderDirectory();

    await screen.findByText("Rina Lestari");
    expect(screen.queryByRole("button", { name: "Add employee" })).not.toBeInTheDocument();
  });
});
