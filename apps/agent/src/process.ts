import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadEnvFile } from "node:process";

import { MandateChainService } from "@mandate/chain";
import { createPublicClient, defineChain, http } from "viem";

import { parseAgentConfiguration } from "./config.js";
import { AgentRejection, type ExecutionIntent } from "./policy.js";
import { prepareManualExecution, runAutomatedExecution } from "./runtime.js";
import { createDedicatedKeystoreSigner } from "./signer.js";

try {
  loadEnvFile("../../.env");
} catch {
  // Deployed environments inject variables directly.
}

const configuration = parseAgentConfiguration(process.env);
const intentPath = process.argv[2];
if (!intentPath) throw new Error("execution intent path is required");
const intent = JSON.parse(await readFile(intentPath, "utf8")) as ExecutionIntent;
const chainDefinition = defineChain({
  id: configuration.runtime.chainId,
  name: `Mandate chain ${configuration.runtime.chainId}`,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [configuration.runtime.rpcUrl] } },
});
const client = createPublicClient({
  chain: chainDefinition,
  transport: http(configuration.runtime.rpcUrl),
});
const authority = new MandateChainService([
  {
    chainId: configuration.runtime.chainId.toString(),
    client,
    mandateApp: configuration.runtime.mandateApp,
  },
]);

try {
  if (process.env["AGENT_CUSTODY_MODE"] === "manual") {
    const manual = await prepareManualExecution(intent, {
      policy: configuration.policy,
      authority,
    });
    console.log(
      JSON.stringify({
        mode: manual.mode,
        request: { ...manual.request, value: manual.request.value.toString() },
      }),
    );
  } else {
    const signer = await createDedicatedKeystoreSigner({
      keystorePath: configuration.keystore.path,
      keystorePassword: configuration.keystore.password,
      expectedSigner: configuration.policy.signer,
      chainId: configuration.runtime.chainId,
      rpcUrl: configuration.runtime.rpcUrl,
    });
    const result = await runAutomatedExecution(intent, {
      policy: configuration.policy,
      authority,
      signer,
    });
    console.log(
      JSON.stringify({
        mode: result.mode,
        txHash: result.txHash,
        executionStatus: result.execution.status,
        auditResult: result.audit.result,
      }),
    );
  }
} catch (error) {
  if (error instanceof AgentRejection) {
    console.error(JSON.stringify({ status: "REJECTED", reason: error.reason }));
  } else {
    const detail = error instanceof Error ? `${error.name}:${error.message}` : String(error);
    console.error(
      JSON.stringify({
        status: "UNKNOWN",
        errorHash: createHash("sha256").update(detail).digest("hex"),
      }),
    );
  }
  process.exitCode = 1;
}
