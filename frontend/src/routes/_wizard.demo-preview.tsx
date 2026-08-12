import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Phone,
  Sun,
  Moon,
  Sparkles,
  Check,
  Share2,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  Volume2,
  Send,
  X,
  ChevronDown,
  MessageSquare,
  DollarSign,
  Clock,
  UserCheck,
  BarChart3,
} from "lucide-react";
import { CompanyLogo } from "@/components/common/CompanyCard";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { z } from "zod";
import {
  endDemoSession,
  getDemoRequestStatus,
  submitDemoFeedback,
  getFeedbackForLead,
  saveCallRecord,
  type DemoFeedback,
} from "@/lib/api";
import { lookupNarrative } from "@/lib/industry-narratives";

const demoPreviewSearchSchema = z.object({
  name: z.string().optional(),
  company: z.string().optional(),
  problem: z.string().optional(),
  language: z.string().optional(),
  tools: z.string().optional(),
  assistant_id: z.string().optional(),
  lead_id: z.string().optional(),
  industry: z.string().optional(),
});

export const Route = createFileRoute("/_wizard/demo-preview")({
  validateSearch: (search) => demoPreviewSearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Your Personalized Demo — Convoa" },
      { name: "description", content: "A tailored AI voice demo sandbox." },
    ],
  }),
  component: DemoPreview,
});

/* Animation variants */
const containerVariants: any = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp: any = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

/* Value props shown alongside the live-call orb in the hero. */
const HERO_POINTS = [
  { icon: Volume2, text: "Sounds human, callers never ask to be put through to someone else." },
  {
    icon: Clock,
    text: "Answers at 2am, on weekends, and through the rush. Every call, every time.",
  },
  { icon: UserCheck, text: "Every caller captured, qualified, and ready for you to follow up." },
  { icon: BarChart3, text: "See every call and every missed opportunity in one place." },
] as const;

