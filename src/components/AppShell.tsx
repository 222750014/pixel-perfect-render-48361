import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Activity, LayoutDashboard, Plus, BookOpen, ArrowUpRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analysesQuery } from "@/lib/queries";
import type { AnalysisStats } from "@/lib/sentiment";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/analyze", label: "New analysis", icon: Plus },
  { to: "/project", label: "Docs & methods", icon: BookOpen },
] as const;

function pageLabel(pathname: string) {
  if (pathname.startsWith("/analysis/")) return "Analysis report";
  if (pathname.startsWith("/analyze")) return "New analysis";
  if (pathname.startsWith("/project")) return "Docs & methods";
  return "Dashboard";
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: recent } = useQuery(analysesQuery);
  const page = pageLabel(pathname);
  return (
    <div className="app-layout min-h-screen bg-background">
      <aside className="app-sidebar no-print border-sidebar-border bg-sidebar text-sidebar-foreground">
        <Link to="/" className="flex items-center gap-2.5 whitespace-nowrap px-2 text-[17px] font-semibold">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><Activity size={19} /></span>
          <span>Sentiment Lab</span>
        </Link>

        <Button asChild className="sidebar-cta mt-8 h-10 w-full shadow-sm"><Link to="/analyze"><Plus />New analysis</Link></Button>

        <p className="sidebar-caption eyebrow mt-8 px-3">Menu</p>
        <nav aria-label="Main navigation" className="sidebar-nav mt-2 flex flex-col gap-1">
          {NAV.map((n) => (
            <Button key={n.to} asChild variant="ghost" className="h-10 justify-start rounded-lg px-3 font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground">
              <Link to={n.to} activeOptions={{ exact: true }} activeProps={{ className: "bg-sidebar-accent !text-sidebar-accent-foreground" }}><n.icon size={18} />{n.label}</Link>
            </Button>
          ))}
        </nav>

        {recent && recent.length > 0 && (
          <div className="sidebar-recent mt-8">
            <p className="eyebrow px-3">Recent analyses</p>
            <ul className="mt-2 flex flex-col gap-0.5">
              {recent.slice(0, 5).map((a) => {
                const s = a.stats as unknown as AnalysisStats;
                return (
                  <li key={a.id}>
                    <Link to="/analysis/$id" params={{ id: a.id }} activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-sidebar-foreground/75 hover:bg-muted hover:text-sidebar-foreground">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${dominantTone(s)}`} />
                      <span className="truncate">{a.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="sidebar-bottom mt-auto rounded-xl border border-sidebar-border bg-muted/50 p-4">
          <div className="flex items-center gap-2 text-xs font-medium"><span className="h-2 w-2 rounded-full bg-positive" />AI sentiment model active</div>
          <Link to="/project" className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">Methodology & limitations<ArrowUpRight size={13} /></Link>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/80 px-6 backdrop-blur lg:px-10">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">Sentiment Lab</Link>
            <ChevronRight size={14} />
            <span className="font-medium text-foreground">{page}</span>
          </nav>
          {pathname !== "/analyze" && (
            <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex"><Link to="/analyze"><Plus />New analysis</Link></Button>
          )}
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-5 py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

/** Color of the sentiment with the largest share (ties favor neutral). */
function dominantTone(s: Pick<AnalysisStats, "positive" | "neutral" | "negative">) {
  if (s.positive > s.neutral && s.positive > s.negative) return "bg-positive";
  if (s.negative > s.neutral && s.negative > s.positive) return "bg-negative";
  return "bg-neutral";
}

export function SentimentDot({ label }: { label: string }) {
  const cls = label === "Positive" ? "bg-positive" : label === "Negative" ? "bg-negative" : "bg-neutral";
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />;
}
