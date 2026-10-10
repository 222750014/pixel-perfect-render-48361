import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { cleanComments, computeStats, scoreComment, parseYouTubeId, pct, type AnalysisStats } from "./sentiment";

const commentSchema = z.object({
  text: z.string().max(10000),
  author: z.string().max(300).nullish(),
  published_at: z.string().max(100).nullish(),
  like_count: z.number().nullish(),
});

export interface Insights {
  overall: string;
  dominantEmotion: string;
  emotions: { emotion: string; share: number }[];
  emojiInterpretation: string;
  positiveThemes: string[];
  negativeThemes: string[];
  concerns: string[];
  improvements: string[];
  interpretation: string;
}

/** Cleans, scores with VADER and stores an analysis. */
export const createAnalysis = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      title: z.string().min(1).max(200),
      source: z.enum(["youtube", "csv", "manual"]),
      sourceRef: z.string().max(500).nullish(),
      comments: z.array(commentSchema).min(1).max(5000),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { publicDb } = await import("./db.server");
    const { comments, removedEmpty, removedDuplicates } = cleanComments(data.comments);
    if (!comments.length) return { error: "No usable comments after cleaning (all were empty)." as string, id: null };
    const scored = comments.map(scoreComment);
    const stats = computeStats(scored, removedEmpty, removedDuplicates);
    const db = publicDb();
    const { data: row, error } = await db
      .from("analyses")
      .insert({ title: data.title, source: data.source, source_ref: data.sourceRef ?? null, stats: stats as never })
      .select("id").single();
    if (error || !row) { console.error(error); return { error: "Could not save the analysis.", id: null }; }
    const rows = scored.map((c) => ({
      analysis_id: row.id, text: c.text, author: c.author ?? null,
      published_at: c.published_at && !isNaN(Date.parse(c.published_at)) ? new Date(c.published_at).toISOString() : null,
      like_count: c.like_count ?? null, pos: c.pos, neu: c.neu, neg: c.neg, compound: c.compound,
      label: c.label, emojis: c.emojis,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error: e } = await db.from("comments").insert(rows.slice(i, i + 500));
      if (e) { console.error(e); return { error: "Could not save comments.", id: null }; }
    }
    return { error: null, id: row.id as string };
  });

/** Fetches public comments for a video through the official YouTube Data API v3. */
export const fetchYouTubeComments = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ url: z.string().min(1).max(500), max: z.number().min(10).max(1000) }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env["YOUTUBE_API_KEY"];
    if (!key) return { error: "YouTube API key missing. Add YOUTUBE_API_KEY (see Project → API setup).", comments: [], title: null, videoId: null };
    const videoId = parseYouTubeId(data.url);
    if (!videoId) return { error: "Invalid YouTube URL.", comments: [], title: null, videoId: null };
    try {
      const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${key}`);
      const vJson = await vRes.json();
      if (!vRes.ok) return { error: ytError(vJson), comments: [], title: null, videoId };
      if (!vJson.items?.length) return { error: "Video not found or unavailable.", comments: [], title: null, videoId };
      const title: string = vJson.items[0].snippet.title;
      const comments: { text: string; author: string; published_at: string; like_count: number }[] = [];
      let pageToken = "";
      while (comments.length < data.max) {
        const r = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&maxResults=100&order=relevance&textFormat=plainText&videoId=${videoId}&key=${key}${pageToken ? `&pageToken=${pageToken}` : ""}`);
        const j = await r.json();
        if (!r.ok) return { error: ytError(j), comments: [], title, videoId };
        for (const it of j.items ?? []) {
          const s = it.snippet.topLevelComment.snippet;
          comments.push({ text: s.textOriginal ?? s.textDisplay, author: s.authorDisplayName, published_at: s.publishedAt, like_count: s.likeCount });
        }
        if (!j.nextPageToken) break;
        pageToken = j.nextPageToken;
      }
      if (!comments.length) return { error: "This video has no comments.", comments: [], title, videoId };
      return { error: null, comments: comments.slice(0, data.max), title, videoId };
    } catch (e) {
      console.error(e);
      return { error: "Network error while contacting YouTube.", comments: [], title: null, videoId };
    }
  });

function ytError(j: { error?: { errors?: { reason?: string }[]; message?: string } }) {
  const reason = j?.error?.errors?.[0]?.reason;
  if (reason === "commentsDisabled") return "Comments are disabled for this video.";
  if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") return "YouTube API quota exceeded. Try again tomorrow.";
  if (reason === "keyInvalid" || reason === "badRequest") return "The YouTube API key is invalid.";
  if (reason === "videoNotFound") return "Video not found or unavailable.";
  return `YouTube API error: ${j?.error?.message ?? "unknown"}`;
}

