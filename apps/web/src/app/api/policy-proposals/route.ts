import { createPolicyProposal, type PolicyModelConfig } from "@/lib/policy-model";

function configuration(): PolicyModelConfig | undefined {
  const endpoint = process.env["POLICY_AI_ENDPOINT"];
  const apiKey = process.env["POLICY_AI_API_KEY"];
  const model = process.env["POLICY_AI_MODEL"];
  return endpoint && apiKey && model ? { endpoint, apiKey, model } : undefined;
}

export async function POST(request: Request): Promise<Response> {
  let intent: unknown;
  try {
    ({ intent } = await request.json());
  } catch {
    return Response.json({ kind: "CLARIFICATION", message: "Describe the authority you want to create." }, { status: 400 });
  }
  if (typeof intent !== "string" || !intent.trim() || intent.length > 800) {
    return Response.json({ kind: "CLARIFICATION", message: "Describe one authority in 800 characters or fewer." }, { status: 400 });
  }

  const proposal = await createPolicyProposal(intent, configuration());
  return Response.json(proposal, {
    status: proposal.kind === "UNAVAILABLE" ? 503 : proposal.kind === "CLARIFICATION" ? 422 : 200,
    headers: { "cache-control": "no-store" },
  });
}
