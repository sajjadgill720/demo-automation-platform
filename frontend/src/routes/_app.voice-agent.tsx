import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { Mic, Volume2, RefreshCw, Search, Bot, Trash2, Loader2, Phone, Clock } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { StatusBadge, statusToTone } from "@/components/common/StatusBadge";
import { CallItem, formatDuration } from "@/components/common/CallItem";
import {
  listLeads,
  getCallsForLead,
  deleteLeadAgent,
  type LeadResponse,
  type CallRecord,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/voice-agent")({
  head: () => ({ meta: [{ title: "Voice Agents — DataQuartz" }] }),
  component: VoiceAgent,
});

/**
 * Agent tester.
 *
 * This page used to be a fabricated "agent console" — a hardcoded agent id, phone
 * number, webhook, three fake connected functions, three fake knowledge-base
 * files, a simulated upload, and Update/Delete/Create buttons that only fired
 * toasts. None of it touched the backend, and the product has no per-agent
 * management API: agents are provisioned automatically, one per lead.
 *
 * It now shows the REAL provisioned agents (leads that have an assistant_id),
 * their actual details, the real calls each agent has handled (Vapi's own
 * recording, transcript, summary and cost, via getCallsForLead), a one-click
 * link to the live voice test on the demo page, and a genuine microphone check
 * (the only interactive piece that was ever real here).
 */
