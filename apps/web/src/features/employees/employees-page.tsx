import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  Input,
  Select,
  Spinner,
  Stack,
  Table,
  Typography,
} from "@nemo-ui/ui";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  EMPLOYMENT_STATUSES,
  PERMISSIONS,
  type EmployeeListItem,
  type PaginatedResponse,
} from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import {
  departmentChoiceOptions,
  useBranchOptions,
  useDepartmentTree,
  usePositionOptions,
} from "./employee-options";
import { EMPLOYMENT_STATUS_OPTIONS } from "./employee-schemas";

const PAGE_SIZE = 10;

export function EmployeesPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const branchesQuery = useBranchOptions();
  const departmentsQuery = useDepartmentTree();
  const positionsQuery = usePositionOptions();

  const employeesQuery = useQuery({
    queryKey: [
      "employees",
      page,
      search,
      branchId,
      departmentId,
      positionId,
      employmentStatus,
      sortBy,
      sortDir,
    ],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sortBy,
        sortDir,
      });
      if (search) params.set("search", search);
      if (branchId) params.set("branchId", branchId);
      if (departmentId) params.set("departmentId", departmentId);
      if (positionId) params.set("positionId", positionId);
      if (employmentStatus) params.set("employmentStatus", employmentStatus);
      return apiRequest<PaginatedResponse<EmployeeListItem>>(`/employees?${params.toString()}`);
    },
  });

  const resetFilters = () => {
    setSearchInput("");
    setBranchId("");
    setDepartmentId("");
    setPositionId("");
    setEmploymentStatus("");
    setPage(1);
  };

  return (
    <Stack spacing={20}>
      <Stack direction="row" justify="between" align="center" wrap spacing={12}>
        <Stack spacing={4}>
          <Typography variant="h4" as="h1">
            Employees
          </Typography>
          <Typography variant="bodySmall" color="neutral">
            PeopleOps / Employee directory
          </Typography>
        </Stack>
        {hasPermission(PERMISSIONS.EMPLOYEE_CREATE) ? (
          <Button onClick={() => navigate("/employees/new")}>Add employee</Button>
        ) : null}
      </Stack>

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Input
                placeholder="Search name or employee number"
                aria-label="Search employees"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                clearable
                onClear={() => setSearchInput("")}
                fullWidth
              />
              <Select
                aria-label="Filter by branch"
                placeholder="All branches"
                value={branchId}
                onChange={(value) => {
                  setBranchId(value);
                  setPage(1);
                }}
                options={[
                  { label: "All branches", value: "" },
                  ...(branchesQuery.data?.items.map((branch) => ({
                    label: branch.name,
                    value: branch.id,
                  })) ?? []),
                ]}
                fullWidth
              />
              <Select
                aria-label="Filter by department"
                placeholder="All departments"
                value={departmentId}
                onChange={(value) => {
                  setDepartmentId(value);
                  setPage(1);
                }}
                options={[
                  { label: "All departments", value: "" },
                  ...departmentChoiceOptions(departmentsQuery.data ?? []),
                ]}
                fullWidth
              />
              <Select
                aria-label="Filter by position"
                placeholder="All positions"
                value={positionId}
                onChange={(value) => {
                  setPositionId(value);
                  setPage(1);
                }}
                options={[
                  { label: "All positions", value: "" },
                  ...(positionsQuery.data?.items.map((position) => ({
                    label: position.title,
                    value: position.id,
                  })) ?? []),
                ]}
                fullWidth
              />
              <Select
                aria-label="Filter by employment status"
                value={employmentStatus}
                onChange={(value) => {
                  setEmploymentStatus(value);
                  setPage(1);
                }}
                options={[
                  { label: "All statuses", value: "" },
                  ...EMPLOYMENT_STATUS_OPTIONS.filter((option) =>
                    EMPLOYMENT_STATUSES.includes(option.value),
                  ),
                ]}
                fullWidth
              />
              <Select
                aria-label="Sort employees"
                value={sortBy}
                onChange={(value) => {
                  setSortBy(value);
                  setPage(1);
                }}
                options={[
                  { label: "Sort by name", value: "name" },
                  { label: "Sort by employee number", value: "employeeNumber" },
                  { label: "Sort by join date", value: "joinDate" },
                ]}
                fullWidth
              />
              <Select
                aria-label="Sort direction"
                value={sortDir}
                onChange={(value) => {
                  setSortDir(value || "asc");
                  setPage(1);
                }}
                options={[
                  { label: "Ascending", value: "asc" },
                  { label: "Descending", value: "desc" },
                ]}
                fullWidth
              />
              <Button variant="outlined" onClick={resetFilters}>
                Reset filters
              </Button>
            </div>

            {employeesQuery.isPending ? (
              <Stack direction="row" spacing={12} align="center">
                <Spinner />
                <Typography variant="bodySmall" color="neutral">
                  Loading employees…
                </Typography>
              </Stack>
            ) : employeesQuery.isError ? (
              <Alert tone="error" title="Could not load employees">
                {employeesQuery.error instanceof ApiRequestError
                  ? employeesQuery.error.message
                  : "Unexpected error"}
              </Alert>
            ) : (
              <Table
                columns={[
                  {
                    key: "employee",
                    header: "Employee",
                    render: (employee) => (
                      <Stack direction="row" spacing={10} align="center">
                        <Avatar
                          name={employee.fullName}
                          src={employee.photoUrl ?? undefined}
                          size="sm"
                        />
                        <Stack spacing={2}>
                          <Typography variant="bodySmall" className="font-medium">
                            {employee.fullName}
                          </Typography>
                          <Typography variant="caption" color="neutral">
                            {employee.employeeNumber}
                          </Typography>
                        </Stack>
                      </Stack>
                    ),
                  },
                  {
                    key: "email",
                    header: "Email",
                    render: (employee) => employee.workEmail ?? employee.personalEmail ?? "—",
                  },
                  {
                    key: "branch",
                    header: "Branch",
                    render: (employee) => employee.branch?.name ?? "—",
                  },
                  {
                    key: "department",
                    header: "Department",
                    render: (employee) => employee.department?.name ?? "—",
                  },
                  {
                    key: "position",
                    header: "Position",
                    render: (employee) => employee.position?.name ?? "—",
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (employee) => (
                      <Badge
                        variant="filled"
                        color={employee.employmentStatus === "ACTIVE" ? "success" : "neutral"}
                      >
                        {employee.employmentStatus.toLowerCase()}
                      </Badge>
                    ),
                  },
                  {
                    key: "joinDate",
                    header: "Join date",
                    render: (employee) => employee.joinDate,
                  },
                  {
                    key: "actions",
                    header: "",
                    align: "right",
                    render: (employee) => (
                      <Button
                        variant="text"
                        size="sm"
                        onClick={() => navigate(`/employees/${employee.id}`)}
                      >
                        View
                      </Button>
                    ),
                  },
                ]}
                data={employeesQuery.data.items}
                rowKey={(employee) => employee.id}
                pagination={{
                  page,
                  pageSize: PAGE_SIZE,
                  pageCount: employeesQuery.data.totalPages,
                  total: employeesQuery.data.total,
                  onChange: setPage,
                }}
                emptyText="No employees match these filters."
              />
            )}
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  );
}
