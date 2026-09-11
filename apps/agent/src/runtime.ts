import type { ReceiptAuditV1, ExecutionV1 } from "@mandate/domain";
import type { Hash } from "viem";

import {
  AgentRejection,
  prepareExecution,
  revalidatePrepared,
  type AgentAuthority,
  type AgentPolicy,
  type ExecutionIntent,
  type ManualExecutionRequest,
} from "./policy.js";
import type { MandateExecutionSigner } from "./signer.js";

interface RuntimeDependencies {
  policy: AgentPolicy;
  authority: AgentAuthority;
  now?: () => Date;
}

export async function prepareManualExecution(
  intent: ExecutionIntent,
  dependencies: RuntimeDependencies,
): Promise<{ mode: "MANUAL"; request: ManualExecutionRequest }> {
  const prepared = await prepareExecution(
    intent,
    dependencies.policy,
    dependencies.authority,
    dependencies.now ? { now: dependencies.now } : {},
  );
  return { mode: "MANUAL", request: await revalidatePrepared(prepared) };
}

export async function runAutomatedExecution(
  intent: ExecutionIntent,
  dependencies: RuntimeDependencies & { signer: MandateExecutionSigner },
): Promise<{
  mode: "AUTOMATED";
  txHash: Hash;
  execution: ExecutionV1;
  audit: ReceiptAuditV1;
}> {
  const prepared = await prepareExecution(
    intent,
    dependencies.policy,
    dependencies.authority,
    dependencies.now ? { now: dependencies.now } : {},
  );
  const { txHash } = await dependencies.signer.submit(prepared);
  const execution = await dependencies.authority.readExecution({
    chainId: dependencies.policy.chainId,
    txHash,
  });
  if (
    execution.status !== "CONFIRMED" ||
    execution.txHash !== txHash ||
    execution.chainId !== dependencies.policy.chainId ||
    execution.strategyHash !== dependencies.policy.strategyHash ||
    execution.caller !== dependencies.policy.signer ||
    execution.amountIn !== intent.amountIn
  ) {
    throw new AgentRejection("RECEIPT_NOT_CANONICAL");
  }
  const audit = await dependencies.authority.auditReceipt({
    chainId: dependencies.policy.chainId,
    txHash,
  });
  if (
    audit.chainId !== execution.chainId ||
    audit.txHash !== execution.txHash ||
    audit.strategyHash !== execution.strategyHash ||
    audit.block.number !== execution.block.number ||
    audit.block.hash !== execution.block.hash
  ) {
    throw new AgentRejection("RECEIPT_NOT_CANONICAL");
  }
  return { mode: "AUTOMATED", txHash, execution, audit };
}
