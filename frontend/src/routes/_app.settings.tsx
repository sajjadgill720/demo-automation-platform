import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Sun,
  Moon,
  Monitor,
  KeyRound,
  ServerCog,
  Check,
  X,
  Activity,
  RefreshCw,
  Loader2,
  LogOut,
} from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { useTheme, type ThemePreference } from "@/hooks/use-theme";
import { apiHealth, type ApiHealth } from "@/lib/api";
import { logoutPortal } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
 * What remains is only what's true today, and every control does a real thing:
 *   • Appearance — light / dark / system, actually applied and persisted, with
 *     "system" genuinely following the OS.
 *   • Backend connection — a live health probe against the API this frontend
 *     talks to, with real latency.
 *   • Voice infrastructure — a read-only view of how things are actually
 *     configured server-side (environment variables), which the dashboard
 *     cannot edit.
 *   • Session — a real sign-out that clears the portal cookie.
 */
function Settings() {
  const { preference, setPreference } = useTheme();

  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [checking, setChecking] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const checkHealth = async () => {
    setChecking(true);
    try {
      setHealth(await apiHealth());
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  // The browser Vapi call widget uses this public key; it's a real client env var,
  // so we can honestly report whether it's configured. The secret Vapi API key
  // lives only on the server and is never exposed here.
  const publicKeySet = Boolean(import.meta.env.VITE_VAPI_PUBLIC_KEY);

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await logoutPortal();
      toast.success("Signed out");
      window.location.href = "/portal";
    } catch {
      setLoggingOut(false);
      toast.error("Could not sign out. Please try again.");
    }
  };

  return (
    <>
      <TopNav title="Settings" />
      <div className="console-page-glow flex-1">
        <div className="mx-auto w-full max-w-2xl space-y-6 p-6">
          {/* Appearance */}
          <section className="console-card-glass overflow-hidden">
            <div className="console-card-header-futuristic border-b border-border/70 bg-muted/10 px-5 py-4">
              <h2 className="text-sm font-semibold pl-2">Appearance</h2>
              <p className="text-xs text-muted-foreground pl-2">
                How the dashboard looks on this device.
              </p>
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">Theme</span>
              </div>
              <div className="inline-flex overflow-hidden rounded-lg border border-border/80">
                <ThemeOption
                  current={preference}
                  value="light"
                  onSelect={setPreference}
                  icon={Sun}
                  label="Light"
                  position="left"
                />
                <ThemeOption
                  current={preference}
                  value="dark"
                  onSelect={setPreference}
                  icon={Moon}
                  label="Dark"
                  position="middle"
                />
                <ThemeOption
                  current={preference}
                  value="system"
                  onSelect={setPreference}
                  icon={Monitor}
                  label="System"
                  position="right"
                />
              </div>
            </div>
          </section>

          {/* Backend connection (live) */}
          <section className="console-card-glass overflow-hidden">
            <div className="console-card-header-futuristic flex items-center justify-between border-b border-border/70 bg-muted/10 px-5 py-4">
              <div className="pl-2">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                  <Activity className="h-4 w-4 text-muted-foreground" /> Backend connection
                </h2>
                <p className="text-xs text-muted-foreground">
                  Live status of the API this dashboard talks to.
                </p>
              </div>
              <button
                onClick={checkHealth}
                disabled={checking}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 cursor-pointer transition-all duration-200 btn-themed-shadow hover:-translate-y-[1px] active:translate-y-0"
              >
                <RefreshCw className={checking ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
                Recheck
              </button>
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "relative flex h-2.5 w-2.5 shrink-0 rounded-full",
                    checking
                      ? "bg-muted-foreground/50"
                      : health?.ok
                        ? "bg-success"
                        : "bg-destructive",
                  )}
                >
                  {!checking && health?.ok && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
                  )}
                </span>
                <div className="text-sm">
                  <div className="font-medium">
                    {checking ? "Checking…" : health?.ok ? "Connected" : "Unreachable"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {checking
                      ? "Pinging the API…"
                      : health?.ok
                        ? `Healthy · responded in ${health.latencyMs} ms`
                        : health?.error || "No response from the API."}
                  </div>
                </div>
              </div>
              {!checking &&
                (health?.ok ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                    <Check className="h-3.5 w-3.5" /> Online
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                    <X className="h-3.5 w-3.5" /> Offline
                  </span>
                ))}
            </div>
          </section>

          {/* Voice infrastructure (read-only) */}
          <section className="console-card-glass overflow-hidden">
            <div className="console-card-header-futuristic border-b border-border/70 bg-muted/10 px-5 py-4">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold pl-2">
                <ServerCog className="h-4 w-4 text-muted-foreground" /> Voice infrastructure
              </h2>
              <p className="text-xs text-muted-foreground pl-2">
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

          {/* Session */}
          <section className="console-card-glass overflow-hidden">
            <div className="console-card-header-futuristic border-b border-border/70 bg-muted/10 px-5 py-4">
              <h2 className="text-sm font-semibold pl-2">Session</h2>
              <p className="text-xs text-muted-foreground pl-2">
                You're signed in to the internal portal on this browser.
              </p>
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-sm text-muted-foreground">
                Sign out to clear this device's access.
              </span>
              <button
                onClick={handleSignOut}
                disabled={loggingOut}
                className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50 cursor-pointer transition-all duration-200 btn-themed-shadow hover:-translate-y-[1px] active:translate-y-0"
              >
                {loggingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                {loggingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </section>

          <p className="text-center text-xs text-muted-foreground">
            Team, billing and integrations aren't available yet.
          </p>
        </div>
      </div>
    </>
  );
}

function ThemeOption({
  current,
  value,
  onSelect,
  icon: Icon,
  label,
  position,
}: {
  current: ThemePreference;
  value: ThemePreference;
  onSelect: (v: ThemePreference) => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  position: "left" | "middle" | "right";
}) {
  const active = current === value;
  return (
    <button
      onClick={() => !active && onSelect(value)}
      title={`Use ${label.toLowerCase()} theme`}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium cursor-pointer transition-all duration-200 btn-themed-shadow hover:-translate-y-[1px] active:translate-y-0",
        position === "left" && "rounded-l-lg",
        position === "right" && "rounded-r-lg",
        position !== "left" && "border-l border-border/80",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
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
      <span
        className={cn("inline-flex shrink-0 items-center gap-1 text-xs font-medium", badge.cls)}
      >
        <badge.Icon className="h-3.5 w-3.5" />
        {badge.text}
      </span>
    </div>
  );
}
