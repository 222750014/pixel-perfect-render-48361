import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";

const MODEL = "gpt-6-astra";

export class AIError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/**
 * OpenAI-compatible provider. Uses the Lovable AI Gateway when LOVABLE_API_KEY is set (Lovable preview),
 * otherwise Netlify AI Gateway, which injects OPENAI_API_KEY / OPENAI_BASE_URL on deployed sites.
 */
export function aiProvider() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (lovableKey) {
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: lovableKey,
      headers: { "Lovable-API-Key": lovableKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    return { provider, modelId: (id: string) => `openai/${id}` };
  }
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new AIError("AI is not configured (missing key). Netlify AI Gateway activates after a production deploy.", 401);
  const baseURL = process.env["OPENAI_BASE_URL"];
  return { provider: createOpenAI(baseURL ? { apiKey, baseURL } : { apiKey }), modelId: (id: string) => id };
}

/** Maps AI SDK / gateway failures to user-facing errors. */
export function toAIError(e: unknown): AIError {
  if (e instanceof AIError) return e;
  const status = (e as { statusCode?: number })?.statusCode ?? 500;
  console.error("AI gateway error", e);
  if (status === 402) return new AIError("AI credits are exhausted. Add credits in your billing settings.", 402);
  if (status === 429) return new AIError("AI is rate limited. Please wait a moment and try again.", 429);
  if (status === 403) return new AIError("AI access is currently blocked for this account.", 403);
  return new AIError("The AI service is unavailable right now.", status);
}

/** Runs one AI Gateway call (streamed internally) and returns final text. */
export async function runAI(instructions: string, messages: ModelMessage[]): Promise<string> {
  const { provider, modelId } = aiProvider();
  try {
    const result = streamText({
      model: provider.responses(modelId(MODEL)),
      instructions,
      messages,
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    } as Parameters<typeof streamText>[0]);
    const text = await result.text;
    if (!text.trim()) throw new AIError("The AI returned an empty response.", 502);
    return text;
  } catch (e: unknown) {
    throw toAIError(e);
  }
}

export function parseJsonLoose<T>(text: string): T | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]) as T; } catch { return null; }
}
