import { useState } from "react";
import { Phone, ChevronDown, Loader2 } from "lucide-react";
import type { CallRecord } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * One recorded conversation with a provisioned agent.
 *
 * Renders Vapi's own call report — inline recording playback, end-of-call
 * summary, cost/outcome, and the full transcript — from a real CallRecord. It is
 * shared by the lead detail drawer and the Agent Tester so both show calls the
 * same way; nothing here is fabricated, every field comes from the backend.
 */
export function CallItem({ call }: { call: CallRecord }) {
  const [open, setOpen] = useState(false);
  const processing = call.status === "processing";
  const failed = call.status === "failed";
  return (
    <li className="rounded-lg border border-border/70 bg-secondary/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left cursor-pointer bg-transparent border-0 hover:bg-muted/40 transition-colors"
        aria-expanded={open}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
          <Phone className="h-3 w-3" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground">
              {formatDuration(call.duration_seconds)}
            </span>
            <span className="text-[10px] text-muted-foreground">· {call.turn_count} turns</span>
            {processing && (
              <span className="inline-flex items-center gap-1 text-[10px] text-primary">
                <Loader2 className="h-2.5 w-2.5 animate-spin" /> processing
              </span>
            )}
            {failed && <span className="text-[10px] text-destructive">unavailable</span>}
          </span>
          <time className="text-[10px] font-mono text-muted-foreground">
            {formatDateTime(call.created_at)}
          </time>
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {/* Vapi's own recording + summary. Recording plays inline. */}
      {call.recording_url && (
        <div className="px-3 pb-2">
          <audio controls preload="none" src={call.recording_url} className="w-full h-8" />
        </div>
      )}

      {call.summary && (
        <p className="px-3 pb-2 text-xs leading-relaxed text-foreground/80">{call.summary}</p>
      )}

      {open && (
        <div className="border-t px-3 py-2.5 space-y-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {call.ended_reason && (
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Ended: {call.ended_reason}
              </p>
            )}
            {call.cost != null && (
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Cost: ${call.cost.toFixed(3)}
              </p>
            )}
          </div>
          {processing ? (
            <p className="text-xs text-muted-foreground">
              Fetching the recording and transcript from Vapi…
            </p>
          ) : call.transcript.length === 0 ? (
            <p className="text-xs text-muted-foreground">No transcript available.</p>
          ) : (
            <ul className="space-y-1.5">
              {call.transcript.map((turn, i) => (
                <li key={i} className="text-xs leading-relaxed">
                  <span
                    className={cn(
                      "font-mono text-[10px] uppercase tracking-wider mr-1.5",
                      turn.role === "assistant" ? "text-primary" : "text-success",
                    )}
                  >
                    {turn.role === "assistant" ? "Agent" : "Caller"}:
                  </span>
                  <span className="text-foreground/80">{turn.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}
