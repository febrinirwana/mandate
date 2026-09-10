import {
  decodeFunctionData,
  getAddress,
  isAddress,
  isHex,
  keccak256,
  toHex,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { z } from "zod";
import type { RouteAssessmentReason } from "@mandate/domain";

const DECIMAL = /^(?:0|[1-9][0-9]*)$/;
const SLIPPAGE = /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;
const PROTOCOL = /^[A-Z0-9_]+$/;

export const ONEINCH_CLASSIC_SWAP_BASE_URL = "https://api.1inch.com/swap/v6.1";
export const ONEINCH_AGGREGATION_ROUTER_V6 = "0x111111125421cA6dc452d289314280a0f8842A65" as const;
export const CLASSIC_SWAP_SELECTOR = "0x07ed2379" as const;
export const CLASSIC_SWAP_SCHEMA =
  "swap(address,(address,address,address,address,uint256,uint256,uint256),bytes)";

export class RouteAdmissionError extends Error {
  constructor(
    readonly reason: RouteAssessmentReason,
    message: string,
  ) {
    super(message);
    this.name = "RouteAdmissionError";
  }
}

function rejectRoute(reason: RouteAssessmentReason, message: string): never {
  throw new RouteAdmissionError(reason, message);
}

export const aggregationRouterV6Abi = [
  {
    type: "function",
    name: "swap",
    stateMutability: "payable",
    inputs: [
      { name: "executor", type: "address" },
      {
        name: "desc",
        type: "tuple",
        components: [
          { name: "srcToken", type: "address" },
          { name: "dstToken", type: "address" },
          { name: "srcReceiver", type: "address" },
          { name: "dstReceiver", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "minReturnAmount", type: "uint256" },
          { name: "flags", type: "uint256" },
        ],
      },
      { name: "data", type: "bytes" },
    ],
    outputs: [
      { name: "returnAmount", type: "uint256" },
      { name: "spentAmount", type: "uint256" },
    ],
  },
] as const satisfies Abi;

const classicSwapResponseSchema = z.object({
  dstAmount: z.string().regex(DECIMAL),
  tx: z.object({
    from: z.string().refine(isAddress, "invalid transaction sender"),
    to: z.string().refine(isAddress, "invalid transaction target"),
    data: z.custom<Hex>(
      (value) => typeof value === "string" && isHex(value),
      "invalid transaction calldata",
    ),
    value: z.string().regex(DECIMAL),
    gas: z.union([z.number().int().positive(), z.string().regex(DECIMAL)]).optional(),
    gasPrice: z.union([z.number().int().nonnegative(), z.string().regex(DECIMAL)]).optional(),
  }),
});

export interface ClassicSwapRequest {
  chainId: 1;
  srcToken: Address;
  dstToken: Address;
  amount: bigint;
  from: Address;
  receiver: Address;
  slippagePercent: string;
  protocols: readonly string[];
  complexityLevel: 0 | 1 | 2 | 3;
}

export interface RouteExpectation {
  chainId: 1;
  router: Address;
  srcToken: Address;
  dstToken: Address;
  amount: bigint;
  caller: Address;
  recipient: Address;
  protocols: readonly string[];
}

export interface AdmittedClassicSwapRoute {
  provider: "1inch-classic-swap-v6.1";
  requestId: string;
  chainId: "1";
  target: Address;
  selector: typeof CLASSIC_SWAP_SELECTOR;
  calldataSchema: typeof CLASSIC_SWAP_SCHEMA;
  calldata: Hex;
  calldataHash: Hex;
  caller: Address;
  executor: Address;
  recipient: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  quotedAmountOut: string;
  routeMinimumOut: string;
  nativeValue: "0";
  allowPartialFill: false;
  deadline: null;
  protocols: string[];
}

export function buildClassicSwapRequest(request: ClassicSwapRequest): URL {
  if (request.amount <= 0n) throw new Error("route amount must be positive");
  if (getAddress(request.srcToken) === getAddress(request.dstToken)) {
    throw new Error("route tokens must differ");
  }
  if (getAddress(request.from) !== getAddress(request.receiver)) {
    throw new Error("route receiver must be the Mandate app");
  }

  const slippage = Number(request.slippagePercent);
  if (
    !SLIPPAGE.test(request.slippagePercent) ||
    !Number.isFinite(slippage) ||
    slippage <= 0 ||
    slippage > 50
  ) {
    throw new Error("route slippage must be greater than zero and at most 50 percent");
  }
  if (
    request.protocols.length === 0 ||
    request.protocols.some((protocol) => !PROTOCOL.test(protocol))
  ) {
    throw new Error("route protocols must be explicit 1inch liquidity-source identifiers");
  }

  const url = new URL(`${ONEINCH_CLASSIC_SWAP_BASE_URL}/${request.chainId}/swap`);
  url.search = new URLSearchParams({
    src: request.srcToken,
    dst: request.dstToken,
    amount: request.amount.toString(),
    from: request.from,
    receiver: request.receiver,
    slippage: request.slippagePercent,
    allowPartialFill: "false",
    disableEstimate: "true",
    protocols: request.protocols.join(","),
    complexityLevel: request.complexityLevel.toString(),
  }).toString();
  return url;
}

export function admitClassicSwapRoute(
  input: unknown,
  expectation: RouteExpectation,
  requestId: string,
): AdmittedClassicSwapRoute {
  if (expectation.chainId !== 1)
    rejectRoute("ONEINCH_RESPONSE_INVALID", "only Ethereum mainnet routes are admitted");
  if (requestId.trim().length === 0)
    rejectRoute("ONEINCH_RESPONSE_INVALID", "1inch response did not include a request ID");

  const parsed = classicSwapResponseSchema.safeParse(input);
  if (!parsed.success) rejectRoute("ONEINCH_RESPONSE_INVALID", "1inch response schema is invalid");
  const response = parsed.data;
  const target = getAddress(response.tx.to);
  const caller = getAddress(response.tx.from);
  const tokenIn = getAddress(expectation.srcToken);
  const tokenOut = getAddress(expectation.dstToken);

  if (target !== getAddress(expectation.router))
    rejectRoute("TARGET_MISMATCH", "route target differs from admitted router");
  if (caller !== getAddress(expectation.caller))
    rejectRoute("CALLER_MISMATCH", "route caller differs from Mandate app");
  if (
    expectation.protocols.length === 0 ||
    expectation.protocols.some((protocol) => !PROTOCOL.test(protocol))
  ) {
    rejectRoute("ONEINCH_RESPONSE_INVALID", "route expectation contains no valid liquidity source");
  }
  if (tokenIn === tokenOut) rejectRoute("TOKEN_MISMATCH", "route tokens must differ");
  if (BigInt(response.tx.value) !== 0n)
    rejectRoute("NATIVE_VALUE_NONZERO", "route requires native value");

  const calldata = response.tx.data;
  if (calldata.slice(0, 10).toLowerCase() !== CLASSIC_SWAP_SELECTOR) {
    rejectRoute("SELECTOR_MISMATCH", "route selector is not the admitted Classic Swap function");
  }

  let decoded;
  try {
    decoded = decodeFunctionData({ abi: aggregationRouterV6Abi, data: calldata });
  } catch {
    rejectRoute("ONEINCH_RESPONSE_INVALID", "route calldata cannot be decoded");
  }
  if (decoded.functionName !== "swap")
    rejectRoute("SELECTOR_MISMATCH", "unsupported route function");
  const [executorAddress, description, executorData] = decoded.args;
  const executor = getAddress(executorAddress);
  const recipient = getAddress(description.dstReceiver);
  const sourceReceiver = getAddress(description.srcReceiver);
  const decodedTokenIn = getAddress(description.srcToken);
  const decodedTokenOut = getAddress(description.dstToken);

  if (executor === "0x0000000000000000000000000000000000000000") {
    rejectRoute("ROUTE_EXECUTOR_INVALID", "route executor is zero");
  }
  if (sourceReceiver !== executor) {
    rejectRoute(
      "CALLBACK_CUSTODY_UNSAFE",
      "route requires callback custody outside the admitted executor",
    );
  }
  if (recipient !== getAddress(expectation.recipient))
    rejectRoute("RECIPIENT_MISMATCH", "route recipient is not the Mandate app");
  if (decodedTokenIn !== tokenIn || decodedTokenOut !== tokenOut) {
    rejectRoute("TOKEN_MISMATCH", "route calldata token pair differs from the request");
  }
  if (description.amount !== expectation.amount)
    rejectRoute("AMOUNT_MISMATCH", "route does not spend the exact requested input");
  if (description.flags !== 0n) {
    rejectRoute(
      "PARTIAL_FILL_ENABLED",
      "route enables partial fill, extra native value, or Permit2",
    );
  }
  if (
    description.minReturnAmount <= 0n ||
    description.minReturnAmount > BigInt(response.dstAmount)
  ) {
    rejectRoute(
      "ONEINCH_RESPONSE_INVALID",
      "route minimum output is invalid for the quoted output",
    );
  }
  if (executorData === "0x")
    rejectRoute("ROUTE_EXECUTOR_INVALID", "route contains no admitted liquidity call");

  const protocols = [...new Set(expectation.protocols)].sort();

  return {
    provider: "1inch-classic-swap-v6.1",
    requestId,
    chainId: "1",
    target,
    selector: CLASSIC_SWAP_SELECTOR,
    calldataSchema: CLASSIC_SWAP_SCHEMA,
    calldata,
    calldataHash: keccak256(calldata),
    caller,
    executor,
    recipient,
    tokenIn,
    tokenOut,
    amountIn: description.amount.toString(),
    quotedAmountOut: response.dstAmount,
    routeMinimumOut: description.minReturnAmount.toString(),
    nativeValue: "0",
    allowPartialFill: false,
    deadline: null,
    protocols,
  };
}

export interface CapturedClassicSwapRoute {
  route: AdmittedClassicSwapRoute;
  responseHash: Hex;
}

export async function requestClassicSwapRoute(
  request: ClassicSwapRequest,
  expectation: RouteExpectation,
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<CapturedClassicSwapRoute> {
  if (apiKey.trim().length === 0 || apiKey === "replace_me")
    throw new Error("ONEINCH_API_KEY is not configured");

  const response = await fetchFn(buildClassicSwapRequest(request), {
    headers: { accept: "application/json", authorization: `Bearer ${apiKey}` },
  });
  const requestId =
    response.headers.get("x-request-id") ?? response.headers.get("request-id") ?? "";
  if (!response.ok)
    throw new Error(
      `1inch route request failed with HTTP ${response.status} (${requestId || "no request ID"})`,
    );

  const rawResponse = await response.text();
  const body: unknown = JSON.parse(rawResponse);
  return {
    route: admitClassicSwapRoute(body, expectation, requestId),
    responseHash: keccak256(toHex(rawResponse)),
  };
}
