import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  FileUpload,
  Input,
  Modal,
  Select,
  Spinner,
  Stack,
  Table,
  Typography,
  useToast,
} from "@nemo-ui/ui";
import { useState } from "react";
import { PERMISSIONS, type EmployeeDocument } from "@peopleops/shared-types";
import { useAuth } from "../auth/auth-context";
import { apiRequest, apiUpload, downloadFile, ApiRequestError } from "../../lib/http";
import { LoadingButton } from "../../components/loading-button";

const CATEGORY_OPTIONS = [
  { label: "Employment contract", value: "CONTRACT" },
  { label: "Identity document", value: "IDENTITY" },
  { label: "Certificate", value: "CERTIFICATE" },
  { label: "Other", value: "OTHER" },
];

const MAX_BYTES = 5 * 1024 * 1024;

export function DocumentsTab({ employeeId }: { employeeId: string }) {
  const { hasPermission } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [files, setFiles] = useState<File[]>([]);
  const toast = useToast();
  const queryClient = useQueryClient();

  const canManage = hasPermission(PERMISSIONS.EMPLOYEE_MANAGE_DOCUMENTS);

  const documentsQuery = useQuery({
    queryKey: ["employees", employeeId, "documents"],
    queryFn: () => apiRequest<EmployeeDocument[]>(`/employees/${employeeId}/documents`),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const file = files[0];
      if (!file) throw new ApiRequestError("Choose a file first", 400, "FILE_REQUIRED");
      const form = new FormData();
      form.append("title", title);
      form.append("category", category);
      form.append("file", file);
      return apiUpload<EmployeeDocument>(`/employees/${employeeId}/documents`, form);
    },
    onSuccess: () => {
      toast.success("Document uploaded");
      void queryClient.invalidateQueries({ queryKey: ["employees", employeeId, "documents"] });
      void queryClient.invalidateQueries({ queryKey: ["employees", "detail", employeeId] });
      setOpen(false);
      setTitle("");
      setCategory("OTHER");
      setFiles([]);
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not upload document"),
  });

  const deleteMutation = useMutation({
    mutationFn: (document: EmployeeDocument) =>
      apiRequest<void>(`/employees/${employeeId}/documents/${document.id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Document deleted");
      void queryClient.invalidateQueries({ queryKey: ["employees", employeeId, "documents"] });
      void queryClient.invalidateQueries({ queryKey: ["employees", "detail", employeeId] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : "Could not delete document"),
  });

  return (
    <Stack spacing={16}>
      <Stack direction="row" justify="between" align="center" wrap spacing={8}>
        <Stack spacing={2}>
          <Typography variant="h6">Documents</Typography>
          <Typography variant="caption" color="neutral">
            Files are stored privately and download through an authorized request.
          </Typography>
        </Stack>
        {canManage ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            Upload document
          </Button>
        ) : null}
      </Stack>

      {documentsQuery.isPending ? (
        <Stack direction="row" spacing={12} align="center">
          <Spinner />
          <Typography variant="bodySmall" color="neutral">
            Loading documents…
          </Typography>
        </Stack>
      ) : documentsQuery.isError ? (
        <Alert tone="error" title="Could not load documents">
          {documentsQuery.error instanceof ApiRequestError
            ? documentsQuery.error.message
            : "Unexpected error"}
        </Alert>
      ) : (
        <Table
          columns={[
            {
              key: "title",
              header: "Document",
              render: (document) => (
                <Stack spacing={2}>
                  <Typography variant="bodySmall" className="font-medium">
                    {document.title}
                  </Typography>
                  <Typography variant="caption" color="neutral">
                    {document.fileName}
                  </Typography>
                </Stack>
              ),
            },
            {
              key: "category",
              header: "Category",
              render: (document) => (
                <Badge variant="outlined" color="neutral">
                  {document.category.toLowerCase()}
                </Badge>
              ),
            },
            {
              key: "size",
              header: "Size",
              render: (document) => `${Math.max(1, Math.round(document.sizeBytes / 1024))} KB`,
            },
            {
              key: "uploaded",
              header: "Uploaded",
              render: (document) =>
                `${document.createdAt.slice(0, 10)}${
                  document.uploadedBy ? ` · ${document.uploadedBy.name}` : ""
                }`,
            },
            {
              key: "actions",
              header: "",
              align: "right",
              render: (document) => (
                <Stack direction="row" spacing={4} justify="end">
                  <Button
                    variant="text"
                    size="sm"
                    onClick={() =>
                      void downloadFile(
                        `/employees/${employeeId}/documents/${document.id}/download`,
                        document.fileName,
                      ).catch(() => toast.error("Could not download this document"))
                    }
                  >
                    Download
                  </Button>
                  {canManage ? (
                    <LoadingButton
                      variant="text"
                      size="sm"
                      color="error"
                      loading={
                        deleteMutation.isPending &&
                        deleteMutation.variables?.id === document.id
                      }
                      onClick={() => deleteMutation.mutate(document)}
                    >
                      Delete
                    </LoadingButton>
                  ) : null}
                </Stack>
              ),
            },
          ]}
          data={documentsQuery.data}
          rowKey={(document) => document.id}
          emptyText="No documents uploaded."
        />
      )}

      <Modal
        open={open}
        onOpenChange={(next) => !next && setOpen(false)}
        title="Upload document"
        description="Accepted: PDF, JPEG, PNG, WebP or Word documents up to 5 MB."
        size="md"
        footer={
          <>
            <Button variant="outlined" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <LoadingButton
              loading={uploadMutation.isPending}
              disabled={!files[0] || title.trim().length === 0}
              onClick={() => uploadMutation.mutate()}
            >
              Upload
            </LoadingButton>
          </>
        }
      >
        <Stack spacing={16}>
          <Input
            label="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            fullWidth
            required
          />
          <Select
            label="Category"
            value={category}
            onChange={(value) => setCategory(value || "OTHER")}
            options={CATEGORY_OPTIONS}
            fullWidth
          />
          <FileUpload
            label="File"
            multiple={false}
            maxFiles={1}
            maxSize={MAX_BYTES}
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
            value={files}
            onChange={(next) => setFiles(next.slice(0, 1))}
            fullWidth
          />
        </Stack>
      </Modal>
    </Stack>
  );
}
