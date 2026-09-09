import { decodeFunctionResult, encodeFunctionData, keccak256, parseAbi, stringToHex } from "viem";

import type { Address } from "@mandate/domain";

import type { PolicyProfileV1 } from "@/lib/policy";

export type PolicyReadiness =
  | { kind: "READY"; aqua: Address; maxMandateDuration: string }
  | { kind: "BLOCKED"; reason: string }
  | { kind: "UNAVAILABLE" };

type ReadinessInput = {
  mandateApp: Address;
  profile: PolicyProfileV1;
  rpcUrl: string | undefined;
  now?: number;
  fetcher?: typeof fetch;
};

const mandateAbi = parseAbi([
  "function AQUA() view returns (address)",
  "function MAX_MANDATE_DURATION() view returns (uint64)",
]);
const registryAbi = parseAbi([
  "function getState(uint256) view returns ((uint8 status,uint64 expiry,address latestOwner,uint256 tokenId,uint256 resource))",
  "function getResolver(string) view returns (address)",
  "function ownerOf(uint256) view returns (address)",
]);
const resolverAbi = parseAbi(["function addr(bytes32) view returns (address)"]);

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function addressEquals(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function hasCode(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-f]+$/i.test(value) && value !== "0x";
}

async function rpc(
  fetcher: typeof fetch,
  url: string,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const response = await fetcher(
    new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }),
  );
  const body = record(await response.json());
  if (!response.ok || !body || body.error !== undefined || body.result === undefined)
    throw new Error("RPC unavailable");
  return body.result;
}

async function call(
  fetcher: typeof fetch,
  url: string,
  to: Address,
  data: `0x${string}`,
): Promise<`0x${string}`> {
  const result = await rpc(fetcher, url, "eth_call", [{ to, data }, "latest"]);
  if (typeof result !== "string" || !/^0x[0-9a-f]*$/i.test(result))
    throw new Error("RPC returned invalid calldata");
  return result as `0x${string}`;
}
export async function checkPolicyReadiness({
  mandateApp,
  profile,
  rpcUrl,
  now = Math.floor(Date.now() / 1000),
  fetcher = fetch,
}: ReadinessInput): Promise<PolicyReadiness> {
  if (!rpcUrl) return { kind: "UNAVAILABLE" };

  try {
    const targets = [
      mandateApp,
      profile.tokenIn.address,
      profile.tokenOut.address,
      profile.route.target,
      profile.ens.registry,
      profile.ens.resolver,
    ] as const;
    const code = await Promise.all(
      targets.map((address) => rpc(fetcher, rpcUrl, "eth_getCode", [address, "latest"])),
    );
    if (code.some((value) => !hasCode(value)))
      return { kind: "BLOCKED", reason: "A configured authority contract has no live code." };

    const aquaData = encodeFunctionData({ abi: mandateAbi, functionName: "AQUA" });
    const aqua = decodeFunctionResult({
      abi: mandateAbi,
      functionName: "AQUA",
      data: await call(fetcher, rpcUrl, mandateApp, aquaData),
    });
    if (!hasCode(await rpc(fetcher, rpcUrl, "eth_getCode", [aqua, "latest"])))
      return { kind: "BLOCKED", reason: "The Mandate app is not bound to a live Aqua deployment." };
    const maxDurationData = encodeFunctionData({
      abi: mandateAbi,
      functionName: "MAX_MANDATE_DURATION",
    });
    const maxMandateDuration = decodeFunctionResult({
      abi: mandateAbi,
      functionName: "MAX_MANDATE_DURATION",
      data: await call(fetcher, rpcUrl, mandateApp, maxDurationData),
    });
    if (maxMandateDuration === 0n)
      return { kind: "BLOCKED", reason: "The Mandate app has no usable duration limit." };

    const labelId = BigInt(keccak256(stringToHex(profile.ens.label)));
    const stateData = encodeFunctionData({
      abi: registryAbi,
      functionName: "getState",
      args: [labelId],
    });
    const state = decodeFunctionResult({
      abi: registryAbi,
      functionName: "getState",
      data: await call(fetcher, rpcUrl, profile.ens.registry, stateData),
    });
    if (state.status !== 2)
      return { kind: "BLOCKED", reason: "The configured agent identity is not registered." };
    if (Number(state.expiry) <= now)
      return { kind: "BLOCKED", reason: "The configured agent identity has expired." };

    const resolverData = encodeFunctionData({
      abi: registryAbi,
      functionName: "getResolver",
      args: [profile.ens.label],
    });
    const resolver = decodeFunctionResult({
      abi: registryAbi,
      functionName: "getResolver",
      data: await call(fetcher, rpcUrl, profile.ens.registry, resolverData),
    });
    if (!addressEquals(resolver, profile.ens.resolver))
      return {
        kind: "BLOCKED",
        reason: "The configured agent identity uses a different resolver.",
      };

    const ownerData = encodeFunctionData({
      abi: registryAbi,
      functionName: "ownerOf",
      args: [state.tokenId],
    });
    const owner = decodeFunctionResult({
      abi: registryAbi,
      functionName: "ownerOf",
      data: await call(fetcher, rpcUrl, profile.ens.registry, ownerData),
    });
    if (!addressEquals(owner, profile.agent.address))
      return { kind: "BLOCKED", reason: "The configured agent no longer owns its identity." };

    const agentData = encodeFunctionData({
      abi: resolverAbi,
      functionName: "addr",
      args: [profile.ens.node],
    });
    const agent = decodeFunctionResult({
      abi: resolverAbi,
      functionName: "addr",
      data: await call(fetcher, rpcUrl, profile.ens.resolver, agentData),
    });
    if (!addressEquals(agent, profile.agent.address))
      return {
        kind: "BLOCKED",
        reason: "The configured identity no longer resolves to its agent.",
      };

    return {
      kind: "READY",
      aqua: aqua.toLowerCase() as Address,
      maxMandateDuration: maxMandateDuration.toString(),
    };
  } catch {
    return { kind: "UNAVAILABLE" };
  }
}
