import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

/**
 * Workspace packages are compiled to CommonJS for the Node API. A browser dev
 * server cannot serve CommonJS as native ESM (named exports go missing), so the
 * web app points at the TypeScript sources instead of `dist`.
 */
const workspaceSource = (relativePath: string) =>
  fileURLToPath(new URL(relativePath, import.meta.url));

export default defineConfig(({ mode }) => {
  // Read the workspace .env so one file configures API and web together.
  const env = loadEnv(mode, path.resolve(process.cwd(), "../.."), "");
  const apiTarget = env.VITE_DEV_API_TARGET ?? "http://localhost:3001";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@peopleops/shared-types": workspaceSource("../../packages/shared-types/src/index.ts"),
        "@peopleops/validators": workspaceSource("../../packages/validators/src/index.ts"),
      },
    },
    // Workspace packages are rebuilt during development; never serve a cached prebundle.
    optimizeDeps: {
      exclude: ["@peopleops/shared-types", "@peopleops/validators"],
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
