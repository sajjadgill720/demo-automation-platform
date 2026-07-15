import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, PlusCircle, Mic, Radio, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/new-demo", label: "New Demo", icon: PlusCircle },
  { to: "/voice-agent", label: "Voice Agents", icon: Mic },
  { to: "/active-demos", label: "Active Demos", icon: Radio },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex items-center gap-2 px-5 pt-6 pb-8">
        <div className="h-8 w-8 rounded border border-dashed border-amber-500/60 dark:border-amber-500/40 flex items-center justify-center bg-amber-500/5 text-amber-500 font-bold text-xs uppercase tracking-tight shadow-sm shadow-amber-500/10 shrink-0">
          DQ
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">DataQuartz</p>
          <p className="text-[11px] leading-tight text-sidebar-foreground/60">AI Demo Automation</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const active =
            item.to === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-sm font-semibold">
            EM
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">Elena Marchetti</p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">elena@dataquartz.ai</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
