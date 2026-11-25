import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Spinner,
  Stack,
  Textarea,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import type { LeaveRequest, LeaveRequestPreview } from "@peopleops/shared-types";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { FormDatePicker } from "../../components/form-date-picker";
import { FormSelect } from "../../components/form-select";
import { LoadingButton } from "../../components/loading-button";
import { EmptyState, PageHeading } from "./leave-ui";
import {
  balanceForType,
  formatDate,
  formatQuantity,
  halfDayLabel,
  useLeaveTypes,
  useMyLeaveBalances,
} from "./leave-utils";

const requestSchema = z
  .object({
    leaveTypeId: z.string().min(1, "Choose a leave type"),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date is required"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date is required"),
    requestMode: z.enum(["FULL_DAY", "HALF_DAY"]),
    halfDayPeriod: z.string().nullable().optional(),
    reason: z.string().min(5, "Give at least 5 characters").max(1000),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "End date cannot be before the start date",
    path: ["endDate"],
  })
  .refine((value) => value.requestMode !== "HALF_DAY" || Boolean(value.halfDayPeriod), {
    message: "Choose which half of the day",
    path: ["halfDayPeriod"],
  });

type RequestFormInput = z.input<typeof requestSchema>;
type RequestFormValues = z.output<typeof requestSchema>;

