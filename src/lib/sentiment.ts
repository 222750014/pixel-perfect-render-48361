// Shared, pure analysis helpers (safe on client and server).
// Sentiment comes from the Hugging Face model (see hf.server.ts); emojis are only counted, never scored.

export type SentimentLabel = "Positive" | "Neutral" | "Negative";
export type SourceType = "youtube" | "csv" | "manual";

export const SOURCE_LABELS: Record<SourceType, string> = {
  youtube: "YouTube API",
  csv: "CSV Upload",
  manual: "Manual Input",
};

export interface RawComment {
  text: string;
  author?: string | null | undefined;
  published_at?: string | null | undefined;
  like_count?: number | null | undefined;
}

export interface ScoredComment extends RawComment {
  pos: number;
  neu: number;
  neg: number;
  compound: number;
  label: SentimentLabel;
  emojis: string[];
}

export interface AnalysisStats {
  total: number;
  removedEmpty: number;
  removedDuplicates: number;
  positive: number;
  neutral: number;
  negative: number;
  avgCompound: number;
  emojiTotal: number;
  emojiUnique: number;
  topEmojis: { emoji: string; count: number; avgCompound: number }[];
  histogram: { bin: string; count: number }[];
  keywords: { word: string; count: number }[];
  timeline: { date: string; Positive: number; Neutral: number; Negative: number }[];
}

const EMOJI_RE = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|\p{Emoji_Modifier})*/gu;

export function extractEmojis(text: string): string[] {
  return text.match(EMOJI_RE) ?? [];
}

export function classify(compound: number): SentimentLabel {
  if (compound >= 0.05) return "Positive";
  if (compound <= -0.05) return "Negative";
  return "Neutral";
}

/** Cleaning keeps emojis, punctuation and casing (kept so the model sees the original text). */
export function cleanComments(raw: RawComment[]) {
  let removedEmpty = 0;
  let removedDuplicates = 0;
  const seen = new Set<string>();
  const out: RawComment[] = [];
  for (const c of raw) {
    const text = (c.text ?? "").toString().replace(/\s+/g, " ").trim();
    if (!text) { removedEmpty++; continue; }
    const key = text.toLowerCase();
    if (seen.has(key)) { removedDuplicates++; continue; }
    seen.add(key);
    out.push({ ...c, text: text.slice(0, 5000) });
  }
  return { comments: out, removedEmpty, removedDuplicates };
}

/** Builds a scored comment from model probabilities. compound = P(positive) − P(negative). */
export function scoreComment(c: RawComment, p: { pos: number; neu: number; neg: number }): ScoredComment {
  const label: SentimentLabel = p.pos >= p.neu && p.pos >= p.neg ? "Positive" : p.neg >= p.neu ? "Negative" : "Neutral";
  return { ...c, ...p, compound: +(p.pos - p.neg).toFixed(4), label, emojis: extractEmojis(c.text) };
}

export function confidence(c: { pos: number; neu: number; neg: number }) {
  return Math.round(Math.max(c.pos, c.neu, c.neg) * 100);
}

const STOP = new Set(
  "the a an and or but if is are was were be been to of in on for with this that it its i you he she we they me my your our their at as by from so just not no do does did have has had can will would could should what when who how all any more most very too than then there here about out up down get got im it's i'm dont don't like one also really video".split(" "),
);

export function computeStats(scored: ScoredComment[], removedEmpty = 0, removedDuplicates = 0): AnalysisStats {
  const total = scored.length;
  const count = (l: SentimentLabel) => scored.filter((c) => c.label === l).length;
  const avgCompound = total ? scored.reduce((a, c) => a + c.compound, 0) / total : 0;

  const emojiMap = new Map<string, { count: number; sum: number }>();
  let emojiTotal = 0;
  for (const c of scored) for (const e of c.emojis) {
    emojiTotal++;
    const m = emojiMap.get(e) ?? { count: 0, sum: 0 };
    m.count++; m.sum += c.compound;
    emojiMap.set(e, m);
  }
  const topEmojis = [...emojiMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([emoji, m]) => ({ emoji, count: m.count, avgCompound: +(m.sum / m.count).toFixed(3) }));

  const bins = Array.from({ length: 10 }, (_, i) => ({ bin: (-1 + i * 0.2).toFixed(1), count: 0 }));
  for (const c of scored) bins[Math.min(9, Math.floor((c.compound + 1) / 0.2))]!.count++;

  const words = new Map<string, number>();
  for (const c of scored) {
    for (const w of c.text.toLowerCase().match(/[a-z][a-z']{2,}/g) ?? []) {
      if (!STOP.has(w)) words.set(w, (words.get(w) ?? 0) + 1);
    }
  }
  const keywords = [...words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([word, count]) => ({ word, count }));

  const byDay = new Map<string, { Positive: number; Neutral: number; Negative: number }>();
  for (const c of scored) {
    if (!c.published_at) continue;
    const d = new Date(c.published_at);
    if (isNaN(d.getTime())) continue;
    const k = d.toISOString().slice(0, 10);
    const m = byDay.get(k) ?? { Positive: 0, Neutral: 0, Negative: 0 };
    m[c.label]++;
    byDay.set(k, m);
  }
  const timeline = [...byDay.entries()].sort().map(([date, m]) => ({ date, ...m }));

  return {
    total, removedEmpty, removedDuplicates,
    positive: count("Positive"), neutral: count("Neutral"), negative: count("Negative"),
    avgCompound: +avgCompound.toFixed(4),
    emojiTotal, emojiUnique: emojiMap.size, topEmojis,
    histogram: bins, keywords, timeline,
  };
}

export function pct(n: number, total: number) {
  return total ? Math.round((n / total) * 1000) / 10 : 0;
}

/** Extract a YouTube video ID from common URL shapes or a bare ID. */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1, 12) || null;
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v.slice(0, 11);
      const m = u.pathname.match(/\/(shorts|embed|live)\/([\w-]{11})/);
      if (m) return m[2] ?? null;
    }
  } catch { /* not a URL */ }
  return null;
}
