import { describe, expect, it } from "vitest";

import { parseWorkerConfiguration } from "../src/config.js";

describe("parseWorkerConfiguration", () => {
  it("parses explicit bounded polling settings", () => {
    expect(
      parseWorkerConfiguration({
        WORKER_BATCH_SIZE: "25",
        WORKER_CONFIRMATION_DEPTH: "4",
        WORKER_POLL_INTERVAL_MS: "15000",
      }),
    ).toEqual({ batchSize: 25, confirmationDepth: 4, pollIntervalMs: 15_000 });
  });

  it("uses conservative defaults", () => {
    expect(parseWorkerConfiguration({})).toEqual({
      batchSize: 25,
      confirmationDepth: 4,
      pollIntervalMs: 15_000,
    });
  });

  it.each([
    ["WORKER_BATCH_SIZE", "0"],
    ["WORKER_BATCH_SIZE", "1001"],
    ["WORKER_CONFIRMATION_DEPTH", "-1"],
    ["WORKER_CONFIRMATION_DEPTH", "1025"],
    ["WORKER_POLL_INTERVAL_MS", "99"],
    ["WORKER_POLL_INTERVAL_MS", "3600001"],
    ["WORKER_POLL_INTERVAL_MS", "1.5"],
  ])("rejects out-of-range %s=%s", (name, value) => {
    expect(() => parseWorkerConfiguration({ [name]: value })).toThrow(name);
  });
});
