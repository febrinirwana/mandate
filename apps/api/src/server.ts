import { loadEnvFile } from "node:process";
import { serve } from "@hono/node-server";

import { createApp } from "./app.js";
import { createProductionServices } from "./services.js";

try {
  loadEnvFile("../../.env");
} catch {
  // Deployed environments inject variables directly.
}

const port = Number(process.env["API_PORT"] ?? "3001");
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("API_PORT must be a valid TCP port");
}

const production = createProductionServices();
const server = serve(
  { fetch: createApp(production.services).fetch, port },
  ({ port: boundPort }) => {
    console.log(JSON.stringify({ level: "info", event: "api_listening", port: boundPort }));
  },
);

async function shutdown(): Promise<void> {
  server.close();
  await production.close();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
