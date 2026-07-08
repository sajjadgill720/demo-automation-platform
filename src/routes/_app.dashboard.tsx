import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Radio, Mic, CalendarCheck, ArrowUpRight, MoreHorizontal } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge, statusToTone } from "@/components/common/StatusBadge";
import { CompanyCard } from "@/components/common/CompanyCard";
import { DataTable, type Column } from "@/components/common/DataTable";
import { pipelineStages, type DemoJob } from "@/lib/mock-data";
import { getStoredDemos, getStoredActivity } from "@/lib/db";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — DataQuartz AI Demo Automation" },
      {
        name: "description",
        content:
          "Monitor demo generation pipelines, active voice agents, and booked meetings from the DataQuartz AI Ops dashboard.",
      },
    ],
  }),
  component: Dashboard,
});

const analyticsData = [
  { date: "Jun 28", views: 42, calls: 10 },
  { date: "Jun 29", views: 58, calls: 14 },
  { date: "Jun 30", views: 51, calls: 12 },
  { date: "Jul 01", views: 76, calls: 22 },
  { date: "Jul 02", views: 82, calls: 24 },
  { date: "Jul 03", views: 95, calls: 30 },
  { date: "Jul 04", views: 110, calls: 34 },
  { date: "Jul 05", views: 125, calls: 45 },
  { date: "Jul 06", views: 142, calls: 53 },
];

interface ActivityItem {
  id: number;
  company: string;
  action: string;
  time: string;
  tone: "success" | "warning" | "info" | "muted";
}

