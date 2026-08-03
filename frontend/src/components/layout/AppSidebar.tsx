import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Mic, Radio, MessageSquare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/voice-agent", label: "Voice Agents", icon: Mic },
  { to: "/active-demos", label: "Demo Requests", icon: Radio },
  { to: "/feedback", label: "Feedback", icon: MessageSquare },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-7">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold text-xs uppercase tracking-tight shadow-lg shadow-primary/25">
          DQ
          <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight tracking-tight">DataQuartz</p>
          <p className="text-[11px] leading-tight text-sidebar-foreground/55">AI Demo Automation</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/40">
          Workspace
        </p>
        {nav.map((item) => {
          const active =
            item.to === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-primary/15"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              {active && (
                <span className="console-active-rail absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full" />
              )}
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  active ? "text-primary" : "text-sidebar-foreground/55 group-hover:text-sidebar-foreground",
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
