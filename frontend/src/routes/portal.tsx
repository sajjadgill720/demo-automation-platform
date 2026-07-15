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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#070a13] dark:bg-zinc-950 text-slate-200 px-4 font-mono relative overflow-hidden">
      
      {/* Global Page Guidelines */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="mx-auto h-full max-w-7xl relative">
          <div className="absolute left-0 top-0 h-full w-px bg-zinc-800/15 dark:bg-zinc-800/30" />
          <div className="absolute right-0 top-0 h-full w-px bg-zinc-800/15 dark:bg-zinc-800/30" />
        </div>
      </div>

      <div className="relative z-10 w-full max-w-md border border-zinc-800 bg-[#0c101d]/60 backdrop-blur-md p-8 rounded-xl shadow-2xl overflow-hidden transition-all duration-300">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-amber-500 animate-pulse" />

        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800">
            <Lock className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white uppercase font-mono">
              Internal Access
            </h1>
            <p className="text-xs text-slate-500 mt-1.5 font-sans">
              Authorized Operations Personnel Only
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <label
              htmlFor="passcode"
              className="text-[10px] font-medium tracking-wider text-slate-400 uppercase font-mono"
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
                className="w-full bg-[#070a13] border border-zinc-800 rounded px-3.5 py-2.5 text-sm tracking-widest placeholder:text-zinc-700 placeholder:tracking-normal focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 text-white font-sans transition-all"
                required
                disabled={loading}
                autoFocus
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 rounded bg-rose-950/20 border border-rose-900/30 p-3 text-xs text-rose-400 font-sans">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 text-slate-950 hover:bg-amber-400 hover:shadow-lg transition-all rounded py-3 text-xs font-semibold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5 font-mono border-0 active:scale-98"
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
