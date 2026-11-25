import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Modal,
  Spinner,
  Stack,
  Tabs,
  Table,
  Textarea,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PERMISSIONS, type PayrollRunDetail } from "@peopleops/shared-types";
import { LoadingButton } from "../../components/loading-button";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { useAuth } from "../auth/auth-context";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  usePayrollAdjustments,
  usePayrollRun,
  usePayslips,
} from "./payroll-utils";
import {
  AdjustmentStatusBadge,
  EmptyState,
  MetricCard,
  PageHeading,
  PayrollStatusBadge,
  PayrollWarnings,
  PermissionNotice,
} from "./payroll-ui";

type RunAction = "calculate" | "submit" | "approve" | "publish" | "cancel";

const ACTION_COPY: Record<RunAction, { title: string; description: string; confirm: string; tone: "primary" | "success" | "warning" | "error" }> = {
  calculate: {
    title: "Calculate payroll",
    description: "Draft payslips are replaced and the calculation version is incremented.",
    confirm: "Calculate",
    tone: "primary",
  },
  submit: {
    title: "Submit for review",
    description: "The run becomes read-only for calculation changes until it is reviewed.",
    confirm: "Submit review",
    tone: "primary",
  },
  approve: {
    title: "Approve payroll",
    description: "Approval confirms the calculated amounts. The creator cannot approve without override permission.",
    confirm: "Approve",
    tone: "success",
  },
  publish: {
    title: "Publish payroll",
    description: "Payslips become visible to employees and their snapshots are protected.",
    confirm: "Publish",
    tone: "success",
  },
  cancel: {
    title: "Cancel payroll run",
    description: "Cancelling is recorded with a reason and cannot be undone.",
    confirm: "Cancel run",
    tone: "error",
  },
};

