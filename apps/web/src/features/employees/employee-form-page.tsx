import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Divider,
  Spinner,
  Stack,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import type { EmployeeDetail } from "@peopleops/shared-types";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { FormDatePicker } from "../../components/form-date-picker";
import { FormInput } from "../../components/form-input";
import { FormSelect } from "../../components/form-select";
import { LoadingButton } from "../../components/loading-button";
import {
  departmentChoiceOptions,
  useBranchOptions,
  useDepartmentTree,
  useJobLevelOptions,
  useManagerOptions,
  usePositionOptions,
} from "./employee-options";
import {
  EMPLOYMENT_STATUS_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  GENDER_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  employeeSchema,
  type EmployeeFormInput,
} from "./employee-schemas";
import { nullifyEmpty } from "../organization/organization-schemas";

const EMPTY: EmployeeFormInput = {
  employeeNumber: "",
  firstName: "",
  middleName: "",
  lastName: "",
  preferredName: "",
  gender: "",
  birthDate: "",
  placeOfBirth: "",
  maritalStatus: "",
  nationality: "",
  personalEmail: "",
  phone: "",
  addressLine: "",
  city: "",
  province: "",
  postalCode: "",
  country: "Indonesia",
  workEmail: "",
  employmentType: "PERMANENT",
  employmentStatus: "ACTIVE",
  joinDate: "",
  probationEndDate: "",
  contractStartDate: "",
  contractEndDate: "",
  branchId: "",
  departmentId: "",
  positionId: "",
  jobLevelId: "",
  managerId: "",
  effectiveDate: "",
  changeReason: "",
};

