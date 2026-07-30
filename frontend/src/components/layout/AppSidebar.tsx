import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Mic, Radio, MessageSquare, Settings, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/voice-agent", label: "Agent Tester", icon: Mic },
  { to: "/active-demos", label: "Active Demos", icon: Radio },
  { to: "/feedback", label: "Feedback", icon: MessageSquare },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggleTheme } = useTheme();

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

      <div className="p-3">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/40 px-2.5 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/25 to-accent/25 text-sidebar-foreground text-sm font-semibold ring-1 ring-inset ring-primary/20 shrink-0">
              EM
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight">Elena Marchetti</p>
              <p className="truncate text-[11px] text-sidebar-foreground/55">elena@dataquartz.ai</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg border border-sidebar-border bg-sidebar hover:bg-sidebar-accent hover:text-primary text-sidebar-foreground transition-all duration-200 cursor-pointer shrink-0 btn-themed-shadow hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.95]"
            aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
