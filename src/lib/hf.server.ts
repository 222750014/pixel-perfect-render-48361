// Server-only: Hugging Face Inference API sentiment classification.
// Model has three classes (negative / neutral / positive), so Neutral is a real model prediction.
export const HF_MODEL = "cardiffnlp/twitter-roberta-base-sentiment-latest";
const URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;
const BATCH = 32;

export interface HFScore { pos: number; neu: number; neg: number }

export class HFError extends Error {}

async function callBatch(token: string, inputs: string[], attempt = 0): Promise<HFScore[]> {
  const res = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs, parameters: { top_k: 3 }, options: { wait_for_model: true } }),
  });
  if (res.status === 429 || res.status === 503 || res.status >= 500) {
    if (attempt < 3) {
      const ra = Number(res.headers.get("retry-after"));
      await new Promise((r) => setTimeout(r, (ra > 0 ? ra * 1000 : 2000 * 2 ** attempt) + Math.random() * 500));
      return callBatch(token, inputs, attempt + 1);
    }
    throw new HFError(res.status === 429 ? "Hugging Face rate limit reached. Please wait a minute and try again." : "The Hugging Face model is currently unavailable. Please try again shortly.");
  }
  if (res.status === 401 || res.status === 403) throw new HFError("The Hugging Face token is invalid or lacks Inference permission.");
  if (res.status === 404) throw new HFError("The Hugging Face sentiment model could not be found.");
  if (!res.ok) throw new HFError(`Hugging Face error (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { label: string; score: number }[][] | { label: string; score: number }[];
  const rows = Array.isArray(json[0]) ? (json as { label: string; score: number }[][]) : [json as { label: string; score: number }[]];
  if (rows.length !== inputs.length) throw new HFError("Unexpected response from Hugging Face.");
  return rows.map((r) => {
    const get = (l: string) => r.find((x) => x.label.toLowerCase() === l)?.score ?? 0;
    return { pos: get("positive"), neu: get("neutral"), neg: get("negative") };
  });
}

/** Classifies every text; throws HFError on failure (never returns fake predictions). */
export async function classifyTexts(texts: string[]): Promise<HFScore[]> {
  const token = process.env["HUGGINGFACE_API_TOKEN"];
  if (!token) throw new HFError("Hugging Face token missing. Add the HUGGINGFACE_API_TOKEN secret.");
  const out: HFScore[] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    // Model limit is 512 tokens; trim very long comments.
    out.push(...(await callBatch(token, texts.slice(i, i + BATCH).map((t) => t.slice(0, 1200)))));
  }
  return out;
}
