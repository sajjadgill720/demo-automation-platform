import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { StatusBadge, statusToTone } from "@/components/common/StatusBadge";
import { LeadDetailDrawer } from "@/components/common/LeadDetailDrawer";
import { listLeads, type LeadResponse } from "@/lib/api";

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
            className="inline-flex items-center gap-1.5 bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Sparkles className="h-3.5 w-3.5" />
            New demo
          </Link>
        }
      />
      <div className="space-y-4 p-6">
        {error && (
          <div className="border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-px border bg-border md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Leads" value={stats.total} loading={loading} />
          <Stat label="Qualified" value={stats.qualified} loading={loading} />
          <Stat label="Live" value={stats.live} loading={loading} />
          <Stat label="Pending" value={stats.pending} loading={loading} />
          <Stat label="Failed" value={stats.failed} loading={loading} />
          <Stat label="Skipped" value={stats.skipped} loading={loading} />
        </div>

        <div className="border bg-card">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Recent leads
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={load}
                aria-label="Refresh"
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              </button>
              <Link to="/active-demos" className="text-xs text-primary hover:underline">
                View all
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Company</th>
                  <th className="px-3 py-2 font-medium">Industry</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {loading && leads.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : recent.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                      No leads yet.
                    </td>
                  </tr>
                ) : (
                  recent.map((l) => (
                    <tr
                      key={l.id}
                      onClick={() => setSelected(l)}
                      className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-3 py-2 font-medium">{l.company_name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{l.industry}</td>
                      <td className="px-3 py-2">
                        <StatusBadge tone={statusToTone(l.agent_status)}>
                          {l.agent_status}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
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

function Stat({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <div className="bg-card px-3 py-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{loading ? "—" : value}</div>
    </div>
  );
}
