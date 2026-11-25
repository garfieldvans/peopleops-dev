import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Modal,
  Stack,
  Typography,
} from "@nemo-ui/ui";
import type { ReactNode } from "react";
import type { PayrollAdjustment, PayrollRunStatus } from "@peopleops/shared-types";
import { LoadingButton } from "../../components/loading-button";
import { adjustmentStatusColor, runStatusColor, warningLabel } from "./payroll-utils";

export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <Stack direction="row" justify="between" align="center" wrap spacing={12}>
      <Stack spacing={4}>
        <Typography variant="h4" as="h1">
          {title}
        </Typography>
        <Typography variant="bodySmall" color="neutral">
          {description}
        </Typography>
      </Stack>
      {actions}
    </Stack>
  );
}

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card variant="outlined" padding="md">
      <CardBody>
        <Stack spacing={4}>
          <Typography variant="caption" color="neutral">
            {label}
          </Typography>
          <Typography variant="h5">{value}</Typography>
          {hint ? (
            <Typography variant="caption" color="neutral">
              {hint}
            </Typography>
          ) : null}
        </Stack>
      </CardBody>
    </Card>
  );
}

export function PayrollStatusBadge({ status }: { status: PayrollRunStatus }) {
  return (
    <Badge variant="filled" color={runStatusColor(status)}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

export function AdjustmentStatusBadge({ status }: { status: PayrollAdjustment["status"] }) {
  return (
    <Badge variant="filled" color={adjustmentStatusColor(status)}>
      {status}
    </Badge>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Stack spacing={4}>
      <Typography variant="bodySmall" className="font-medium">
        {title}
      </Typography>
      <Typography variant="caption" color="neutral">
        {description}
      </Typography>
    </Stack>
  );
}

export function PayrollWarnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <Alert tone="warning" title={`${warnings.length} calculation warning${warnings.length === 1 ? "" : "s"}`}>
      <Stack spacing={2}>
        {warnings.map((warning) => (
          <Typography key={warning} variant="caption">
            • {warningLabel(warning)}
          </Typography>
        ))}
      </Stack>
    </Alert>
  );
}

export function PermissionNotice({ children }: { children: ReactNode }) {
  return (
    <Alert tone="warning" title="You do not have access to this payroll area">
      {children}
    </Alert>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "primary",
  busy,
  onConfirm,
  onOpenChange,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "primary" | "error" | "warning" | "success";
  busy?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <Stack direction="row" justify="end" spacing={8}>
          <Button variant="outlined" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <LoadingButton
            color={tone}
            loading={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </LoadingButton>
        </Stack>
      }
    >
      {children}
    </Modal>
  );
}
