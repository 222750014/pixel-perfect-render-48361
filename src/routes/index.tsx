import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDistanceToNow } from "date-fns";
import { Plus, ArrowUpRight, MessageSquare, FolderOpen, Smile, Gauge, Search, ChevronRight, Youtube, FileSpreadsheet, PenLine } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import sentimentBubbles from "@/assets/sentiment-bubbles.jpg";
import { analysesQuery } from "@/lib/queries";
import { SOURCE_LABELS, pct, type AnalysisStats, type SourceType } from "@/lib/sentiment";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Sentiment Lab" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "description", content: "Your saved sentiment analyses of real YouTube, CSV and manually entered comments." },
      { property: "og:title", content: "Sentiment Lab — Dashboard" },
      { property: "og:description", content: "Saved AI sentiment analyses with AI-assisted insights." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(analysesQuery),
  component: Index,
});

const SENTIMENTS = [
  { key: "positive", label: "Positive", color: "var(--positive)", dot: "bg-positive" },
  { key: "neutral", label: "Neutral", color: "var(--neutral)", dot: "bg-neutral" },
  { key: "negative", label: "Negative", color: "var(--negative)", dot: "bg-negative" },
] as const;

const SOURCE_ICONS: Record<SourceType, typeof Youtube> = { youtube: Youtube, csv: FileSpreadsheet, manual: PenLine };

type Row = ReturnType<typeof useAnalyses>[number];

function useAnalyses() {
  const { data } = useSuspenseQuery(analysesQuery);
  return useMemo(() => data.map((a) => ({ ...a, s: a.stats as unknown as AnalysisStats })), [data]);
}

function Index() {
  const rows = useAnalyses();
  const totals = rows.reduce((t, { s }) => ({ total: t.total + s.total, positive: t.positive + s.positive, neutral: t.neutral + s.neutral, negative: t.negative + s.negative, weighted: t.weighted + s.avgCompound * s.total }), { total: 0, positive: 0, neutral: 0, negative: 0, weighted: 0 });
  const avgScore = totals.total ? totals.weighted / totals.total : 0;

  return (
    <AppShell>
      <section className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow mb-2 text-primary">Your audience at a glance</p>
          <h1 className="text-3xl font-semibold">Sentiment dashboard</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">Track how people feel about your content across every saved analysis.</p>
        </div>
        <Button asChild size="lg" className="h-11 shadow-sm"><Link to="/analyze"><Plus />New analysis</Link></Button>
      </section>

      {rows.length === 0 ? <EmptyState /> : (
        <>
          <section aria-label="Workspace statistics" className="mt-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Kpi label="Saved analyses" value={rows.length.toLocaleString()} icon={FolderOpen} detail={`Latest ${formatDistanceToNow(new Date(rows[0]!.created_at), { addSuffix: true })}`} />
            <Kpi label="Comments analyzed" value={totals.total.toLocaleString()} icon={MessageSquare} detail="Across all datasets" />
            <Kpi label="Positive share" value={`${pct(totals.positive, totals.total)}%`} icon={Smile} detail={`${pct(totals.negative, totals.total)}% negative`}>
              <ShareBar s={totals} className="mt-3" />
            </Kpi>
            <Kpi label="Avg sentiment score" value={`${avgScore >= 0 ? "+" : ""}${avgScore.toFixed(2)}`} icon={Gauge} detail="−1 negative · +1 positive">
              <ScoreMeter score={avgScore} />
            </Kpi>
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card title="Overall sentiment" subtitle="All analyzed comments">
              <OverallDonut totals={totals} />
            </Card>
            <Card title="Sentiment by analysis" subtitle="Share of comments, latest 8" className="lg:col-span-2">
              <ByAnalysisChart rows={rows.slice(0, 8)} />
            </Card>
          </section>

          {rows.length > 1 && (
            <section className="mt-4">
              <Card title="Sentiment trend" subtitle="Average score of each analysis, oldest to newest">
                <TrendChart rows={rows} />
              </Card>
            </section>
          )}

          <RecentAnalyses rows={rows.slice(0, 5)} />
          <AllAnalyses rows={rows} />
        </>
      )}
    </AppShell>
  );
}

