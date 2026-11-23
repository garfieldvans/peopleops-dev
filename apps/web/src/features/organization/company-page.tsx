import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Divider,
  Spinner,
  Stack,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { PERMISSIONS, type Company } from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { FormInput } from "../../components/form-input";
import { LoadingButton } from "../../components/loading-button";
import {
  companySchema,
  nullifyEmpty,
  type CompanyFormInput,
} from "./organization-schemas";

const FIELDS: { name: keyof CompanyFormInput; label: string; full?: boolean }[] = [
  { name: "name", label: "Company name", full: true },
  { name: "code", label: "Company code" },
  { name: "registrationNumber", label: "Registration number" },
  { name: "email", label: "Email" },
  { name: "phone", label: "Phone" },
  { name: "website", label: "Website" },
  { name: "addressLine", label: "Address", full: true },
  { name: "city", label: "City" },
  { name: "province", label: "Province" },
  { name: "postalCode", label: "Postal code" },
  { name: "country", label: "Country" },
  { name: "timezone", label: "Timezone" },
  { name: "currency", label: "Currency" },
];

export function CompanyPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(PERMISSIONS.COMPANY_UPDATE);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);

  const companyQuery = useQuery({
    queryKey: ["company"],
    queryFn: () => apiRequest<Company>("/company"),
  });

  const { control, handleSubmit, reset, formState } = useForm<CompanyFormInput>({
    resolver: zodResolver(companySchema),
  });

  useEffect(() => {
    if (companyQuery.data && !editing) {
      const company = companyQuery.data;
      reset({
        name: company.name,
        code: company.code,
        registrationNumber: company.registrationNumber ?? "",
        email: company.email,
        phone: company.phone ?? "",
        website: company.website ?? "",
        addressLine: company.addressLine ?? "",
        city: company.city ?? "",
        province: company.province ?? "",
        postalCode: company.postalCode ?? "",
        country: company.country,
        timezone: company.timezone,
        currency: company.currency,
      });
    }
  }, [companyQuery.data, editing, reset]);

  const mutation = useMutation({
    mutationFn: (values: CompanyFormInput) =>
      apiRequest<Company>("/company", {
        method: "PATCH",
        body: nullifyEmpty(values as Record<string, unknown>),
      }),
    onSuccess: () => {
      toast.success("Company profile saved");
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["company"] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiRequestError ? error.message : "Could not save the profile");
    },
  });

  if (companyQuery.isPending) {
    return (
      <Stack direction="row" spacing={12} align="center">
        <Spinner />
        <Typography variant="bodySmall" color="neutral">
          Loading company profile…
        </Typography>
      </Stack>
    );
  }

  if (companyQuery.isError) {
    return (
      <Alert tone="error" title="Could not load the company profile">
        {companyQuery.error instanceof ApiRequestError
          ? companyQuery.error.message
          : "Unexpected error"}
      </Alert>
    );
  }

  const company = companyQuery.data;

  return (
    <Stack spacing={20}>
      <Stack direction="row" justify="between" align="center" wrap spacing={12}>
        <Stack spacing={4}>
          <Typography variant="h4" as="h1">
            Company profile
          </Typography>
          <Typography variant="bodySmall" color="neutral">
            Organization settings / Company profile
          </Typography>
        </Stack>
        <Stack direction="row" spacing={8}>
          {editing ? (
            <>
              <Button variant="outlined" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <LoadingButton
                type="submit"
                form="company-form"
                loading={mutation.isPending || formState.isSubmitting}
              >
                Save changes
              </LoadingButton>
            </>
          ) : canEdit ? (
            <Button onClick={() => setEditing(true)}>Edit profile</Button>
          ) : null}
        </Stack>
      </Stack>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card variant="elevated" padding="none">
          <div className="h-28 rounded-t-xl bg-[var(--nemo-primary-500)]" />
          <CardBody>
            <Stack spacing={16} align="center">
              <div className="-mt-16 flex h-20 w-20 items-center justify-center rounded-full border-4 border-[var(--nemo-neutral-0)] bg-[var(--nemo-neutral-0)] text-2xl font-semibold text-[var(--nemo-primary-600)] shadow">
                {company.name.slice(0, 1).toUpperCase()}
              </div>
              <Stack spacing={4} align="center">
                <Typography variant="h5" as="h2">
                  {company.name}
                </Typography>
                <Badge variant="outlined" color="primary">
                  {company.code}
                </Badge>
              </Stack>
              <Divider />
              <Stack spacing={10} className="w-full">
                <Row label="Email" value={company.email} />
                <Row label="Phone" value={company.phone} />
                <Row label="Website" value={company.website} />
                <Row
                  label="Address"
                  value={[company.addressLine, company.city, company.province, company.country]
                    .filter(Boolean)
                    .join(", ")}
                />
                <Row label="Currency" value={company.currency} />
                <Row label="Timezone" value={company.timezone} />
              </Stack>
            </Stack>
          </CardBody>
        </Card>

        <Card variant="elevated" padding="lg" className="xl:col-span-2">
          <CardBody>
            <form id="company-form" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
              <Stack spacing={16}>
                <div>
                  <Typography variant="h6" as="h2">
                    Basic information
                  </Typography>
                  <Typography variant="caption" color="neutral">
                    Registered details used on documents and payslips.
                  </Typography>
                </div>
                {mutation.isError ? (
                  <Alert tone="error" title="Could not save the profile">
                    {mutation.error instanceof ApiRequestError
                      ? mutation.error.message
                      : "Unexpected error"}
                  </Alert>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                  {FIELDS.map((field) => (
                    <div key={field.name} className={field.full ? "md:col-span-2" : undefined}>
                      <FormInput
                        control={control}
                        name={field.name}
                        label={field.label}
                        readOnly={!editing}
                        disabled={!editing}
                        fullWidth
                      />
                    </div>
                  ))}
                </div>
              </Stack>
            </form>
          </CardBody>
        </Card>
      </div>
    </Stack>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <Typography variant="caption" color="neutral">
        {label}
      </Typography>
      <Typography variant="bodySmall" className="text-right">
        {value || "—"}
      </Typography>
    </div>
  );
}
