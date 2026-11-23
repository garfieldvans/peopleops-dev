import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  Input,
  Modal,
  Spinner,
  Stack,
  Tabs,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  PERMISSIONS,
  type EmployeeDetail,
  type EmploymentHistoryEntry,
} from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";
import { EmergencyContactsTab } from "./emergency-contacts-tab";
import { DocumentsTab } from "./documents-tab";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack spacing={2}>
      <Typography variant="caption" color="neutral">
        {label}
      </Typography>
      <Typography variant="bodySmall">{value ?? "—"}</Typography>
    </Stack>
  );
}

function statusColor(status: EmployeeDetail["employmentStatus"]) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "PROBATION") return "warning" as const;
  return "neutral" as const;
}

export function EmployeeDetailPage({ self = false }: { self?: boolean }) {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user, hasPermission } = useAuth();
  const [selfDialogOpen, setSelfDialogOpen] = useState(false);

  const employeeQuery = useQuery({
    queryKey: ["employees", "detail", self ? "me" : params.id],
    queryFn: () =>
      apiRequest<EmployeeDetail>(self ? "/employees/me" : `/employees/${params.id}`),
  });

  const employee = employeeQuery.data;

  const historyQuery = useQuery({
    queryKey: ["employees", employee?.id, "history"],
    queryFn: () => apiRequest<EmploymentHistoryEntry[]>(`/employees/${employee!.id}/history`),
    enabled: Boolean(employee),
  });

  const deactivateMutation = useMutation({
    mutationFn: (employeeId: string) =>
      apiRequest<EmployeeDetail>(`/employees/${employeeId}/deactivate`, {
        method: "POST",
        body: { reason: "Deactivated from the employee profile" },
      }),
    onSuccess: () => {
      toast.success("Employee deactivated");
      void queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not deactivate"),
  });

  if (employeeQuery.isPending) {
    return (
      <Stack direction="row" spacing={12} align="center">
        <Spinner />
        <Typography variant="bodySmall" color="neutral">
          Loading employee…
        </Typography>
      </Stack>
    );
  }

  if (employeeQuery.isError || !employee) {
    return (
      <Alert tone="error" title="Could not load this employee">
        {employeeQuery.error instanceof ApiRequestError
          ? employeeQuery.error.message
          : "Unexpected error"}
      </Alert>
    );
  }

  const isSelf = Boolean(user && employee.user?.id === user.id);
  const canEdit = hasPermission(PERMISSIONS.EMPLOYEE_UPDATE);
  const canDeactivate = hasPermission(PERMISSIONS.EMPLOYEE_DEACTIVATE);
  const canEditSelf = isSelf && hasPermission(PERMISSIONS.EMPLOYEE_UPDATE_SELF);

  const overview = (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card variant="outlined">
        <CardBody>
          <Stack spacing={12}>
            <Typography variant="h6">Employment</Typography>
            <Field label="Employee number" value={employee.employeeNumber} />
            <Field label="Employment type" value={employee.employmentType.toLowerCase()} />
            <Field label="Status" value={employee.employmentStatus.toLowerCase()} />
            <Field label="Join date" value={employee.joinDate} />
            <Field label="Branch" value={employee.branch?.name} />
            <Field label="Department" value={employee.department?.name} />
            <Field label="Position" value={employee.position?.name} />
            <Field label="Job level" value={employee.jobLevel?.name} />
            <Field
              label="Direct manager"
              value={employee.manager ? employee.manager.fullName : "No manager"}
            />
          </Stack>
        </CardBody>
      </Card>
      <Card variant="outlined">
        <CardBody>
          <Stack spacing={12}>
            <Typography variant="h6">Contact</Typography>
            <Field label="Personal email" value={employee.personalEmail} />
            <Field label="Work email" value={employee.workEmail} />
            <Field label="Phone" value={employee.phone} />
            <Field
              label="Address"
              value={[employee.addressLine, employee.city, employee.province, employee.country]
                .filter(Boolean)
                .join(", ")}
            />
          </Stack>
        </CardBody>
      </Card>
      <Card variant="outlined">
        <CardBody>
          <Stack spacing={12}>
            <Typography variant="h6">Records</Typography>
            <Field label="Emergency contacts" value={employee.emergencyContactCount} />
            <Field label="Documents" value={employee.documentCount} />
            <Field label="Linked account" value={employee.user?.email ?? "Not linked"} />
            <Field label="Last updated" value={employee.updatedAt.slice(0, 10)} />
          </Stack>
        </CardBody>
      </Card>
    </div>
  );

  const personal = (
    <Card variant="outlined">
      <CardBody>
        <div className="grid gap-5 md:grid-cols-3">
          <Field label="Full name" value={employee.fullName} />
          <Field label="Preferred name" value={employee.preferredName} />
          <Field label="Gender" value={employee.gender?.toLowerCase()} />
          <Field label="Birth date" value={employee.birthDate} />
          <Field label="Place of birth" value={employee.placeOfBirth} />
          <Field label="Marital status" value={employee.maritalStatus?.toLowerCase()} />
          <Field label="Nationality" value={employee.nationality} />
          <Field label="Personal email" value={employee.personalEmail} />
          <Field label="Phone" value={employee.phone} />
          <Field label="Address" value={employee.addressLine} />
          <Field label="City" value={employee.city} />
          <Field label="Province" value={employee.province} />
          <Field label="Postal code" value={employee.postalCode} />
          <Field label="Country" value={employee.country} />
        </div>
        {employee.birthDate === null && !canEdit && !isSelf ? (
          <Typography variant="caption" color="neutral" className="mt-4 block">
            Some personal fields are hidden because you do not have sensitive-read permission.
          </Typography>
        ) : null}
      </CardBody>
    </Card>
  );

  const employment = (
    <Card variant="outlined">
      <CardBody>
        <div className="grid gap-5 md:grid-cols-3">
          <Field label="Employment type" value={employee.employmentType.toLowerCase()} />
          <Field label="Employment status" value={employee.employmentStatus.toLowerCase()} />
          <Field label="Join date" value={employee.joinDate} />
          <Field label="Probation end date" value={employee.probationEndDate} />
          <Field label="Contract start date" value={employee.contractStartDate} />
          <Field label="Contract end date" value={employee.contractEndDate} />
          <Field label="Branch" value={employee.branch?.name} />
          <Field label="Department" value={employee.department?.name} />
          <Field label="Position" value={employee.position?.name} />
          <Field label="Job level" value={employee.jobLevel?.name} />
          <Field label="Direct manager" value={employee.manager?.fullName} />
          <Field label="Work email" value={employee.workEmail} />
        </div>
      </CardBody>
    </Card>
  );

  const history = historyQuery.isPending ? (
    <Spinner />
  ) : historyQuery.isError ? (
    <Alert tone="error" title="Could not load employment history">
      {historyQuery.error instanceof ApiRequestError ? historyQuery.error.message : "Unexpected error"}
    </Alert>
  ) : (
    <Stack spacing={12}>
      {historyQuery.data.map((entry) => (
        <Card key={entry.id} variant="outlined">
          <CardBody>
            <Stack spacing={6}>
              <Stack direction="row" justify="between" align="center" wrap spacing={8}>
                <Typography variant="bodySmall" className="font-medium">
                  {entry.position?.name ?? "No position"} · {entry.department?.name ?? "No department"}
                </Typography>
                <Badge variant="outlined" color="neutral">
                  {entry.effectiveFrom} → {entry.effectiveTo ?? "present"}
                </Badge>
              </Stack>
              <Typography variant="caption" color="neutral">
                {entry.employmentType.toLowerCase()} · {entry.employmentStatus.toLowerCase()} ·{" "}
                {entry.branch?.name ?? "No branch"} · Manager: {entry.manager?.fullName ?? "—"}
              </Typography>
              {entry.changeReason ? (
                <Typography variant="caption" color="neutral">
                  {entry.changeReason}
                  {entry.createdBy ? ` · by ${entry.createdBy.name}` : ""}
                </Typography>
              ) : null}
            </Stack>
          </CardBody>
        </Card>
      ))}
    </Stack>
  );

  return (
    <Stack spacing={20}>
      <Stack direction="row" justify="between" align="start" wrap spacing={12}>
        <Stack direction="row" spacing={14} align="center">
          <Avatar name={employee.fullName} src={employee.photoUrl ?? undefined} size="lg" />
          <Stack spacing={4}>
            <Stack direction="row" spacing={8} align="center" wrap>
              <Typography variant="h4" as="h1">
                {employee.fullName}
              </Typography>
              <Badge variant="filled" color={statusColor(employee.employmentStatus)}>
                {employee.employmentStatus.toLowerCase()}
              </Badge>
            </Stack>
            <Typography variant="bodySmall" color="neutral">
              {employee.employeeNumber} · {employee.position?.name ?? "No position"} ·{" "}
              {employee.department?.name ?? "No department"}
            </Typography>
          </Stack>
        </Stack>
        <Stack direction="row" spacing={8} wrap>
          {canEdit ? (
            <Button variant="outlined" onClick={() => navigate(`/employees/${employee.id}/edit`)}>
              Edit employee
            </Button>
          ) : null}
          {canEditSelf ? (
            <Button variant="outlined" onClick={() => setSelfDialogOpen(true)}>
              Edit my contact details
            </Button>
          ) : null}
          {canDeactivate && employee.employmentStatus !== "INACTIVE" ? (
            <LoadingButton
              variant="outlined"
              color="error"
              loading={deactivateMutation.isPending}
              onClick={() => deactivateMutation.mutate(employee.id)}
            >
              Deactivate
            </LoadingButton>
          ) : null}
        </Stack>
      </Stack>

      <Tabs
        ariaLabel="Employee profile sections"
        items={[
          { value: "overview", label: "Overview", content: overview },
          { value: "personal", label: "Personal", content: personal },
          { value: "employment", label: "Employment", content: employment },
          {
            value: "emergency",
            label: "Emergency contacts",
            content: (
              <EmergencyContactsTab employeeId={employee.id} canManage={canEdit} />
            ),
          },
          {
            value: "documents",
            label: "Documents",
            content: <DocumentsTab employeeId={employee.id} />,
          },
          { value: "history", label: "History", content: history },
        ]}
      />

      {canEditSelf ? (
        <SelfContactDialog
          employee={employee}
          open={selfDialogOpen}
          onClose={() => setSelfDialogOpen(false)}
        />
      ) : null}
    </Stack>
  );
}

