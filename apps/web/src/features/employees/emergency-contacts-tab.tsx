import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
  Modal,
  Spinner,
  Stack,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { EmergencyContact } from "@peopleops/shared-types";
import { apiRequest, ApiRequestError } from "../../lib/http";
import { FormInput } from "../../components/form-input";
import { LoadingButton } from "../../components/loading-button";
import {
  emergencyContactSchema,
  type EmergencyContactFormInput,
} from "./employee-schemas";

export function EmergencyContactsTab({
  employeeId,
  canManage,
}: {
  employeeId: string;
  canManage: boolean;
}) {
  const [dialog, setDialog] = useState<
    { mode: "create" } | { mode: "edit"; contact: EmergencyContact } | null
  >(null);

  const contactsQuery = useQuery({
    queryKey: ["employees", employeeId, "emergency-contacts"],
    queryFn: () =>
      apiRequest<EmergencyContact[]>(`/employees/${employeeId}/emergency-contacts`),
  });

  return (
    <Stack spacing={16}>
      <Stack direction="row" justify="between" align="center" wrap spacing={8}>
        <Typography variant="h6">Emergency contacts</Typography>
        {canManage ? (
          <Button size="sm" onClick={() => setDialog({ mode: "create" })}>
            Add contact
          </Button>
        ) : null}
      </Stack>
      <Typography variant="bodySmall" color="neutral">
        Only one contact can be marked as primary; choosing a new primary clears the previous one.
      </Typography>

      {contactsQuery.isPending ? (
        <Stack direction="row" spacing={12} align="center">
          <Spinner />
          <Typography variant="bodySmall" color="neutral">
            Loading contacts…
          </Typography>
        </Stack>
      ) : contactsQuery.isError ? (
        <Alert tone="error" title="Could not load emergency contacts">
          {contactsQuery.error instanceof ApiRequestError
            ? contactsQuery.error.message
            : "Unexpected error"}
        </Alert>
      ) : contactsQuery.data.length === 0 ? (
        <Typography variant="bodySmall" color="neutral">
          No emergency contacts recorded.
        </Typography>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {contactsQuery.data.map((contact) => (
            <Card key={contact.id} variant="outlined">
              <CardBody>
                <Stack spacing={6}>
                  <Stack direction="row" justify="between" align="center" spacing={8}>
                    <Typography variant="bodySmall" className="font-medium">
                      {contact.fullName}
                    </Typography>
                    {contact.isPrimary ? (
                      <Badge variant="filled" color="primary">
                        Primary
                      </Badge>
                    ) : null}
                  </Stack>
                  <Typography variant="caption" color="neutral">
                    {contact.relationship}
                  </Typography>
                  <Typography variant="bodySmall">{contact.phone}</Typography>
                  {contact.email ? (
                    <Typography variant="caption" color="neutral">
                      {contact.email}
                    </Typography>
                  ) : null}
                  {contact.address ? (
                    <Typography variant="caption" color="neutral">
                      {contact.address}
                    </Typography>
                  ) : null}
                  {canManage ? (
                    <Stack direction="row" spacing={4}>
                      <Button
                        variant="text"
                        size="sm"
                        onClick={() => setDialog({ mode: "edit", contact })}
                      >
                        Edit
                      </Button>
                      <RemoveContactButton employeeId={employeeId} contact={contact} />
                    </Stack>
                  ) : null}
                </Stack>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <ContactDialog
        employeeId={employeeId}
        dialog={dialog}
        onClose={() => setDialog(null)}
      />
    </Stack>
  );
}

function RemoveContactButton({
  employeeId,
  contact,
}: {
  employeeId: string;
  contact: EmergencyContact;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: () =>
      apiRequest<void>(`/employees/${employeeId}/emergency-contacts/${contact.id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Emergency contact removed");
      void queryClient.invalidateQueries({
        queryKey: ["employees", employeeId, "emergency-contacts"],
      });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not remove contact"),
  });

  return (
    <LoadingButton
      variant="text"
      size="sm"
      color="error"
      loading={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      Remove
    </LoadingButton>
  );
}

function ContactDialog({
  employeeId,
  dialog,
  onClose,
}: {
  employeeId: string;
  dialog: { mode: "create" } | { mode: "edit"; contact: EmergencyContact } | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const open = dialog !== null;
  const editing = dialog?.mode === "edit" ? dialog.contact : null;

  const { control, handleSubmit, reset, formState } = useForm<EmergencyContactFormInput>({
    resolver: zodResolver(emergencyContactSchema),
  });

  useEffect(() => {
    if (!open) return;
    reset(
      editing
        ? {
            fullName: editing.fullName,
            relationship: editing.relationship,
            phone: editing.phone,
            email: editing.email ?? "",
            address: editing.address ?? "",
            isPrimary: editing.isPrimary,
          }
        : {
            fullName: "",
            relationship: "",
            phone: "",
            email: "",
            address: "",
            isPrimary: false,
          },
    );
  }, [open, editing, reset]);

  const mutation = useMutation({
    mutationFn: (values: EmergencyContactFormInput) => {
      const body = {
        ...values,
        email: values.email || null,
        address: values.address || null,
      };
      return editing
        ? apiRequest<EmergencyContact>(
            `/employees/${employeeId}/emergency-contacts/${editing.id}`,
            { method: "PATCH", body },
          )
        : apiRequest<EmergencyContact>(`/employees/${employeeId}/emergency-contacts`, {
            method: "POST",
            body,
          });
    },
    onSuccess: () => {
      toast.success(editing ? "Contact updated" : "Contact added");
      void queryClient.invalidateQueries({
        queryKey: ["employees", employeeId, "emergency-contacts"],
      });
      void queryClient.invalidateQueries({ queryKey: ["employees", "detail", employeeId] });
      onClose();
    },
  });

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={editing ? "Edit emergency contact" : "Add emergency contact"}
      size="md"
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            form="emergency-contact-form"
            loading={mutation.isPending || formState.isSubmitting}
          >
            {editing ? "Save changes" : "Add contact"}
          </LoadingButton>
        </>
      }
    >
      <form
        id="emergency-contact-form"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <Stack spacing={16}>
          {mutation.isError ? (
            <Alert tone="error" title="Could not save the contact">
              {mutation.error instanceof ApiRequestError
                ? mutation.error.message
                : "Unexpected error"}
            </Alert>
          ) : null}
          <FormInput control={control} name="fullName" label="Full name" required fullWidth />
          <FormInput
            control={control}
            name="relationship"
            label="Relationship"
            required
            fullWidth
          />
          <FormInput control={control} name="phone" label="Phone" required fullWidth />
          <FormInput control={control} name="email" label="Email" type="email" fullWidth />
          <FormInput control={control} name="address" label="Address" fullWidth />
          <Controller
            control={control}
            name="isPrimary"
            render={({ field }) => (
              <Checkbox
                label="Primary contact"
                checked={Boolean(field.value)}
                onChange={(event) => field.onChange(event.target.checked)}
                onBlur={field.onBlur}
              />
            )}
          />
        </Stack>
      </form>
    </Modal>
  );
}