function EmptyState() {
  return (
    <div className="surface-card mt-8 flex flex-col items-center px-6 py-12 text-center">
      <img src={sentimentBubbles} alt="Positive, neutral and negative comment bubbles" width={1024} height={768} className="h-48 w-64 rounded-xl object-cover" />
      <h2 className="mt-6 text-xl font-semibold">Your next insight starts here</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">Analyze YouTube comments, a CSV file or pasted text. Charts and trends appear here once you save an analysis.</p>
      <Button asChild className="mt-6"><Link to="/analyze"><Plus />Create your first analysis</Link></Button>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, detail, children }: { label: string; value: string; icon: typeof Smile; detail: string; children?: React.ReactNode }) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-foreground"><Icon size={16} /></span>
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
      {children}
      <p className="mt-2 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function Card({ title, subtitle, className = "", children }: { title: string; subtitle?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`surface-card p-5 ${className}`}>
      <h2 className="text-sm font-semibold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** Stacked share bar with 2px surface gaps between segments. */
function ShareBar({ s, className = "" }: { s: { positive: number; neutral: number; negative: number; total: number }; className?: string }) {
  return (
    <div className={`flex h-2 gap-0.5 overflow-hidden rounded-full ${className}`} role="img" aria-label={`${pct(s.positive, s.total)}% positive, ${pct(s.neutral, s.total)}% neutral, ${pct(s.negative, s.total)}% negative`}>
      {SENTIMENTS.map((x) => s[x.key] > 0 && <div key={x.key} className={`${x.dot} first:rounded-l-full last:rounded-r-full`} style={{ width: `${pct(s[x.key], s.total)}%` }} />)}
    </div>
  );
}

function ScoreMeter({ score }: { score: number }) {
  const left = ((Math.max(-1, Math.min(1, score)) + 1) / 2) * 100;
  return (
    <div className="relative mt-3 h-2 rounded-full bg-gradient-to-r from-negative via-neutral to-positive" aria-hidden>
      <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground shadow" style={{ left: `${left}%` }} />
    </div>
  );
}

