import { describe, expect, it } from "vitest";
import { keccak256 } from "viem";

import { readEnsIdentity, serializeEnsIdentity, verifyContractCodeAtBlock } from "../src/ens.js";

const registry = "0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2" as const;
const resolver = "0xe7b9a25607e02da8145e4eb1836ca539e53f11f7" as const;
const agent = "0x1111111111111111111111111111111111111111" as const;
const blockNumber = 12_345n;
const blockHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const node = "0xdac922a62f53701c35dce88d9d2ee0b24f15871f4af98f6131b5a966abdc76b5" as const;

function identityClient() {
  const blockRequests: Array<Record<string, unknown>> = [];
  const readRequests: Array<Record<string, unknown>> = [];

  return {
    blockRequests,
    readRequests,
    getChainId() {
      return 11_155_111;
    },
    getBlock(request: Record<string, unknown>) {
      blockRequests.push(request);
      return {
        number: blockNumber,
        hash: blockHash,
        timestamp: 123_000_000n,
      };
    },
    readContract(request: Record<string, unknown>) {
      readRequests.push(request);
      switch (request["functionName"]) {
        case "getState":
          return { status: 2, expiry: 123_456_789n, latestOwner: agent, tokenId: 77n, resource: 99n };
        case "ownerOf":
        case "addr":
          return agent;
        case "getResolver":
          return resolver;
        default:
          throw new Error(`unexpected method ${String(request["functionName"])}`);
      }
    },
  };
}

describe("readEnsIdentity", () => {
  it("reads one current ENSv2 identity at one canonical block", async () => {
    const client = identityClient();

    const identity = await readEnsIdentity(client as never, {
      blockNumber,
      registry,
      label: "agent",
      name: "agent.treasury.eth",
      expectedAgent: agent,
      expectedResolver: resolver,
    });

    expect(identity).toMatchObject({
      chainId: 11_155_111,
      blockNumber,
      blockHash,
      registry: "0xBDC85dD5b15D7ecb354cd7cb6f2c50b4f2c4F0E2",
      label: "agent",
      labelId: 0x314c1dfbbccab41a44cf9fefc21e632eb8e01bc0346d4414114d4c3dd0e9fdf1n,
      node,
      status: "REGISTERED",
      expiry: 123_456_789n,
      tokenId: 77n,
      owner: agent,
      resolver: "0xe7B9A25607E02da8145E4eB1836CA539e53F11f7",
      resolvedAddress: agent,
      validation: {
        domain: true,
        registered: true,
        unexpired: true,
        ownerMatchesAgent: true,
        resolverMatchesExpected: true,
        addressMatchesAgent: true,
        valid: true,
      },
    });
    expect(client.readRequests).toHaveLength(4);
    expect(client.readRequests.every((request) => request["blockNumber"] === blockNumber)).toBe(true);
    expect(client.blockRequests).toEqual([{ blockNumber }, { blockHash }]);
  });

  it("rejects a name whose canonical block no longer resolves to the same header", async () => {
    const client = identityClient();
    client.getBlock = (request: Record<string, unknown>) => {
      client.blockRequests.push(request);
      return request["blockHash"]
        ? { number: blockNumber + 1n, hash: blockHash, timestamp: 123_000_000n }
        : { number: blockNumber, hash: blockHash, timestamp: 123_000_000n };
    };

    await expect(
      readEnsIdentity(client as never, {
        blockNumber,
        registry,
        label: "agent",
        name: "agent.treasury.eth",
        expectedAgent: agent,
        expectedResolver: resolver,
      }),
    ).rejects.toThrow("ENS identity block is not canonical");
  });

  it("rejects labels that cannot be a normalized immediate subname", async () => {
    const client = identityClient();

    await expect(
      readEnsIdentity(client as never, {
        blockNumber,
        registry,
        label: "Agent",
        name: "Agent.treasury.eth",
        expectedAgent: agent,
        expectedResolver: resolver,
      }),
    ).rejects.toThrow("ENS label must be normalized and immediate");

    expect(client.readRequests).toHaveLength(0);
  });

  it("serializes chain quantities as decimal strings", async () => {
    const client = identityClient();
    const identity = await readEnsIdentity(client as never, {
      blockNumber,
      registry,
      label: "agent",
      name: "agent.treasury.eth",
      expectedAgent: agent,
      expectedResolver: resolver,
    });

    expect(serializeEnsIdentity(identity)).toMatchObject({
      blockNumber: "12345",
      labelId: "22297816894975978848074963920248935732632492024043732038897609618724122918385",
      expiry: "123456789",
      tokenId: "77",
    });
  });
});

describe("verifyContractCodeAtBlock", () => {
  it("verifies runtime bytecode and the exact manifest block", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const code = "0x6000" as const;
    const client = {
      getBlock(request: Record<string, unknown>) {
        requests.push(request);
        return { number: blockNumber, hash: blockHash, timestamp: 123_000_000n };
      },
      getCode(request: Record<string, unknown>) {
        requests.push(request);
        return code;
      },
    };

    await verifyContractCodeAtBlock(client as never, {
      address: registry,
      codeHash: keccak256(code),
      verificationBlock: { number: blockNumber, hash: blockHash },
    });

    expect(requests).toEqual([{ blockNumber }, { address: registry, blockNumber }, { blockHash }]);
  });
});
