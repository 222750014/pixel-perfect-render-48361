import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createAnalysis, fetchYouTubeComments } from "@/lib/analysis.functions";
import { SOURCE_LABELS, type RawComment, type SourceType } from "@/lib/sentiment";

export const Route = createFileRoute("/analyze")({
  head: () => ({
    meta: [
      { title: "Analyze comments — Sentiment Lab" },
      { name: "description", content: "Import comments from YouTube, TikTok CSV exports, CSV files or manual text and run VADER sentiment analysis." },
      { property: "og:title", content: "Analyze comments — Sentiment Lab" },
      { property: "og:description", content: "Import real comments and classify their sentiment with VADER." },
    ],
  }),
  component: AnalyzePage,
});

const TEXT_COLS = ["comment", "text", "message", "content", "body", "comment_text"];
const DATE_COLS = ["date", "published_at", "created_at", "timestamp", "time", "create_time"];
const AUTHOR_COLS = ["author", "username", "user", "name", "nickname"];

function pick(fields: string[], wanted: string[]) {
  return fields.find((f) => wanted.includes(f.trim().toLowerCase()));
}

function AnalyzePage() {
  const navigate = useNavigate();
  const create = useServerFn(createAnalysis);
  const fetchYT = useServerFn(fetchYouTubeComments);
  const [busy, setBusy] = useState(false);
  const [ytUrl, setYtUrl] = useState("");
  const [ytMax, setYtMax] = useState(300);
  const [manual, setManual] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [csv, setCsv] = useState<{ name: string; rows: RawComment[]; column: string; source: SourceType } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(title: string, source: SourceType, sourceRef: string | null, comments: RawComment[]) {
    setBusy(true); setError(null);
    try {
      const res = await create({ data: { title, source, sourceRef, comments: comments.slice(0, 5000) } });
      if (res.error || !res.id) { setError(res.error ?? "Analysis failed."); return; }
      toast.success("Analysis complete");
      navigate({ to: "/analysis/$id", params: { id: res.id } });
    } catch (e) {
      console.error(e); setError("Network error. Please try again.");
    } finally { setBusy(false); }
  }

  async function runYouTube() {
    setBusy(true); setError(null);
    try {
      const r = await fetchYT({ data: { url: ytUrl, max: ytMax } });
      if (r.error) { setError(r.error); setBusy(false); return; }
      await run(r.title ?? `YouTube ${r.videoId}`, "youtube", `https://youtu.be/${r.videoId}`, r.comments);
    } catch (e) { console.error(e); setError("Network error."); setBusy(false); }
  }

  function onFile(file: File, source: SourceType) {
    setError(null); setCsv(null);
    if (!file.name.toLowerCase().endsWith(".csv")) { setError("Invalid file format — please upload a .csv file."); return; }
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const fields = res.meta.fields ?? [];
        const col = pick(fields, TEXT_COLS);
        if (!col) { setError(`Missing comment column. Expected one of: ${TEXT_COLS.join(", ")}. Found: ${fields.join(", ") || "none"}.`); return; }
        const dc = pick(fields, DATE_COLS); const ac = pick(fields, AUTHOR_COLS);
        const rows = res.data.map((r) => ({ text: r[col] ?? "", published_at: dc ? r[dc] : null, author: ac ? r[ac] : null }))
          .filter((r) => r.text.trim());
        if (!rows.length) { setError("Empty dataset — no comments found in that column."); return; }
        setCsv({ name: file.name, rows, column: col, source });
      },
      error: () => setError("Invalid CSV — the file could not be parsed."),
    });
  }

  const csvPanel = (source: SourceType) => (
    <div className="space-y-4">
      <Input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0], source)} />
      {csv && csv.source === source && (
        <div className="rounded-md border bg-muted/40 p-4">
          <p className="text-sm"><b>{csv.rows.length}</b> comments found in <code className="font-mono">{csv.column}</code> column of {csv.name}.</p>
          <ul className="mt-3 max-h-48 space-y-1 overflow-auto text-sm text-muted-foreground">
            {csv.rows.slice(0, 8).map((r, i) => <li key={i} className="truncate">• {r.text}</li>)}
          </ul>
          <Button className="mt-4" disabled={busy} onClick={() => run(csv.name.replace(/\.csv$/i, ""), source, csv.name, csv.rows)}>
            {busy ? "Analyzing…" : `Analyze ${csv.rows.length} comments`}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <AppShell>
      <h1 className="text-3xl font-bold tracking-tight">Analyze comments</h1>
      <p className="mt-1 text-muted-foreground">Choose a data source. The source is recorded and shown with every analysis.</p>

      <Tabs defaultValue="youtube" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="youtube">YouTube</TabsTrigger>
          <TabsTrigger value="tiktok">TikTok</TabsTrigger>
          <TabsTrigger value="csv">CSV upload</TabsTrigger>
          <TabsTrigger value="manual">Manual input</TabsTrigger>
        </TabsList>

        <div className="mt-4 rounded-lg border bg-card p-6">
          <TabsContent value="youtube" className="mt-0 space-y-4">
            <p className="text-sm text-muted-foreground">Fetches public top-level comments via the official <b>YouTube Data API v3</b> (requires a configured API key).</p>
            <div className="grid gap-4 md:grid-cols-[1fr_160px]">
              <div><Label>Video URL or ID</Label><Input value={ytUrl} onChange={(e) => setYtUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" /></div>
              <div><Label>Max comments</Label><Input type="number" min={10} max={1000} value={ytMax} onChange={(e) => setYtMax(Math.max(10, Math.min(1000, +e.target.value || 100)))} /></div>
            </div>
            <Button disabled={busy || !ytUrl.trim()} onClick={runYouTube}>{busy ? "Fetching & analyzing…" : "Fetch & analyze"}</Button>
          </TabsContent>

          <TabsContent value="tiktok" className="mt-0 space-y-4">
            <div className="rounded-md border border-accent bg-accent/30 p-4 text-sm">
              <b>TikTok API status: not connected.</b> TikTok only provides comment data through its Research API, which requires an approved application. This app does not scrape TikTok. Export your comments to CSV (e.g. from TikTok's data download or an approved tool) and upload them here — they'll be labelled “{SOURCE_LABELS.tiktok_csv}”.
            </div>
            {csvPanel("tiktok_csv")}
          </TabsContent>

          <TabsContent value="csv" className="mt-0 space-y-4">
            <p className="text-sm text-muted-foreground">Upload a CSV with a column named <code className="font-mono">comment</code>, <code className="font-mono">text</code> or <code className="font-mono">message</code>. Optional <code className="font-mono">date</code> and <code className="font-mono">author</code> columns enable the timeline.</p>
            {csvPanel("csv")}
          </TabsContent>

          <TabsContent value="manual" className="mt-0 space-y-4">
            <div><Label>Dataset name</Label><Input value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} placeholder="e.g. Product launch feedback" /></div>
            <div><Label>Comments (one per line)</Label><Textarea rows={10} value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Paste real comments here, one per line" /></div>
            <Button disabled={busy || !manual.trim()} onClick={() => run(manualTitle.trim() || "Manual input", "manual", null, manual.split("\n").map((text) => ({ text })))}>
              {busy ? "Analyzing…" : `Analyze ${manual.split("\n").filter((l) => l.trim()).length} comments`}
            </Button>
          </TabsContent>

          {error && <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        </div>
      </Tabs>
    </AppShell>
  );
}
