import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ThumbsUp, ThumbsDown, RefreshCw, Search } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { listAllFeedback, type DemoFeedbackWithLead } from "@/lib/api";
import { cn } from "@/lib/utils";

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
      <div className="space-y-3 p-6">
        <div className="grid grid-cols-3 gap-px border bg-border">
          <Stat label="Total" value={rows.length} loading={loading} />
          <Stat label="Accurate" value={positive} loading={loading} tone="success" />
          <Stat label="Needs tweaks" value={negative} loading={loading} tone="destructive" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search company, industry, comment"
              className="w-full border bg-card py-1.5 pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <select
            value={rating}
            onChange={(e) => setRating(e.target.value as RatingFilter)}
            className="border bg-card px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
          >
            <option value="all">All ratings</option>
            <option value="positive">Accurate</option>
            <option value="negative">Needs tweaks</option>
          </select>
          <button
            onClick={load}
            className="flex items-center gap-1.5 border bg-card px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            Refresh
          </button>
          <div className="ml-auto text-xs tabular-nums text-muted-foreground">
            {filtered.length} / {rows.length}
          </div>
        </div>

        {error ? (
          <div className="border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : loading && rows.length === 0 ? (
          <div className="border bg-card p-8 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="border bg-card p-8 text-center text-sm text-muted-foreground">
            No feedback yet.
          </div>
        ) : (
          <ul className="divide-y border bg-card">
            {filtered.map((r) => (
              <li key={r.id} className="flex gap-3 p-3">
                <span
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                    r.rating === "positive"
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-destructive/40 bg-destructive/10 text-destructive",
                  )}
                  aria-hidden="true"
                >
                  {r.rating === "positive" ? (
                    <ThumbsUp className="h-3 w-3" />
                  ) : (
                    <ThumbsDown className="h-3 w-3" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium">{r.company_name}</span>
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
  tone,
}: {
  label: string;
  value: number;
  loading: boolean;
  tone?: "success" | "destructive";
}) {
  return (
    <div className="bg-card px-3 py-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "success" && "text-success",
          tone === "destructive" && "text-destructive",
        )}
      >
        {loading ? "—" : value}
      </div>
    </div>
  );
}