export function LeaveRequestFormPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const typesQuery = useLeaveTypes();
  const balancesQuery = useMyLeaveBalances();
  const [preview, setPreview] = useState<LeaveRequestPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const form = useForm<RequestFormInput, unknown, RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      leaveTypeId: "",
      startDate: "",
      endDate: "",
      requestMode: "FULL_DAY",
      halfDayPeriod: "",
      reason: "",
    },
  });
  const values = form.watch();
  const selectedType = typesQuery.data?.find((entry) => entry.id === values.leaveTypeId);
  const selectedBalance = balanceForType(balancesQuery.data, values.leaveTypeId);

  const previewMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest<LeaveRequestPreview>("/leave-requests/preview", { method: "POST", body }),
  });

  useEffect(() => {
    setPreview(null);
    setPreviewError(null);
    if (!values.leaveTypeId || !values.startDate || !values.endDate) return;
    if (values.endDate < values.startDate) return;
    if (values.requestMode === "HALF_DAY" && !values.halfDayPeriod) return;

    const timer = window.setTimeout(() => {
      previewMutation.mutate(
        {
          leaveTypeId: values.leaveTypeId,
          startDate: values.startDate,
          endDate: values.endDate,
          requestMode: values.requestMode,
          ...(values.requestMode === "HALF_DAY" && values.halfDayPeriod
            ? { halfDayPeriod: values.halfDayPeriod }
            : {}),
        },
        {
          onSuccess: (result) => setPreview(result),
          onError: (error) =>
            setPreviewError(
              error instanceof ApiRequestError ? error.message : "Could not calculate leave",
            ),
        },
      );
    }, 350);
    return () => window.clearTimeout(timer);
    // Preview is recalculated whenever any calculation input changes.
  }, [
    values.leaveTypeId,
    values.startDate,
    values.endDate,
    values.requestMode,
    values.halfDayPeriod,
  ]);

  const submitMutation = useMutation({
    mutationFn: async (input: RequestFormValues) => {
      const created = await apiRequest<LeaveRequest>("/leave-requests", {
        method: "POST",
        body: {
          leaveTypeId: input.leaveTypeId,
          startDate: input.startDate,
          endDate: input.endDate,
          requestMode: input.requestMode,
          halfDayPeriod: input.requestMode === "HALF_DAY" ? input.halfDayPeriod : null,
          reason: input.reason,
        },
      });
      return apiRequest<LeaveRequest>(`/leave-requests/${created.id}/submit`, {
        method: "POST",
      });
    },
    onSuccess: (request) => {
      toast.success("Leave request submitted");
      void queryClient.invalidateQueries({ queryKey: ["leave"] });
      navigate(`/leave/requests/${request.id}`);
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiRequestError ? error.message : "Could not submit the request",
      );
    },
  });

  const typeOptions = useMemo(
    () =>
      typesQuery.data?.map((entry) => ({
        label: `${entry.name}${entry.requiresBalance ? "" : " (no balance required)"}`,
        value: entry.id,
      })) ?? [],
    [typesQuery.data],
  );

  const isBusy = previewMutation.isPending || submitMutation.isPending;

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Request leave"
        description="The server calculates working days from your schedule and holidays"
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card variant="elevated" padding="lg">
          <CardBody>
            {typesQuery.isPending || balancesQuery.isPending ? (
              <Stack direction="row" spacing={12} align="center">
                <Spinner />
                <Typography variant="bodySmall" color="neutral">
                  Loading leave options…
                </Typography>
              </Stack>
            ) : (
              <form
                onSubmit={form.handleSubmit((input) => submitMutation.mutate(input))}
                className="flex flex-col gap-4"
              >
                <FormSelect
                  control={form.control}
                  name="leaveTypeId"
                  label="Leave type"
                  placeholder="Choose a leave type"
                  options={typeOptions}
                  fullWidth
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <FormDatePicker
                    control={form.control}
                    name="startDate"
                    label="Start date"
                    required
                  />
                  <FormDatePicker control={form.control} name="endDate" label="End date" required />
                </div>
                <FormSelect
                  control={form.control}
                  name="requestMode"
                  label="Duration mode"
                  options={[
                    { label: "Full day", value: "FULL_DAY" },
                    ...(selectedType?.allowHalfDay
                      ? [{ label: "Half day", value: "HALF_DAY" }]
                      : []),
                  ]}
                  fullWidth
                />
                {values.requestMode === "HALF_DAY" ? (
                  <FormSelect
                    control={form.control}
                    name="halfDayPeriod"
                    label="Half day period"
                    options={[
                      { label: "First half", value: "FIRST_HALF" },
                      { label: "Second half", value: "SECOND_HALF" },
                    ]}
                    fullWidth
                  />
                ) : null}
                <Textarea
                  label="Reason"
                  rows={4}
                  placeholder="Explain the reason for this leave"
                  {...form.register("reason")}
                  error={form.formState.errors.reason?.message}
                  fullWidth
                />
                {selectedType?.requiresAttachment ? (
                  <Alert tone="warning" title="Supporting document required">
                    This leave type requires an attachment. You can upload it on the request detail
                    page after creating the request.
                  </Alert>
                ) : null}
                {submitMutation.isError ? (
                  <Alert tone="error" title="Could not submit the request">
                    {submitMutation.error instanceof ApiRequestError
                      ? submitMutation.error.message
                      : "Unexpected error"}
                  </Alert>
                ) : null}
                <Stack direction="row" spacing={8} wrap>
                  <LoadingButton type="submit" loading={submitMutation.isPending} disabled={isBusy}>
                    Submit request
                  </LoadingButton>
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={() => navigate("/leave/requests")}
                  >
                    Cancel
                  </Button>
                </Stack>
              </form>
            )}
          </CardBody>
        </Card>

        <Card variant="outlined" padding="lg">
          <CardBody>
            <Stack spacing={14}>
              <Typography variant="h6">Request preview</Typography>
              {selectedBalance ? (
                <div className="grid grid-cols-2 gap-3">
                  <PreviewStat
                    label="Available"
                    value={formatQuantity(selectedBalance.available, selectedBalance.unit)}
                  />
                  <PreviewStat
                    label="Reserved"
                    value={formatQuantity(selectedBalance.reserved, selectedBalance.unit)}
                  />
                  <PreviewStat
                    label="Entitled"
                    value={formatQuantity(selectedBalance.entitled, selectedBalance.unit)}
                  />
                  <PreviewStat
                    label="Used"
                    value={formatQuantity(selectedBalance.used, selectedBalance.unit)}
                  />
                </div>
              ) : null}

              {previewMutation.isPending ? (
                <Stack direction="row" spacing={8} align="center">
                  <Spinner />
                  <Typography variant="caption" color="neutral">
                    Calculating duration…
                  </Typography>
                </Stack>
              ) : previewError ? (
                <Alert tone="error" title="Cannot calculate this request">
                  {previewError}
                </Alert>
              ) : preview ? (
                <Stack spacing={10}>
                  <PreviewStat
                    label="Calculated duration"
                    value={formatQuantity(preview.duration, preview.durationUnit)}
                  />
                  <PreviewStat
                    label="Estimated remaining"
                    value={
                      preview.estimatedRemaining === null
                        ? "No balance tracked"
                        : formatQuantity(preview.estimatedRemaining, preview.durationUnit)
                    }
                  />
                  <PreviewStat
                    label="Requested dates"
                    value={`${formatDate(preview.startDate)} – ${formatDate(preview.endDate)}`}
                  />
                  {preview.requestMode === "HALF_DAY" ? (
                    <PreviewStat label="Half day" value={halfDayLabel(preview.halfDayPeriod)} />
                  ) : null}
                  <Stack spacing={4}>
                    <Typography variant="caption" color="neutral">
                      Working days counted
                    </Typography>
                    <div className="flex flex-wrap gap-2">
                      {preview.days.map((day) => (
                        <span
                          key={day.date}
                          className={[
                            "rounded-md border px-2 py-1 text-xs",
                            day.isWorkingDay
                              ? "border-[var(--nemo-neutral-300)]"
                              : "border-[var(--nemo-neutral-200)] text-[var(--nemo-neutral-500)] line-through",
                          ].join(" ")}
                        >
                          {formatDate(day.date)} · {day.duration}
                        </span>
                      ))}
                    </div>
                  </Stack>
                </Stack>
              ) : (
                <EmptyState
                  title="Preview appears here"
                  description="Choose a leave type and dates. The preview shows working days, excluded holidays, half-day duration, and your estimated remaining balance."
                />
              )}
            </Stack>
          </CardBody>
        </Card>
      </div>
    </Stack>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={2}>
      <Typography variant="caption" color="neutral">
        {label}
      </Typography>
      <Typography variant="bodySmall" className="font-medium">
        {value}
      </Typography>
    </Stack>
  );
}
