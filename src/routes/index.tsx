import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, ArrowUpRight, MessageSquare, FolderOpen, Smile, Database } from "lucide-react";
import sentimentBubbles from "@/assets/sentiment-bubbles.jpg";
import { SOURCE_LABELS, pct, type AnalysisStats, type SourceType } from "@/lib/sentiment";

const analysesQuery = queryOptions({
  queryKey: ["analyses"],
  queryFn: async () => {
    const { data, error } = await supabase.from("analyses").select("id,title,source,source_ref,created_at,stats").order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return data;
  },
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — Sentiment Lab" },
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

function Index() {
  const { data } = useSuspenseQuery(analysesQuery);
  const stats = data.map((a) => a.stats as unknown as AnalysisStats);
  const totalComments = stats.reduce((n, s) => n + s.total, 0);
  const positive = stats.reduce((n, s) => n + s.positive, 0);
  const sources = new Set(data.map((a) => a.source)).size;
  return (
    <AppShell>
      <section className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase text-primary">Your audience, in perspective</p>
          <h1 className="text-3xl font-semibold">Sentiment overview</h1>
          <p className="mt-2 text-sm text-muted-foreground">A closer look at the conversations behind your content.</p>
        </div>
        <Button asChild className="h-10"><Link to="/analyze"><Plus />New analysis</Link></Button>
      </section>

      <section aria-label="Workspace statistics" className="mt-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          { label: "Saved analyses", value: data.length, icon: FolderOpen, detail: "In your workspace" },
          { label: "Comments analyzed", value: totalComments.toLocaleString(), icon: MessageSquare, detail: "Across all datasets" },
          { label: "Positive sentiment", value: totalComments ? `${pct(positive, totalComments)}%` : "—", icon: Smile, detail: "Of analyzed comments" },
          { label: "Data sources", value: sources, icon: Database, detail: "Represented in your analyses" },
        ].map((item) => <div key={item.label} className="rounded-lg border bg-card p-5">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{item.label}</span><item.icon size={16} /></div>
          <p className="mt-4 text-3xl font-semibold tabular-nums">{item.value}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">{item.detail}</p>
        </div>)}
      </section>

      <section className="mt-10">
        <div className="mb-5 flex items-center justify-between border-b pb-4">
          <h2 className="text-lg font-semibold">Recent analyses <span className="ml-2 text-sm font-normal text-muted-foreground">{data.length}</span></h2>
          <span className="font-mono text-[10px] uppercase text-muted-foreground">Latest first</span>
        </div>
        {data.length === 0 ? (
          <div className="flex flex-col items-center py-5 text-center">
            <img src={sentimentBubbles} alt="Positive, neutral and negative comment bubbles" width={1024} height={768} className="h-48 w-64 rounded-lg object-cover" />
            <h3 className="mt-5 text-xl font-semibold">Your next insight starts here</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">No saved analyses yet.</p>
            <Button asChild className="mt-5"><Link to="/analyze"><Plus />Create your first analysis</Link></Button>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {data.map((a) => {
              const s = a.stats as unknown as AnalysisStats;
              return <Link key={a.id} to="/analysis/$id" params={{ id: a.id }} className="group rounded-lg border bg-card p-5 transition hover:border-primary">
                <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                  <span className="rounded bg-secondary px-2 py-1 font-medium text-secondary-foreground">{SOURCE_LABELS[a.source as SourceType] ?? "Archived source"}</span>
                  <span>{new Date(a.created_at).toLocaleDateString()}</span>
                </div>
                <div className="mt-4 flex items-start justify-between gap-3"><h3 className="line-clamp-2 font-semibold group-hover:text-primary">{a.title}</h3><ArrowUpRight size={17} className="shrink-0 text-muted-foreground group-hover:text-primary" /></div>
                <p className="mt-1 text-xs text-muted-foreground">{s.total.toLocaleString()} comments</p>
                <div className="mt-5 flex h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="bg-positive" style={{ width: `${pct(s.positive, s.total)}%` }} />
                  <div className="bg-neutral" style={{ width: `${pct(s.neutral, s.total)}%` }} />
                  <div className="bg-negative" style={{ width: `${pct(s.negative, s.total)}%` }} />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-positive" />{pct(s.positive, s.total)}% positive</span>
                  <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-neutral" />{pct(s.neutral, s.total)}% neutral</span>
                  <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-negative" />{pct(s.negative, s.total)}% negative</span>
                </div>
              </Link>;
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
