import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Download, Printer, Sparkles, Send, MessageSquare, ChartNoAxesCombined, Smile } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, SentimentDot } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { askChat, generateInsights, type Insights } from "@/lib/analysis.functions";
import { SOURCE_LABELS, pct, type AnalysisStats, type SourceType } from "@/lib/sentiment";

const analysisQuery = (id: string) => queryOptions({
  queryKey: ["analysis", id],
  queryFn: async () => {
    const { data: a, error } = await supabase.from("analyses").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!a) return null;
    const all: { id: string; text: string; author: string | null; published_at: string | null; like_count: number | null; pos: number; neu: number; neg: number; compound: number; label: string; emojis: string[] }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from("comments").select("*").eq("analysis_id", id).range(from, from + 999);
      all.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    const { data: chat } = await supabase.from("chat_messages").select("id,role,content").eq("analysis_id", id).order("created_at");
    return { analysis: a, comments: all, chat: chat ?? [] };
  },
});

export const Route = createFileRoute("/analysis/$id")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(analysisQuery(params.id));
    if (!d) throw notFound();
    return { title: d.analysis.title };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} — Sentiment Lab` },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary_large_image" },
          { name: "description", content: `Sentiment analysis results for ${loaderData.title}.` },
          { property: "og:title", content: `${loaderData.title} — Sentiment Lab` },
          { property: "og:description", content: "Hugging Face sentiment, emoji and AI insights for real audience comments." },
        ]
      : [{ title: "Analysis not found" }, { name: "robots", content: "noindex" }],
  }),
  notFoundComponent: () => <AppShell><p>Analysis not found. <Link to="/" className="underline">Back</Link></p></AppShell>,
  component: AnalysisPage,
});

const COLORS = { Positive: "var(--positive)", Neutral: "var(--neutral)", Negative: "var(--negative)" };
const EMO_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--accent)", "var(--muted-foreground)"];

function AnalysisPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(analysisQuery(id));
  const qc = useQueryClient();
  const genInsights = useServerFn(generateInsights);
  const [loadingInsights, setLoadingInsights] = useState(false);
  if (!data) return null;
  const { analysis: a, comments } = data;
  const s = a.stats as unknown as AnalysisStats;
  const insights = a.insights as unknown as Insights | null;
   const source = SOURCE_LABELS[a.source as SourceType] ?? "Archived source";

  async function makeInsights() {
    setLoadingInsights(true);
    try {
      const r = await genInsights({ data: { id } });
      if (r.error) toast.error(r.error); else await qc.invalidateQueries({ queryKey: ["analysis", id] });
    } catch { toast.error("Network error"); } finally { setLoadingInsights(false); }
  }

  const pieData = [
    { name: "Positive", value: s.positive }, { name: "Neutral", value: s.neutral }, { name: "Negative", value: s.negative },
  ];

  return (
    <AppShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Source: <span className="text-foreground">{source}</span> · {new Date(a.created_at).toLocaleString()}
          </p>
          <h1 className="mt-1 break-words text-3xl font-semibold">{a.title}</h1>
          {a.source_ref && (a.source_ref.startsWith("http")
            ? <a href={a.source_ref} target="_blank" rel="noreferrer" className="break-all font-mono text-xs text-primary underline">{a.source_ref}</a>
            : <p className="font-mono text-sm text-muted-foreground">{a.source_ref}</p>)}
        </div>
        <div className="no-print flex gap-2">
          <Button variant="outline" onClick={() => exportCsv(a.title, comments)}><Download />Export CSV</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer />Print / PDF report</Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <Stat label="Total comments" value={s.total} />
        <Stat label="Positive" value={`${s.positive}`} sub={`${pct(s.positive, s.total)}%`} tone="bg-positive" />
        <Stat label="Neutral" value={`${s.neutral}`} sub={`${pct(s.neutral, s.total)}%`} tone="bg-neutral" />
        <Stat label="Negative" value={`${s.negative}`} sub={`${pct(s.negative, s.total)}%`} tone="bg-negative" />
        <Stat label="Avg compound" value={s.avgCompound.toFixed(3)} />
        <Stat label="Top emotion" value={insights?.dominantEmotion ?? "—"} sub={insights ? "AI-assisted" : "generate insights"} />
        <Stat label="Top emoji" value={s.topEmojis[0]?.emoji ?? "—"} sub={s.topEmojis[0] ? `×${s.topEmojis[0].count}` : undefined} />
      </div>
      {(s.removedEmpty > 0 || s.removedDuplicates > 0) && (
        <p className="mt-2 text-xs text-muted-foreground">Cleaning removed {s.removedEmpty} empty and {s.removedDuplicates} duplicate comments.</p>
      )}

      <Tabs defaultValue="overview" className="mt-8">
        <TabsList className="no-print flex-wrap">
          <TabsTrigger value="overview"><ChartNoAxesCombined size={16} />Sentiment results</TabsTrigger>
          <TabsTrigger value="emoji"><Smile size={16} />Emoji & emotion</TabsTrigger>
          <TabsTrigger value="insights"><Sparkles size={16} />AI insights</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="chat"><MessageSquare size={16} />Chatbot</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid gap-4 lg:grid-cols-2">
          <Panel title="Sentiment distribution">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={65} outerRadius={95} paddingAngle={3}>
                  {pieData.map((d) => <Cell key={d.name} fill={COLORS[d.name as keyof typeof COLORS]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </Panel>
          <Panel title="Sentiment breakdown">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={pieData}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip />
                <Bar dataKey="value">{pieData.map((d) => <Cell key={d.name} fill={COLORS[d.name as keyof typeof COLORS]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>
          <Panel title="Compound score distribution">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={s.histogram}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="bin" /><YAxis allowDecimals={false} /><Tooltip />
                <Bar dataKey="count" fill="var(--chart-1)" />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
          <Panel title="Common keywords">
            <div className="flex flex-wrap gap-2">
              {s.keywords.map((k) => (
                <span key={k.word} className="rounded border bg-muted px-2 py-1 font-mono text-xs">{k.word} <span className="text-muted-foreground">{k.count}</span></span>
              ))}
              {!s.keywords.length && <p className="text-sm text-muted-foreground">Not enough text.</p>}
            </div>
          </Panel>
          {s.timeline.length > 1 && (
            <Panel title="Comments over time" className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={s.timeline}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Tooltip /><Legend />
                  {(["Positive", "Neutral", "Negative"] as const).map((k) => <Line key={k} type="monotone" dataKey={k} stroke={COLORS[k]} dot={false} strokeWidth={2} />)}
                </LineChart>
              </ResponsiveContainer>
            </Panel>
          )}
          <Extremes title="Most positive comments" rows={[...comments].sort((x, y) => y.compound - x.compound).slice(0, 5)} />
          <Extremes title="Most negative comments" rows={[...comments].sort((x, y) => x.compound - y.compound).slice(0, 5)} />
        </TabsContent>

        <TabsContent value="emoji" className="grid gap-4 lg:grid-cols-2">
          <Panel title={`Emoji frequency · ${s.emojiTotal} total, ${s.emojiUnique} unique`}>
            {s.topEmojis.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={s.topEmojis} layout="vertical"><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="emoji" width={40} tick={{ fontSize: 18 }} /><Tooltip />
                  <Bar dataKey="count" fill="var(--chart-3)" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground">No emojis detected in this dataset.</p>}
          </Panel>
          <Panel title="Emoji → sentiment relationship (avg model score)">
            <table className="w-full text-sm">
              <thead className="text-left font-mono text-xs text-muted-foreground"><tr><th className="py-1">Emoji</th><th>Count</th><th>Avg compound</th></tr></thead>
              <tbody>
                {s.topEmojis.map((e) => (
                  <tr key={e.emoji} className="border-t"><td className="py-1.5 text-lg">{e.emoji}</td><td className="font-mono">{e.count}</td>
                    <td className="font-mono"><SentimentDot label={e.avgCompound >= 0.05 ? "Positive" : e.avgCompound <= -0.05 ? "Negative" : "Neutral"} /> {e.avgCompound}</td></tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Panel title="Emotion distribution (AI-assisted)" className="lg:col-span-2">
            <p className="mb-3 text-xs text-muted-foreground">VADER provides the primary sentiment classification. The emotion estimate below is an additional AI interpretation (Hugging Face-style emotion labels) and should be checked against the calculated statistics.</p>
            {insights?.emotions?.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart><Pie data={insights.emotions} dataKey="share" nameKey="emotion" outerRadius={90} label={({ name }) => name as string}>
                    {insights.emotions.map((_, i) => <Cell key={i} fill={EMO_COLORS[i % EMO_COLORS.length] ?? "var(--muted-foreground)"} />)}</Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
                <div className="text-sm"><p className="font-medium">Dominant emotion: {insights.dominantEmotion}</p><p className="mt-2 text-muted-foreground">{insights.emojiInterpretation}</p></div>
              </div>
            ) : <InsightsCTA loading={loadingInsights} onClick={makeInsights} />}
          </Panel>
        </TabsContent>

        <TabsContent value="insights">
          {insights ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Overall audience sentiment" className="lg:col-span-2">
                <p>{insights.overall}</p>
                <p className="mt-3 font-mono text-xs text-muted-foreground">Calculated: {pct(s.positive, s.total)}% positive · {pct(s.neutral, s.total)}% neutral · {pct(s.negative, s.total)}% negative · dominant: {pieData.reduce((m, d) => (d.value > m.value ? d : m)).name}</p>
              </Panel>
              <ListPanel title="Positive themes" items={insights.positiveThemes} />
              <ListPanel title="Negative themes" items={insights.negativeThemes} />
              <ListPanel title="Potential audience concerns" items={insights.concerns} />
              <ListPanel title="Areas for improvement" items={insights.improvements} />
              <Panel title="Overall interpretation" className="lg:col-span-2"><p>{insights.interpretation}</p></Panel>
              <div className="no-print"><Button variant="outline" disabled={loadingInsights} onClick={makeInsights}>{loadingInsights ? "Regenerating…" : "Regenerate insights"}</Button></div>
            </div>
          ) : <Panel title="AI-generated insights"><InsightsCTA loading={loadingInsights} onClick={makeInsights} /></Panel>}
        </TabsContent>

        <TabsContent value="comments"><CommentTable comments={comments} /></TabsContent>
        <TabsContent value="chat"><Chat id={id} initial={data.chat} /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string | undefined; tone?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{tone && <span className={`h-2 w-2 rounded-full ${tone}`} />}{label}</div>
      <div className="mt-1 truncate text-2xl font-semibold capitalize">{value}</div>
      {sub && <div className="font-mono text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`border-t py-5 ${className}`}>
      <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function ListPanel({ title, items }: { title: string; items: string[] }) {
  return <Panel title={title}><ul className="list-disc space-y-1 pl-5 text-sm">{(items ?? []).map((i, k) => <li key={k}>{i}</li>)}</ul></Panel>;
}

function Extremes({ title, rows }: { title: string; rows: { id: string; text: string; compound: number; label: string }[] }) {
  return (
    <Panel title={title}>
      <ul className="space-y-2 text-sm">
        {rows.map((r) => <li key={r.id} className="flex gap-2"><span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">{r.compound.toFixed(3)}</span><span className="line-clamp-2">{r.text}</span></li>)}
      </ul>
    </Panel>
  );
}

function InsightsCTA({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <div className="no-print flex flex-col items-start gap-2">
      <p className="text-sm text-muted-foreground">Generate an AI interpretation grounded in the calculated VADER statistics and real comments.</p>
      <Button disabled={loading} onClick={onClick}><Sparkles />{loading ? "Generating insights…" : "Generate AI insights"}</Button>
    </div>
  );
}

type Row = { id: string; text: string; author: string | null; published_at: string | null; pos: number; neu: number; neg: number; compound: number; label: string };

function CommentTable({ comments }: { comments: Row[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const per = 20;
  const rows = useMemo(() => comments
    .filter((c) => (filter === "All" || c.label === filter) && c.text.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (sort === "desc" ? b.compound - a.compound : a.compound - b.compound)), [comments, q, filter, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / per));
  const view = rows.slice(page * per, page * per + per);
  return (
    <div className="rounded-lg border bg-card">
      <div className="no-print flex flex-wrap gap-2 border-b p-3">
        <Input className="max-w-xs" placeholder="Search comments…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        {["All", "Positive", "Neutral", "Negative"].map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => { setFilter(f); setPage(0); }}>{f}</Button>
        ))}
        <Button size="sm" variant="outline" onClick={() => setSort(sort === "desc" ? "asc" : "desc")}>Compound {sort === "desc" ? "↓" : "↑"}</Button>
        <span className="ml-auto self-center font-mono text-xs text-muted-foreground">{rows.length} rows</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left font-mono text-xs text-muted-foreground">
            <tr><th className="p-2">Comment</th><th className="p-2">Sentiment</th><th className="p-2">Compound</th><th className="p-2">Pos</th><th className="p-2">Neu</th><th className="p-2">Neg</th></tr>
          </thead>
          <tbody>
            {view.map((c) => (
              <tr key={c.id} className="cursor-pointer border-t align-top hover:bg-muted/30" onClick={() => setOpen(open === c.id ? null : c.id)}>
                <td className={`max-w-xl p-2 ${open === c.id ? "whitespace-pre-wrap" : "truncate"}`}>{c.text}{open === c.id && c.author && <div className="mt-1 text-xs text-muted-foreground">— {c.author}{c.published_at && `, ${new Date(c.published_at).toLocaleDateString()}`}</div>}</td>
                <td className="whitespace-nowrap p-2"><SentimentDot label={c.label} /> {c.label}</td>
                <td className="p-2 font-mono">{c.compound.toFixed(3)}</td>
                <td className="p-2 font-mono text-muted-foreground">{c.pos.toFixed(2)}</td>
                <td className="p-2 font-mono text-muted-foreground">{c.neu.toFixed(2)}</td>
                <td className="p-2 font-mono text-muted-foreground">{c.neg.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="no-print flex items-center justify-between border-t p-3 text-sm">
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
        <span className="font-mono text-xs">Page {page + 1} / {pages}</span>
        <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

const SUGGESTIONS = ["What is the overall sentiment?", "What are people complaining about?", "What do people like most?", "Explain the pie chart.", "What should the content creator improve?", "What does the VADER compound score mean?"];

function Chat({ id, initial }: { id: string; initial: { id: string; role: string; content: string }[] }) {
  const ask = useServerFn(askChat);
  const [msgs, setMsgs] = useState(initial.map((m) => ({ role: m.role, content: m.content })));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  async function send(text: string) {
    if (!text.trim() || busy) return;
    setMsgs((m) => [...m, { role: "user", content: text }]); setInput(""); setBusy(true);
    try {
      const r = await ask({ data: { id, message: text } });
      if (r.error || !r.reply) toast.error(r.error ?? "No reply");
      else { const reply = r.reply; setMsgs((m) => [...m, { role: "assistant", content: reply }]); }
    } catch { toast.error("Network error"); } finally { setBusy(false); }
  }
  return (
    <div className="rounded-lg border bg-card">
      <div className="max-h-[520px] min-h-[300px] space-y-4 overflow-y-auto p-5">
        {msgs.length === 0 && <p className="text-sm text-muted-foreground">Ask questions about this dataset. Answers are based only on the calculated results and the real comments.</p>}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={m.role === "user" ? "max-w-[80%] rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground" : "max-w-[90%] whitespace-pre-wrap text-sm leading-relaxed"}>{m.content}</div>
          </div>
        ))}
        {busy && <p className="font-mono text-xs text-muted-foreground">Analyzing data…</p>}
      </div>
      <div className="no-print border-t p-3">
        <div className="mb-2 flex flex-wrap gap-1">
          {SUGGESTIONS.map((s) => <Button key={s} size="sm" variant="outline" disabled={busy} onClick={() => send(s)}>{s}</Button>)}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <Textarea rows={2} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about this dataset…"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} />
          <Button type="submit" disabled={busy || !input.trim()} className="self-end"><Send />Send</Button>
        </form>
      </div>
    </div>
  );
}

function exportCsv(title: string, rows: Row[]) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = ["comment,author,date,sentiment,compound,positive,neutral,negative"].concat(
    rows.map((r) => [r.text, r.author, r.published_at, r.label, r.compound, r.pos, r.neu, r.neg].map(esc).join(",")),
  );
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${title.replace(/[^\w-]+/g, "_").slice(0, 60)}_sentiment.csv`;
  a.click();
}
