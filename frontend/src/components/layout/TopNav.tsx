import { Search, Sun, Moon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTheme } from "@/hooks/use-theme";
import { HelpMenu } from "@/components/layout/HelpMenu";
import { NotificationsBell } from "@/components/layout/NotificationsBell";

export function TopNav({ title, actions }: { title: string; actions?: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b bg-background/80 px-6 backdrop-blur">
      <h1 className="text-base font-semibold text-foreground">{title}</h1>
      <div className="relative ml-4 hidden max-w-sm flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search demos, companies, agents…"
          className="w-full rounded-lg border bg-card py-1.5 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        {actions}

        {/* Global Light/Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <HelpMenu />
        <NotificationsBell />
        <Link
          to="/demo-preview"
          className="hidden rounded-lg border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors md:inline-block"
        >
          View demo as client
        </Link>
      </div>
    </header>
  );
}
