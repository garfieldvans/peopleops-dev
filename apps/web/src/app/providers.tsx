import { ThemeProvider, ToastProvider } from "@nemo-ui/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { queryClient } from "../lib/query-client";
import { useThemeStore } from "../stores/theme-store";
import { brandTheme, brandThemeDark } from "./brand-theme";

export function AppProviders({ children }: { children: ReactNode }) {
  const mode = useThemeStore((state) => state.mode);

  return (
    <ThemeProvider
      mode={mode}
      theme={mode === "dark" ? brandThemeDark : brandTheme}
      surface="var(--nemo-neutral-0)"
      style={{ minHeight: "100vh", fontFamily: "var(--nemo-font-family)" }}
    >
      <ToastProvider placement="top-right">
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
