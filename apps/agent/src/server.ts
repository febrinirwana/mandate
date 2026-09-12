import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { pathToFileURL } from "node:url";

import { MandateChainService } from "@mandate/chain";
import {
  DemoExecutionRequestV1Schema,
  DemoExecutionResultV1Schema,
  type DemoExecutionResultV1,
} from "@mandate/domain";
import { createPublicClient, defineChain, http } from "viem";

import { parseDemoAgentConfiguration } from "./config.js";
import { createDemoExecutionService } from "./demo.js";
import { runAutomatedExecution } from "./runtime.js";
import { createDedicatedKeystoreSignerFactory } from "./signer.js";

const MAX_BODY_BYTES = 64 * 1024;

export const DEFAULT_AGENT_PORT = 3002;

export interface DemoExecutionService {
  execute(rawInput: unknown): Promise<DemoExecutionResultV1>;
}

export interface DemoExecutionServerOptions {
  demoEnabled: boolean;
  authToken?: string;
  service: DemoExecutionService;
  logger?: (entry: unknown) => void;
}

function unknownResult(scope: string): Extract<DemoExecutionResultV1, { status: "UNKNOWN" }> {
  return {
    status: "UNKNOWN",
    errorId: `0x${createHash("sha256").update(scope).digest("hex")}`,
  };
}

function send(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const contentLength = Number(request.headers["content-length"] ?? "0");
  if (!Number.isSafeInteger(contentLength) || contentLength > MAX_BODY_BYTES) {
    throw new RangeError("request body exceeds the safe limit");
  }

  let size = 0;
  const chunks: Uint8Array[] = [];
  for await (const chunk of request as AsyncIterable<unknown>) {
    const bytes =
      typeof chunk === "string"
        ? Buffer.from(chunk)
        : chunk instanceof Uint8Array
          ? chunk
          : undefined;
    if (!bytes) throw new TypeError("request body chunk is invalid");
    size += bytes.length;
    if (size > MAX_BODY_BYTES) throw new RangeError("request body exceeds the safe limit");
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function isAuthorized(request: IncomingMessage, authToken: string | undefined): boolean {
  if (!authToken) return true;
  const provided = request.headers.authorization ?? "";
  const expected = `Bearer ${authToken}`;
  return timingSafeEqual(
    createHash("sha256").update(provided).digest(),
    createHash("sha256").update(expected).digest(),
  );
}

async function handleDemoExecutionRequest(
  options: DemoExecutionServerOptions,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (request.method === "GET" && request.url === "/health") {
    send(response, 200, { status: "ok" });
    return;
  }
  if (request.method !== "POST" || request.url !== "/v1/demo-executions") {
    send(response, 404, unknownResult("route unavailable"));
    return;
  }
  if (!isAuthorized(request, options.authToken)) {
    send(response, 401, unknownResult("authorization required"));
    return;
  }
  if (!options.demoEnabled) {
    send(response, 503, unknownResult("demo mode disabled"));
    return;
  }
  if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
    send(response, 400, { status: "REJECTED", reason: "INVALID_STRATEGY" });
    return;
  }

  let rawInput: unknown;
  try {
    rawInput = await readJson(request);
  } catch {
    send(response, 400, { status: "REJECTED", reason: "INVALID_STRATEGY" });
    return;
  }
  if (!DemoExecutionRequestV1Schema.safeParse(rawInput).success) {
    send(response, 400, { status: "REJECTED", reason: "INVALID_STRATEGY" });
    return;
  }

  try {
    const result = DemoExecutionResultV1Schema.parse(await options.service.execute(rawInput));
    send(response, 200, result);
  } catch {
    const result = unknownResult("demo execution dependency failure");
    options.logger?.({ event: "demo-execution-failed", errorId: result.errorId });
    send(response, 500, result);
  }
}

export function createDemoExecutionServer(options: DemoExecutionServerOptions): Server {
  return createServer((request, response) => {
    void handleDemoExecutionRequest(options, request, response);
  });
}

export function listenDemoExecutionServer(
  options: DemoExecutionServerOptions,
  port = DEFAULT_AGENT_PORT,
  host = "127.0.0.1",
): Server {
  const server = createDemoExecutionServer(options);
  server.listen(port, host);
  return server;
}

async function startStandaloneServer(): Promise<void> {
  try {
    loadEnvFile("../../.env");
  } catch {
    // Deployed environments inject variables directly.
  }
  try {
    const configuration = parseDemoAgentConfiguration(process.env);
    const chain = defineChain({
      id: configuration.runtime.chainId,
      name: `Mandate chain ${configuration.runtime.chainId}`,
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [configuration.runtime.rpcUrl] } },
    });
    const client = createPublicClient({ chain, transport: http(configuration.runtime.rpcUrl) });
    const authority = new MandateChainService([
      {
        chainId: configuration.runtime.chainId.toString(),
        client,
        mandateApp: configuration.runtime.mandateApp,
        deploymentBlock: configuration.runtime.deploymentBlock,
      },
    ]);
    const signerFactory = await createDedicatedKeystoreSignerFactory({
      keystorePath: configuration.keystore.path,
      keystorePassword: configuration.keystore.password,
      expectedSigner: configuration.profile.agent.address,
      chainId: configuration.runtime.chainId,
      rpcUrl: configuration.runtime.rpcUrl,
    });
    const service = createDemoExecutionService({
      profile: configuration.profile,
      runtime: {
        chainId: configuration.runtime.chainId.toString(),
        mandateApp: configuration.runtime.mandateApp,
        routeRecipient: configuration.runtime.routeRecipient,
        maximumDemoInput: configuration.maximumDemoInput,
      },
      authority,
      runAutomatedExecution: (intent, security) =>
        runAutomatedExecution(intent, { ...security, signer: signerFactory.create(security) }),
      logger: (entry) => console.error(JSON.stringify(entry)),
    });
    const server = listenDemoExecutionServer(
      {
        ...(configuration.authToken ? { authToken: configuration.authToken } : {}),
        demoEnabled: true,
        service,
      },
      configuration.port,
      configuration.host,
    );
    server.once("error", () => {
      console.error(JSON.stringify(unknownResult("demo server startup failure")));
      process.exitCode = 1;
    });
    console.log(JSON.stringify({ status: "READY", port: configuration.port }));
  } catch {
    console.error(JSON.stringify(unknownResult("demo server startup failure")));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void startStandaloneServer();
}