export function EmployeeFormPage({ mode }: { mode: "create" | "edit" }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const editing = mode === "edit" && Boolean(id);

  const employeeQuery = useQuery({
    queryKey: ["employees", "detail", id],
    queryFn: () => apiRequest<EmployeeDetail>(`/employees/${id}`),
    enabled: editing,
  });

  const branchesQuery = useBranchOptions();
  const departmentsQuery = useDepartmentTree();
  const positionsQuery = usePositionOptions();
  const jobLevelsQuery = useJobLevelOptions();
  const managersQuery = useManagerOptions();

  const { control, handleSubmit, reset, formState } = useForm<EmployeeFormInput>({
    resolver: zodResolver(employeeSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!editing || !employeeQuery.data) return;
    const employee = employeeQuery.data;
    reset({
      ...EMPTY,
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      middleName: employee.middleName ?? "",
      lastName: employee.lastName,
      preferredName: employee.preferredName ?? "",
      gender: employee.gender ?? "",
      birthDate: employee.birthDate ?? "",
      placeOfBirth: employee.placeOfBirth ?? "",
      maritalStatus: employee.maritalStatus ?? "",
      nationality: employee.nationality ?? "",
      personalEmail: employee.personalEmail ?? "",
      phone: employee.phone ?? "",
      addressLine: employee.addressLine ?? "",
      city: employee.city ?? "",
      province: employee.province ?? "",
      postalCode: employee.postalCode ?? "",
      country: employee.country || "Indonesia",
      workEmail: employee.workEmail ?? "",
      employmentType: employee.employmentType,
      employmentStatus: employee.employmentStatus,
      joinDate: employee.joinDate,
      probationEndDate: employee.probationEndDate ?? "",
      contractStartDate: employee.contractStartDate ?? "",
      contractEndDate: employee.contractEndDate ?? "",
      branchId: employee.branch?.id ?? "",
      departmentId: employee.department?.id ?? "",
      positionId: employee.position?.id ?? "",
      jobLevelId: employee.jobLevel?.id ?? "",
      managerId: employee.manager?.id ?? "",
      effectiveDate: "",
      changeReason: "",
    });
  }, [editing, employeeQuery.data, reset]);

  const mutation = useMutation({
    mutationFn: (values: EmployeeFormInput) => {
      const payload = nullifyEmpty(values as Record<string, unknown>);
      delete payload["employeeNumber"];
      delete payload["employmentStatus"];
      delete payload["effectiveDate"];
      delete payload["changeReason"];

      if (editing) {
        delete payload["joinDate"];
        delete payload["contractStartDate"];
        return apiRequest<EmployeeDetail>(`/employees/${id}`, {
          method: "PATCH",
          body: {
            ...payload,
            employmentStatus: values.employmentStatus || undefined,
            effectiveDate: values.effectiveDate || undefined,
            changeReason: values.changeReason || undefined,
          },
        });
      }

      return apiRequest<EmployeeDetail>("/employees", { method: "POST", body: payload });
    },
    onSuccess: (employee) => {
      toast.success(editing ? "Employee updated" : "Employee created");
      void queryClient.invalidateQueries({ queryKey: ["employees"] });
      navigate(`/employees/${employee.id}`);
    },
  });

  if (editing && employeeQuery.isPending) {
    return (
      <Stack direction="row" spacing={12} align="center">
        <Spinner />
        <Typography variant="bodySmall" color="neutral">
          Loading employee…
        </Typography>
      </Stack>
    );
  }

  if (editing && (employeeQuery.isError || !employeeQuery.data)) {
    return (
      <Alert tone="error" title="Could not load this employee">
        {employeeQuery.error instanceof ApiRequestError
          ? employeeQuery.error.message
          : "Unexpected error"}
      </Alert>
    );
  }

  return (
    <Stack spacing={20}>
      <Stack spacing={4}>
        <Typography variant="h4" as="h1">
          {editing ? "Edit employee" : "Add employee"}
        </Typography>
        <Typography variant="bodySmall" color="neutral">
          {editing
            ? "Employment changes are recorded in history with an effective date."
            : "Create an employee profile and its first employment record."}
        </Typography>
      </Stack>

      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
        className="space-y-5"
      >
        {mutation.isError ? (
          <Alert tone="error" title="Could not save the employee">
            {mutation.error instanceof ApiRequestError
              ? mutation.error.message
              : "Unexpected error"}
          </Alert>
        ) : null}

        <Card variant="elevated" padding="lg">
          <CardBody>
            <Stack spacing={16}>
              <Typography variant="h6">Personal information</Typography>
              <div className="grid gap-4 md:grid-cols-3">
                <FormInput control={control} name="firstName" label="First name" required fullWidth />
                <FormInput control={control} name="middleName" label="Middle name" fullWidth />
                <FormInput control={control} name="lastName" label="Last name" required fullWidth />
                <FormInput control={control} name="preferredName" label="Preferred name" fullWidth />
                <FormSelect
                  control={control}
                  name="gender"
                  label="Gender"
                  placeholder="Not specified"
                  options={[{ label: "Not specified", value: "" }, ...GENDER_OPTIONS]}
                  fullWidth
                />
                <FormDatePicker control={control} name="birthDate" label="Birth date" />
                <FormInput control={control} name="placeOfBirth" label="Place of birth" fullWidth />
                <FormSelect
                  control={control}
                  name="maritalStatus"
                  label="Marital status"
                  placeholder="Not specified"
                  options={[{ label: "Not specified", value: "" }, ...MARITAL_STATUS_OPTIONS]}
                  fullWidth
                />
                <FormInput control={control} name="nationality" label="Nationality" fullWidth />
                <FormInput
                  control={control}
                  name="personalEmail"
                  label="Personal email"
                  type="email"
                  required
                  fullWidth
                />
                <FormInput control={control} name="phone" label="Phone" fullWidth />
              </div>
              <Divider />
              <Typography variant="h6">Address</Typography>
              <div className="grid gap-4 md:grid-cols-2">
                <FormInput control={control} name="addressLine" label="Address" fullWidth />
                <FormInput control={control} name="city" label="City" fullWidth />
                <FormInput control={control} name="province" label="Province" fullWidth />
                <FormInput control={control} name="postalCode" label="Postal code" fullWidth />
                <FormInput control={control} name="country" label="Country" fullWidth />
              </div>
            </Stack>
          </CardBody>
        </Card>

        <Card variant="elevated" padding="lg">
          <CardBody>
            <Stack spacing={16}>
              <Typography variant="h6">Employment</Typography>
              <div className="grid gap-4 md:grid-cols-3">
                {!editing ? (
                  <FormInput
                    control={control}
                    name="employeeNumber"
                    label="Employee number"
                    helperText="Leave blank to generate automatically"
                    fullWidth
                  />
                ) : (
                  <FormInput
                    control={control}
                    name="employeeNumber"
                    label="Employee number"
                    disabled
                    fullWidth
                  />
                )}
                <FormSelect
                  control={control}
                  name="employmentType"
                  label="Employment type"
                  options={[...EMPLOYMENT_TYPE_OPTIONS]}
                  fullWidth
                  required
                />
                {editing ? (
                  <FormSelect
                    control={control}
                    name="employmentStatus"
                    label="Employment status"
                    options={[...EMPLOYMENT_STATUS_OPTIONS]}
                    fullWidth
                  />
                ) : null}
                <FormDatePicker
                  control={control}
                  name="joinDate"
                  label="Join date"
                  required
                  disabled={editing}
                />
                <FormDatePicker control={control} name="probationEndDate" label="Probation end date" />
                <FormDatePicker
                  control={control}
                  name="contractStartDate"
                  label="Contract start date"
                  disabled={editing}
                />
                <FormDatePicker control={control} name="contractEndDate" label="Contract end date" />
                <FormInput control={control} name="workEmail" label="Work email" type="email" fullWidth />
              </div>

              <Divider />
              <div className="grid gap-4 md:grid-cols-2">
                <FormSelect
                  control={control}
                  name="branchId"
                  label="Branch"
                  placeholder="No branch"
                  options={[
                    { label: "No branch", value: "" },
                    ...(branchesQuery.data?.items.map((branch) => ({
                      label: branch.name,
                      value: branch.id,
                    })) ?? []),
                  ]}
                  fullWidth
                />
                <FormSelect
                  control={control}
                  name="departmentId"
                  label="Department"
                  placeholder="Derived from position"
                  options={[
                    { label: "Derived from position", value: "" },
                    ...departmentChoiceOptions(departmentsQuery.data ?? []),
                  ]}
                  fullWidth
                />
                <FormSelect
                  control={control}
                  name="positionId"
                  label="Position"
                  placeholder="Choose a position"
                  options={
                    positionsQuery.data?.items.map((position) => ({
                      label: `${position.title} — ${position.department.name}`,
                      value: position.id,
                    })) ?? []
                  }
                  fullWidth
                  required
                />
                <FormSelect
                  control={control}
                  name="jobLevelId"
                  label="Job level"
                  placeholder="No job level"
                  options={[
                    { label: "No job level", value: "" },
                    ...(jobLevelsQuery.data?.map((level) => ({
                      label: level.name,
                      value: level.id,
                    })) ?? []),
                  ]}
                  fullWidth
                />
                <FormSelect
                  control={control}
                  name="managerId"
                  label="Direct manager"
                  placeholder="No manager"
                  options={[
                    { label: "No manager", value: "" },
                    ...(managersQuery.data?.items
                      .filter((manager) => manager.id !== id)
                      .map((manager) => ({
                        label: `${manager.fullName} (${manager.employeeNumber})`,
                        value: manager.id,
                      })) ?? []),
                  ]}
                  fullWidth
                />
                {editing ? (
                  <>
                    <FormDatePicker
                      control={control}
                      name="effectiveDate"
                      label="Effective date"
                      helperText="Defaults to today when employment fields change"
                    />
                    <FormInput
                      control={control}
                      name="changeReason"
                      label="Change reason"
                      fullWidth
                    />
                  </>
                ) : null}
              </div>
            </Stack>
          </CardBody>
        </Card>

        <Stack direction="row" justify="end" spacing={8}>
          <Button variant="outlined" type="button" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <LoadingButton type="submit" loading={mutation.isPending || formState.isSubmitting}>
            {editing ? "Save changes" : "Create employee"}
          </LoadingButton>
        </Stack>
      </form>
    </Stack>
  );
}
