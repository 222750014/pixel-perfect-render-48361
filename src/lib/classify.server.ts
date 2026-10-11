// Server-only: sentiment classification through the AI Gateway (see ai.server.ts).
// Three classes (negative / neutral / positive), so Neutral is a real model prediction.
import { generateText } from "ai";
import { aiProvider, toAIError, parseJsonLoose, AIError } from "./ai.server";

export const SENTIMENT_MODEL = "gpt-5.4-mini";
const BATCH = 40;
const CONCURRENCY = 6;

export interface SentimentScore { pos: number; neu: number; neg: number }

export class ClassifyError extends Error {}

const INSTRUCTIONS = `You are a sentiment classifier for social-media comments (YouTube, CSV exports, pasted text).
For each numbered comment, estimate the probability that its overall sentiment is positive, neutral or negative.
Read the whole sentence in context: handle sarcasm, slang, negation and emojis. Questions, plain facts and mixed feelings lean neutral.
Probabilities for each comment must sum to 1.
Respond with ONLY a JSON object: {"results":[{"i":<comment number>,"pos":<0-1>,"neu":<0-1>,"neg":<0-1>}, ...]} with exactly one entry per comment, in order.`;

async function callBatch(texts: string[], attempt = 0): Promise<SentimentScore[]> {
  const { provider, modelId } = aiProvider();
  let text: string;
  try {
    ({ text } = await generateText({
      model: provider.chat(modelId(SENTIMENT_MODEL)),
      system: INSTRUCTIONS,
      prompt: texts.map((t, i) => `${i}: ${JSON.stringify(t)}`).join("\n"),
    }));
  } catch (e) {
    const err = toAIError(e);
    if ((err.status === 429 || err.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt + Math.random() * 500));
      return callBatch(texts, attempt + 1);
    }
    throw new ClassifyError(err.message);
  }
  const rows = parseJsonLoose<{ results?: { i: number; pos: number; neu: number; neg: number }[] }>(text)?.results;
  const byIndex = new Map((rows ?? []).map((r) => [Number(r.i), r]));
  if (texts.some((_, i) => !byIndex.has(i))) {
    if (attempt < 2) return callBatch(texts, attempt + 1);
    throw new ClassifyError("Unexpected response from the sentiment model. Please try again.");
  }
  return texts.map((_, i) => {
    const r = byIndex.get(i)!;
    const clean = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
    const pos = clean(r.pos), neu = clean(r.neu), neg = clean(r.neg);
    const sum = pos + neu + neg || 1;
    return { pos: pos / sum, neu: neu / sum, neg: neg / sum };
  });
}

/** Classifies every text; throws ClassifyError on failure (never returns fake predictions). */
export async function classifyTexts(texts: string[]): Promise<SentimentScore[]> {
  try { aiProvider(); } catch (e) { throw new ClassifyError(e instanceof AIError ? e.message : "AI is not configured."); }
  // Trim very long comments to keep prompts small.
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) batches.push(texts.slice(i, i + BATCH).map((t) => t.slice(0, 1200)));
  const results: SentimentScore[][] = new Array(batches.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, async () => {
    while (next < batches.length) {
      const b = next++;
      results[b] = await callBatch(batches[b]!);
    }
  }));
  return results.flat();
}
