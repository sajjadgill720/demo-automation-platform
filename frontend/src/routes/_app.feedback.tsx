import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ThumbsUp, ThumbsDown, RefreshCw, Search, MessagesSquare } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { listAllFeedback, type DemoFeedbackWithLead } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_app/feedback")({
  head: () => ({ meta: [{ title: "Client feedback — DataQuartz" }] }),
  component: FeedbackPage,
});

type RatingFilter = "all" | "positive" | "negative";

/**
 * Internal view of feedback clients submitted from their demo preview.
 *
 * The same records are shown back to the client on their own preview page, so
 * both sides see identical text — this is not a private internal-only note
 * field.
 */
function FeedbackPage() {
  const [rows, setRows] = useState<DemoFeedbackWithLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState<RatingFilter>("all");
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listAllFeedback({ limit: 200 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feedback.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (rating !== "all" && r.rating !== rating) return false;
      if (!needle) return true;
      return (
        r.company_name.toLowerCase().includes(needle) ||
        r.industry.toLowerCase().includes(needle) ||
        (r.comment ?? "").toLowerCase().includes(needle)
      );
    });
  }, [rows, rating, q]);

  const positive = rows.filter((r) => r.rating === "positive").length;
  const negative = rows.length - positive;

  return (
    <>
      <TopNav title="Client feedback" />
      <div className="console-page-glow flex-1 space-y-6 p-6">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Total" value={rows.length} loading={loading} icon={MessagesSquare} tone="primary" />
          <Stat label="Accurate" value={positive} loading={loading} icon={ThumbsUp} tone="success" />
          <Stat label="Needs tweaks" value={negative} loading={loading} icon={ThumbsDown} tone="destructive" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search company, industry, comment"
              className="w-full rounded-lg border border-border/80 bg-card py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-shadow"
            />
          </div>
          <Select
            value={rating}
            onValueChange={(val) => setRating(val as RatingFilter)}
          >
            <SelectTrigger className="w-[140px] border-0 bg-card px-2.5 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 cursor-pointer btn-themed-shadow transition-all duration-200 hover:-translate-y-[1px] active:translate-y-0">
              <SelectValue placeholder="All ratings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ratings</SelectItem>
              <SelectItem value="positive">Accurate</SelectItem>
              <SelectItem value="negative">Needs tweaks</SelectItem>
            </SelectContent>
          </Select>
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-card px-2.5 py-2 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground cursor-pointer transition-colors"
          >
            <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            Refresh
          </button>
          <div className="ml-auto text-xs tabular-nums text-muted-foreground">
            {filtered.length} / {rows.length}
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : loading && rows.length === 0 ? (
          <div className="console-card-glass p-10 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="console-card-glass p-10 text-center text-sm text-muted-foreground">
            No feedback yet.
          </div>
        ) : (
          <ul className="console-card-glass divide-y divide-border/60 overflow-hidden">
            {filtered.map((r) => (
              <li key={r.id} className="flex gap-3 p-4 transition-colors hover:bg-muted/30">
                <span
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1 ring-inset console-stat-glow-ring",
                    r.rating === "positive"
                      ? "bg-success/10 text-success ring-success/25"
                      : "bg-destructive/10 text-destructive ring-destructive/25",
                  )}
                  aria-hidden="true"
                >
                  {r.rating === "positive" ? (
                    <ThumbsUp className="h-3.5 w-3.5" />
                  ) : (
                    <ThumbsDown className="h-3.5 w-3.5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-sm font-semibold">{r.company_name}</span>
                    <span className="text-xs text-muted-foreground">{r.industry}</span>
                    <time
                      dateTime={r.created_at}
                      className="ml-auto text-xs tabular-nums text-muted-foreground"
                    >
                      {new Date(r.created_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  {r.comment ? (
                    <p className="mt-1 text-sm leading-relaxed text-foreground/85">{r.comment}</p>
                  ) : (
                    <p className="mt-1 text-sm italic text-muted-foreground">No comment</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  loading,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  loading: boolean;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "success" | "destructive";
}) {
  const toneCls =
    tone === "success"
      ? "bg-success/10 text-success ring-success/20"
      : tone === "destructive"
        ? "bg-destructive/10 text-destructive ring-destructive/20"
        : "bg-primary/10 text-primary ring-primary/20";
  return (
    <div className="console-card-glass console-card-interactive p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-inset console-stat-glow-ring", toneCls)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div
        className={cn(
          "mt-2 text-3xl font-semibold tabular-nums tracking-tight",
          tone === "success" && "text-success",
          tone === "destructive" && "text-destructive",
        )}
      >
        {loading ? "—" : value}
      </div>
    </div>
  );
}
