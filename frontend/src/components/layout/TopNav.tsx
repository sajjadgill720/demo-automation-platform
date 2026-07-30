import { Search, Sun, Moon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTheme } from "@/hooks/use-theme";
import { HelpMenu } from "@/components/layout/HelpMenu";
import { NotificationsBell } from "@/components/layout/NotificationsBell";

export function TopNav({ title, actions }: { title: string; actions?: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border/70 bg-background/70 px-6 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <h1 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h1>
      <div className="relative ml-4 hidden max-w-sm flex-1 md:flex items-center">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
        <input
          placeholder="Search demos, companies, agents…"
          className="w-full rounded-lg border border-border/80 bg-card/70 py-2 pl-9 pr-16 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-shadow"
        />
        {/* Keyboard shortcut discovery hint */}
        <span className="kbd-chip absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
          ⌘K
        </span>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        {actions}

        {/* Global Light/Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200 cursor-pointer btn-themed-shadow hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.95]"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <HelpMenu />
        <NotificationsBell />
        <Link
          to="/demo-preview"
          title="Preview the demo as your client would see it"
          className="hidden rounded-lg border border-border/80 px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all duration-200 hover:-translate-y-[2px] active:translate-y-0 md:inline-block btn-themed-shadow"
        >
          View demo as client
        </Link>
      </div>
    </header>
  );
}
