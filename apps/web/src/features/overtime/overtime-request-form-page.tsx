import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, CardBody, Stack, Textarea, Typography, useToast } from "@nemo-ui/ui";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import type { OvertimeRequest } from "@peopleops/shared-types";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { FormDatePicker } from "../../components/form-date-picker";
import { FormInput } from "../../components/form-input";
import { LoadingButton } from "../../components/loading-button";
import { PageHeading } from "./overtime-ui";
import { formatMinutes, toIsoInstant, todayKey } from "./overtime-utils";

const requestSchema = z
  .object({
    workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the work date"),
    plannedStartAt: z.string().min(1, "Choose the planned start"),
    plannedEndAt: z.string().min(1, "Choose the planned end"),
    plannedBreakMinutes: z.coerce.number().int().min(0).max(240),
    reason: z.string().min(5, "Give at least 5 characters").max(1000),
  })
  .refine((value) => new Date(value.plannedEndAt) > new Date(value.plannedStartAt), {
    message: "Planned end must be later than planned start",
    path: ["plannedEndAt"],
  });

type RequestFormInput = z.input<typeof requestSchema>;
type RequestFormValues = z.output<typeof requestSchema>;

export function OvertimeRequestFormPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useForm<RequestFormInput, unknown, RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      workDate: todayKey(),
      plannedStartAt: "",
      plannedEndAt: "",
      plannedBreakMinutes: 0,
      reason: "",
    },
  });
  const values = form.watch();
  const plannedMinutes =
    values.plannedStartAt && values.plannedEndAt
      ? Math.max(
          0,
          Math.round(
            (new Date(values.plannedEndAt).getTime() - new Date(values.plannedStartAt).getTime()) /
              60_000,
          ) - Number(values.plannedBreakMinutes || 0),
        )
      : null;

  const submitMutation = useMutation({
    mutationFn: async (input: RequestFormValues) => {
      const created = await apiRequest<OvertimeRequest>("/overtime/requests", {
        method: "POST",
        body: {
          workDate: input.workDate,
          plannedStartAt: toIsoInstant(input.plannedStartAt),
          plannedEndAt: toIsoInstant(input.plannedEndAt),
          plannedBreakMinutes: input.plannedBreakMinutes,
          reason: input.reason,
          clientRequestId: crypto.randomUUID(),
        },
      });
      return apiRequest<OvertimeRequest>(`/overtime/requests/${created.id}/submit`, {
        method: "POST",
      });
    },
    onSuccess: (request) => {
      toast.success("Overtime request submitted");
      void queryClient.invalidateQueries({ queryKey: ["overtime", "requests"] });
      void queryClient.invalidateQueries({ queryKey: ["overtime", "dashboard"] });
      navigate(`/overtime/requests/${request.id}`);
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiRequestError ? error.message : "Could not submit the request",
      ),
  });

  return (
    <Stack spacing={16}>
      <PageHeading
        title="Request overtime"
        description="Planned overtime is validated against your policy, schedule, and approved leave"
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card variant="elevated" padding="lg">
          <CardBody>
            <form
              className="flex flex-col gap-4"
              onSubmit={form.handleSubmit((input) => submitMutation.mutate(input))}
            >
              <FormDatePicker control={form.control} name="workDate" label="Work date" required />
              <div className="grid gap-3 md:grid-cols-2">
                <FormInput
                  control={form.control}
                  name="plannedStartAt"
                  label="Planned start"
                  type="datetime-local"
                  required
                  fullWidth
                />
                <FormInput
                  control={form.control}
                  name="plannedEndAt"
                  label="Planned end"
                  type="datetime-local"
                  required
                  fullWidth
                />
              </div>
              <FormInput
                control={form.control}
                name="plannedBreakMinutes"
                label="Planned break (minutes)"
                type="number"
                min="0"
                max="240"
                fullWidth
              />
              <Controller
                control={form.control}
                name="reason"
                render={({ field, fieldState }) => (
                  <Textarea
                    label="Reason"
                    rows={4}
                    placeholder="Explain the overtime work"
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                    fullWidth
                  />
                )}
              />
              {submitMutation.isError ? (
                <Alert tone="error" title="Could not submit the request">
                  {submitMutation.error instanceof ApiRequestError
                    ? submitMutation.error.message
                    : "Unexpected error"}
                </Alert>
              ) : null}
              <Stack direction="row" spacing={8} wrap>
                <LoadingButton type="submit" loading={submitMutation.isPending}>
                  Submit request
                </LoadingButton>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => navigate("/overtime/requests")}
                >
                  Cancel
                </Button>
              </Stack>
            </form>
          </CardBody>
        </Card>

        <Card variant="outlined" padding="lg">
          <CardBody>
            <Stack spacing={12}>
              <Typography variant="h6">Planned duration</Typography>
              <Typography variant="h3">
                {plannedMinutes === null ? "—" : formatMinutes(plannedMinutes)}
              </Typography>
              <Typography variant="bodySmall" color="neutral">
                The server recalculates the duration using the assigned policy and rounding rules.
                Overtime is not automatically payable; approved work still needs actual recording
                and HR verification.
              </Typography>
              <Alert tone="info" title="Attendance evidence">
                After the work date you can complete the request manually or let the server derive
                the actual window from your clock-out. Early arrival is never counted as overtime.
              </Alert>
            </Stack>
          </CardBody>
        </Card>
      </div>
    </Stack>
  );
}
