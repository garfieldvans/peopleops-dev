import { config } from "dotenv";

/**
 * Loads the workspace .env. When an app is started from apps/api, the root file
 * is two levels up; a local apps/api/.env wins if present.
 */
export function loadDotenv(): void {
  config({ path: ["../../.env", ".env"], quiet: true });
}
