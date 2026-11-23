import { Button, Spinner } from "@nemo-ui/ui";
import type { ComponentProps, ReactNode } from "react";

type LoadingButtonProps = ComponentProps<typeof Button> & {
  loading?: boolean;
  children: ReactNode;
};

/** Nemo's Button has no loading prop, so the busy state wraps it here. */
export function LoadingButton({ loading = false, disabled, children, ...rest }: LoadingButtonProps) {
  return (
    <Button {...rest} disabled={disabled || loading} aria-busy={loading || undefined}>
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <Spinner size="sm" />
          Please wait…
        </span>
      ) : (
        children
      )}
    </Button>
  );
}
