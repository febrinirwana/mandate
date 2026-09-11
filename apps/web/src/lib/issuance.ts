import type { StrategyV1 } from "@mandate/domain";

import {
  compilePolicy,
  type PolicyCompilationContext,
  type PolicyDraftV1,
  type PolicyProfileV1,
} from "@/lib/policy";

export type IssuanceDefaults = Pick<PolicyDraftV1, "maxInput" | "minRate" | "expiresAt">;
export type PolicyDraftIssues = Partial<Record<"maxInput" | "minRate" | "expiresAt", string>>;

export type PolicyDraftReview = {
  draft: PolicyDraftV1;
  strategy: StrategyV1 | undefined;
  issues: PolicyDraftIssues;
};

export type AuthorizationChecklistInput = {
  smartAccountReady: boolean;
  chainReady: boolean;
  ensReady: boolean;
  fundingReady: boolean;
  economicFieldsValid: boolean;
  batchReady: boolean;
};

export type AuthorizationChecklistItem = {
  id: "smartAccount" | "chain" | "ens" | "funding" | "economicFields" | "batch";
  complete: boolean;
  reason: string;
};

export type AccountPreparationState =
  | { kind: "SIGNED_OUT" }
  | { kind: "AUTHENTICATING" }
  | { kind: "PREPARING_ACCOUNT" }
  | { kind: "READY" }
  | { kind: "RECOVERABLE_ERROR"; actions: ["RETRY", "SIGN_OUT"] };

function formatLocalDateTime(value: Date, offset: number): string {
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function validExpiry(validAfter: string): string {
  return new Date(Number((BigInt(validAfter) + 1n) * 1_000n)).toISOString();
}

function validationDraft(draft: PolicyDraftV1, context: PolicyCompilationContext): PolicyDraftV1 {
  return {
    ...draft,
    maxInput: "1",
    minRate: "1",
    expiresAt: validExpiry(context.validAfter),
  };
}

function fieldIssue(
  field: keyof PolicyDraftIssues,
  draft: PolicyDraftV1,
  profile: PolicyProfileV1,
  context: PolicyCompilationContext,
): string | undefined {
  const candidate = validationDraft(draft, context);
  candidate[field] = draft[field];
  try {
    compilePolicy(candidate, profile, context);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : undefined;
  }
}

export function createIssuanceDefaults(now: Date, offset: number): IssuanceDefaults {
  return {
    maxInput: "1",
    minRate: "1",
    expiresAt: formatLocalDateTime(new Date(now.getTime() + 24 * 60 * 60 * 1_000), offset),
  };
}

export function reviewPolicyDraft(
  draft: PolicyDraftV1,
  profile: PolicyProfileV1,
  context: PolicyCompilationContext,
): PolicyDraftReview {
  const issues: PolicyDraftIssues = {};
  for (const field of ["maxInput", "minRate", "expiresAt"] as const) {
    const issue = fieldIssue(field, draft, profile, context);
    if (issue) issues[field] = issue;
  }

  if (Object.keys(issues).length > 0) return { draft, strategy: undefined, issues };

  try {
    return { draft, strategy: compilePolicy(draft, profile, context), issues };
  } catch {
    return { draft, strategy: undefined, issues };
  }
}

export function authorizationChecklist(input: AuthorizationChecklistInput): {
  items: AuthorizationChecklistItem[];
  canAuthorize: boolean;
} {
  const items: AuthorizationChecklistItem[] = [
    {
      id: "smartAccount",
      complete: input.smartAccountReady,
      reason: "Prepare the dedicated owner smart account.",
    },
    {
      id: "chain",
      complete: input.chainReady,
      reason: "Confirm the live Sepolia contracts are ready.",
    },
    {
      id: "ens",
      complete: input.ensReady,
      reason: "Verify the named agent ENS identity matches the trusted profile.",
    },
    {
      id: "funding",
      complete: input.fundingReady,
      reason: "Fund the demo account or lower the maximum spend.",
    },
    {
      id: "economicFields",
      complete: input.economicFieldsValid,
      reason: "Resolve the economic field errors.",
    },
    {
      id: "batch",
      complete: input.batchReady,
      reason: "Prepare the exact four-call authorization batch.",
    },
  ];

  return { items, canAuthorize: items.every((item) => item.complete) };
}

export function deriveAccountPreparationState({
  authenticated,
  privyReady,
  smartAccount,
  attemptStartedAt,
  now,
  timeoutMs,
}: {
  authenticated: boolean;
  privyReady: boolean;
  smartAccount: `0x${string}` | undefined;
  attemptStartedAt: number | undefined;
  now: number;
  timeoutMs: number;
}): AccountPreparationState {
  if (!authenticated) return { kind: "SIGNED_OUT" };
  if (smartAccount) return { kind: "READY" };
  if (attemptStartedAt !== undefined && now - attemptStartedAt >= timeoutMs) {
    return { kind: "RECOVERABLE_ERROR", actions: ["RETRY", "SIGN_OUT"] };
  }
  if (!privyReady) return { kind: "AUTHENTICATING" };
  return { kind: "PREPARING_ACCOUNT" };
}

export function issuedMandateUrl(strategyHash: string, activationTx: string): string {
  return `/mandates/${strategyHash}?justIssued=1&activationTx=${activationTx}`;
}
