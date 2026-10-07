import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
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
      { title: "Dashboard — Sentiment Lab" },
      { name: "description", content: "Your saved sentiment analyses of real YouTube, TikTok and CSV comments." },
      { property: "og:title", content: "Sentiment Lab — Dashboard" },
      { property: "og:description", content: "Saved VADER sentiment analyses with AI-assisted insights." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(analysesQuery),
  component: Index,
});

function Index() {
  const { data } = useSuspenseQuery(analysesQuery);
  return (
    <AppShell>
      <section className="mb-10 grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">AI for Data Analysis & Insights · Week 3</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight md:text-5xl">What is the audience really saying?</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Import real comments from YouTube, TikTok exports, CSV files or pasted text. Every comment is scored with VADER, then summarised with AI-assisted insights.
          </p>
        </div>
        <div className="flex gap-3 md:justify-end">
          <Button asChild size="lg"><Link to="/analyze">New analysis</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/project">How it works</Link></Button>
        </div>
      </section>

      <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">Saved analyses ({data.length})</h2>
      {data.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          No analyses yet. <Link to="/analyze" className="font-medium text-primary underline">Import your first comments</Link>.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((a) => {
            const s = a.stats as unknown as AnalysisStats;
            return (
              <Link key={a.id} to="/analysis/$id" params={{ id: a.id }} className="group rounded-lg border bg-card p-5 transition hover:border-primary">
                <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  <span>{SOURCE_LABELS[a.source as SourceType] ?? a.source}</span>
                  <span>{new Date(a.created_at).toLocaleDateString()}</span>
                </div>
                <h3 className="mt-2 line-clamp-2 font-semibold group-hover:text-primary">{a.title}</h3>
                <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted">
                  <div className="bg-positive" style={{ width: `${pct(s.positive, s.total)}%` }} />
                  <div className="bg-neutral" style={{ width: `${pct(s.neutral, s.total)}%` }} />
                  <div className="bg-negative" style={{ width: `${pct(s.negative, s.total)}%` }} />
                </div>
                <div className="mt-2 flex justify-between font-mono text-xs text-muted-foreground">
                  <span>{s.total} comments</span>
                  <span>avg {s.avgCompound.toFixed(3)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
