import { AgentRejection, prepareExecution, type ExecutionIntent } from "../apps/agent/src/index.js";
import type { ReasonCode } from "../packages/domain/src/index.js";

import {
  authority,
  now,
  policy,
  request,
  simulation,
  snapshot,
  strategy,
} from "../apps/agent/test/fixtures.js";
import { unsafeRawSignerBaseline } from "./unsafe-raw-signer.js";

export interface AgentEvalResult {
  case: string;
  constrained: { result: "REJECTED"; reason: ReasonCode };
  unsafeBaseline: "ARBITRARY_TRANSACTION_ACCEPTED";
}

const baseIntent: ExecutionIntent = {
  chainId: request.chainId,
  strategy,
  amountIn: request.amountIn,
  agentMinOut: request.agentMinOut,
  executionDeadline: request.executionDeadline,
  routeData: request.routeData,
  simulation,
};
const wrongAddress = `0x${"f".repeat(40)}` as const;

export async function runAgentEvals(): Promise<AgentEvalResult[]> {
  const cases = [
    {
      case: "wrong target",
      intent: { ...baseIntent, strategy: { ...strategy, swapTarget: wrongAddress } },
      authority: authority(),
    },
    {
      case: "cap breach",
      intent: { ...baseIntent, amountIn: "101" },
      authority: authority(),
    },
    {
      case: "stale simulation",
      intent: {
        ...baseIntent,
        simulation: {
          ...simulation,
          binding: { ...simulation.binding, expiresAt: now.toISOString() },
        },
      },
      authority: authority(),
    },
    {
      case: "revoked identity",
      intent: baseIntent,
      authority: authority({
        state: { ...snapshot.state, revoked: true },
        result: "FAIL",
      }),
    },
    {
      case: "malicious route",
      intent: {
        ...baseIntent,
        routeData: `${request.routeData.slice(0, -40)}${wrongAddress.slice(2)}` as `0x${string}`,
      },
      authority: authority(),
    },
    {
      case: "unknown evidence",
      intent: {
        ...baseIntent,
        simulation: {
          ...simulation,
          result: "UNKNOWN" as const,
          reasons: ["ENS_READ_UNAVAILABLE" as const],
        },
      },
      authority: authority(),
    },
  ];

  return Promise.all(
    cases.map(async (entry) => {
      let reason: ReasonCode | undefined;
      try {
        await prepareExecution(entry.intent, policy, entry.authority, { now: () => now });
      } catch (error) {
        if (error instanceof AgentRejection) reason = error.reason;
        else throw error;
      }
      if (!reason) throw new Error(`${entry.case} was not rejected`);
      return {
        case: entry.case,
        constrained: { result: "REJECTED" as const, reason },
        unsafeBaseline: unsafeRawSignerBaseline({
          to: wrongAddress,
          data: entry.intent.routeData,
          value: 1n,
        }),
      };
    }),
  );
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/evals/agent-runtime.ts")) {
  void runAgentEvals().then((results) => {
    console.log(JSON.stringify(results, null, 2));
  });
}