function SelfContactDialog({
  employee,
  open,
  onClose,
}: {
  employee: EmployeeDetail;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    preferredName: employee.preferredName ?? "",
    phone: employee.phone ?? "",
    addressLine: employee.addressLine ?? "",
    city: employee.city ?? "",
    province: employee.province ?? "",
    postalCode: employee.postalCode ?? "",
    country: employee.country ?? "Indonesia",
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest<EmployeeDetail>("/employees/me", {
        method: "PATCH",
        body: {
          ...form,
          preferredName: form.preferredName || null,
          phone: form.phone || null,
          addressLine: form.addressLine || null,
          city: form.city || null,
          province: form.province || null,
          postalCode: form.postalCode || null,
        },
      }),
    onSuccess: () => {
      toast.success("Contact details updated");
      void queryClient.invalidateQueries({ queryKey: ["employees"] });
      onClose();
    },
  });

  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Edit my contact details"
      description="Employment fields can only be changed by HR."
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Save changes
          </LoadingButton>
        </>
      }
    >
      <Stack spacing={16}>
        {mutation.isError ? (
          <Alert tone="error" title="Could not update contact details">
            {mutation.error instanceof ApiRequestError ? mutation.error.message : "Unexpected error"}
          </Alert>
        ) : null}
        <Input
          label="Preferred name"
          value={form.preferredName}
          onChange={(event) => update("preferredName", event.target.value)}
          fullWidth
        />
        <Input
          label="Phone"
          value={form.phone}
          onChange={(event) => update("phone", event.target.value)}
          fullWidth
        />
        <Input
          label="Address"
          value={form.addressLine}
          onChange={(event) => update("addressLine", event.target.value)}
          fullWidth
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="City"
            value={form.city}
            onChange={(event) => update("city", event.target.value)}
            fullWidth
          />
          <Input
            label="Province"
            value={form.province}
            onChange={(event) => update("province", event.target.value)}
            fullWidth
          />
          <Input
            label="Postal code"
            value={form.postalCode}
            onChange={(event) => update("postalCode", event.target.value)}
            fullWidth
          />
          <Input
            label="Country"
            value={form.country}
            onChange={(event) => update("country", event.target.value)}
            fullWidth
          />
        </div>
      </Stack>
    </Modal>
  );
}