export function PayrollRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const runQuery = usePayrollRun(id);
  const [action, setAction] = useState<RunAction | null>(null);
  const [comment, setComment] = useState("");
  const periodId = runQuery.data?.period.id ?? "";
  const payslipsQuery = usePayslips(
    new URLSearchParams({ runId: id ?? "", pageSize: "100" }),
    Boolean(id),
  );
  const adjustmentsQuery = usePayrollAdjustments(
    new URLSearchParams({ periodId, pageSize: "100" }),
    Boolean(periodId),
  );

  const actionMutation = useMutation({
    mutationFn: (nextAction: RunAction) => {
      const body =
        nextAction === "cancel"
          ? { reason: comment.trim() }
          : nextAction === "calculate"
            ? undefined
            : { comment: comment.trim() || null };
      const paths: Record<RunAction, string> = {
        calculate: "calculate",
        submit: "submit-review",
        approve: "approve",
        publish: "publish",
        cancel: "cancel",
      };
      return apiRequest<PayrollRunDetail>(`/payroll/runs/${id}/${paths[nextAction]}`, {
        method: "POST",
        body,
      });
    },
    onSuccess: (_result, nextAction) => {
      const messages: Record<RunAction, string> = {
        calculate: "Payroll calculated",
        submit: "Payroll submitted for review",
        approve: "Payroll approved",
        publish: "Payroll published",
        cancel: "Payroll run cancelled",
      };
      toast.success(messages[nextAction]);
      setAction(null);
      setComment("");
      void queryClient.invalidateQueries({ queryKey: ["payroll"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not update the run"),
  });

  if (!hasPermission(PERMISSIONS.PAYROLL_RUNS_READ)) {
    return <PermissionNotice>Ask payroll for run access.</PermissionNotice>;
  }

  if (runQuery.isPending) {
    return (
      <Stack direction="row" spacing={12} align="center">
        <Spinner />
        <Typography variant="bodySmall" color="neutral">
          Loading payroll run…
        </Typography>
      </Stack>
    );
  }

  if (runQuery.isError || !runQuery.data) {
    return (
      <Alert tone="error" title="Could not load payroll run">
        {runQuery.error instanceof ApiRequestError ? runQuery.error.message : "Run not found"}
      </Alert>
    );
  }

  const run = runQuery.data;
  const canCalculate =
    hasPermission(PERMISSIONS.PAYROLL_RUNS_CALCULATE) &&
    ["DRAFT", "CALCULATED", "UNDER_REVIEW"].includes(run.status);
  const canSubmit = hasPermission(PERMISSIONS.PAYROLL_RUNS_REVIEW) && run.status === "CALCULATED";
  const canApprove = hasPermission(PERMISSIONS.PAYROLL_RUNS_APPROVE) && run.status === "UNDER_REVIEW";
  const canPublish = hasPermission(PERMISSIONS.PAYROLL_RUNS_PUBLISH) && run.status === "APPROVED";
  const canCancel =
    hasPermission(PERMISSIONS.PAYROLL_RUNS_CANCEL) && run.status !== "CANCELLED";
  const cancelDisabled = action === "cancel" && comment.trim().length < 5;

  return (
    <Stack spacing={16}>
      <PageHeading
        title={`${run.period.name} · payroll run`}
        description={`Run #${run.runNumber} · ${formatDate(run.period.startDate)} – ${formatDate(run.period.endDate)} · payment ${formatDate(run.period.paymentDate)}`}
        actions={
          <Stack direction="row" spacing={8} wrap>
            {canCalculate ? (
              <Button
                variant={run.status === "DRAFT" ? "filled" : "outlined"}
                onClick={() => setAction("calculate")}
              >
                {run.status === "DRAFT" ? "Calculate" : "Recalculate"}
              </Button>
            ) : null}
            {canSubmit ? (
              <Button onClick={() => setAction("submit")}>Submit review</Button>
            ) : null}
            {canApprove ? <Button onClick={() => setAction("approve")}>Approve</Button> : null}
            {canPublish ? (
              <Button color="success" onClick={() => setAction("publish")}>
                Publish
              </Button>
            ) : null}
            {canCancel ? (
              <Button variant="outlined" color="error" onClick={() => setAction("cancel")}>
                Cancel run
              </Button>
            ) : null}
          </Stack>
        }
      />

      <Stack direction="row" spacing={8} align="center" wrap>
        <PayrollStatusBadge status={run.status} />
        <Typography variant="caption" color="neutral">
          Calculation v{run.calculationVersion} · updated {formatDateTime(run.updatedAt)}
        </Typography>
      </Stack>

      <PayrollWarnings warnings={run.warnings} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Employees" value={run.employeeCount} />
        <MetricCard label="Gross" value={formatMoney(run.grossTotal, run.currency)} />
        <MetricCard label="Deductions" value={formatMoney(run.deductionTotal, run.currency)} />
        <MetricCard label="Net" value={formatMoney(run.netTotal, run.currency)} />
        <MetricCard
          label="Employer contributions"
          value={formatMoney(run.employerContributionTotal, run.currency)}
          hint="Not deducted from net"
        />
      </div>

      <Tabs
        defaultValue="payslips"
        items={[
          {
            value: "payslips",
            label: "Calculation review",
            content: (
              <Card variant="elevated" padding="lg">
                <CardBody>
                  <Stack spacing={12}>
                    <Stack direction="row" justify="between" align="center" wrap>
                      <Typography variant="h6">Employee payslips</Typography>
                      <Typography variant="caption" color="neutral">
                        Calculated from attendance, approved unpaid leave, verified overtime, and approved adjustments.
                      </Typography>
                    </Stack>
                    {payslipsQuery.isPending ? (
                      <Stack direction="row" spacing={12} align="center">
                        <Spinner />
                        <Typography variant="bodySmall" color="neutral">
                          Loading payslips…
                        </Typography>
                      </Stack>
                    ) : payslipsQuery.isError ? (
                      <Alert tone="error" title="Could not load payslips">
                        {payslipsQuery.error instanceof ApiRequestError
                          ? payslipsQuery.error.message
                          : "Unexpected error"}
                      </Alert>
                    ) : (
                      <Table
                        data={payslipsQuery.data?.items ?? []}
                        rowKey={(row) => row.id}
                        emptyText={
                          <EmptyState
                            title="No payslips calculated"
                            description="Run the calculation to generate draft payslips."
                          />
                        }
                        columns={[
                          {
                            key: "employee",
                            header: "Employee",
                            render: (row) => (
                              <Stack spacing={1}>
                                <Link to={`/payroll/payslips/${row.id}`} className="underline">
                                  <Typography variant="bodySmall" className="font-medium">
                                    {row.employeeName}
                                  </Typography>
                                </Link>
                                <Typography variant="caption" color="neutral">
                                  {row.employeeNumber}
                                  {row.department ? ` · ${row.department}` : ""}
                                </Typography>
                              </Stack>
                            ),
                          },
                          {
                            key: "base",
                            header: "Base salary",
                            align: "right",
                            render: (row) => formatMoney(row.baseSalary, row.currency),
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
                            key: "warnings",
                            header: "Warnings",
                            render: (row) => row.warnings.length,
                          },
                          {
                            key: "actions",
                            header: "",
                            align: "right",
                            render: (row) => (
                              <Link to={`/payroll/payslips/${row.id}`}>
                                <Button variant="text" size="sm">
                                  Open
                                </Button>
                              </Link>
                            ),
                          },
                        ]}
                      />
                    )}
                  </Stack>
                </CardBody>
              </Card>
            ),
          },
          {
            value: "adjustments",
            label: "Adjustments",
            content: (
              <Card variant="elevated" padding="lg">
                <CardBody>
                  <Stack spacing={12}>
                    <Stack direction="row" justify="between" align="center" wrap>
                      <Typography variant="h6">Approved and pending adjustments</Typography>
                      <Link to="/payroll/adjustments">
                        <Button variant="text" size="sm">
                          Manage adjustments
                        </Button>
                      </Link>
                    </Stack>
                    <Typography variant="caption" color="neutral">
                      Only approved adjustments are included in the calculation. Pending adjustments
                      require review before recalculation.
                    </Typography>
                    {adjustmentsQuery.isPending ? (
                      <Spinner />
                    ) : (
                      <Table
                        data={adjustmentsQuery.data?.items ?? []}
                        rowKey={(row) => row.id}
                        emptyText={
                          <EmptyState
                            title="No adjustments for this period"
                            description="Create an adjustment to add a one-off earning or deduction."
                          />
                        }
                        columns={[
                          {
                            key: "employee",
                            header: "Employee",
                            render: (row) => `${row.employee.fullName} · ${row.employee.employeeNumber}`,
                          },
                          {
                            key: "component",
                            header: "Component",
                            render: (row) => `${row.component.name} (${row.component.code})`,
                          },
                          {
                            key: "amount",
                            header: "Amount",
                            align: "right",
                            render: (row) => formatMoney(row.amount),
                          },
                          {
                            key: "reason",
                            header: "Reason",
                            render: (row) => row.reason,
                          },
                          {
                            key: "status",
                            header: "Status",
                            render: (row) => <AdjustmentStatusBadge status={row.status} />,
                          },
                        ]}
                      />
                    )}
                  </Stack>
                </CardBody>
              </Card>
            ),
          },
          {
            value: "history",
            label: "Approval history",
            content: (
              <Card variant="elevated" padding="lg">
                <CardBody>
                  <Stack spacing={12}>
                    <Typography variant="h6">Audit trail</Typography>
                    {run.approvals.length === 0 ? (
                      <EmptyState
                        title="No workflow actions yet"
                        description="Calculation, review, approval, publication, and cancellation are recorded here."
                      />
                    ) : (
                      run.approvals.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-md border border-[var(--nemo-neutral-200)] p-3"
                        >
                          <Stack direction="row" justify="between" align="center" wrap>
                            <Typography variant="bodySmall" className="font-medium">
                              {entry.action.replaceAll("_", " ")}
                            </Typography>
                            <Typography variant="caption" color="neutral">
                              {formatDateTime(entry.createdAt)}
                            </Typography>
                          </Stack>
                          <Typography variant="caption" color="neutral">
                            {entry.actorName}
                            {entry.comment ? ` · ${entry.comment}` : ""}
                          </Typography>
                        </div>
                      ))
                    )}
                  </Stack>
                </CardBody>
              </Card>
            ),
          },
        ]}
      />

      <Modal
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAction(null);
            setComment("");
          }
        }}
        title={action ? ACTION_COPY[action].title : "Payroll action"}
        description={action ? ACTION_COPY[action].description : ""}
        size="sm"
        footer={
          <Stack direction="row" justify="end" spacing={8}>
            <Button
              variant="outlined"
              onClick={() => {
                setAction(null);
                setComment("");
              }}
            >
              Close
            </Button>
            <LoadingButton
              color={action ? ACTION_COPY[action].tone : "primary"}
              loading={actionMutation.isPending}
              disabled={cancelDisabled}
              onClick={() => {
                if (action) actionMutation.mutate(action);
              }}
            >
              {action ? ACTION_COPY[action].confirm : "Confirm"}
            </LoadingButton>
          </Stack>
        }
      >
        {action === "cancel" ? (
          <Textarea
            label="Cancellation reason"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={4}
            helperText="At least 5 characters. The reason is stored in the audit trail."
            fullWidth
          />
        ) : action === "calculate" ? (
          <Typography variant="bodySmall" color="neutral">
            This recalculates all payslips in the run. Existing draft payslips are replaced.
          </Typography>
        ) : (
          <Textarea
            label="Comment (optional)"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            fullWidth
          />
        )}
      </Modal>
    </Stack>
  );
}
