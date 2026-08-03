import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  RefreshCw,
  Users,
  BadgeCheck,
  Radio,
  Clock,
  AlertTriangle,
  MinusCircle,
  type LucideIcon,
} from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { StatusBadge, statusToTone } from "@/components/common/StatusBadge";
import { LeadDetailDrawer } from "@/components/common/LeadDetailDrawer";
import { listLeads, type LeadResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — DataQuartz" }] }),
  component: Dashboard,
});

/**
 * Internal dashboard, backed by GET /api/leads.
 *
 * Everything here is derived from real lead records. The previous version showed
 * invented figures — totals seeded with `142 + (jobs.length - 5)`, an "Active
 * Vapi Agents" count with a hardcoded +20 baseline, "Meetings Booked" with +36,
 * and fixed deltas like "+12.4%" that never changed. A 9-day performance chart
 * and an activity feed were also mock-only.
 *
 * Those are gone rather than reimplemented: the backend tracks no views, calls,
 * meetings, or historical series, so there is nothing honest to plot yet. Add the
 * metric server-side first, then surface it here.
 */
function Dashboard() {
  const [leads, setLeads] = useState<LeadResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LeadResponse | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setLeads(await listLeads({ limit: 200 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leads.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const by = (s: LeadResponse["agent_status"]) =>
      leads.filter((l) => l.agent_status === s).length;
    return {
      total: leads.length,
      pending: by("pending"),
      live: by("active") + by("completed"),
      failed: by("failed"),
      skipped: by("skipped"),
      qualified: leads.filter((l) => l.qualified === true).length,
    };
  }, [leads]);

  const recent = leads.slice(0, 8);

  return (
    <>
      <TopNav
        title="Dashboard"
        actions={
          <Link
            to="/build-demo"
            title="Create a new AI demo"
            className="console-cta inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 btn-themed-shadow transition-all duration-200 hover:-translate-y-[2px] active:translate-y-0 active:scale-[0.97]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            New demo
          </Link>
        }
      />
      <div className="space-y-6 p-6">
        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Leads" value={stats.total} loading={loading} icon={Users} tone="primary" />
          <Stat label="Qualified" value={stats.qualified} loading={loading} icon={BadgeCheck} tone="success" />
          <Stat label="Live" value={stats.live} loading={loading} icon={Radio} tone="accent" />
          <Stat label="Pending" value={stats.pending} loading={loading} icon={Clock} tone="warning" />
          <Stat label="Failed" value={stats.failed} loading={loading} icon={AlertTriangle} tone="danger" />
          <Stat label="Skipped" value={stats.skipped} loading={loading} icon={MinusCircle} tone="muted" />
        </div>

        <div className="console-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Recent leads
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={load}
                aria-label="Refresh"
                title="Refresh leads list"
                className="rounded-md p-1 text-muted-foreground hover:text-foreground cursor-pointer transition-all duration-200 btn-themed-shadow hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.95]"
              >
                <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              </button>
              <Link
                to="/active-demos"
                className="text-xs font-medium text-primary hover:underline underline-offset-2"
              >
                View all
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">Company</th>
                  <th className="px-4 py-2.5 font-semibold">Industry</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {loading && leads.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : recent.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      No leads yet.
                    </td>
                  </tr>
                ) : (
                  recent.map((l) => (
                    <tr
                      key={l.id}
                      onClick={() => setSelected(l)}
                      className="cursor-pointer border-b border-border/60 last:border-0 table-row-interactive"
                    >
                      <td className="px-4 py-3 font-medium">{l.company_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{l.industry}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={statusToTone(l.agent_status)}>
                          {l.agent_status}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {new Date(l.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <LeadDetailDrawer
        lead={selected}
        onClose={() => setSelected(null)}
        onAgentDeleted={load}
      />
    </>
  );
}

type StatTone = "primary" | "success" | "accent" | "warning" | "danger" | "muted";

const STAT_TONES: Record<StatTone, { icon: string; value: string }> = {
  primary: { icon: "bg-primary/10 text-primary ring-primary/20", value: "text-foreground" },
  success: { icon: "bg-success/10 text-success ring-success/20", value: "text-foreground" },
  accent: { icon: "bg-accent/15 text-accent ring-accent/25", value: "text-foreground" },
  warning: { icon: "bg-warning/15 text-warning ring-warning/25", value: "text-foreground" },
  danger: { icon: "bg-destructive/10 text-destructive ring-destructive/20", value: "text-foreground" },
  muted: { icon: "bg-muted text-muted-foreground ring-border", value: "text-foreground" },
};

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
  icon: LucideIcon;
  tone: StatTone;
}) {
  const t = STAT_TONES[tone];
  return (
    <div className="console-card console-card-interactive stat-hover-shimmer p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-inset", t.icon)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className={cn("mt-2 text-3xl font-semibold tabular-nums tracking-tight", t.value)}>
        {loading ? <span className="skeleton inline-block h-8 w-10 rounded" /> : value}
      </div>
    </div>
  );
}
