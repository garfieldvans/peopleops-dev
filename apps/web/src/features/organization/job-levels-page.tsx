import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Modal,
  Spinner,
  Stack,
  Table,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { PERMISSIONS, type JobLevel } from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { FormInput } from "../../components/form-input";
import { LoadingButton } from "../../components/loading-button";
import { jobLevelSchema, nullifyEmpty, type JobLevelFormInput } from "./organization-schemas";

export function JobLevelsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [dialog, setDialog] = useState<
    { mode: "create" } | { mode: "edit"; jobLevel: JobLevel } | null
  >(null);

  const jobLevelsQuery = useQuery({
    queryKey: ["job-levels"],
    queryFn: () => apiRequest<JobLevel[]>("/job-levels"),
  });

  const removeMutation = useMutation({
    mutationFn: (jobLevel: JobLevel) =>
      apiRequest<void>(`/job-levels/${jobLevel.id}`, { method: "DELETE" }),
    onSuccess: (_, jobLevel) => {
      toast.success(`${jobLevel.name} deleted`);
      void queryClient.invalidateQueries({ queryKey: ["job-levels"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not delete"),
  });

  return (
    <Stack spacing={20}>
      <Stack direction="row" justify="between" align="center" wrap spacing={12}>
        <Stack spacing={4}>
          <Typography variant="h4" as="h1">
            Job levels
          </Typography>
          <Typography variant="bodySmall" color="neutral">
            Organization settings / Job levels
          </Typography>
        </Stack>
        {hasPermission(PERMISSIONS.JOB_LEVEL_CREATE) ? (
          <Button onClick={() => setDialog({ mode: "create" })}>Add job level</Button>
        ) : null}
      </Stack>

      <Card variant="elevated" padding="lg">
        <CardBody>
          {jobLevelsQuery.isPending ? (
            <Stack direction="row" spacing={12} align="center">
              <Spinner />
              <Typography variant="bodySmall" color="neutral">
                Loading job levels…
              </Typography>
            </Stack>
          ) : jobLevelsQuery.isError ? (
            <Alert tone="error" title="Could not load job levels">
              {jobLevelsQuery.error instanceof ApiRequestError
                ? jobLevelsQuery.error.message
                : "Unexpected error"}
            </Alert>
          ) : (
            <Table
              columns={[
                {
                  key: "order",
                  header: "Order",
                  render: (level) => level.displayOrder,
                  width: 80,
                },
                {
                  key: "name",
                  header: "Job level",
                  render: (level) => (
                    <Stack spacing={2}>
                      <Typography variant="bodySmall" className="font-medium">
                        {level.name}
                      </Typography>
                      <Typography variant="caption" color="neutral">
                        {level.code}
                      </Typography>
                    </Stack>
                  ),
                },
                {
                  key: "description",
                  header: "Description",
                  render: (level) => level.description ?? "—",
                },
                {
                  key: "positions",
                  header: "Positions",
                  render: (level) => level.positionCount,
                },
                {
                  key: "employees",
                  header: "Employees",
                  render: (level) => level.employeeCount,
                },
                {
                  key: "status",
                  header: "Status",
                  render: (level) => (
                    <Badge variant="filled" color={level.status === "ACTIVE" ? "success" : "neutral"}>
                      {level.status.toLowerCase()}
                    </Badge>
                  ),
                },
                {
                  key: "actions",
                  header: "",
                  align: "right",
                  render: (level) => (
                    <Stack direction="row" spacing={4} justify="end">
                      {hasPermission(PERMISSIONS.JOB_LEVEL_UPDATE) ? (
                        <Button
                          variant="text"
                          size="sm"
                          onClick={() => setDialog({ mode: "edit", jobLevel: level })}
                        >
                          Edit
                        </Button>
                      ) : null}
                      {hasPermission(PERMISSIONS.JOB_LEVEL_DELETE) ? (
                        <LoadingButton
                          variant="text"
                          size="sm"
                          color="error"
                          loading={
                            removeMutation.isPending && removeMutation.variables?.id === level.id
                          }
                          onClick={() => removeMutation.mutate(level)}
                        >
                          Delete
                        </LoadingButton>
                      ) : null}
                    </Stack>
                  ),
                },
              ]}
              data={jobLevelsQuery.data}
              rowKey={(level) => level.id}
              emptyText="No job levels yet."
            />
          )}
        </CardBody>
      </Card>

      <JobLevelDialog dialog={dialog} onClose={() => setDialog(null)} />
    </Stack>
  );
}

function JobLevelDialog({
  dialog,
  onClose,
}: {
  dialog: { mode: "create" } | { mode: "edit"; jobLevel: JobLevel } | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const open = dialog !== null;
  const editing = dialog?.mode === "edit" ? dialog.jobLevel : null;

  const { control, handleSubmit, reset, formState } = useForm<JobLevelFormInput>({
    resolver: zodResolver(jobLevelSchema),
  });

  useEffect(() => {
    if (!open) return;
    reset(
      editing
        ? {
            name: editing.name,
            code: editing.code,
            description: editing.description ?? "",
            displayOrder: editing.displayOrder,
          }
        : { name: "", code: "", description: "", displayOrder: 0 },
    );
  }, [open, editing, reset]);

  const mutation = useMutation({
    mutationFn: (values: JobLevelFormInput) => {
      const body = nullifyEmpty(values as Record<string, unknown>);
      return editing
        ? apiRequest<JobLevel>(`/job-levels/${editing.id}`, { method: "PATCH", body })
        : apiRequest<JobLevel>("/job-levels", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(editing ? "Job level updated" : "Job level created");
      void queryClient.invalidateQueries({ queryKey: ["job-levels"] });
      onClose();
    },
  });

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={editing ? "Edit job level" : "Add job level"}
      size="sm"
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            form="job-level-form"
            loading={mutation.isPending || formState.isSubmitting}
          >
            {editing ? "Save changes" : "Create job level"}
          </LoadingButton>
        </>
      }
    >
      <form
        id="job-level-form"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <Stack spacing={16}>
          {mutation.isError ? (
            <Alert tone="error" title="Could not save the job level">
              {mutation.error instanceof ApiRequestError
                ? mutation.error.message
                : "Unexpected error"}
            </Alert>
          ) : null}
          <FormInput control={control} name="name" label="Name" fullWidth required />
          <FormInput control={control} name="code" label="Code" fullWidth required />
          <FormInput
            control={control}
            name="displayOrder"
            label="Display order"
            type="number"
            fullWidth
          />
          <FormInput control={control} name="description" label="Description" fullWidth />
        </Stack>
      </form>
    </Modal>
  );
}
