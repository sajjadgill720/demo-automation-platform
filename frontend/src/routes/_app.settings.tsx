import { createFileRoute } from "@tanstack/react-router";
import { Sun, Moon, Monitor, KeyRound, ServerCog, Check, X } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — DataQuartz" }] }),
  component: Settings,
});

/**
 * Settings.
 *
 * Previously five tabs of fabricated enterprise UI — team seats with hardcoded
 * members, a billing plan with fake invoices, editable "API keys" like
 * sk_vapi_••••e04b, and TMS/CRM integration toggles — all local state and toasts,
 * with no backend behind any of it. Showing fake billing and fake teammates is
 * actively misleading, so it's gone.
 *
 * What remains is only what's true today: the appearance preference (really
 * applied and persisted) and a read-only view of how the voice infrastructure is
 * actually configured — server-side, via environment variables, not from here.
 */
function Settings() {
  const { theme, toggleTheme } = useTheme();

  // The browser Vapi call widget uses this public key; it's a real client env var,
  // so we can honestly report whether it's configured. The secret Vapi API key
  // lives only on the server and is never exposed here.
  const publicKeySet = Boolean(import.meta.env.VITE_VAPI_PUBLIC_KEY);

  return (
    <>
      <TopNav title="Settings" />
      <div className="mx-auto w-full max-w-2xl space-y-6 p-6">
        {/* Appearance */}
        <section className="console-card overflow-hidden">
          <div className="border-b border-border/70 bg-muted/30 px-4 py-3">
            <h2 className="text-sm font-semibold">Appearance</h2>
            <p className="text-xs text-muted-foreground">How the dashboard looks on this device.</p>
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2 text-sm">
              {theme === "dark" ? (
                <Moon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Sun className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="font-medium">Theme</span>
            </div>
            <div className="inline-flex overflow-hidden rounded-lg border border-border/80">
              <button
                onClick={() => theme !== "light" && toggleTheme()}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors",
                  theme === "light"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                <Sun className="h-3.5 w-3.5" /> Light
              </button>
              <button
                onClick={() => theme !== "dark" && toggleTheme()}
                className={cn(
                  "flex items-center gap-1.5 border-l border-border/80 px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors",
                  theme === "dark"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                <Moon className="h-3.5 w-3.5" /> Dark
              </button>
            </div>
          </div>
        </section>

        {/* Voice infrastructure (read-only) */}
        <section className="console-card overflow-hidden">
          <div className="border-b border-border/70 bg-muted/30 px-4 py-3">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <ServerCog className="h-4 w-4 text-muted-foreground" /> Voice infrastructure
            </h2>
            <p className="text-xs text-muted-foreground">
              Configured server-side via environment variables — not editable from the dashboard.
            </p>
          </div>
          <dl className="divide-y divide-border/60 text-sm">
            <ConfigRow
              label="Vapi API key (server)"
              icon={KeyRound}
              hint="Set as VAPI_API_KEY in the backend environment."
              status="managed"
            />
            <ConfigRow
              label="Vapi public key (browser calls)"
              icon={KeyRound}
              hint="VITE_VAPI_PUBLIC_KEY — required for the live voice test."
              status={publicKeySet ? "set" : "missing"}
            />
            <ConfigRow
              label="Agent provisioning"
              icon={ServerCog}
              hint="One Vapi agent is created automatically per generated demo."
              status="managed"
            />
          </dl>
        </section>

        <p className="text-center text-xs text-muted-foreground">
          Team, billing and integrations aren't available yet.
        </p>
      </div>
    </>
  );
}

function ConfigRow({
  label,
  hint,
  icon: Icon,
  status,
}: {
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "set" | "missing" | "managed";
}) {
  const badge = {
    set: { text: "Configured", cls: "text-success", Icon: Check },
    missing: { text: "Not set", cls: "text-destructive", Icon: X },
    managed: { text: "Server-managed", cls: "text-muted-foreground", Icon: ServerCog },
  }[status];

  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3.5">
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <div className="font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{hint}</div>
        </div>
      </div>
      <span className={cn("inline-flex shrink-0 items-center gap-1 text-xs font-medium", badge.cls)}>
        <badge.Icon className="h-3.5 w-3.5" />
        {badge.text}
      </span>
    </div>
  );
}
