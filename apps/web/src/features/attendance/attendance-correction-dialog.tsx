import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Modal, Stack, useToast } from "@nemo-ui/ui";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { AttendanceCorrection, AttendanceRecord } from "@peopleops/shared-types";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { FormInput } from "../../components/form-input";
import { FormSelect } from "../../components/form-select";
import { LoadingButton } from "../../components/loading-button";
import { timeFromLocal } from "./attendance-utils";

const correctionSchema = z.object({
  type: z.enum(["CLOCK_IN", "CLOCK_OUT", "BOTH"]),
  requestedClockIn: z.string().optional(),
  requestedClockOut: z.string().optional(),
  reason: z.string().min(5, "Explain the correction in at least 5 characters").max(500),
});

type CorrectionFormInput = z.infer<typeof correctionSchema>;

export function AttendanceCorrectionDialog({
  record,
  open,
  onClose,
}: {
  record: AttendanceRecord | null;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { control, handleSubmit, reset, watch, formState } = useForm<CorrectionFormInput>({
    resolver: zodResolver(correctionSchema),
    defaultValues: { type: "BOTH", requestedClockIn: "", requestedClockOut: "", reason: "" },
  });

  useEffect(() => {
    if (!open || !record) return;
    reset({
      type: "BOTH",
      requestedClockIn: timeFromLocal(record.clockInLocal) || record.scheduledStartLocal.slice(11, 16),
      requestedClockOut: timeFromLocal(record.clockOutLocal) || record.scheduledEndLocal.slice(11, 16),
      reason: "",
    });
  }, [open, record, reset]);

  const type = watch("type");

  const mutation = useMutation({
    mutationFn: (values: CorrectionFormInput) =>
      apiRequest<AttendanceCorrection>("/attendance/corrections", {
        method: "POST",
        body: {
          attendanceRecordId: record?.id,
          type: values.type,
          requestedClockIn: values.type === "CLOCK_OUT" ? null : values.requestedClockIn || null,
          requestedClockOut: values.type === "CLOCK_IN" ? null : values.requestedClockOut || null,
          reason: values.reason,
        },
      }),
    onSuccess: () => {
      toast.success("Correction request submitted");
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
      void queryClient.invalidateQueries({ queryKey: ["attendance-corrections"] });
      onClose();
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not submit the request"),
  });

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Request attendance correction"
      size="md"
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton
            form="attendance-correction-form"
            type="submit"
            loading={mutation.isPending || formState.isSubmitting}
          >
            Submit request
          </LoadingButton>
        </>
      }
    >
      <form
        id="attendance-correction-form"
        noValidate
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        <Stack spacing={16}>
          {mutation.isError ? (
            <Alert tone="error" title="Could not submit the correction">
              {mutation.error instanceof ApiRequestError
                ? mutation.error.message
                : "Unexpected error"}
            </Alert>
          ) : null}
          <FormSelect
            control={control}
            name="type"
            label="Correction type"
            options={[
              { label: "Clock-in and clock-out", value: "BOTH" },
              { label: "Clock-in only", value: "CLOCK_IN" },
              { label: "Clock-out only", value: "CLOCK_OUT" },
            ]}
            fullWidth
          />
          {type !== "CLOCK_OUT" ? (
            <FormInput
              control={control}
              name="requestedClockIn"
              label="Corrected clock-in"
              type="time"
              fullWidth
            />
          ) : null}
          {type !== "CLOCK_IN" ? (
            <FormInput
              control={control}
              name="requestedClockOut"
              label="Corrected clock-out"
              type="time"
              fullWidth
            />
          ) : null}
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="correction-reason">
              Reason
            </label>
            <textarea
              id="correction-reason"
              rows={3}
              className="w-full rounded-md border border-[var(--nemo-neutral-300)] bg-transparent px-3 py-2 text-sm"
              {...control.register("reason")}
            />
            {formState.errors.reason ? (
              <p className="mt-1 text-xs text-[var(--nemo-danger-600)]">
                {formState.errors.reason.message}
              </p>
            ) : null}
          </div>
        </Stack>
      </form>
    </Modal>
  );
}