function Dashboard() {
  const [jobs, setJobs] = useState<DemoJob[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    // Set initial stored values (safe for client-side load)
    setJobs(getStoredDemos());
    setActivities(getStoredActivity());

    const handleDemosUpdate = () => setJobs(getStoredDemos());
    const handleActivityUpdate = () => setActivities(getStoredActivity());

    window.addEventListener("dq-demos-updated", handleDemosUpdate);
    window.addEventListener("dq-activity-updated", handleActivityUpdate);

    return () => {
      window.removeEventListener("dq-demos-updated", handleDemosUpdate);
      window.removeEventListener("dq-activity-updated", handleActivityUpdate);
    };
  }, []);

  const pipelineCount = (stage: string) => {
    return (
      jobs.filter((d) => d.status === stage).length +
      (stage === "completed"
        ? 12
        : stage === "sent"
          ? 8
          : stage === "ready"
            ? 4
            : stage === "agent"
              ? 3
              : stage === "prompt"
                ? 2
                : stage === "research"
                  ? 5
                  : 9)
    );
  };

  const handleMarkAllRead = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("dq_activity", JSON.stringify([]));
      window.dispatchEvent(new Event("dq-activity-updated"));
    }
  };

  // Dynamically calculate dashboard KPI numbers based on current jobs state
  const totalDemos = 142 + (jobs.length - 5);
  const runningJobs = jobs.filter((d) => d.researchStatus === "running").length;
  const activeVapi = jobs.filter((d) => d.agentStatus === "live").length + 20; // baseline 20
  const meetingsBooked = jobs.filter((d) => d.meetingBooked).length + 36; // baseline 36

  return (
    <>
      <TopNav
        title="Dashboard"
        actions={
          <Link
            to="/new-demo"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Sparkles className="h-3.5 w-3.5" />
            New demo
          </Link>
        }
      />
      <div className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Demos"
            value={totalDemos.toString()}
            delta="+12.4%"
            trend="up"
            icon={Sparkles}
            accent="primary"
          />
          <StatCard
            label="Running Jobs"
            value={runningJobs.toString()}
            delta="+2"
            trend="up"
            icon={Radio}
            accent="secondary"
          />
          <StatCard
            label="Active Vapi Agents"
            value={activeVapi.toString()}
            delta="+3"
            trend="up"
            icon={Mic}
            accent="success"
          />
          <StatCard
            label="Meetings Booked"
            value={meetingsBooked.toString()}
            delta="+18.9%"
            trend="up"
            icon={CalendarCheck}
            accent="warning"
          />
        </div>

        {/* Dynamic Analytics & Visualization Graph */}
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2 rounded-xl border bg-card p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-foreground">Performance analytics</h2>
              <p className="text-xs text-muted-foreground">
                Prospect views and calls over the last 9 days
              </p>
            </div>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={analyticsData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--color-border)"
                  />
                  <XAxis
                    dataKey="date"
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card)",
                      borderColor: "var(--color-border)",
                      borderRadius: "0.5rem",
                      fontSize: "12px",
                      color: "var(--color-foreground)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorViews)"
                    name="Views"
                  />
                  <Area
                    type="monotone"
                    dataKey="calls"
                    stroke="var(--color-success)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCalls)"
                    name="Calls"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Pipeline health</h2>
              <p className="text-xs text-muted-foreground">Demo generator pipeline distribution</p>
              <div className="mt-4 space-y-3.5">
                {pipelineStages.map((stage) => {
                  const count = pipelineCount(stage.id);
                  const max = 25;
                  const percentage = Math.min(100, Math.round((count / max) * 100));
                  return (
                    <div key={stage.id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-foreground">{stage.label}</span>
                        <span className="text-muted-foreground">{count}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            stage.id === "completed" && "bg-success",
                            stage.id === "ready" && "bg-primary",
                            stage.id === "research" && "bg-warning",
                            "bg-primary/60",
                          )}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Pipeline overview</h2>
              <p className="text-xs text-muted-foreground">Live counts across every demo stage</p>
            </div>
            <StatusBadge tone="success">All systems operational</StatusBadge>
          </div>
          <div className="flex items-stretch gap-2 overflow-x-auto">
            {pipelineStages.map((stage, i) => (
              <div key={stage.id} className="flex items-center gap-2">
                <div className="min-w-[124px] rounded-lg border bg-background px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {stage.label}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                    {pipelineCount(stage.id)}
                  </p>
                </div>
                {i < pipelineStages.length - 1 && <div className="h-px w-4 bg-border" />}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Recent demo jobs</h2>
              <Link
                to="/active-demos"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <DataTable<DemoJob> rows={jobs.slice(0, 5)} columns={jobColumns} />
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear activities
              </button>
            </div>
            <div className="rounded-xl border bg-card shadow-sm max-h-[360px] overflow-y-auto">
              {activities.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No recent activities.
                </div>
              ) : (
                <ul className="divide-y">
                  {activities.map((a) => (
                    <li key={a.id} className="flex gap-3 p-4">
                      <div
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          a.tone === "success" && "bg-success",
                          a.tone === "warning" && "bg-warning",
                          a.tone === "info" && "bg-primary",
                          a.tone === "muted" && "bg-muted-foreground/40",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground">
                          <span className="font-medium">{a.company}</span>{" "}
                          <span className="text-muted-foreground">{a.action}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{a.time}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const jobColumns: Column<DemoJob>[] = [
  {
    key: "company",
    header: "Company",
    render: (r) => <CompanyCard company={r.company} />,
  },
  {
    key: "product",
    header: "Product",
    render: (r) => <span className="text-sm text-foreground">{r.product}</span>,
  },
  {
    key: "status",
    header: "Stage",
    render: (r) => (
      <StatusBadge tone={statusToTone(r.status)}>
        {r.status[0].toUpperCase() + r.status.slice(1)}
      </StatusBadge>
    ),
  },
  {
    key: "views",
    header: "Views",
    className: "text-right tabular-nums",
    render: (r) => <span className="text-sm">{r.views}</span>,
  },
  {
    key: "calls",
    header: "Calls",
    className: "text-right tabular-nums",
    render: (r) => <span className="text-sm">{r.calls}</span>,
  },
  {
    key: "actions",
    header: "",
    className: "w-8",
    render: (r) => (
      <Link
        to="/voice-agent"
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground inline-block"
      >
        <MoreHorizontal className="h-4 w-4" />
      </Link>
    ),
  },
];
