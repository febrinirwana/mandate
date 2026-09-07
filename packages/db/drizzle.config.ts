import { loadEnvFile } from "node:process";
import { defineConfig } from "drizzle-kit";

try {
  loadEnvFile("../../.env");
} catch {
  // CI supplies DATABASE_MIGRATION_URL directly.
}

const url = process.env["DATABASE_MIGRATION_URL"];
if (!url || url.includes("replace_me") || url.includes("[YOUR-PASSWORD]")) {
  throw new Error("DATABASE_MIGRATION_URL is not configured");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
