import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/project")({
  head: () => ({
    meta: [
      { title: "Project & documentation — Sentiment Lab" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "description", content: "How Sentiment Lab works: VADER, AI emotion analysis, YouTube API, CSV and manual imports, architecture and limitations." },
      { property: "og:title", content: "How Sentiment Lab works" },
      { property: "og:description", content: "Methodology, architecture and limitations of a VADER-based sentiment analysis tool." },
    ],
  }),
  component: ProjectPage,
});

const SECTIONS: { h: string; body: React.ReactNode }[] = [
  { h: "What is sentiment analysis?", body: <p>Sentiment analysis is a text-classification task that decides whether a piece of text expresses a positive, negative or neutral opinion. Here it turns hundreds of audience comments into measurable statistics.</p> },
  { h: "Why VADER was selected", body: <><p>VADER (Valence Aware Dictionary and sEntiment Reasoner) is a rule-based model built for social-media text. It understands capitals (“GREAT”), punctuation (“!!!”), intensifiers (“very”), negation (“not good”), slang and many emojis, needs no training data, and is fully explainable.</p>
    <ul className="mt-2 list-disc pl-5"><li><b>pos / neu / neg</b>: the proportion of the text in each category (sum ≈ 1).</li><li><b>compound</b>: normalised overall score from −1 (most negative) to +1 (most positive).</li><li>Thresholds: compound ≥ 0.05 → Positive; ≤ −0.05 → Negative; otherwise Neutral.</li></ul>
    <p className="mt-2 text-muted-foreground">Documentation example only: “The editing is brilliant!!” → Positive, compound ≈ 0.68.</p></> },
  { h: "What is text classification?", body: <p>Assigning a label to a text. VADER computes a score, and the thresholds above map that score to one of three classes — a simple, transparent classifier that illustrates basic machine-learning concepts like features (words, punctuation, emojis) and decision boundaries.</p> },
  { h: "Emotion & emoji analysis (Hugging Face-style)", body: <p>Emojis are extracted with Unicode pattern matching, counted, and linked to the average VADER score of the comments they appear in. For emotions (joy, love, surprise, anger, sadness, fear, neutral) the app uses an AI model via the built-in AI service, mirroring Hugging Face emotion classifiers. This is shown separately: VADER is the primary classification, AI emotion analysis is supplementary.</p> },
  { h: "How the YouTube API works", body: <><p>The server calls the official YouTube Data API v3: <code className="font-mono">videos.list</code> to validate the video, then <code className="font-mono">commentThreads.list</code> page by page (100 per page) up to the chosen limit. Errors like invalid URL, disabled comments, quota exceeded and missing key are reported clearly.</p>
    <p className="mt-2"><b>Setup:</b> Google Cloud Console → create a project → enable “YouTube Data API v3” → Credentials → Create API key → save it in the app as <code className="font-mono">YOUTUBE_API_KEY</code>.</p></> },
  { h: "Data processing pipeline", body: <ol className="list-decimal pl-5"><li>Import (API, CSV or text)</li><li>Clean: trim whitespace, drop empty and duplicate comments, keep emojis, punctuation and casing</li><li>Score every comment with VADER</li><li>Classify with thresholds</li><li>Aggregate statistics, emoji counts, keywords, timeline</li><li>Store in the database</li><li>Visualise and generate AI insights grounded in the statistics</li></ol> },
  { h: "How insights and the chatbot work", body: <p>The calculated statistics plus the most positive, most negative and a sample of real comments are sent to an AI model with strict instructions to use only that data and never invent numbers. The chatbot receives the same context and the conversation history, which is saved per analysis.</p> },
  { h: "System architecture", body: <pre className="overflow-x-auto rounded bg-muted p-3 font-mono text-xs">{`Browser (React + TypeScript + Tailwind + Recharts)
   │  CSV parsing, charts, table, export
   ▼
Server functions (TanStack Start)
   ├─ VADER scoring + cleaning + statistics
   ├─ YouTube Data API v3 fetcher
   └─ AI insights / chatbot (Lovable AI)
   ▼
Database (Lovable Cloud): analyses · comments · chat_messages`}</pre> },
  { h: "Limitations", body: <ul className="list-disc pl-5"><li>VADER may misunderstand sarcasm.</li><li>Slang can be difficult to classify.</li><li>Context can be ambiguous.</li><li>API access may be restricted or quota-limited.</li><li>Emoji meaning depends on context.</li><li>AI-generated interpretations should be checked against calculated statistics.</li><li>Saved analyses are public to anyone with the app link (no login).</li></ul> },
];

function ProjectPage() {
  return (
    <AppShell>
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Methodology & reference</p>
      <h1 className="mt-1 text-3xl font-semibold">How Sentiment Lab works</h1>
      <div className="mt-8 max-w-4xl">
        {SECTIONS.map((s, i) => (
          <section key={s.h} className={`border-t py-7 text-sm leading-relaxed ${i === 1 || i === 8 ? "md:col-span-2" : ""}`}>
            <h2 className="mb-2 text-lg font-semibold"><span className="mr-2 font-mono text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>{s.h}</h2>
            {s.body}
          </section>
        ))}
      </div>
    </AppShell>
  );
}
