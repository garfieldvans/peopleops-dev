import {
  Alert,
  Card,
  CardBody,
  DatePicker,
  Spinner,
  Stack,
  Tabs,
  Table,
  Typography,
} from "@nemo-ui/ui";
import { useState } from "react";
import { PERMISSIONS } from "@peopleops/shared-types";
import { ApiRequestError } from "../../lib/http";
import { useAuth } from "../auth/auth-context";
import {
  formatDate,
  formatMoney,
  monthStartKey,
  PAYROLL_PAGE_SIZE,
  todayKey,
  usePayrollComponentReport,
  usePayrollRegisterReport,
  usePayrollSummaryReport,
} from "./payroll-utils";
import { EmptyState, MetricCard, PageHeading, PermissionNotice } from "./payroll-ui";

function parseDate(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function dateKey(date: Date | null): string {
  if (!date) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function PayrollReportsPage() {
  const { hasPermission } = useAuth();
  const [from, setFrom] = useState(monthStartKey());
  const [to, setTo] = useState(todayKey());
  const [registerPage, setRegisterPage] = useState(1);
  const summaryQuery = usePayrollSummaryReport(from, to);
  const componentQuery = usePayrollComponentReport(from, to);
  const registerQuery = usePayrollRegisterReport(from, to, registerPage);

  if (!hasPermission(PERMISSIONS.PAYROLL_REPORTS_READ)) {
    return <PermissionNotice>Ask payroll for report access.</PermissionNotice>;
  }

  const summary = summaryQuery.data;
  const error = summaryQuery.error ?? componentQuery.error ?? registerQuery.error;

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Payroll reports"
        description="Published payroll only. Reports use period overlap and immutable payslip data."
      />

      <Card variant="elevated" padding="lg">
        <CardBody>
          <div className="grid gap-3 md:grid-cols-3">
            <DatePicker
              label="From"
              mode="single"
              value={parseDate(from)}
              onChange={(date) => {
                const next = dateKey(date);
                if (next) {
                  setFrom(next);
                  setRegisterPage(1);
                }
              }}
              format="yyyy-mm-dd"
              fullWidth
            />
            <DatePicker
              label="To"
              mode="single"
              value={parseDate(to)}
              onChange={(date) => {
                const next = dateKey(date);
                if (next) {
                  setTo(next);
                  setRegisterPage(1);
                }
              }}
              format="yyyy-mm-dd"
              fullWidth
            />
            <div className="flex items-end">
              <Typography variant="caption" color="neutral">
                Showing published and locked runs whose periods overlap this range.
              </Typography>
            </div>
          </div>
        </CardBody>
      </Card>

      {error ? (
        <Alert tone="error" title="Could not load payroll reports">
          {error instanceof ApiRequestError ? error.message : "Unexpected error"}
        </Alert>
      ) : null}

      {summaryQuery.isPending || componentQuery.isPending || registerQuery.isPending ? (
        <Stack direction="row" spacing={12} align="center">
          <Spinner />
          <Typography variant="bodySmall" color="neutral">
            Loading payroll reports…
          </Typography>
        </Stack>
      ) : summary ? (
        <Tabs
          defaultValue="summary"
          items={[
            {
              value: "summary",
              label: "Summary",
              content: (
                <Stack spacing={12}>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                      label="Gross pay"
                      value={formatMoney(summary.grossTotal)}
                      hint={`${summary.runCount} runs · ${summary.payslipCount} payslips`}
                    />
                    <MetricCard label="Deductions" value={formatMoney(summary.deductionTotal)} />
                    <MetricCard label="Net pay" value={formatMoney(summary.netTotal)} />
                    <MetricCard
                      label="Employer contributions"
                      value={formatMoney(summary.employerContributionTotal)}
                      hint="Not part of net"
                    />
                  </div>
                  <Card variant="outlined" padding="lg">
                    <CardBody>
                      <Table
                        data={summary.rows}
                        rowKey={(row) => row.label}
                        columns={[
                          { key: "label", header: "Measure", render: (row) => row.label },
                          {
                            key: "amount",
                            header: "Amount",
                            align: "right",
                            render: (row) => formatMoney(row.amount),
                          },
                        ]}
                      />
                    </CardBody>
                  </Card>
                </Stack>
              ),
            },
            {
              value: "components",
              label: "Component breakdown",
              content: (
                <Card variant="elevated" padding="lg">
                  <CardBody>
                    <Table
                      data={componentQuery.data?.rows ?? []}
                      rowKey={(row) => `${row.code}-${row.componentType}`}
                      emptyText={
                        <EmptyState
                          title="No component totals"
                          description="Publish a payroll run to populate this report."
                        />
                      }
                      columns={[
                        {
                          key: "component",
                          header: "Component",
                          render: (row) => (
                            <Stack spacing={1}>
                              <Typography variant="bodySmall" className="font-medium">
                                {row.name}
                              </Typography>
                              <Typography variant="caption" color="neutral">
                                {row.code} · {row.componentType.replaceAll("_", " ").toLowerCase()}
                              </Typography>
                            </Stack>
                          ),
                        },
                        { key: "employees", header: "Employees", render: (row) => row.employeeCount },
                        {
                          key: "amount",
                          header: "Total",
                          align: "right",
                          render: (row) => formatMoney(row.totalAmount),
                        },
                      ]}
                    />
                  </CardBody>
                </Card>
              ),
            },
            {
              value: "register",
              label: "Register",
              content: (
                <Card variant="elevated" padding="lg">
                  <CardBody>
                    <Stack spacing={12}>
                      <Table
                        data={registerQuery.data?.rows ?? []}
                        rowKey={(row) => row.payslipId}
                        emptyText={
                          <EmptyState
                            title="No register rows"
                            description="Publish payroll to populate the register."
                          />
                        }
                        pagination={{
                          page: registerPage,
                          pageSize: PAYROLL_PAGE_SIZE,
                          pageCount: registerQuery.data?.totalPages ?? 1,
                          total: registerQuery.data?.total ?? 0,
                          onChange: setRegisterPage,
                        }}
                        columns={[
                          {
                            key: "employee",
                            header: "Employee",
                            render: (row) => (
                              <Stack spacing={1}>
                                <Typography variant="bodySmall" className="font-medium">
                                  {row.employeeName}
                                </Typography>
                                <Typography variant="caption" color="neutral">
                                  {row.employeeNumber}
                                  {row.department ? ` · ${row.department}` : ""}
                                </Typography>
                              </Stack>
                            ),
                          },
                          {
                            key: "payment",
                            header: "Payment date",
                            render: (row) => formatDate(row.paymentDate),
                          },
                          {
                            key: "gross",
                            header: "Gross",
                            align: "right",
                            render: (row) => formatMoney(row.grossPay, row.currency),
                          },
                          {
                            key: "deductions",
                            header: "Deductions",
                            align: "right",
                            render: (row) => formatMoney(row.totalDeductions, row.currency),
                          },
                          {
                            key: "net",
                            header: "Net",
                            align: "right",
                            render: (row) => formatMoney(row.netPay, row.currency),
                          },
                          {
                            key: "employer",
                            header: "Employer",
                            align: "right",
                            render: (row) => formatMoney(row.employerContributions, row.currency),
                          },
                        ]}
                      />
                      <Typography variant="bodySmall" className="font-medium">
                        Totals for all {registerQuery.data?.total ?? 0} rows: gross{" "}
                        {formatMoney(registerQuery.data?.totals.grossPay ?? "0")} ·
                        deductions {formatMoney(registerQuery.data?.totals.totalDeductions ?? "0")} ·
                        net {formatMoney(registerQuery.data?.totals.netPay ?? "0")} · employer{" "}
                        {formatMoney(registerQuery.data?.totals.employerContributions ?? "0")}
                      </Typography>
                    </Stack>
                  </CardBody>
                </Card>
              ),
            },
          ]}
        />
      ) : (
        <EmptyState title="No report data" description="Choose a date range with published payroll." />
      )}
    </Stack>
  );
}
