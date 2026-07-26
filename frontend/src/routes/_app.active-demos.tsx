import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Search, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { StatusBadge, statusToTone } from "@/components/common/StatusBadge";
import { LeadDetailDrawer } from "@/components/common/LeadDetailDrawer";
import { listLeads, type LeadResponse } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/active-demos")({
  head: () => ({ meta: [{ title: "Demos — DataQuartz" }] }),
  component: ActiveDemos,
});

type StatusFilter = "all" | LeadResponse["agent_status"];

/**
 * Internal demo list, backed by GET /api/leads.
 *
 * Previously rendered mock rows from lib/mock-data with columns the backend has
 * no source for — product, research status, view counts, call counts, expiry
 * dates. Those columns are gone rather than zero-filled: a column of zeros reads
 * as "nobody used it" instead of "we don't track this". Every column below maps
 * to a real field on the lead record.
 */
function ActiveDemos() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<LeadResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<LeadResponse | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setLeads(await listLeads({ limit: 100 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load demos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return leads.filter((l) => {
      if (filter !== "all" && l.agent_status !== filter) return false;
      if (!needle) return true;
      return (
        l.company_name.toLowerCase().includes(needle) ||
        l.industry.toLowerCase().includes(needle) ||
        l.contact_email.toLowerCase().includes(needle)
      );
    });
  }, [leads, q, filter]);

  const copyLink = (lead: LeadResponse) => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/demo-preview?assistant_id=${lead.assistant_id ?? ""}&lead_id=${lead.id}`;
    navigator.clipboard.writeText(url);
    toast.success(`Link copied — ${lead.company_name}`);
  };

  return (
    <>
      <TopNav title="Demos" />
      <div className="space-y-3 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search company, industry, email"
              className="w-full border bg-card py-1.5 pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as StatusFilter)}
            className="border bg-card px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
          </select>
          <button
            onClick={load}
            className="flex items-center gap-1.5 border bg-card px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            Refresh
          </button>
          <div className="ml-auto text-xs tabular-nums text-muted-foreground">
            {rows.length} / {leads.length}
          </div>
        </div>

        {error ? (
          <div className="border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <div className="border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Company</th>
                  <th className="px-3 py-2 font-medium">Industry</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Qualified</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                  <th className="w-20 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {loading && leads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      No demos match.
                    </td>
                  </tr>
                ) : (
                  rows.map((l) => (
                    <tr
                      key={l.id}
                      onClick={() => setSelected(l)}
                      className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium">{l.company_name}</div>
                        <div className="text-xs text-muted-foreground">{l.contact_email}</div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{l.industry}</td>
                      <td className="px-3 py-2">
                        <StatusBadge tone={statusToTone(l.agent_status)}>
                          {l.agent_status}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {l.qualified === null || l.qualified === undefined
                          ? "—"
                          : l.qualified
                            ? "Yes"
                            : "No"}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {formatDate(l.created_at)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyLink(l);
                            }}
                            aria-label={`Copy demo link for ${l.company_name}`}
                            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            disabled={!l.assistant_id}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate({
                                to: "/demo-preview",
                                search: { assistant_id: l.assistant_id ?? "", lead_id: l.id },
                              });
                            }}
                            aria-label={`Open demo for ${l.company_name}`}
                            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <LeadDetailDrawer
        lead={selected}
        onClose={() => setSelected(null)}
        onAgentDeleted={load}
      />
    </>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