async function loadContext(id: string) {
  const { publicDb } = await import("./db.server");
  const db = publicDb();
  const { data: a } = await db.from("analyses").select("*").eq("id", id).single();
  if (!a) throw new Error("Analysis not found");
  const top = await db.from("comments").select("text,compound,label").eq("analysis_id", id).order("compound", { ascending: false }).limit(25);
  const bottom = await db.from("comments").select("text,compound,label").eq("analysis_id", id).order("compound", { ascending: true }).limit(25);
  const sample = await db.from("comments").select("text,compound,label").eq("analysis_id", id).limit(200);
  return { db, a, top: top.data ?? [], bottom: bottom.data ?? [], sample: sample.data ?? [] };
}

function statsBlock(a: { title: string; source: string; source_ref: string | null }, s: AnalysisStats) {
  return `Dataset: "${a.title}" (source: ${a.source}${a.source_ref ? `, ${a.source_ref}` : ""})
Total comments: ${s.total} | Positive: ${s.positive} (${pct(s.positive, s.total)}%) | Neutral: ${s.neutral} (${pct(s.neutral, s.total)}%) | Negative: ${s.negative} (${pct(s.negative, s.total)}%)
Average VADER compound: ${s.avgCompound}
Emojis: ${s.emojiTotal} total, ${s.emojiUnique} unique. Top: ${s.topEmojis.map((e) => `${e.emoji}×${e.count} (avg ${e.avgCompound})`).join(", ") || "none"}
Top keywords: ${s.keywords.map((k) => `${k.word}(${k.count})`).join(", ")}`;
}

const fmt = (rows: { text: string; compound: number }[]) =>
  rows.map((r) => `- [${r.compound.toFixed(3)}] ${r.text.slice(0, 280)}`).join("\n");

/** AI-assisted interpretation grounded in calculated VADER statistics. */
export const generateInsights = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { runAI, parseJsonLoose, AIError } = await import("./ai.server");
    try {
      const { db, a, top, bottom, sample } = await loadContext(data.id);
      const s = a.stats as unknown as AnalysisStats;
      const text = await runAI(
        `You are a data analyst. Interpret real audience comments. The VADER numbers are ground truth; never contradict or invent statistics. Also act as an emotion classifier (like a Hugging Face emotion model with labels joy, love, surprise, anger, sadness, fear, neutral): estimate emotion shares from the sample. Respond with ONLY a JSON object with keys: overall (2-3 sentences), dominantEmotion (string), emotions (array of {emotion, share} where share is a percentage, sums to 100), emojiInterpretation (2 sentences on what the emojis signal), positiveThemes (3-5 short strings), negativeThemes (3-5 short strings), concerns (2-4 strings), improvements (2-4 strings), interpretation (one paragraph).`,
        [{ role: "user", content: `${statsBlock(a, s)}\n\nMost positive comments:\n${fmt(top)}\n\nMost negative comments:\n${fmt(bottom)}\n\nSample for emotion estimation:\n${fmt(sample)}` }],
      );
      const insights = parseJsonLoose<Insights>(text);
      if (!insights) return { error: "Could not read the AI response. Please try again.", insights: null };
      await db.from("analyses").update({ insights: insights as never }).eq("id", data.id);
      return { error: null, insights };
    } catch (e) {
      return { error: e instanceof AIError ? e.message : "Failed to generate insights.", insights: null };
    }
  });

/** Chatbot answering only from this dataset's calculated results. */
export const askChat = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), message: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ data }) => {
    const { runAI, AIError } = await import("./ai.server");
    try {
      const { db, a, top, bottom, sample } = await loadContext(data.id);
      const s = a.stats as unknown as AnalysisStats;
      const { data: history } = await db.from("chat_messages").select("role,content").eq("analysis_id", data.id).order("created_at").limit(20);
      await db.from("chat_messages").insert({ analysis_id: data.id, role: "user", content: data.message });
      const reply = await runAI(
        `You are a helpful data-analysis assistant inside a student's Sentiment Analysis Tool. Answer ONLY from the dataset context below. Use the exact calculated numbers. If something cannot be answered from the data, say so. VADER compound ranges -1 to 1; >=0.05 Positive, <=-0.05 Negative, otherwise Neutral. Keep answers concise and use markdown lists when helpful.\n\n${statsBlock(a, s)}\n\nAI insights (if generated): ${a.insights ? JSON.stringify(a.insights) : "none yet"}\n\nMost positive comments:\n${fmt(top)}\n\nMost negative comments:\n${fmt(bottom)}\n\nRandom sample:\n${fmt(sample.slice(0, 80))}`,
        [
          ...(history ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
          { role: "user" as const, content: data.message },
        ],
      );
      await db.from("chat_messages").insert({ analysis_id: data.id, role: "assistant", content: reply });
      return { error: null, reply };
    } catch (e) {
      return { error: e instanceof AIError ? e.message : "The chatbot failed to respond.", reply: null };
    }
  });
