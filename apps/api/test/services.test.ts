import { describe, expect, it } from "vitest";

import { runtimeConfiguration } from "../src/services.js";

const address = `0x${"1".repeat(40)}`;

describe("runtimeConfiguration", () => {
  it("selects an explicit local Anvil profile without replacing Sepolia defaults", () => {
    const local = runtimeConfiguration({
      MANDATE_LOCAL_RPC_URL: "http://127.0.0.1:8545",
      MANDATE_LOCAL_APP: address,
      MANDATE_LOCAL_CHAIN_ID: "31337",
      MANDATE_LOCAL_DEPLOYMENT_BLOCK: "0",
    });

    expect(local).toMatchObject({
      local: true,
      chainId: "31337",
      mandateApp: address,
      deploymentBlock: "0",
    });
  });

  it("requires an explicit Sepolia deployment block", () => {
    expect(() =>
      runtimeConfiguration({
        SEPOLIA_RPC_URL: "https://ethereum-sepolia-rpc.publicnode.com",
        SEPOLIA_MANDATE_APP: address,
      }),
    ).toThrow("SEPOLIA_MANDATE_DEPLOYMENT_BLOCK is not configured");
  });
});
