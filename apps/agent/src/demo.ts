import { createHash } from "node:crypto";

import {
  DemoExecutionRequestV1Schema,
  DemoExecutionResultV1Schema,
  PolicyProfileV1Schema,
  type DemoExecutionResultV1,
  type ExecutionV1,
  type PolicyProfileV1,
  type ReceiptAuditV1,
} from "@mandate/domain";
import { encodeFunctionData, parseAbi, type Address } from "viem";

import {
  AgentRejection,
  type AgentAuthority,
  type AgentPolicy,
  type ExecutionIntent,
} from "./policy.js";

const venueAbi = parseAbi(["function swap(uint256 amountIn,uint256 amountOut,address recipient)"]);

export interface DemoExecutionRuntime {
  chainId: string;
  mandateApp: Address;
  routeRecipient: Address;
  maximumDemoInput: string;
}

export type DemoAutomatedExecution = (
  intent: ExecutionIntent,
  dependencies: { policy: AgentPolicy; authority: AgentAuthority; now?: () => Date },
) => Promise<{ txHash: `0x${string}`; execution: ExecutionV1; audit: ReceiptAuditV1 }>;

export interface DemoExecutionDependencies {
  profile: PolicyProfileV1;
  runtime: DemoExecutionRuntime;
  authority: AgentAuthority;
  runAutomatedExecution: DemoAutomatedExecution;
  now?: () => Date;
  logger?: (entry: unknown) => void;
}

function unknownResult(error: unknown): Extract<DemoExecutionResultV1, { status: "UNKNOWN" }> {
  const detail = error instanceof Error ? `${error.name}:${error.message}` : String(error);
  return { status: "UNKNOWN", errorId: `0x${createHash("sha256").update(detail).digest("hex")}` };
}

function errorTypes(error: unknown): string[] {
  const types: string[] = [];
  let current: unknown = error;
  while (current instanceof Error && types.length < 6) {
    types.push(current.name);
    current = current.cause;
  }
  return types;
}

