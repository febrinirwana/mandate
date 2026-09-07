import { describe, expect, it } from "vitest";

import {
  admitClassicSwapRoute,
  buildClassicSwapRequest,
  requestClassicSwapRoute,
} from "../src/route.js";

const router = "0x111111125421cA6dc452d289314280a0f8842A65" as const;
const app = "0x2222222222222222222222222222222222222222" as const;
const weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;
const usdc = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
const executor = "0x111116053F09d34a7Eae8102887004445176CA11" as const;
const amount = 100_000_000_000_000_000n;
const calldata =
  "0x07ed2379000000000000000000000000111116053f09d34a7eae8102887004445176ca11000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000111116053f09d34a7eae8102887004445176ca110000000000000000000000002222222222222222222222222222222222222222000000000000000000000000000000000000000000000000016345785d8a0000000000000000000000000000000000000000000000000000000000000e4e1c000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000000021234000000000000000000000000000000000000000000000000000000000000" as const;

const request = {
  chainId: 1,
  srcToken: weth,
  dstToken: usdc,
  amount,
  from: app,
  receiver: app,
  slippagePercent: "1",
  protocols: ["UNISWAP_V3"],
  complexityLevel: 0,
} as const;

const response = {
  dstAmount: "250000000",
  tx: {
    from: app,
    to: router,
    data: calldata,
    value: "0",
    gas: 220000,
    gasPrice: "1000000000",
  },
  stateOverrides: {},
};

const expectation = {
  chainId: 1,
  router,
  srcToken: weth,
  dstToken: usdc,
  amount,
  caller: app,
  recipient: app,
  protocols: ["UNISWAP_V3"],
} as const;

function replaceCalldataWord(index: number, word: string): string {
  const normalized = word.replace(/^0x/, "").padStart(64, "0");
  const start = 10 + index * 64;
  return `${calldata.slice(0, start)}${normalized}${calldata.slice(start + 64)}`;
}

describe("buildClassicSwapRequest", () => {
  it("binds an exact-input single-pool request to the Mandate app", () => {
    const url = buildClassicSwapRequest(request);

    expect(url.origin + url.pathname).toBe("https://api.1inch.com/swap/v6.1/1/swap");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      src: weth,
      dst: usdc,
      amount: amount.toString(),
      from: app,
      receiver: app,
      slippage: "1",
      allowPartialFill: "false",
      disableEstimate: "true",
      protocols: "UNISWAP_V3",
      complexityLevel: "0",
    });
  });
});

describe("admitClassicSwapRoute", () => {
  it("admits a decoded zero-flag route that spends the full input to the app", () => {
    expect(admitClassicSwapRoute(response, expectation, "request-123")).toEqual({
      provider: "1inch-classic-swap-v6.1",
      requestId: "request-123",
      chainId: "1",
      target: router,
      selector: "0x07ed2379",
      calldataSchema:
        "swap(address,(address,address,address,address,uint256,uint256,uint256),bytes)",
      calldata,
      calldataHash: "0xe169a1ca24e3f7faf9cc774c0327706bd8acf69d2d9f37fcdedbd106a4b93aed",
      caller: app,
      executor,
      recipient: app,
      tokenIn: weth,
      tokenOut: usdc,
      amountIn: amount.toString(),
      quotedAmountOut: "250000000",
      routeMinimumOut: "240000000",
      nativeValue: "0",
      allowPartialFill: false,
      deadline: null,
      protocols: ["UNISWAP_V3"],
    });
  });

  it.each([
    ["nonzero native value", { ...response, tx: { ...response.tx, value: "1" } }],
    [
      "arbitrary target",
      {
        ...response,
        tx: { ...response.tx, to: "0x3333333333333333333333333333333333333333" },
      },
    ],
    [
      "agent-selected recipient",
      {
        ...response,
        tx: {
          ...response.tx,
          data: replaceCalldataWord(4, "0x3333333333333333333333333333333333333333"),
        },
      },
    ],
    [
      "partial input amount",
      {
        ...response,
        tx: {
          ...response.tx,
          data: replaceCalldataWord(5, "0x00b1a2bc2ec50000"),
        },
      },
    ],
    [
      "partial-fill flag",
      {
        ...response,
        tx: { ...response.tx, data: replaceCalldataWord(7, "0x01") },
      },
    ],
    [
      "callback custody receiver",
      {
        ...response,
        tx: {
          ...response.tx,
          data: replaceCalldataWord(3, "0x2222222222222222222222222222222222222222"),
        },
      },
    ],
    [
      "unsupported direct selector",
      {
        ...response,
        tx: { ...response.tx, data: `0xe2c95c82${"00".repeat(32)}` },
      },
    ],
  ])("rejects %s", (_name, unsafeResponse) => {
    expect(() => admitClassicSwapRoute(unsafeResponse, expectation, "request-123")).toThrow();
  });
});

describe("requestClassicSwapRoute", () => {
  it("captures the provider request ID without exposing the API key", async () => {
    let authorization = "";
    const fetchFn: typeof fetch = (input, init) => {
      authorization = new Headers(init?.headers).get("authorization") ?? "";
      const requestUrl = input instanceof Request ? input.url : input.toString();
      expect(requestUrl).not.toContain("secret-key");
      return Promise.resolve(
        new Response(JSON.stringify(response), {
          status: 200,
          headers: { "content-type": "application/json", "x-request-id": "request-123" },
        }),
      );
    };

    const captured = await requestClassicSwapRoute(request, expectation, "secret-key", fetchFn);

    expect(authorization).toBe("Bearer secret-key");
    expect(captured.route.requestId).toBe("request-123");
    expect(captured.responseHash).toBe(
      "0x63603d60c5f85c7d5b6a9b9ca643ad3adb9def10c53fa05d5415436b075971c9",
    );
  });
});
