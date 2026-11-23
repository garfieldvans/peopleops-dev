import { Alert, Button, Card, CardBody, Stack, Typography } from "@nemo-ui/ui";
import { useNavigate } from "react-router-dom";

export function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto w-full max-w-xl">
      <Card variant="elevated" padding="lg">
        <CardBody>
          <Stack spacing={16}>
            <Typography variant="h4" as="h1">
              Access denied
            </Typography>
            <Alert tone="warning" title="You do not have permission to view this page">
              Ask an administrator to grant the matching role or permission to your account.
            </Alert>
            <Stack direction="row" spacing={8}>
              <Button onClick={() => navigate("/")}>Back to overview</Button>
              <Button variant="outlined" onClick={() => navigate(-1)}>
                Go back
              </Button>
            </Stack>
          </Stack>
        </CardBody>
      </Card>
    </div>
  );
}