export function createDemoExecutionService(dependencies: DemoExecutionDependencies) {
  const profile = PolicyProfileV1Schema.parse(dependencies.profile);
  const maximumDemoInput = BigInt(dependencies.runtime.maximumDemoInput);
  if (maximumDemoInput <= 0n) throw new Error("maximumDemoInput must be positive");
  const now = dependencies.now ?? (() => new Date());
  const automatedExecution = dependencies.runAutomatedExecution;

  return {
    async execute(rawInput: unknown): Promise<DemoExecutionResultV1> {
      const parsed = DemoExecutionRequestV1Schema.safeParse(rawInput);
      if (!parsed.success) return { status: "REJECTED", reason: "INVALID_STRATEGY" };
      const request = parsed.data;
      if (request.chainId !== dependencies.runtime.chainId) {
        return { status: "REJECTED", reason: "TARGET_MISMATCH" };
      }

      let stage: "READ_AUTHORITY" | "SIMULATE" | "EXECUTE" = "READ_AUTHORITY";
      try {
        const snapshot = await dependencies.authority.readMandate(request);
        const strategy = snapshot.strategy;
        if (snapshot.chainId !== request.chainId) throw new AgentRejection("TARGET_MISMATCH");
        if (snapshot.result === "UNKNOWN") throw new AgentRejection("ENS_READ_UNAVAILABLE");
        if (snapshot.aqua.result !== "PASS") throw new AgentRejection("AQUA_READ_UNAVAILABLE");
        if (snapshot.strategyHash !== request.strategyHash) {
          throw new AgentRejection("STRATEGY_HASH_MISMATCH");
        }
        if (strategy.agent !== profile.agent.address) throw new AgentRejection("CALLER_NOT_AGENT");
        if (
          strategy.ensRegistry !== profile.ens.registry ||
          strategy.ensResolver !== profile.ens.resolver ||
          strategy.ensLabel !== profile.ens.label ||
          strategy.ensNode !== profile.ens.node ||
          strategy.tokenIn !== profile.tokenIn.address ||
          strategy.tokenOut !== profile.tokenOut.address
        ) {
          throw new AgentRejection("STRATEGY_HASH_MISMATCH");
        }
        if (strategy.swapTarget !== profile.route.target)
          throw new AgentRejection("TARGET_MISMATCH");
        if (strategy.swapSelector !== profile.route.selector)
          throw new AgentRejection("SELECTOR_MISMATCH");
        if (BigInt(strategy.maxInputTotal) > maximumDemoInput) {
          throw new AgentRejection("TOTAL_CAP_EXCEEDED");
        }

        const timestamp = BigInt(Math.floor(now().getTime() / 1_000));
        if (!snapshot.state.activated) throw new AgentRejection("MANDATE_INACTIVE");
        if (snapshot.state.revoked) throw new AgentRejection("MANDATE_REVOKED");
        if (timestamp < BigInt(strategy.validAfter))
          throw new AgentRejection("MANDATE_NOT_STARTED");
        if (timestamp >= BigInt(strategy.validUntil)) throw new AgentRejection("MANDATE_EXPIRED");
        if (snapshot.ens.status !== "REGISTERED") throw new AgentRejection("ENS_NOT_REGISTERED");
        if (snapshot.ens.owner !== profile.agent.address)
          throw new AgentRejection("ENS_OWNER_MISMATCH");
        if (snapshot.ens.address !== profile.agent.address)
          throw new AgentRejection("ENS_ADDRESS_MISMATCH");
        if (timestamp >= BigInt(snapshot.ens.expiry)) throw new AgentRejection("ENS_EXPIRED");

        const preferredInput = 10n ** BigInt(profile.tokenIn.decimals);
        const remainingTotal = BigInt(strategy.maxInputTotal) - BigInt(snapshot.state.usedInput);
        if (remainingTotal <= 0n) throw new AgentRejection("TOTAL_CAP_EXCEEDED");
        const amountIn = [
          preferredInput,
          BigInt(strategy.maxInputPerCall),
          remainingTotal,
          BigInt(snapshot.aqua.inputBalance),
        ].reduce((minimum, amount) => (amount < minimum ? amount : minimum));
        if (amountIn <= 0n) throw new AgentRejection("AQUA_BALANCE_INSUFFICIENT");
        const agentMinOut =
          (amountIn * BigInt(strategy.minRateNumerator) +
            BigInt(strategy.minRateDenominator) -
            1n) /
          BigInt(strategy.minRateDenominator);
        const executionDeadline = (
          timestamp + 300n < BigInt(strategy.validUntil)
            ? timestamp + 300n
            : BigInt(strategy.validUntil) - 1n
        ).toString();
        const routeData = encodeFunctionData({
          abi: venueAbi,
          functionName: "swap",
          args: [amountIn, agentMinOut, dependencies.runtime.routeRecipient],
        });
        stage = "SIMULATE";
        const simulation = await dependencies.authority.simulate({
          chainId: request.chainId,
          mandateApp: dependencies.runtime.mandateApp,
          strategy,
          amountIn: amountIn.toString(),
          agentMinOut: agentMinOut.toString(),
          executionDeadline,
          routeData,
        });
        const intent: ExecutionIntent = {
          chainId: request.chainId,
          strategy,
          amountIn: amountIn.toString(),
          agentMinOut: agentMinOut.toString(),
          executionDeadline,
          routeData,
          simulation,
        };
        const policy: AgentPolicy = {
          chainId: dependencies.runtime.chainId,
          mandateApp: dependencies.runtime.mandateApp,
          signer: profile.agent.address,
          strategyHash: request.strategyHash,
          tokenIn: profile.tokenIn.address,
          tokenOut: profile.tokenOut.address,
          routeTarget: profile.route.target,
          routeSelector: profile.route.selector,
          routeRecipient: dependencies.runtime.routeRecipient,
          maxInputPerCall: maximumDemoInput.toString(),
          maxInputTotal: maximumDemoInput.toString(),
        };
        stage = "EXECUTE";
        const result = await automatedExecution(intent, {
          policy,
          authority: dependencies.authority,
          now,
        });
        return DemoExecutionResultV1Schema.parse({
          status: "CONFIRMED",
          txHash: result.txHash,
          execution: result.execution,
          audit: result.audit,
        });
      } catch (error) {
        if (error instanceof AgentRejection) {
          dependencies.logger?.({
            event: "demo-execution-rejected",
            stage,
            reason: error.reason,
          });
          return { status: "REJECTED", reason: error.reason };
        }
        const result = unknownResult(error);
        dependencies.logger?.({
          event: "demo-execution-unknown",
          stage,
          errorId: result.errorId,
          errorTypes: errorTypes(error),
        });
        return result;
      }
    },
  };
}
