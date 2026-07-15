import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Search, ChevronDown, MoreHorizontal, Eye, Copy, Trash2 } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge, statusToTone } from "@/components/common/StatusBadge";
import { CompanyCard } from "@/components/common/CompanyCard";
import { demoJobs as defaultDemoJobs, type DemoJob } from "@/lib/mock-data";
import { getStoredDemos, saveDemos, addActivity } from "@/lib/db";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/active-demos")({
  head: () => ({
    meta: [{ title: "Active demos — DataQuartz" }],
  }),
  component: ActiveDemos,
});

type SortKey = "created" | "views" | "calls";

function ActiveDemos() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<DemoJob[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("created");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // Sync with local storage safely to prevent SSR hydration mismatches
  useEffect(() => {
    setJobs(getStoredDemos());

    const handleDemosUpdate = () => {
      setJobs(getStoredDemos());
    };
    window.addEventListener("dq-demos-updated", handleDemosUpdate);
    return () => {
      window.removeEventListener("dq-demos-updated", handleDemosUpdate);
    };
  }, []);

  const handleArchiveDemo = (id: string, companyName: string) => {
    const updated = jobs.filter((j) => j.id !== id);
    saveDemos(updated);
    addActivity(companyName, "archived this demo generation job", "warning");
    toast.success(`Demo job for ${companyName} archived.`);
    setOpenMenu(null);
  };

  const handleCopyLink = (companyName: string) => {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      navigator.clipboard.writeText(`${origin}/demo-preview`);
      toast.success(`Copied sharing link for ${companyName}!`);
      setOpenMenu(null);
    }
  };

  const rows = useMemo(() => {
    let r = jobs.filter((d) => d.company.name.toLowerCase().includes(q.toLowerCase()));
    if (filter !== "all") r = r.filter((d) => d.status === filter);
    r = [...r].sort((a, b) => {
      if (sort === "views") return b.views - a.views;
      if (sort === "calls") return b.calls - a.calls;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return r;
  }, [jobs, q, filter, sort]);

  const columns: Column<DemoJob>[] = [
    { key: "company", header: "Company", render: (r) => <CompanyCard company={r.company} /> },
    {
      key: "product",
      header: "Product",
      render: (r) => <span className="text-sm">{r.product}</span>,
    },
    {
      key: "agent",
      header: "Agent",
      render: (r) => <StatusBadge tone={statusToTone(r.agentStatus)}>{r.agentStatus}</StatusBadge>,
    },
    {
      key: "research",
      header: "Research",
      render: (r) => (
        <StatusBadge tone={statusToTone(r.researchStatus)}>{r.researchStatus}</StatusBadge>
      ),
    },
    {
      key: "created",
      header: "Created",
      render: (r) => (
        <span className="text-sm text-muted-foreground">{formatDate(r.createdAt)}</span>
      ),
    },
    {
      key: "expires",
      header: "Expires",
      render: (r) => (
        <span className="text-sm text-muted-foreground">{formatDate(r.expiresAt)}</span>
      ),
    },
    { key: "views", header: "Views", className: "text-right tabular-nums", render: (r) => r.views },
    { key: "calls", header: "Calls", className: "text-right tabular-nums", render: (r) => r.calls },
    {
      key: "actions",
      header: "",
      className: "w-8 relative",
      render: (r) => (
        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === r.id ? null : r.id)}
            aria-label="Demo actions"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {openMenu === r.id && (
            <div className="absolute right-0 top-8 z-10 w-44 overflow-hidden rounded-lg border bg-popover shadow-md py-1">
              <MenuItem
                icon={Eye}
                onClick={() => {
                  setOpenMenu(null);
                  navigate({ to: "/demo-preview" });
                }}
              >
                View demo
              </MenuItem>
              <MenuItem icon={Copy} onClick={() => handleCopyLink(r.company.name)}>
                Copy demo link
              </MenuItem>
              <MenuItem
                icon={Trash2}
                danger
                onClick={() => handleArchiveDemo(r.id, r.company.name)}
              >
                Archive demo
              </MenuItem>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <TopNav title="Active demos" />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search company"
              className="w-full rounded-lg border bg-card py-1.5 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Select
            value={filter}
            onChange={setFilter}
            options={[
              { v: "all", l: "All stages" },
              { v: "research", l: "Research" },
              { v: "prompt", l: "Prompt configuration" },
              { v: "agent", l: "Vapi Agent" },
              { v: "ready", l: "Demo ready" },
              { v: "sent", l: "Sent" },
              { v: "completed", l: "Completed" },
            ]}
          />
          <Select
            value={sort}
            onChange={(v) => setSort(v as SortKey)}
            options={[
              { v: "created", l: "Newest" },
              { v: "views", l: "Most views" },
              { v: "calls", l: "Most calls" },
            ]}
          />
          <div className="ml-auto text-xs text-muted-foreground">
            {rows.length} of {jobs.length}
          </div>
        </div>

        <DataTable rows={rows} columns={columns} />
      </div>
    </>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border bg-card py-1.5 pl-3 pr-8 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function MenuItem({
  icon: Icon,
  children,
  danger,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted cursor-pointer transition-colors ${
        danger ? "text-destructive hover:bg-destructive/5" : "text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
