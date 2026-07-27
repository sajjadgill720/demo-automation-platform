import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, Lock, AlertCircle } from "lucide-react";
import { loginPortal } from "@/lib/auth";
import { z } from "zod";

const portalSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/portal")({
  validateSearch: (search) => portalSearchSchema.parse(search),
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Internal Access — DataQuartz" },
    ],
  }),
  component: PortalGate,
});

function PortalGate() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const search = Route.useSearch();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setError(null);
    setLoading(true);

    try {
      const res = await loginPortal({ data: password });
      if (res.success) {
        const redirectUrl = search.redirect || "/dashboard";
        window.location.href = redirectUrl; // Force reload to apply session auth state
      } else {
        setError(res.error || "Incorrect password");
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-muted-foreground px-4 font-mono relative overflow-hidden">
      {/* Fine-line crosshatch grid backdrop */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.35]"
        style={{
          backgroundImage: [
            "linear-gradient(to right, rgba(63,63,70,0.25) 1px, transparent 1px)",
            "linear-gradient(to bottom, rgba(63,63,70,0.25) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: "64px 64px",
        }}
      />
      {/* Ambient amber glow */}
      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] bg-primary/[0.045] blur-[130px] rounded-full z-0" />

      {/* Global Page Guidelines */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="mx-auto h-full max-w-7xl relative">
          <div className="absolute left-0 top-0 h-full w-px bg-zinc-800/15 dark:bg-zinc-800/30" />
          <div className="absolute right-0 top-0 h-full w-px bg-zinc-800/15 dark:bg-zinc-800/30" />
        </div>
      </div>

      {/* Brand mark */}
      <div className="relative z-10 mb-8 flex items-center gap-3 text-white select-none">
        <div className="h-7 w-7 border border-zinc-700 flex items-center justify-center bg-zinc-900 font-bold text-xs uppercase tracking-tight">
          DQ
        </div>
        <span className="uppercase tracking-widest text-sm font-semibold">DataQuartz</span>
      </div>

      <div className="relative z-10 w-full max-w-md border-2 border-zinc-800 bg-[#0c101d]/60 backdrop-blur-md p-8 rounded-xl shadow-2xl overflow-hidden transition-all duration-300">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-primary animate-pulse" />

        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 border-2 border-zinc-800 shadow-inner shadow-primary/5">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white uppercase font-sans">
              Internal Access
            </h1>
            <p className="text-xs text-muted-foreground mt-1.5 font-sans">
              Authorized Operations Personnel Only
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <label
              htmlFor="passcode"
              className="text-xs font-semibold tracking-wider text-muted-foreground uppercase font-sans"
            >
              Enter Passcode
            </label>
            <div className="relative">
              <input
                id="passcode"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#070a13] border-2 border-zinc-800 rounded px-3.5 py-3 text-sm tracking-widest placeholder:text-zinc-700 placeholder:tracking-normal focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-white font-sans transition-all"
                required
                disabled={loading}
                autoFocus
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 rounded bg-destructive/20 border-2 border-destructive/30 p-3 text-xs text-destructive font-sans">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground hover:bg-primary hover:shadow-lg transition-all rounded-lg py-3 text-sm font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5 font-sans border-0 active:scale-98"
          >
            {loading ? (
              "Verifying..."
            ) : (
              <>
                <KeyRound className="h-3.5 w-3.5" />
                Authenticate
              </>
            )}
          </button>
        </form>
      </div>

      <div className="mt-8 text-[9px] text-zinc-500 tracking-widest uppercase select-none text-center font-mono relative z-10">
        SYSTEM-ID: DQ-OPS-NODE-01 // STATUS: SECURED
        <br />
        SECURE GATEWAY v1.0.0
      </div>
    </div>
  );
}
