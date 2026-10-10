import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Activity, LayoutGrid, MessageSquarePlus, BookOpen, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutGrid },
  { to: "/analyze", label: "Analyze comments", icon: MessageSquarePlus },
  { to: "/project", label: "Project & docs", icon: BookOpen },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-layout min-h-screen bg-background">
      <aside className="app-sidebar no-print border-sidebar-border bg-sidebar text-sidebar-foreground">
        <Link to="/" className="flex items-center gap-2 whitespace-nowrap px-1 text-[17px] font-semibold">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"><Activity size={19} /></span>
          <span>Sentiment Lab<span className="text-primary">.</span></span>
        </Link>
        <p className="sidebar-caption mt-12 px-3 font-mono text-[10px] uppercase text-muted-foreground">Workspace</p>
        <nav aria-label="Main navigation" className="sidebar-nav mt-3 flex flex-col gap-2">
          {NAV.map((n) => (
            <Button key={n.to} asChild variant="ghost" className="h-11 justify-start px-3 text-sidebar-foreground/75">
              <Link to={n.to} activeOptions={{ exact: n.to === "/" }} activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}><n.icon size={18} />{n.label}</Link>
            </Button>
          ))}
        </nav>
        <div className="sidebar-bottom mt-auto border-t border-sidebar-border pt-5">
          <div className="flex items-center gap-2 text-xs font-medium"><span className="h-2 w-2 rounded-full bg-positive" />Hugging Face RoBERTa model</div>
          <Link to="/project" className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">Methodology & limitations<ArrowUpRight size={13} /></Link>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="no-print flex h-16 items-center justify-between border-b bg-card px-6 lg:px-10">
          <span className="text-xs text-muted-foreground">Workspace <span className="mx-2 text-border">/</span><span className="font-medium text-foreground">Audience insights</span></span>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-6 w-6 rounded-full bg-secondary text-center leading-6 text-secondary-foreground">SL</span><span className="hidden sm:inline">Sentiment Lab</span></div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-5 py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

export function SentimentDot({ label }: { label: string }) {
  const cls = label === "Positive" ? "bg-positive" : label === "Negative" ? "bg-negative" : "bg-neutral";
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />;
}