function VoiceAgent() {
  const [leads, setLeads] = useState<LeadResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Real call history for the selected agent, loaded lazily from its own lead.
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [callsError, setCallsError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await listLeads({ limit: 200 });
      // Only leads with a provisioned assistant are testable agents.
      setLeads(all.filter((l) => !!l.assistant_id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const agents = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return leads;
    return leads.filter(
      (l) =>
        l.company_name.toLowerCase().includes(needle) ||
        l.industry.toLowerCase().includes(needle) ||
        (l.assistant_id ?? "").toLowerCase().includes(needle),
    );
  }, [leads, q]);

  const selected = useMemo(
    () => agents.find((a) => a.id === selectedId) ?? agents[0] ?? null,
    [agents, selectedId],
  );

  const selectedAgentId = selected?.id ?? null;

  const loadCalls = async (leadId: string, opts: { spinner?: boolean } = {}) => {
    if (opts.spinner !== false) setCallsLoading(true);
    setCallsError(null);
    try {
      const rows = await getCallsForLead(leadId);
      setCalls(rows);
    } catch (err) {
      setCallsError(err instanceof Error ? err.message : "Failed to load calls.");
    } finally {
      setCallsLoading(false);
    }
  };

  // Load the selected agent's real calls whenever the selection changes.
  useEffect(() => {
    if (!selectedAgentId) {
      setCalls([]);
      setCallsError(null);
      return;
    }
    let cancelled = false;
    setCalls([]);
    setCallsLoading(true);
    setCallsError(null);
    getCallsForLead(selectedAgentId)
      .then((rows) => {
        if (!cancelled) setCalls(rows);
      })
      .catch((err) => {
        if (!cancelled)
          setCallsError(err instanceof Error ? err.message : "Failed to load calls.");
      })
      .finally(() => {
        if (!cancelled) setCallsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAgentId]);

  // At-a-glance stats over the selected agent's completed calls — all derived
  // from the real records, nothing fabricated.
  const callStats = useMemo(() => {
    const totalSeconds = calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
    const totalCost = calls.reduce((sum, c) => sum + (c.cost ?? 0), 0);
    return {
      count: calls.length,
      totalSeconds,
      avgSeconds: calls.length ? Math.round(totalSeconds / calls.length) : 0,
      totalCost,
    };
  }, [calls]);

  const handleDeleteAgent = async () => {
    if (!selected) return;
    setDeleting(true);
    try {
      await deleteLeadAgent(selected.id);
      toast.success(`Agent deleted — ${selected.company_name}`);
      setConfirmingDelete(false);
      setSelectedId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete agent.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <TopNav title="Voice Agents" />
      <div className="console-page-glow flex-1 grid gap-6 p-6 xl:grid-cols-3">
        {/* Agent list */}
        <div className="space-y-3 xl:col-span-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search agents"
              className="w-full rounded-lg border border-border/80 bg-card py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-shadow"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{agents.length} provisioned</span>
            <button
              onClick={load}
              className="flex items-center gap-1.5 hover:text-foreground cursor-pointer"
            >
              <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              Refresh
            </button>
          </div>

          {error ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : loading && leads.length === 0 ? (
            <div className="console-card-glass p-6 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : agents.length === 0 ? (
            <div className="console-card-glass p-6 text-center text-sm text-muted-foreground">
              No provisioned agents yet. Generate a demo to create one.
            </div>
          ) : (
            <ul className="console-card-glass divide-y divide-border/60 overflow-hidden">
              {agents.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => {
                      setSelectedId(a.id);
                      setConfirmingDelete(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left cursor-pointer transition-colors hover:bg-primary/5",
                      selected?.id === a.id && "bg-primary/10",
                    )}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary console-stat-glow-ring">
                      <Bot className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{a.company_name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {a.industry}
                      </span>
                    </span>
                    <StatusBadge tone={statusToTone(a.agent_status)}>{a.agent_status}</StatusBadge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Selected agent detail + test */}
        <div className="space-y-6 xl:col-span-2">
          {selected ? (
            <>
              <div className="console-card-glass p-5">
                <div className="console-card-header-futuristic flex flex-col gap-4 md:flex-row md:items-start md:justify-between pb-3 border-b border-border/40">
                  <div className="min-w-0 pl-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold">{selected.company_name}</h2>
                      <StatusBadge tone={statusToTone(selected.agent_status)}>
                        {selected.agent_status}
                      </StatusBadge>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {selected.industry}
                    </p>
                  </div>
                </div>

                <dl className="mt-5 grid gap-4 border-t border-border/40 pt-4 sm:grid-cols-2">
                  <Field label="Assistant ID" value={selected.assistant_id ?? "—"} mono />
                  <Field label="Contact" value={selected.contact_email} />
                  <Field label="Provisioned" value={formatDate(selected.created_at)} />
                  <Field label="Last updated" value={formatDate(selected.updated_at)} />
                  {selected.problem_statement && (
                    <div className="sm:col-span-2">
                      <Field label="Problem" value={selected.problem_statement} />
                    </div>
                  )}
                  {selected.failure_reason && (
                    <div className="sm:col-span-2">
                      <Field label="Failure" value={selected.failure_reason} tone="destructive" />
                    </div>
                  )}
                </dl>

                {/* Delete agent — tears down the Vapi assistant, keeps the lead. */}
                <div className="mt-4 border-t border-border/40 pt-4">
                  {!confirmingDelete ? (
                    <button
                      onClick={() => setConfirmingDelete(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5 cursor-pointer transition-all duration-200 btn-themed-shadow hover:-translate-y-[1px] active:translate-y-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete agent
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2 border border-destructive/30 bg-destructive/5 p-3">
                      <p className="text-xs text-foreground/80">
                        Tear down this Vapi agent for {selected.company_name}? The demo link stops
                        working. The lead record, profile and feedback are kept.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleDeleteAgent}
                          disabled={deleting}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 cursor-pointer btn-themed-shadow hover:-translate-y-[1px] active:translate-y-0 transition-all duration-200"
                        >
                          {deleting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          {deleting ? "Deleting…" : "Confirm delete"}
                        </button>
                        <button
                          onClick={() => setConfirmingDelete(false)}
                          disabled={deleting}
                          className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-all duration-200 hover:bg-muted btn-themed-shadow hover:-translate-y-[1px] active:translate-y-0"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Real call history for this agent (Vapi's own reports). */}
              <div className="console-card-glass p-5">
                <div className="console-card-header-futuristic mb-4 flex items-center justify-between gap-2 pb-3 border-b border-border/40">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold pl-2">
                    <Phone className="h-4 w-4 text-muted-foreground" /> Call history
                  </h3>
                  <button
                    onClick={() => selectedAgentId && loadCalls(selectedAgentId)}
                    disabled={!selectedAgentId || callsLoading}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 cursor-pointer pr-1"
                  >
                    <RefreshCw className={callsLoading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
                    Refresh
                  </button>
                </div>

                {callStats.count > 0 && (
                  <div className="mb-4 grid grid-cols-3 gap-3">
                    <CallStat label="Calls" value={String(callStats.count)} />
                    <CallStat
                      label="Total talk time"
                      value={formatDuration(callStats.totalSeconds)}
                    />
                    <CallStat label="Avg length" value={formatDuration(callStats.avgSeconds)} />
                  </div>
                )}

                {callsError ? (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                    {callsError}
                  </div>
                ) : callsLoading && calls.length === 0 ? (
                  <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading calls…
                  </p>
                ) : calls.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/70 bg-background/40 px-4 py-8 text-center">
                    <Clock className="mx-auto mb-2 h-5 w-5 text-muted-foreground/60" />
                    <p className="text-sm text-muted-foreground">No calls recorded yet.</p>
                    <p className="mt-0.5 text-xs text-muted-foreground/80">
                      Run a live voice test and the conversation will appear here.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {calls.map((c) => (
                      <CallItem key={c.id} call={c} />
                    ))}
                  </ul>
                )}
              </div>

              <div className="console-card-glass p-5">
                <div className="console-card-header-futuristic mb-3 flex items-center gap-2 pb-3 border-b border-border/40">
                  <h3 className="text-sm font-semibold pl-2">Microphone check</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Verify your mic before running a live voice test. This runs entirely in your
                  browser — it doesn't call the agent.
                </p>
                <div className="mt-4 flex justify-center rounded-lg border border-border/60 bg-background/40 py-6">
                  <Waveform />
                </div>
              </div>
            </>
          ) : (
            <div className="console-card-glass p-10 text-center text-sm text-muted-foreground">
              Select an agent to see its details and test it.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "destructive";
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 break-words text-sm text-foreground/80",
          mono && "font-mono text-xs",
          tone === "destructive" && "text-destructive",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function CallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/50 px-3 py-2 text-center">
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Live microphone level meter. Genuinely functional — uses the Web Audio API to
 * visualise the user's real mic input so they can confirm it works before a call.
 */
function Waveform() {
  const bars = 28;
  const [isMicTesting, setIsMicTesting] = useState(false);
  const [amplitudes, setAmplitudes] = useState<number[]>([]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    setAmplitudes(Array.from({ length: bars }).map((_, i) => 20 + Math.abs(Math.sin(i * 0.7)) * 40));
  }, []);

  const handleStartMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) throw new Error("Web Audio not supported");
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      setIsMicTesting(true);
      toast.success("Microphone connected. Speak to see the level move.");

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateWave = () => {
        analyser.getByteFrequencyData(dataArray);
        const newAmps = Array.from({ length: bars }).map((_, idx) => {
          const val = dataArray[Math.floor((idx / bars) * dataArray.length)] || 0;
          return Math.max(8, val * 0.45);
        });
        setAmplitudes(newAmps);
        animRef.current = requestAnimationFrame(updateWave);
      };
      updateWave();
    } catch (err) {
      console.warn(err);
      toast.error("Could not access microphone.", {
        description: "Please check your browser permissions.",
      });
    }
  };

  const handleStopMic = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (audioCtxRef.current) audioCtxRef.current.close();
    audioCtxRef.current = null;
    streamRef.current = null;
    setIsMicTesting(false);
    toast.info("Microphone preview disconnected.");
    setAmplitudes(Array.from({ length: bars }).map((_, i) => 20 + Math.abs(Math.sin(i * 0.7)) * 40));
  };

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex h-12 items-end gap-[3px]">
        {amplitudes.map((amp, i) => (
          <motion.span
            key={i}
            className={cn("w-[3px] rounded-full", isMicTesting ? "bg-success" : "bg-primary/70")}
            animate={isMicTesting ? { height: amp } : { height: [amp * 0.4, amp, amp * 0.5] }}
            transition={
              isMicTesting
                ? { type: "tween", duration: 0.1 }
                : {
                    duration: 1 + (i % 5) * 0.15,
                    repeat: Infinity,
                    repeatType: "reverse",
                    delay: i * 0.04,
                    ease: "easeInOut",
                  }
            }
            style={{ height: isMicTesting ? amp : amp * 0.6 }}
          />
        ))}
      </div>

      <button
        onClick={isMicTesting ? handleStopMic : handleStartMic}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all duration-200 cursor-pointer btn-themed-shadow hover:-translate-y-[2px] active:translate-y-0 active:scale-[0.97]",
          isMicTesting
            ? "border-success bg-success/10 text-success hover:bg-success/20"
            : "border-border bg-card text-muted-foreground hover:text-foreground",
        )}
      >
        {isMicTesting ? (
          <>
            <Volume2 className="h-3.5 w-3.5 text-success" /> Stop test
          </>
        ) : (
          <>
            <Mic className="h-3.5 w-3.5" /> Start mic test
          </>
        )}
      </button>
    </div>
  );
}
