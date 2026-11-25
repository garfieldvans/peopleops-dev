import { Badge, Card, CardBody, Progress, Stack, Typography } from "@nemo-ui/ui";
import type { ReactNode } from "react";
import type { LeaveBalance, LeaveRequestStatus } from "@peopleops/shared-types";
import { formatDate, formatQuantity, statusColor, statusLabel } from "./leave-utils";

export function LeaveStatusBadge({ status }: { status: LeaveRequestStatus }) {
  return (
    <Badge variant="filled" color={statusColor(status)}>
      {statusLabel(status)}
    </Badge>
  );
}

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

export function BalanceCard({ balance }: { balance: LeaveBalance }) {
  const committed = balance.used + balance.reserved;
  return (
    <Card variant="elevated" padding="lg">
      <CardBody>
        <Stack spacing={12}>
          <Stack spacing={2}>
            <Typography variant="h6">{balance.leaveType.name}</Typography>
            <Typography variant="caption" color="neutral">
              {balance.policy?.name ?? "Leave policy"} · {formatDate(balance.periodStart)} –{" "}
              {formatDate(balance.periodEnd)}
            </Typography>
          </Stack>
          <Stack direction="row" align="end" spacing={6}>
            <Typography variant="h3">{balance.available}</Typography>
            <Typography variant="bodySmall" color="neutral">
              {balance.unit === "HOUR" ? "hours available" : "days available"}
            </Typography>
          </Stack>
          <Stack spacing={4}>
            <Progress
              value={Math.min(committed, Math.max(balance.entitled, 1))}
              max={Math.max(balance.entitled, 1)}
              size="sm"
              color={committed >= balance.entitled && balance.entitled > 0 ? "warning" : "success"}
              label={`${formatQuantity(committed, balance.unit)} committed of ${formatQuantity(balance.entitled, balance.unit)}`}
            />
            <Typography variant="caption" color="neutral">
              {balance.entitled > 0
                ? `${formatQuantity(committed, balance.unit)} committed · ${formatQuantity(balance.available, balance.unit)} available`
                : "No entitlement configured for this period"}
            </Typography>
          </Stack>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <Stat label="Entitled" value={formatQuantity(balance.entitled, balance.unit)} />
            <Stat label="Used" value={formatQuantity(balance.used, balance.unit)} />
            <Stat label="Reserved" value={formatQuantity(balance.reserved, balance.unit)} />
          </div>
        </Stack>
      </CardBody>
    </Card>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="neutral">
        {label}
      </Typography>
      <Typography variant="bodySmall">{value}</Typography>
    </Stack>
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
