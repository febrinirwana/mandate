import { describe, expect, it } from "vitest";
import { encodeFunctionData, encodeFunctionResult, parseAbi } from "viem";

import type { PolicyProfileV1 } from "../src/lib/policy";
import { checkPolicyReadiness } from "../src/lib/policy-readiness";

const address = (digit: string): `0x${string}` => `0x${digit.repeat(40)}`;
const hash = (digit: string): `0x${string}` => `0x${digit.repeat(64)}`;

const profile: PolicyProfileV1 = {
  agent: { name: "Nova", address: address("2") },
  ens: { registry: address("3"), resolver: address("4"), label: "nova", node: hash("5") },
  tokenIn: { symbol: "USDC", address: address("6"), decimals: 6 },
  tokenOut: { symbol: "DAI", address: address("7"), decimals: 18 },
  route: { target: address("8"), selector: "0x12345678" },
};

const aquaAbi = parseAbi(["function AQUA() view returns (address)"]);
const registryAbi = parseAbi([
  "function getState(uint256) view returns ((uint8 status,uint64 expiry,address latestOwner,uint256 tokenId,uint256 resource))",
  "function getResolver(string) view returns (address)",
  "function ownerOf(uint256) view returns (address)",
]);
const resolverAbi = parseAbi(["function addr(bytes32) view returns (address)"]);

function rpcResult(result: `0x${string}`) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }));
}

function requestBody(input: string | URL | Request): Promise<{ method: string; params: unknown[] }> {
  if (input instanceof Request) return input.json() as Promise<{ method: string; params: unknown[] }>;
  return Promise.resolve(JSON.parse(input.toString()) as { method: string; params: unknown[] });
}

function readyRpc() {
  const selectors = {
    state: encodeFunctionData({ abi: registryAbi, functionName: "getState", args: [0n] }).slice(0, 10),
    resolver: encodeFunctionData({ abi: registryAbi, functionName: "getResolver", args: [profile.ens.label] }).slice(0, 10),
    owner: encodeFunctionData({ abi: registryAbi, functionName: "ownerOf", args: [1n] }).slice(0, 10),
  };
  return async (input: string | URL | Request) => {
    const request = await requestBody(input);
    if (request.method === "eth_getCode") return rpcResult("0x01");
    const call = request.params[0] as { to: string; data: `0x${string}` };
    if (call.to.toLowerCase() === address("1")) return rpcResult(encodeFunctionResult({ abi: aquaAbi, functionName: "AQUA", result: address("a") }));
    if (call.data.startsWith(selectors.state)) return rpcResult(encodeFunctionResult({ abi: registryAbi, functionName: "getState", result: { status: 2, expiry: 2_000_000_000n, latestOwner: address("0"), tokenId: 1n, resource: 0n } }));
    if (call.data.startsWith(selectors.resolver)) return rpcResult(encodeFunctionResult({ abi: registryAbi, functionName: "getResolver", result: profile.ens.resolver }));
    if (call.data.startsWith(selectors.owner)) return rpcResult(encodeFunctionResult({ abi: registryAbi, functionName: "ownerOf", result: profile.agent.address }));
    return rpcResult(encodeFunctionResult({ abi: resolverAbi, functionName: "addr", result: profile.agent.address }));
  };
}

describe("policy readiness", () => {
  it("allows issuance only when the live app, route, and ENS binding match the trusted profile", async () => {
    await expect(checkPolicyReadiness({ mandateApp: address("1"), profile, rpcUrl: "https://rpc.example", now: 1_800_000_000, fetcher: readyRpc() })).resolves.toEqual({ kind: "READY", aqua: address("a") });
  });

  it("blocks issuance when the trusted identity is no longer registered", async () => {
    const fetcher = readyRpc();
    const stateSelector = encodeFunctionData({ abi: registryAbi, functionName: "getState", args: [0n] }).slice(0, 10);
    const notRegistered = async (input: string | URL | Request) => {
      const forward = input instanceof Request ? input.clone() : input;
      const request = await requestBody(input);
      const call = request.params[0] as { data?: `0x${string}` } | undefined;
      if (request.method === "eth_call" && call?.data?.startsWith(stateSelector)) return rpcResult(encodeFunctionResult({ abi: registryAbi, functionName: "getState", result: { status: 0, expiry: 0n, latestOwner: address("0"), tokenId: 0n, resource: 0n } }));
      return fetcher(forward);
    };

    await expect(checkPolicyReadiness({ mandateApp: address("1"), profile, rpcUrl: "https://rpc.example", now: 1_800_000_000, fetcher: notRegistered })).resolves.toEqual({ kind: "BLOCKED", reason: "The configured agent identity is not registered." });
  });
});
