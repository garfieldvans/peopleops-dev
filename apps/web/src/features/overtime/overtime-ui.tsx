import { Badge, Card, CardBody, Stack, Typography } from "@nemo-ui/ui";
import type { ReactNode } from "react";
import type { OvertimeStatus } from "@peopleops/shared-types";
import { statusColor, statusLabel } from "./overtime-utils";

export function OvertimeStatusBadge({ status }: { status: OvertimeStatus }) {
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
