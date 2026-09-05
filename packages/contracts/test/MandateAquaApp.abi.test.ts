import { describe, expect, it } from "vitest";
import { encodeAbiParameters, keccak256, type AbiParameter } from "viem";

import { mandateAquaAppAbi } from "../src/MandateAquaApp.abi.js";

const strategy = {
  maker: "0x1111111111111111111111111111111111111111",
  agent: "0x2222222222222222222222222222222222222222",
  ensRegistry: "0x3333333333333333333333333333333333333333",
  ensResolver: "0x4444444444444444444444444444444444444444",
  ensLabel: "mandate-agent",
  ensNode: "0xc498c1b2d999c5e0ccd355baab1ba96394922f2aea9823167bea91fcbcda313f",
  tokenIn: "0x5555555555555555555555555555555555555555",
  tokenOut: "0x6666666666666666666666666666666666666666",
  swapTarget: "0x7777777777777777777777777777777777777777",
  swapSelector: "0xe3547335",
  minRateNumerator: 3n,
  minRateDenominator: 2n,
  maxInputPerCall: 100n,
  maxInputTotal: 1000n,
  validAfter: 1000n,
  validUntil: 2000n,
  salt: "0x8888888888888888888888888888888888888888888888888888888888888888",
} as const;

const expectedFieldNames = [
  "maker",
  "agent",
  "ensRegistry",
  "ensResolver",
  "ensLabel",
  "ensNode",
  "tokenIn",
  "tokenOut",
  "swapTarget",
  "swapSelector",
  "minRateNumerator",
  "minRateDenominator",
  "maxInputPerCall",
  "maxInputTotal",
  "validAfter",
  "validUntil",
  "salt",
] as const;

describe("MandateAquaApp generated ABI", () => {
  it("preserves the Strategy tuple layout and the independently published Solidity hash vector", () => {
    const strategyHash = mandateAquaAppAbi.find(
      (item) => item.type === "function" && item.name === "strategyHash",
    );
    if (!strategyHash || strategyHash.type !== "function" || strategyHash.name !== "strategyHash") {
      throw new Error("Generated ABI is missing strategyHash");
    }
    const strategyParameter = strategyHash.inputs[0];
    if (!strategyParameter || strategyParameter.type !== "tuple" || !("components" in strategyParameter)) {
      throw new Error("Generated ABI is missing the Strategy tuple");
    }

    expect(strategyParameter.components.map((component) => component.name)).toEqual(expectedFieldNames);

    const encoded = encodeAbiParameters([strategyParameter as AbiParameter], [strategy]);
    expect(keccak256(encoded)).toBe("0xf71f6723d6a2b1e170a9c884d5fffae336644f75a1f78171ade4caeac2c626b0");
  });
});
