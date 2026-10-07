import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";

const MODEL = "openai/gpt-6-astra";

export class AIError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** Runs one Lovable AI Gateway call (streamed internally) and returns final text. */
export async function runAI(instructions: string, messages: ModelMessage[]): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AIError("AI is not configured (missing key).", 401);
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  try {
    const result = streamText({
      model: provider.responses(MODEL),
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
    if (e instanceof AIError) throw e;
    const status = (e as { statusCode?: number })?.statusCode ?? 500;
    console.error("AI gateway error", e);
    if (status === 402) throw new AIError("AI credits are exhausted. Add credits in workspace billing.", 402);
    if (status === 429) throw new AIError("AI is rate limited. Please wait a moment and try again.", 429);
    if (status === 403) throw new AIError("AI access is currently blocked for this workspace.", 403);
    throw new AIError("The AI service is unavailable right now.", status);
  }
}

export function parseJsonLoose<T>(text: string): T | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]) as T; } catch { return null; }
}
