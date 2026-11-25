import { useQuery } from "@tanstack/react-query";
import {
  Alert,
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
import {
  PERMISSIONS,
  type LeaveTransaction,
  type PaginatedResponse,
} from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { PageHeading } from "./leave-ui";
import {
  LEAVE_PAGE_SIZE,
  formatDate,
  formatQuantity,
  transactionTypeLabel,
  useLeaveTypes,
} from "./leave-utils";

export function LeaveTransactionsPage() {
  const { hasPermission } = useAuth();
  const canReadAll = hasPermission(PERMISSIONS.LEAVE_TRANSACTION_READ_ALL);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const typesQuery = useLeaveTypes(canReadAll);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(LEAVE_PAGE_SIZE),
  });
  if (search) params.set("search", search);
  if (leaveTypeId) params.set("leaveTypeId", leaveTypeId);
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const path = canReadAll ? "/leave-transactions" : "/leave-transactions/me";
  const transactionsQuery = useQuery({
    queryKey: ["leave", "transactions", canReadAll ? "all" : "me", params.toString()],
    queryFn: () => apiRequest<PaginatedResponse<LeaveTransaction>>(`${path}?${params.toString()}`),
  });

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Leave transaction history"
        description="Every entitlement, accrual, deduction, reversal, and adjustment"
      />

      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <Input
                aria-label="Search leave transactions"
                placeholder="Search description or source"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                clearable
                onClear={() => setSearchInput("")}
                fullWidth
              />
              <Select
                aria-label="Filter transactions by leave type"
                value={leaveTypeId}
                onChange={(value) => {
                  setLeaveTypeId(value);
                  setPage(1);
                }}
                options={[
                  { label: "All leave types", value: "" },
                  ...(typesQuery.data?.map((type) => ({ label: type.name, value: type.id })) ?? []),
                ]}
                fullWidth
              />
              <Input
                aria-label="Transactions from date"
                type="date"
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                  setPage(1);
                }}
                fullWidth
              />
              <Input
                aria-label="Transactions to date"
                type="date"
                value={to}
                onChange={(event) => {
                  setTo(event.target.value);
                  setPage(1);
                }}
                fullWidth
              />
              <Button
                variant="outlined"
                onClick={() => {
                  setSearchInput("");
                  setLeaveTypeId("");
                  setFrom("");
                  setTo("");
                  setPage(1);
                }}
              >
                Reset filters
              </Button>
            </div>

            {transactionsQuery.isPending ? (
              <Stack direction="row" spacing={12} align="center">
                <Spinner />
                <Typography variant="bodySmall" color="neutral">
                  Loading transactions…
                </Typography>
              </Stack>
            ) : transactionsQuery.isError ? (
              <Alert tone="error" title="Could not load leave transactions">
                {transactionsQuery.error instanceof ApiRequestError
                  ? transactionsQuery.error.message
                  : "Unexpected error"}
              </Alert>
            ) : (
              <Table
                columns={[
                  ...(canReadAll
                    ? [
                        {
                          key: "employee",
                          header: "Employee",
                          render: (row: LeaveTransaction) => (
                            <Stack spacing={1}>
                              <Typography variant="bodySmall" className="font-medium">
                                {row.employeeName}
                              </Typography>
                              <Typography variant="caption" color="neutral">
                                {row.employeeNumber}
                              </Typography>
                            </Stack>
                          ),
                        },
                      ]
                    : []),
                  {
                    key: "date",
                    header: "Date",
                    render: (row) => formatDate(row.transactionDate),
                  },
                  { key: "type", header: "Type", render: (row) => transactionTypeLabel(row.type) },
                  { key: "leave", header: "Leave type", render: (row) => row.leaveType.name },
                  {
                    key: "amount",
                    header: "Amount",
                    render: (row) => (
                      <Badge variant="filled" color={row.amount >= 0 ? "success" : "warning"}>
                        {row.amount >= 0 ? "+" : ""}
                        {formatQuantity(row.amount)}
                      </Badge>
                    ),
                  },
                  {
                    key: "description",
                    header: "Description",
                    render: (row) => row.description ?? row.sourceType,
                  },
                  {
                    key: "created",
                    header: "Recorded by",
                    render: (row) => row.createdBy?.name ?? "System",
                  },
                ]}
                data={transactionsQuery.data.items}
                rowKey={(row) => row.id}
                pagination={{
                  page,
                  pageSize: LEAVE_PAGE_SIZE,
                  pageCount: transactionsQuery.data.totalPages,
                  total: transactionsQuery.data.total,
                  onChange: setPage,
                }}
                emptyText="No leave transactions match these filters."
              />
            )}
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  );
}