function DemoPreview() {
  const search = Route.useSearch();
  const { theme, toggleTheme } = useTheme();

  // Dynamic agent identifiers from URL search params (set by the onboarding wizard)
  const dynamicAssistantId = search.assistant_id || null;
  const dynamicLeadId = search.lead_id || null;

  // Personalization State
  const [personalization] = useState(() => {
    // 1. Check search params
    if (search.name || search.company || search.problem) {
      return {
        name: search.name || "Elena",
        company: search.company || "ABC Logistics",
        problem:
          search.problem ||
          "Our manual dispatch process takes 6+ hours per shift, causing driver churn and delayed communications.",
        language: search.language || "English (US Accent)",
        tools: search.tools || "Descartes, Trimble, Salesforce",
      };
    }

    // 2. Check localStorage
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("convoa_demo_preview_data");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.name || parsed.company) {
            return {
              name: parsed.name || "Elena",
              company: parsed.company || "ABC Logistics",
              problem:
                parsed.problem ||
                "Our manual dispatch process takes 6+ hours per shift, causing driver churn and delayed communications.",
              language: parsed.language || "English (US Accent)",
              tools: parsed.tools || "Descartes, Trimble, Salesforce",
            };
          }
        }
      } catch (e) {
        console.error("Error reading localStorage:", e);
      }
    }

    // 3. Fallback to default
    return {
      name: "Elena",
      company: "ABC Logistics",
      problem:
        "Our manual dispatch process takes 6+ hours per shift, causing driver churn and delayed communications.",
      language: "English (US Accent)",
      tools: "Descartes, Trimble, Salesforce",
    };
  });

  // Industry drives the before/after narrative. Prefer the lead record (the
  // authoritative value the user picked on the form); fall back to the search
  // param, then to the generic narrative so this never renders blank.
  const [leadIndustry, setLeadIndustry] = useState<string | null>(search.industry ?? null);
  const [leadCompany, setLeadCompany] = useState<string | null>(null);
  // The lead record is the AUTHORITATIVE source for which agent belongs to this
  // demo. The URL param is only a hint — it can be missing (a link shared without
  // params, the nav's "View demo as client") or stale (the link was made before
  // provisioning finished, or the agent was since deleted).
  const [leadAssistantId, setLeadAssistantId] = useState<string | null>(null);
  const [agentBuilding, setAgentBuilding] = useState(false);

  useEffect(() => {
    if (!dynamicLeadId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const IN_PROGRESS = ["pending", "summarizing_documents", "building_profile", "provisioning"];

    const load = () => {
      getDemoRequestStatus(dynamicLeadId)
        .then((lead) => {
          if (cancelled) return;
          if (lead.industry) setLeadIndustry(lead.industry);
          if (lead.company_name) setLeadCompany(lead.company_name);
          setLeadAssistantId(lead.assistant_id ?? null);

          // If the agent is still being generated, keep checking so the call
          // button goes live the moment its id exists — rather than the visitor
          // having to reload the page.
          const building = IN_PROGRESS.includes(lead.agent_status);
          setAgentBuilding(building && !lead.assistant_id);
          if (building && !lead.assistant_id) {
            timer = setTimeout(load, 3000);
          }
        })
        .catch(() => {
          /* Non-fatal: falls back to the URL param and the generic narrative. */
        });
    };

    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [dynamicLeadId]);

  /**
   * The agent this call button dials.
   *
   * Precedence: explicit URL param first (it encodes the caller's intent — e.g.
   * an internal "open this specific demo"), then the lead record.
   *
   * There is deliberately NO global-env fallback. It used to fall back to
   * VITE_VAPI_ASSISTANT_ID, which meant a visitor whose own agent was missing
   * would be silently connected to an unrelated shared assistant and believe it
   * was theirs — a demo that appears to work while demonstrating the wrong
   * business. Failing visibly is far better here.
   */
  const resolvedAssistantId = dynamicAssistantId || leadAssistantId;
  const canCall = Boolean(resolvedAssistantId);

  const narrative = lookupNarrative(leadIndustry);
  const displayCompany = leadCompany || personalization.company;

  // Dynamic company color / initial calculation
  const companyRepresentation = (() => {
    const name = personalization.company;
    const initials = name
      ? name
          .split(" ")
          .map((w: string) => w[0])
          .join("")
          .substring(0, 2)
          .toUpperCase()
      : "DQ";

    // Previously hashed the company name into an arbitrary hue, which produced
    // random indigo/violet/green logos. The brand colour is used instead so the
    // page keeps one palette.
    const logoColor = "var(--color-primary)";

    return {
      name,
      logoColor,
      logoInitials: initials,
    };
  })();

  // Interactive Live Call Client Setup
  const [vapi, setVapi] = useState<any>(null);
  const [callStatus, setCallStatus] = useState<"idle" | "connecting" | "on-call" | "ended">("idle");

  const connectionSteps = [
    "Establishing secure connection...",
    "Checking audio and microphone parameters...",
    "Provisioning virtual receptionist agent...",
    "Calibrating digital audio feeds...",
    "Ready! Preparing voice greeting...",
  ];
  const [connectStepIndex, setConnectStepIndex] = useState(0);

  useEffect(() => {
    if (callStatus !== "connecting") {
      setConnectStepIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setConnectStepIndex((prev) => (prev < connectionSteps.length - 1 ? prev + 1 : prev));
    }, 1500);
    return () => clearInterval(timer);
  }, [callStatus]);

  // Native call capture. Vapi is the source of truth: when a call starts we grab
  // Vapi's call id, and when it ends we hand that id to the backend, which pulls
  // the official report (recording, transcript, summary) from Vapi's API. Refs
  // (not state) so the once-registered event handlers always read the latest
  // values without re-subscribing.
  const vapiCallIdRef = useRef<string | null>(null);
  const callStartRef = useRef<number | null>(null);
  const assistantIdRef = useRef<string | null>(null);
  const leadIdRef = useRef<string | null>(dynamicLeadId);
  // Mirror of callStatus so the once-registered Vapi handlers can read the LIVE
  // status (a handler closes over the value at registration time otherwise).
  const callStatusRef = useRef(callStatus);

  // Keep the refs in sync so the once-registered call-end handler always saves
  // against the currently-resolved agent and lead (the assistant id can arrive
  // asynchronously while provisioning finishes).
  useEffect(() => {
    assistantIdRef.current = resolvedAssistantId;
    leadIdRef.current = dynamicLeadId;
  }, [resolvedAssistantId, dynamicLeadId]);

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  // The two primary actions (feedback + booking) live in this block, directly
  // below the demo. When a call ends — the moment the client is most primed to
  // act — we scroll it into view and emphasise it. It stays visible at all other
  // times, so the actions never depend on completing a call.
  const actNowRef = useRef<HTMLDivElement>(null);
  const justEnded = callStatus === "ended";
  useEffect(() => {
    if (callStatus === "ended") {
      actNowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [callStatus]);

  // Feedback States
  const [feedbackRating, setFeedbackRating] = useState<"positive" | "negative" | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackSending, setFeedbackSending] = useState(false);
  // Feedback this client has already submitted for this demo, shown back to them.
  const [pastFeedback, setPastFeedback] = useState<DemoFeedback[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    if (!dynamicLeadId) return;
    let cancelled = false;
    getFeedbackForLead(dynamicLeadId)
      .then((rows) => {
        if (cancelled) return;
        setPastFeedback(rows);
        if (rows.length > 0) setFeedbackSubmitted(true);
      })
      .catch(() => {
        /* Non-fatal: the form still works, we just can't show past submissions. */
      });
    return () => {
      cancelled = true;
    };
  }, [dynamicLeadId]);

  // Dynamic load of Vapi
  useEffect(() => {
    if (typeof window === "undefined") return;

    const VAPI_PUBLIC_KEY = (import.meta.env.VITE_VAPI_PUBLIC_KEY as string) || "";
    if (!VAPI_PUBLIC_KEY) {
      console.warn("VITE_VAPI_PUBLIC_KEY is not defined in environment variables.");
    }

    let createdVapi: any = null;

    import("@vapi-ai/web").then((VapiModule) => {
      try {
        let VapiClass = VapiModule.default;
        if (
          typeof VapiClass !== "function" &&
          VapiClass &&
          typeof (VapiClass as any).default === "function"
        ) {
          VapiClass = (VapiClass as any).default;
        }
        if (typeof VapiClass !== "function") {
          VapiClass = VapiModule as any;
        }
        const vapiInstance = new (VapiClass as any)(VAPI_PUBLIC_KEY);
        createdVapi = vapiInstance;

        // Flip out of the "connecting" spinner into the live-call UI. Idempotent,
        // and driven by SEVERAL signals because in the current SDK (2.6.x) the
        // bare `call-start` event does not always land before the agent's first
        // words — `call-start-success` and `speech-start` are used as fallbacks
        // so the loader never sticks while the agent is already talking.
        const markConnected = () => {
          if (!callStartRef.current) callStartRef.current = Date.now();
          if (callStatusRef.current !== "on-call") {
            setCallStatus("on-call");
            toast.success("Connected to generated demo agent.");
          }
        };

        vapiInstance.on("call-start", () => markConnected());
        vapiInstance.on("call-start-success", (evt: any) => {
          // This event DOES carry the call id in 2.6.x; capture it for the report.
          if (evt?.callId && typeof evt.callId === "string") vapiCallIdRef.current = evt.callId;
          markConnected();
        });
        // The agent (or the caller) producing speech proves the call is live —
        // clear the loader even if the connection events were missed.
        vapiInstance.on("speech-start", () => {
          if (callStatusRef.current === "connecting") markConnected();
        });

        vapiInstance.on("call-start-failed", (evt: any) => {
          console.error("Vapi call-start-failed:", evt);
          setCallStatus("idle");
          toast.error(
            evt?.error ? `Couldn't start the call: ${evt.error}` : "Couldn't start the call.",
          );
        });

        vapiInstance.on("call-end", () => {
          setCallStatus("ended");
          toast.info("Demo call ended.");

          // Hand Vapi's call id to the backend, which pulls the native report.
          const leadId = leadIdRef.current;
          const vapiCallId = vapiCallIdRef.current;
          const startedMs = callStartRef.current;
          if (leadId && vapiCallId) {
            const endedAt = new Date();
            const startedAt = startedMs ? new Date(startedMs) : endedAt;
            saveCallRecord(leadId, {
              vapi_call_id: vapiCallId,
              assistant_id: assistantIdRef.current ?? undefined,
              started_at: startedAt.toISOString(),
              ended_at: endedAt.toISOString(),
            }).catch((err) => console.error("saveCallRecord failed (non-blocking):", err));
          }
          vapiCallIdRef.current = null;
          callStartRef.current = null;
        });

        vapiInstance.on("error", (err: any) => {
          console.error("Vapi error:", err);
          // Only tear the UI down if we never got connected. An error emitted
          // mid-call is left to `call-end` to handle, so a benign warning does
          // not yank an active call back to the idle screen.
          if (callStatusRef.current === "connecting" || callStatusRef.current === "idle") {
            setCallStatus("idle");
            toast.error("Connection failed. Check your microphone permission and try again.");
          }
        });

        setVapi(vapiInstance);
      } catch (err) {
        console.error("Failed to initialize Vapi:", err);
      }
    });

    return () => {
      // Stop the instance THIS effect created. The previous code closed over the
      // `vapi` state (still null when the empty-deps effect ran), so the call and
      // microphone were never released on unmount.
      if (createdVapi) {
        try {
          createdVapi.stop();
        } catch {
          /* already stopped / never started */
        }
      }
      // endDemoSession is intentionally NOT called here: React StrictMode would
      // trigger it instantly during dev, deleting the backend agent before the
      // user can even test it.
    };
  }, []);

  const handleStartBrowserCall = () => {
    if (!vapi) {
      toast.error("Vapi is initializing. Please try again.");
      return;
    }
    if (!resolvedAssistantId) {
      toast.error(
        agentBuilding
          ? "Your agent is still being built, this will be ready in a moment."
          : "No agent is attached to this demo yet.",
      );
      return;
    }
    setCallStatus("connecting");
    try {
      // start() resolves to Vapi's Call object; capture its id so we can pull the
      // native report after the call ends.
      const maybeCall = vapi.start(resolvedAssistantId);
      Promise.resolve(maybeCall)
        .then((call: any) => {
          if (call?.id) vapiCallIdRef.current = call.id;
        })
        .catch(() => {
          /* id may still arrive via the call-start event */
        });
    } catch (err) {
      console.error(err);
      setCallStatus("idle");
    }
  };

  const handleEndBrowserCall = () => {
    if (vapi) {
      vapi.stop();
    }
    // Best-effort cleanup: delete the Vapi assistant on the backend
    if (dynamicLeadId) {
      endDemoSession(dynamicLeadId).catch((err) =>
        console.error("endDemoSession failed (non-blocking):", err),
      );
    }
  };

  const handleCopyShareLink = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams({
      name: personalization.name,
      company: personalization.company,
      problem: personalization.problem,
      language: personalization.language,
      tools: personalization.tools,
    });
    const shareUrl = `${baseUrl}?${params.toString()}`;

    navigator.clipboard.writeText(shareUrl);
    toast.success("Demo Sandbox URL copied to clipboard! (Link expires in 8 days)");
  };

  // Previously this only flipped local state and showed a toast — the feedback
  // was never sent anywhere, so nothing ever reached the internal team. It now
  // persists via the API and is read back below so the client can see what they
  // submitted.
  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackRating) return;

    if (!dynamicLeadId) {
      toast.error("This preview isn't linked to a request, so feedback can't be saved.");
      return;
    }

    setFeedbackSending(true);
    try {
      const saved = await submitDemoFeedback(dynamicLeadId, {
        rating: feedbackRating,
        comment: feedbackText.trim() || undefined,
      });
      setPastFeedback((prev) => [saved, ...prev]);
      setFeedbackSubmitted(true);
      toast.success(
        feedbackRating === "positive"
          ? "Thanks, your feedback has been sent to the team."
          : "Sent. The team will review what needs adjusting.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send your feedback.");
    } finally {
      setFeedbackSending(false);
    }
  };

  return (
    <div className={cn(theme === "dark" && "dark")}>
      <div
        className="flex-1 bg-background text-foreground relative overflow-hidden"
        id="print-section"
      >
        {/* Print Stylesheet (N1) */}
        <style>{`
          @media print {
            body {
              background: #fff !important;
              color: #000 !important;
            }
            .no-print {
              display: none !important;
            }
            .print-only {
              display: block !important;
            }
            #print-section {
              border: none !important;
              padding: 0 !important;
            }
          }
          .print-only {
            display: none;
          }
        `}</style>

        {/* Background Grid & Glows */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 no-print">
          <div
            className="absolute inset-0 opacity-[0.1] dark:opacity-[0.04]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, var(--border) 1.5px, transparent 1.5px)",
              backgroundSize: "32px 32px",
              maskImage: "radial-gradient(ellipse 60% 50% at 50% 0%, #000 40%, transparent 100%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 60% 50% at 50% 0%, #000 40%, transparent 100%)",
            }}
          />
          <div
            className="absolute top-[5%] left-[20%] w-[28rem] h-[28rem] bg-primary/[0.04] dark:bg-primary/[0.025] blur-[110px] rounded-full animate-pulse"
            style={{ animationDuration: "9s" }}
          />
          <div
            className="absolute top-[30%] right-[10%] w-[35rem] h-[35rem] bg-primary/[0.035] dark:bg-primary/[0.02] blur-[130px] rounded-full animate-pulse"
            style={{ animationDuration: "12s" }}
          />
        </div>

        {/* Hero Section */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="relative z-10 mx-auto w-full max-w-[1600px] px-6 lg:px-10 pt-4 pb-20 space-y-12"
        >
          <div className="relative pt-2">
            <div className="grid lg:grid-cols-2 gap-10 xl:gap-16 lg:items-center">
              {/* Left — the pitch */}
              <motion.div variants={fadeUp} className="space-y-7 text-center lg:text-left">
                {/* Company lockup */}
                <div className="flex items-center gap-3 justify-center lg:justify-start">
                  <CompanyLogo company={companyRepresentation} size={44} />
                  <span className="text-muted-foreground text-lg font-light">×</span>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary text-foreground">
                    <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                  </div>
                </div>

                {/* Headline */}
                <div className="space-y-4">
                  <h1 className="text-3xl sm:text-4xl xl:text-5xl font-normal tracking-tight text-foreground leading-[1.1]">
                    {personalization.company}'s new receptionist{" "}
                    <span className="text-primary">never misses a call</span>
                  </h1>
                  <p className="text-base text-muted-foreground leading-relaxed max-w-md mx-auto lg:mx-0 font-sans">
                    Trained on how you work. Call it right now, this is exactly what your customers
                    would hear.
                  </p>
                </div>

                {/* Value list */}
                <ul className="space-y-3.5 max-w-md mx-auto lg:mx-0 text-left">
                  {HERO_POINTS.map((p) => (
                    <li key={p.text} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                        <p.icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-sm text-foreground/75 font-sans leading-relaxed">
                        {p.text}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Trust row */}
                <div className="flex items-center gap-5 flex-wrap justify-center lg:justify-start pt-1 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Live
                    agent
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Volume2 className="h-3.5 w-3.5" /> Real voice
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5" /> No setup
                  </span>
                </div>
              </motion.div>

              {/* Right — the live-call orb (the primary action, now the hero visual) */}
              <motion.div variants={fadeUp} className="w-full no-print">
                <button
                  onClick={callStatus === "on-call" ? handleEndBrowserCall : handleStartBrowserCall}
                  disabled={callStatus === "connecting" || !canCall}
                  aria-label={
                    callStatus === "on-call"
                      ? "End the live voice call"
                      : "Start a live voice call now"
                  }
                  className="w-full group relative flex flex-col items-center justify-start gap-5 rounded-3xl p-6 md:p-8 text-center cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  style={{
                    background:
                      theme === "dark"
                        ? "radial-gradient(ellipse 78% 62% at 50% 54%, #05070d 0%, #05070d 44%, transparent 82%)"
                        : "transparent",
                  }}
                >
                  {/* Brand + tagline */}
                  <div className="relative z-10 space-y-3 min-h-[110px] md:min-h-[120px] flex flex-col items-center justify-start w-full">
                    <span
                      className="block text-3xl md:text-4xl font-bold tracking-tight lowercase"
                      style={{
                        background:
                          "linear-gradient(90deg, var(--color-primary), var(--color-primary))",
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        color: "transparent",
                      }}
                    >
                      convoa
                    </span>
                    <div className="h-[60px] flex items-center justify-center w-full px-4 overflow-hidden">
                      <AnimatePresence mode="wait">
                        {callStatus === "idle" ||
                        callStatus === "ended" ||
                        callStatus === "connecting" ? (
                          <motion.p
                            key="idle"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                            className="text-sm text-white/55 leading-relaxed max-w-xs mx-auto font-sans"
                          >
                            Answers every call, books the job, and never puts anyone on hold.
                          </motion.p>
                        ) : (
                          <motion.div
                            key="on-call"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-1 text-center"
                          >
                            <p className="text-[11px] font-mono uppercase tracking-widest text-primary/80 font-bold animate-pulse">
                              🎙️ Connected & Listening
                            </p>
                            <p className="text-xs text-white/70 font-sans max-w-xs mx-auto leading-normal">
                              Try asking:{" "}
                              {narrative.faqs[0] ? `"${narrative.faqs[0].q}"` : `"Who are you?"`}
                            </p>
                            {narrative.faqs[1] && (
                              <p className="text-[10px] text-white/40 font-sans max-w-xs mx-auto leading-normal truncate">
                                or: "{narrative.faqs[1].q}"
                              </p>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Eclipse */}
                  <div className="relative flex-1 flex items-center justify-center w-full min-h-[380px] md:min-h-[460px]">
                    {/* Outer halo glow */}
                    <div
                      className="absolute h-[460px] w-[460px] rounded-full blur-3xl animate-pulse pointer-events-none"
                      style={{
                        background:
                          "radial-gradient(circle, rgba(245,158,11,0.30) 0%, rgba(34,211,238,0.12) 44%, transparent 68%)",
                        animationDuration: "7s",
                      }}
                    />
                    {/* Dark disc: glowing teal rim + faint starfield */}
                    <div
                      className="absolute h-[300px] w-[300px] md:h-[360px] md:w-[360px] rounded-full transition-transform duration-500 group-hover:scale-[1.04] pointer-events-none"
                      style={{
                        background:
                          "radial-gradient(circle, #03050a 50%, rgba(245,158,11,0.05) 68%, transparent 73%), radial-gradient(1.5px 1.5px at 30% 38%, rgba(255,255,255,0.55), transparent), radial-gradient(1px 1px at 68% 30%, rgba(255,255,255,0.4), transparent), radial-gradient(1.5px 1.5px at 58% 72%, rgba(255,255,255,0.45), transparent), radial-gradient(1px 1px at 38% 64%, rgba(255,255,255,0.3), transparent), radial-gradient(1px 1px at 74% 58%, rgba(255,255,255,0.35), transparent), radial-gradient(1px 1px at 46% 44%, rgba(255,255,255,0.25), transparent)",
                        boxShadow:
                          "0 0 0 1px rgba(245,158,11,0.30), 0 0 100px -6px rgba(245,158,11,0.55), 0 0 46px -4px rgba(245,158,11,0.4), inset 0 0 80px -16px rgba(45,212,191,0.7)",
                      }}
                    />
                    {/* Organic ribbon knot — faint counter layer (depth) */}
                    <EclipseRibbon
                      className="absolute h-[230px] w-[230px] md:h-[262px] md:w-[262px] opacity-35"
                      gradientId="ribbonGradFaint"
                      rotate={-360}
                      duration={95}
                      strokeWidth={0.5}
                    />
                    {/* Organic ribbon knot — primary */}
                    <EclipseRibbon
                      className="absolute h-[188px] w-[188px] md:h-[216px] md:w-[216px]"
                      gradientId="ribbonGradMain"
                      rotate={360}
                      duration={58}
                      strokeWidth={0.7}
                      glow
                    />
                    {/* Center label */}
                    <div className="relative z-10 flex flex-col items-center gap-0.5 pointer-events-none">
                      {callStatus === "on-call" ? (
                        <>
                          <VoiceWaveform />
                          <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-destructive/70">
                            In call
                          </span>
                          <span className="text-lg md:text-xl font-semibold text-destructive">
                            tap to end
                          </span>
                        </>
                      ) : callStatus === "connecting" ? (
                        <>
                          <LoadingPulseRing />
                          <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary/60 mb-1">
                            Connecting
                          </span>
                          <span className="text-sm md:text-base font-semibold text-primary animate-pulse text-center max-w-[220px] leading-snug">
                            {connectionSteps[connectStepIndex]}
                          </span>
                        </>
                      ) : !canCall ? (
                        <>
                          <span className="text-[11px] font-light uppercase tracking-[0.2em] text-white/40">
                            {agentBuilding ? "Your agent is" : "Agent"}
                          </span>
                          <span className="text-xl md:text-2xl font-semibold tracking-tight text-white/55">
                            {agentBuilding ? "almost ready…" : "not available"}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-[11px] font-light uppercase tracking-[0.2em] text-white/40">
                            Click here to
                          </span>
                          <span
                            className="text-2xl md:text-3xl font-semibold tracking-tight"
                            style={{
                              background:
                                "linear-gradient(90deg, var(--color-primary), var(--color-primary))",
                              WebkitBackgroundClip: "text",
                              backgroundClip: "text",
                              color: "transparent",
                            }}
                          >
                            talk now
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              </motion.div>
            </div>
          </div>

          {/* Dashboard preview — the four product panels, reframed as labeled
              previews of what the client sees inside the live console. */}
          <motion.div variants={fadeUp} className="space-y-6 no-print">
            <div className="text-center lg:text-left space-y-2">
              <span className="text-[10px] font-mono text-primary uppercase tracking-widest font-semibold">
                Inside the console
              </span>
              <h2 className="text-2xl font-normal tracking-tight">
                Everything Convoa captures, in one view
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
              {[
                {
                  label: "Agent activity",
                  desc: "Live roster of calls handled",
                  el: <VoiceRosterIllustration />,
                },
                {
                  label: "Service heatmap",
                  desc: "Where demand concentrates",
                  el: <HeatmapIllustration />,
                },
                {
                  label: "Revenue trend",
                  desc: "Booked jobs over time",
                  el: <RevenueIllustration />,
                },
                {
                  label: "Call timings",
                  desc: "Peak hours at a glance",
                  el: <TimelineIllustration />,
                },
              ].map((t) => (
                <div
                  key={t.label}
                  className="group flex flex-col gap-4 rounded-3xl border border-border bg-card/60 backdrop-blur-sm p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_32px_-12px_rgba(45,212,191,0.25)]"
                >
                  <div className="relative h-40 overflow-hidden rounded-2xl border border-border/60 bg-secondary/30 transition-colors group-hover:border-primary/25">
                    {t.el}
                  </div>
                  <div className="px-1">
                    <p className="text-sm font-medium text-foreground">{t.label}</p>
                    <p className="text-xs text-muted-foreground font-sans">{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Act now — the two primary actions, directly below the demo so the
              client reaches them without scrolling past secondary content. On lg
              they sit side by side; they stack on narrow viewports. Emphasised and
              scrolled into view when the call ends (see actNowRef / justEnded),
              but always visible so they never depend on completing a call. */}
          <motion.div ref={actNowRef} variants={fadeUp} className="scroll-mt-24 no-print">
            {justEnded && (
              <div className="mb-4 flex items-center justify-center gap-2 text-center text-sm font-sans text-primary animate-fade-in">
                <Sparkles className="h-4 w-4 shrink-0" />
                <span>That's your agent. What did you think? Ready to take it live?</span>
              </div>
            )}
            <div
              className={cn(
                "grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 items-stretch rounded-3xl transition-all duration-500",
                justEnded && "ring-2 ring-primary/40 ring-offset-4 ring-offset-background",
              )}
            >
              {/* Feedback card */}
              <div className="rounded-3xl border border-border bg-card/70 backdrop-blur-sm p-6 md:p-8 flex flex-col">
                <div className="flex items-center gap-2.5 mb-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary shrink-0">
                    <MessageSquare className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-base font-medium tracking-tight leading-tight">
                      How was that?
                    </h3>
                    <p className="text-xs text-muted-foreground font-sans">
                      Tell us if the agent got it right.
                    </p>
                  </div>
                </div>
                <div className="space-y-4 flex-1">
                  {!feedbackSubmitted ? (
                    <form onSubmit={handleFeedbackSubmit} className="space-y-4 font-sans text-sm">
                      {/* Rating Selector */}
                      <div className="flex gap-4 justify-center">
                        <button
                          type="button"
                          onClick={() => setFeedbackRating("positive")}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border px-6 py-3 font-mono uppercase tracking-wider text-sm font-semibold cursor-pointer bg-transparent transition-all duration-200 btn-themed-shadow hover:-translate-y-[2px] active:translate-y-0 active:scale-[0.97]",
                            feedbackRating === "positive"
                              ? "border-success text-success bg-success/[0.05]"
                              : "border-border text-foreground hover:bg-secondary",
                          )}
                        >
                          <ThumbsUp className="h-4 w-4" /> Yes, Accurate
                        </button>
                        <button
                          type="button"
                          onClick={() => setFeedbackRating("negative")}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border px-6 py-3 font-mono uppercase tracking-wider text-sm font-semibold cursor-pointer bg-transparent transition-all duration-200 btn-themed-shadow hover:-translate-y-[2px] active:translate-y-0 active:scale-[0.97]",
                            feedbackRating === "negative"
                              ? "border-destructive text-destructive bg-destructive/[0.05]"
                              : "border-border text-foreground hover:bg-secondary",
                          )}
                        >
                          <ThumbsDown className="h-4 w-4" /> Needs Tweaks
                        </button>
                      </div>

                      {/* Rating text prompt */}
                      {feedbackRating && (
                        <div className="space-y-2 text-left animate-fade-in">
                          <label className="text-xs font-mono uppercase tracking-wider text-foreground/75 font-semibold">
                            {feedbackRating === "positive"
                              ? "What works well? (Optional)"
                              : "What did the agent miss? (e.g. tools, workflow instructions) *"}
                          </label>
                          <textarea
                            required={feedbackRating === "negative"}
                            rows={3}
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            placeholder={
                              feedbackRating === "positive"
                                ? "Provide any comments..."
                                : "Tell us what to adjust so we can rebuild your agent..."
                            }
                            className="w-full bg-secondary border border-border px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary text-sm font-sans resize-none"
                          />
                          <button
                            type="submit"
                            disabled={feedbackSending}
                            className="w-full bg-primary text-primary-foreground hover:bg-primary/95 transition-all duration-200 text-sm font-mono font-semibold uppercase tracking-wider py-3 cursor-pointer border-0 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl btn-themed-shadow hover:-translate-y-[2px] active:translate-y-0 active:scale-[0.97]"
                          >
                            <Send className="h-3.5 w-3.5" />
                            {feedbackSending ? "Sending…" : "Send feedback"}
                          </button>
                        </div>
                      )}
                    </form>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-center py-2 space-y-2 font-mono">
                        <div className="h-10 w-10 bg-success/10 border border-success/20 text-success flex items-center justify-center rounded-full mx-auto">
                          <Check className="h-5 w-5" />
                        </div>
                        <p className="text-sm uppercase tracking-wider font-bold">Feedback sent</p>
                        <p className="text-xs text-muted-foreground font-sans leading-relaxed max-w-xs mx-auto">
                          Thanks, this is now with the team.
                        </p>
                      </div>

                      {/* The client's own submissions, read back from the server so they
                      can see exactly what was sent and when. */}
                      {pastFeedback.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                            Your feedback
                          </p>
                          <ul className="space-y-2">
                            {pastFeedback.map((fb) => (
                              <li
                                key={fb.id}
                                className="border border-border bg-secondary/40 p-3.5 space-y-1.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider font-semibold",
                                      fb.rating === "positive"
                                        ? "text-success"
                                        : "text-destructive",
                                    )}
                                  >
                                    {fb.rating === "positive" ? (
                                      <ThumbsUp className="h-3 w-3" />
                                    ) : (
                                      <ThumbsDown className="h-3 w-3" />
                                    )}
                                    {fb.rating === "positive" ? "Accurate" : "Needs tweaks"}
                                  </span>
                                  <time
                                    dateTime={fb.created_at}
                                    className="text-xs font-mono text-muted-foreground"
                                  >
                                    {new Date(fb.created_at).toLocaleString(undefined, {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </time>
                                </div>
                                {fb.comment && (
                                  <p className="text-sm font-sans text-foreground/90 leading-relaxed">
                                    {fb.comment}
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                          <button
                            type="button"
                            onClick={() => {
                              setFeedbackSubmitted(false);
                              setFeedbackRating(null);
                              setFeedbackText("");
                            }}
                            className="text-xs font-sans text-muted-foreground hover:text-foreground underline underline-offset-4 cursor-pointer bg-transparent border-0 p-0"
                          >
                            Add more feedback
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Booking card */}
              <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-primary/[0.03] p-6 md:p-8 flex flex-col">
                <div
                  className="absolute inset-x-0 -top-24 mx-auto h-48 w-96 max-w-full rounded-full blur-3xl pointer-events-none"
                  style={{
                    background: "radial-gradient(circle, rgba(245,158,11,0.14), transparent 70%)",
                  }}
                />
                <div className="relative z-10 flex flex-col flex-1">
                  <div className="flex items-center gap-2.5 mb-5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary shrink-0">
                      <DollarSign className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-base font-medium tracking-tight leading-tight">
                        Take it live
                      </h3>
                      <p className="text-xs text-muted-foreground font-sans">Pricing & Plans</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed font-sans">
                    Every day this isn't live is another day of calls going to voicemail. Choose a
                    pricing plan that suits your call volume and start answering for{" "}
                    {personalization.company}.
                  </p>
                  <div className="mt-auto pt-6 space-y-2.5">
                    <a
                      href="https://convoa.com/pricing/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-6 py-3.5 text-sm font-semibold tracking-tight transition-all duration-200 hover:bg-primary/90 cursor-pointer border-0 text-center select-none btn-themed-shadow hover:-translate-y-[2px] active:translate-y-0 active:scale-[0.97]"
                    >
                      <DollarSign className="h-4 w-4" /> See Convoa Pricing
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </a>
                    <button
                      onClick={handleCopyShareLink}
                      className="inline-flex w-full items-center justify-center gap-1.5 bg-transparent border-0 text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 cursor-pointer"
                    >
                      <Share2 className="h-3.5 w-3.5" /> Share this demo
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* I1: Before/After ROI Narrative Comparison (Proof of Concept) */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="space-y-8"
          >
            <div className="space-y-2">
              <span className="text-[10px] font-mono text-primary uppercase tracking-widest font-semibold">
                With vs. without
              </span>
              <h2 className="text-2xl font-normal tracking-tight">
                What {displayCompany} stops losing
              </h2>
            </div>

            <div className="grid gap-0 md:grid-cols-2 rounded-2xl overflow-hidden border border-border/80 divide-y md:divide-y-0 md:divide-x divide-border">
              {/* Manual State */}
              <div className="p-6 md:p-8 space-y-4">
                <div className="flex items-center gap-2 text-destructive font-mono text-xs uppercase tracking-wider">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive"></span>
                  Today, without us
                </div>
                <ul className="space-y-3.5 text-sm sm:text-base text-foreground/80 leading-relaxed font-sans list-disc list-inside">
                  {narrative.before.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>

              {/* Convoa State */}
              <div className="p-6 md:p-8 space-y-4 bg-success/[0.02]">
                <div className="flex items-center gap-2 text-success font-mono text-xs uppercase tracking-wider">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse"></span>
                  From day one with Convoa
                </div>
                <ul className="space-y-3.5 text-sm sm:text-base text-foreground/80 leading-relaxed font-sans list-disc list-inside">
                  {narrative.after.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* ROI Pill Banner */}
            <div className="rounded-xl bg-success/[0.04] border border-success/20 p-4 text-center">
              <p className="text-xs font-semibold text-success font-mono uppercase tracking-wider">
                Projected: {narrative.projection}
              </p>
            </div>
          </motion.div>
        </motion.section>

        {/* FAQ — real questions a caller to this business asks, with how the
            agent handles them. Replaces a dead list of prompt buttons that only
            fired a toast and showed no answers. Industry-aware via lookupNarrative. */}
        <section className="relative z-10 mx-auto max-w-3xl px-6 pb-20">
          <div className="space-y-2 mb-6 text-center">
            <span className="text-[10px] font-mono text-primary uppercase tracking-widest font-semibold">
              Objection handled
            </span>
            <h2 className="text-2xl font-normal tracking-tight">
              The calls you're worried about — already handled
            </h2>
          </div>
          <div className="divide-y divide-border rounded-2xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden">
            {narrative.faqs.map((item, i) => {
              const open = openFaq === i;
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer bg-transparent border-0 hover:bg-primary/[0.03] transition-colors"
                  >
                    <span className="text-sm font-medium text-foreground">{item.q}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                        open && "rotate-180 text-primary",
                      )}
                      aria-hidden="true"
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground font-sans">
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground font-sans">
            Don't take our word for it, call the agent above and ask it yourself.
          </p>
        </section>

        {/* Footer */}
        <footer className="relative z-10 border-t border-border bg-background">
          <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-6 lg:px-10 py-8 text-[11px] text-muted-foreground font-mono">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              <span className="uppercase tracking-widest text-[9px]">Your demo is live</span>
            </div>
            <span>&copy; DataQuartz &middot; Built for {displayCompany}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Convoa Command Grid — presentational sub-components
   ───────────────────────────────────────────────────────────── */

/* Precomputed organic "silk ribbon" knot — concentric wobbly closed
   curves, each slightly larger and phase-rotated, so the strokes swirl
   into a flowing knot instead of rigid rectangles. Computed once. */
const RIBBON_PATHS: { d: string; opacity: number }[] = (() => {
  const smoothClosedPath = (pts: number[][]): string => {
    const n = pts.length;
    let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const p3 = pts[(i + 2) % n];
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += `C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
    }
    return d + "Z";
  };

  const rings = 22;
  const points = 150;
  return Array.from({ length: rings }, (_, i) => {
    const radius = 10 + i * 3.3;
    const phase = i * 0.19;
    const pts: number[][] = [];
    for (let k = 0; k < points; k++) {
      const a = (k / points) * Math.PI * 2;
      const r =
        radius * (1 + 0.11 * Math.sin(3 * a + phase) + 0.05 * Math.sin(5 * a - phase * 1.4));
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return {
      d: smoothClosedPath(pts),
      opacity: +(0.12 + (i / rings) * 0.5).toFixed(3),
    };
  });
})();

/* One rotating organic ribbon layer for the eclipse orb */
function EclipseRibbon({
  className,
  gradientId,
  rotate,
  duration,
  strokeWidth = 0.7,
  glow = false,
}: {
  className: string;
  gradientId: string;
  rotate: number;
  duration: number;
  strokeWidth?: number;
  glow?: boolean;
}) {
  return (
    <motion.svg
      viewBox="-100 -100 200 200"
      className={cn("pointer-events-none", className)}
      animate={{ rotate }}
      transition={{ duration, repeat: Infinity, ease: "linear" }}
      style={glow ? { filter: "drop-shadow(0 0 7px rgba(245,158,11,0.45))" } : undefined}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" />
          <stop offset="55%" stopColor="var(--color-primary)" />
          <stop offset="100%" stopColor="var(--color-primary)" />
        </linearGradient>
      </defs>
      <g fill="none" stroke={`url(#${gradientId})`} strokeWidth={strokeWidth}>
        {RIBBON_PATHS.map((p, i) => (
          <path key={i} d={p.d} opacity={p.opacity} />
        ))}
      </g>
    </motion.svg>
  );
}

function VoiceWaveform() {
  return (
    <div className="flex items-center justify-center gap-1.5 h-6 mb-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={i}
          className="w-1 bg-primary rounded-full"
          initial={{ height: 4 }}
          animate={{ height: [4, 24, 4] }}
          transition={{
            duration: 0.6 + (i % 3) * 0.15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function LoadingPulseRing() {
  return (
    <div className="relative flex items-center justify-center h-8 w-8 mb-2">
      <motion.div className="absolute h-full w-full rounded-full border-2 border-primary/20" />
      <motion.div
        className="absolute h-full w-full rounded-full border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent"
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </div>
  );
}

/* Card 1 — stylized agent roster panel */
function VoiceRosterIllustration() {
  const rows = [
    { label: "Calls taken", value: "995" },
    { label: "Support", value: "56" },
    { label: "Call back", value: "930" },
    { label: "Traffic", value: "100%" },
  ];
  return (
    <div className="absolute inset-0 p-3 flex flex-col gap-2 font-mono">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/60 to-success/60 flex items-center justify-center text-[9px] font-bold text-background">
          EM
        </div>
        <div className="leading-tight">
          <p className="text-[10px] font-semibold text-foreground/80">Emily</p>
          <p className="text-[8px] text-foreground/40 uppercase tracking-wider">Problem Solver</p>
        </div>
        <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-success/15 text-success font-semibold">
          6%
        </span>
      </div>
      <div className="flex-1 space-y-1">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between text-[9px] px-2 py-1 rounded bg-background/50 border border-border/50"
          >
            <span className="text-foreground/50">{r.label}</span>
            <span className="text-foreground/80 font-semibold">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Card 2 — service heat map */
function HeatmapIllustration() {
  const blobs = [
    { top: "20%", left: "25%", color: "oklch(0.62 0.19 149)", size: 42 },
    { top: "55%", left: "60%", color: "oklch(0.72 0.2 30)", size: 54 },
    { top: "35%", left: "72%", color: "oklch(0.79 0.17 70)", size: 38 },
    { top: "68%", left: "30%", color: "oklch(0.7 0.16 250)", size: 40 },
  ];
  return (
    <div className="absolute inset-0">
      {/* faint street grid */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: [
            "linear-gradient(to right, var(--border) 1px, transparent 1px)",
            "linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: "22px 22px",
        }}
      />
      {blobs.map((b, i) => (
        <div
          key={i}
          className="absolute rounded-full blur-md animate-pulse"
          style={{
            top: b.top,
            left: b.left,
            width: b.size,
            height: b.size,
            background: b.color,
            opacity: 0.55,
            animationDuration: `${4 + i}s`,
          }}
        />
      ))}
      <span className="absolute top-2 left-2 text-[8px] font-mono uppercase tracking-widest text-foreground/50">
        Heatmap
      </span>
    </div>
  );
}

/* Card 3 — revenue area chart */
function RevenueIllustration() {
  return (
    <div className="absolute inset-0 p-3 flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-mono font-semibold text-foreground/70">Revenue</span>
        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-secondary text-foreground/50">
          October
        </span>
      </div>
      <svg viewBox="0 0 200 70" preserveAspectRatio="none" className="w-full flex-1">
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.72 0.19 149)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="oklch(0.72 0.19 149)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,55 C20,40 30,50 45,30 C60,12 72,45 90,38 C108,31 120,52 140,28 C158,8 172,40 200,22 L200,70 L0,70 Z"
          fill="url(#revGrad)"
        />
        <path
          d="M0,55 C20,40 30,50 45,30 C60,12 72,45 90,38 C108,31 120,52 140,28 C158,8 172,40 200,22"
          fill="none"
          stroke="oklch(0.72 0.19 149)"
          strokeWidth="1.5"
        />
      </svg>
      <div className="flex items-center gap-3 mt-1 text-[8px] font-mono text-foreground/45">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-success" /> Sales
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-foreground/30" /> Profit
        </span>
      </div>
    </div>
  );
}

/* Card 4 — real-time call timings */
function TimelineIllustration() {
  const bars = [70, 45, 88, 32, 60, 50];
  return (
    <div className="absolute inset-0 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono font-semibold text-foreground/70">Call timings</span>
        {/* mini donut */}
        <svg viewBox="0 0 36 36" className="h-7 w-7 -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border)" strokeWidth="4" />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="oklch(0.7 0.16 250)"
            strokeWidth="4"
            strokeDasharray="94"
            strokeDashoffset="30"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="flex-1 flex flex-col justify-center gap-1.5">
        {bars.map((w, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-[7px] font-mono text-foreground/35 w-6">0{i + 1}:00</span>
            <div className="flex-1 h-1.5 rounded-full bg-background/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary/70 to-success/70"
                style={{ width: `${w}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
