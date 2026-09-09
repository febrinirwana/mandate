import type { PolicyDraftV1 } from "@/lib/policy";

export type PolicyModelConfig = {
  endpoint: string;
  apiKey: string;
  model: string;
};

export type PolicyProposalResult =
  | { kind: "PROPOSAL"; proposal: PolicyDraftV1 }
  | { kind: "CLARIFICATION"; message: string }
  | { kind: "UNAVAILABLE" };

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

const policySchema = {
  name: "policy_proposal_v1",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["version", "intent", "agent", "tokenIn", "tokenOut", "maxInput", "minRate", "expiresAt"],
    properties: {
      version: { type: "integer", const: 1 },
      intent: { type: "string", minLength: 1, maxLength: 800 },
      agent: { type: "string", minLength: 1, maxLength: 80 },
      tokenIn: { type: "string", minLength: 1, maxLength: 24 },
      tokenOut: { type: "string", minLength: 1, maxLength: 24 },
      maxInput: { type: "string", minLength: 1, maxLength: 80 },
      minRate: { type: "string", minLength: 1, maxLength: 80 },
      expiresAt: { type: "string", minLength: 20, maxLength: 40 },
    },
  },
} as const;

function parseProposal(value: unknown): PolicyDraftV1 | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const proposal = value as Record<string, unknown>;
  const keys = Object.keys(proposal).sort();
  const expected = ["agent", "expiresAt", "intent", "maxInput", "minRate", "tokenIn", "tokenOut", "version"];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) return null;
  if (proposal.version !== 1) return null;
  for (const key of expected.slice(0, -1)) {
    if (typeof proposal[key] !== "string" || !proposal[key].trim()) return null;
  }
  return proposal as PolicyDraftV1;
}

export async function createPolicyProposal(
  intent: string,
  configuration: PolicyModelConfig | undefined,
  fetcher: Fetcher = fetch,
): Promise<PolicyProposalResult> {
  if (!configuration) return { kind: "UNAVAILABLE" };
  if (!intent.trim() || intent.length > 800) {
    return { kind: "CLARIFICATION", message: "Describe one authority in 800 characters or fewer." };
  }

  try {
    const response = await fetcher(configuration.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${configuration.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: configuration.model,
        response_format: { type: "json_schema", json_schema: policySchema },
        messages: [
          {
            role: "system",
            content: "Extract only the requested policy fields. Do not include addresses, contract data, transaction data, explanations, or extra fields.",
          },
          { role: "user", content: intent },
        ],
      }),
    });
    if (!response.ok) return { kind: "CLARIFICATION", message: "The policy assistant is unavailable. Edit the guided policy instead." };

    const body = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = body.choices?.[0]?.message?.content;
    const proposal = typeof content === "string" ? parseProposal(JSON.parse(content)) : null;
    return proposal
      ? { kind: "PROPOSAL", proposal }
      : { kind: "CLARIFICATION", message: "I need a clearer asset, agent, cap, rate floor, or expiry." };
  } catch {
    return { kind: "CLARIFICATION", message: "The policy assistant is unavailable. Edit the guided policy instead." };
  }
}
