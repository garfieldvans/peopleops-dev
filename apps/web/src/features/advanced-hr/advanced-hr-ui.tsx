import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Modal,
  Spinner,
  Stack,
  Typography,
} from "@nemo-ui/ui";
import type { ReactNode } from "react";
import { LoadingButton } from "../../components/loading-button";
import { ApiRequestError } from "../../lib/http";
import { statusColor, titleCase } from "./advanced-hr-api";

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

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="filled" color={statusColor(status)}>
      {titleCase(status)}
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

export function LoadingBlock({ label }: { label: string }) {
  return (
    <Stack direction="row" spacing={12} align="center">
      <Spinner />
      <Typography variant="bodySmall" color="neutral">
        {label}
      </Typography>
    </Stack>
  );
}

export function ErrorBlock({ title, error }: { title: string; error: unknown }) {
  return (
    <Alert tone="error" title={title}>
      {error instanceof ApiRequestError ? error.message : "Unexpected error"}
    </Alert>
  );
}

export function PermissionNotice({ children }: { children: ReactNode }) {
  return (
    <Alert tone="warning" title="You do not have access to this area">
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
          <LoadingButton color={tone} loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </LoadingButton>
        </Stack>
      }
    >
      {children}
    </Modal>
  );
}

export function ProgressSummary({
  progress,
}: {
  progress: { total: number; completed: number; overdue: number };
}) {
  const percent = progress.total === 0 ? 0 : Math.round((progress.completed / progress.total) * 100);
  return (
    <Stack spacing={4}>
      <Typography variant="bodySmall">
        {progress.completed} of {progress.total} tasks · {percent}%
      </Typography>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--nemo-neutral-100)]">
        <div
          className="h-full rounded-full bg-[var(--nemo-primary-500)]"
          style={{ width: `${percent}%` }}
        />
      </div>
      {progress.overdue > 0 ? (
        <Typography variant="caption" color="error">
          {progress.overdue} overdue task{progress.overdue === 1 ? "" : "s"}
        </Typography>
      ) : null}
    </Stack>
  );
}