function SentimentLegend({ s }: { s: { positive: number; neutral: number; negative: number; total: number } }) {
  return (
    <ul className="space-y-2">
      {SENTIMENTS.map((x) => (
        <li key={x.key} className="flex items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${x.dot}`} />{x.label}</span>
          <span className="tabular-nums text-muted-foreground"><span className="font-medium text-foreground">{pct(s[x.key], s.total)}%</span> · {s[x.key].toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}

function ChartTooltip({ active, payload, label, percent }: { active?: boolean; payload?: { name?: string; value?: number; color?: string; payload?: { fill?: string } }[]; label?: string; percent?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="surface-card min-w-36 px-3 py-2 text-xs">
      {label && <p className="mb-1 max-w-56 truncate font-medium">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.payload?.fill }} />{p.name}</span>
          <span className="font-medium tabular-nums">{percent ? `${p.value}%` : p.value?.toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
}

function OverallDonut({ totals }: { totals: { positive: number; neutral: number; negative: number; total: number } }) {
  const data = SENTIMENTS.map((x) => ({ name: x.label, value: totals[x.key], fill: x.color }));
  return (
    <div>
      <div className="relative h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="95%" paddingAngle={2} cornerRadius={4} stroke="var(--card)" strokeWidth={2} startAngle={90} endAngle={-270}>
              {data.map((d) => <Cell key={d.name} fill={d.fill} />)}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div><p className="text-2xl font-semibold tabular-nums">{pct(totals.positive, totals.total)}%</p><p className="text-[11px] text-muted-foreground">positive</p></div>
        </div>
      </div>
      <div className="mt-4"><SentimentLegend s={totals} /></div>
    </div>
  );
}

function shortTitle(t: string) {
  return t.length > 22 ? `${t.slice(0, 21)}…` : t;
}

function ByAnalysisChart({ rows }: { rows: Row[] }) {
  const data = [...rows].reverse().map((r) => ({
    name: r.title, Positive: pct(r.s.positive, r.s.total), Neutral: pct(r.s.neutral, r.s.total), Negative: pct(r.s.negative, r.s.total),
  }));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {SENTIMENTS.map((x) => <span key={x.key} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${x.dot}`} />{x.label}</span>)}
      </div>
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 36 + 30)}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={150} tickFormatter={shortTitle} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip percent />} />
          {SENTIMENTS.map((x, i) => (
            <Bar key={x.key} dataKey={x.label} stackId="s" fill={x.color} stroke="var(--card)" strokeWidth={2} radius={i === 0 ? [4, 0, 0, 4] : i === 2 ? [0, 4, 4, 0] : 0} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendChart({ rows }: { rows: Row[] }) {
  const data = [...rows].reverse().map((r) => ({ name: r.title, date: new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }), Score: +r.s.avgCompound.toFixed(3) }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="date" axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis domain={[-1, 1]} ticks={[-1, -0.5, 0, 0.5, 1]} width={36} axisLine={false} tickLine={false} />
        <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
        <Tooltip
          cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            const p = payload?.[0]?.payload as (typeof data)[number] | undefined;
            if (!active || !p) return null;
            return <div className="surface-card px-3 py-2 text-xs"><p className="max-w-56 truncate font-medium">{p.name}</p><p className="text-muted-foreground">{p.date} · score <span className="font-medium text-foreground tabular-nums">{p.Score >= 0 ? "+" : ""}{p.Score}</span></p></div>;
          }}
        />
        <Line type="monotone" dataKey="Score" stroke="var(--primary)" strokeWidth={2} dot={{ r: 4, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 2 }} activeDot={{ r: 6, stroke: "var(--card)", strokeWidth: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function SourceBadge({ source }: { source: string }) {
  const Icon = SOURCE_ICONS[source as SourceType] ?? FolderOpen;
  return <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-[11px] font-medium text-secondary-foreground"><Icon size={12} />{SOURCE_LABELS[source as SourceType] ?? "Archived source"}</span>;
}

function RecentAnalyses({ rows }: { rows: Row[] }) {
  return (
    <section className="mt-10" aria-labelledby="recent-heading">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 id="recent-heading" className="text-lg font-semibold">Recent analyses</h2>
          <p className="text-xs text-muted-foreground">Pick up where you left off</p>
        </div>
      </div>
      <div className="surface-card divide-y overflow-hidden">
        {rows.map((r) => (
          <Link key={r.id} to="/analysis/$id" params={{ id: r.id }} className="group grid items-center gap-x-6 gap-y-2 px-5 py-4 hover:bg-muted/60 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto_auto]">
            <div className="min-w-0">
              <p className="truncate font-medium group-hover:text-primary">{r.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <SourceBadge source={r.source} />
                <span>{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                <span>· {r.s.total.toLocaleString()} comments</span>
              </div>
            </div>
            <div>
              <ShareBar s={r.s} />
              <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">{pct(r.s.positive, r.s.total)}% positive · {pct(r.s.negative, r.s.total)}% negative</p>
            </div>
            <div className="text-right md:w-16">
              <p className="text-sm font-semibold tabular-nums">{r.s.avgCompound >= 0 ? "+" : ""}{r.s.avgCompound.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">score</p>
            </div>
            <ChevronRight size={18} className="hidden text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary md:block" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function AllAnalyses({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceType | "all">("all");
  const sources = [...new Set(rows.map((r) => r.source as SourceType))].filter((s) => s in SOURCE_LABELS);
  const filtered = rows.filter((r) => (source === "all" || r.source === source) && r.title.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <section className="mt-10" aria-labelledby="all-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="all-heading" className="text-lg font-semibold">All analyses <span className="ml-1 text-sm font-normal text-muted-foreground">{rows.length}</span></h2>
          <p className="text-xs text-muted-foreground">Search or filter by data source</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Filter by source" className="flex rounded-lg border bg-card p-0.5">
            {(["all", ...sources] as const).map((s) => (
              <button key={s} type="button" onClick={() => setSource(s)} aria-pressed={source === s} className={`rounded-md px-3 py-1.5 text-xs font-medium ${source === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {s === "all" ? "All" : SOURCE_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search analyses" aria-label="Search analyses" className="h-9 w-56 bg-card pl-9" />
          </div>
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="surface-card px-5 py-10 text-center text-sm text-muted-foreground">No analyses match your filters.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <Link key={r.id} to="/analysis/$id" params={{ id: r.id }} className="surface-card surface-card-interactive group flex flex-col p-5">
              <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                <SourceBadge source={r.source} />
                <span>{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              <div className="mt-4 flex items-start justify-between gap-3">
                <h3 className="line-clamp-2 font-semibold group-hover:text-primary">{r.title}</h3>
                <ArrowUpRight size={17} className="shrink-0 text-muted-foreground group-hover:text-primary" />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{r.s.total.toLocaleString()} comments</p>
              <div className="mt-auto pt-5">
                <ShareBar s={r.s} />
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground tabular-nums">
                  {SENTIMENTS.map((x) => <span key={x.key} className="flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${x.dot}`} />{pct(r.s[x.key], r.s.total)}% {x.key}</span>)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
