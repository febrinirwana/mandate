import type { StrategyV1 } from "@mandate/domain";

import { expect, it } from "vitest";

import { buildExecutionCall } from "../src/mandate.js";

it("preserves the browser-issued strategy hash when building a dedicated-agent execution", () => {
  const strategy: StrategyV1 = {
    version: 1 as const,
    maker: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    agent: "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
    ensRegistry: "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0",
    ensResolver: "0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9",
    ensLabel: "mandate-agent",
    ensNode: "0xc498c1b2d999c5e0ccd355baab1ba96394922f2aea9823167bea91fcbcda313f",
    tokenIn: "0xdc64a140aa3e981100a9beca4e685f962f0cf6c9",
    tokenOut: "0x5fc8d32690cc91d4c39d9d3abcbd16989f875707",
    swapTarget: "0x0165878a594ca255338adfa4d48449f69242eb8f",
    swapSelector: "0x6d9a640a",
    minRateNumerator: "1",
    minRateDenominator: "1",
    maxInputPerCall: "100000000000000000000",
    maxInputTotal: "100000000000000000000",
    validAfter: "1788935395",
    validUntil: "1789016400",
    salt: "0x2004a05ff16857de5189a71b2a28950ba4ef16b0392095a903cde4e96c4ea3cd",
  };
  expect(
    buildExecutionCall({
      strategy,
      amountIn: "10000000000000000000",
      agentMinOut: "10000000000000000000",
      executionDeadline: "2000000000",
      routeData: "0x6d9a640a",
    }).strategyHash,
  ).toBe("0x0702054547a1854ad0f83c086afaf1f75082e06d17ceaf7826be62ad16162402");
});
