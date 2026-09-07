import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

export function requireDatabaseUrl(value: string | undefined): string {
  if (!value || value.includes("replace_me") || value.includes("[YOUR-PASSWORD]")) {
    throw new Error("DATABASE_URL is not configured");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a PostgreSQL URL");
  }
  if (!(["postgres:", "postgresql:"] as string[]).includes(url.protocol)) {
    throw new Error("DATABASE_URL must be a PostgreSQL URL");
  }
  if (url.searchParams.get("sslmode") !== "require") {
    throw new Error("DATABASE_URL must require TLS");
  }
  return value;
}

export interface DatabaseConnection {
  db: PostgresJsDatabase<typeof schema>;
  close: () => Promise<void>;
}

export function createDatabase(databaseUrl = process.env["DATABASE_URL"]): DatabaseConnection {
  const client = postgres(requireDatabaseUrl(databaseUrl), {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return {
    db: drizzle(client, { schema }),
    close: () => client.end(),
  };
}

export * from "./evidence.js";
export * from "./schema.js";
