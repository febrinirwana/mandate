import { describe, expect, it } from "vitest";

import { requireDatabaseUrl } from "../src/index.js";

describe("requireDatabaseUrl", () => {
  it("accepts configured TLS PostgreSQL URLs and rejects placeholders", () => {
    expect(
      requireDatabaseUrl(
        "postgresql://postgres.project:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require",
      ),
    ).toContain("pooler.supabase.com:6543");
    expect(() => requireDatabaseUrl(undefined)).toThrow("DATABASE_URL is not configured");
    expect(() => requireDatabaseUrl("postgresql://postgres:replace_me@localhost/postgres")).toThrow(
      "DATABASE_URL is not configured",
    );
  });
});
