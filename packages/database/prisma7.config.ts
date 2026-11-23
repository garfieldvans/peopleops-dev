import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// The workspace keeps a single .env at the repository root. Loading it here also
// lets the CLI be run directly from packages/database during development.
config({ path: ["../../.env", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
