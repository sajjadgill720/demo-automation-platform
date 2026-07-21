import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Phone,
  MessageSquare,
  Calendar,
  Sun,
  Moon,
  Sparkles,
  ShieldCheck,
  Rocket,
  Gauge,
  Check,
  Bot,
  Share2,
  Download,
  ThumbsUp,
  ThumbsDown,
  User,
  ArrowRight,
  ExternalLink,
  Lock,
  CheckCircle,
  Volume2,
  Info,
  ChevronDown,
  Clock,
  Send,
  X,
} from "lucide-react";
import { CompanyLogo } from "@/components/common/CompanyCard";
import { companies } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { z } from "zod";
import { endDemoSession } from "@/lib/api";

const demoPreviewSearchSchema = z.object({
  name: z.string().optional(),
  company: z.string().optional(),
  problem: z.string().optional(),
  language: z.string().optional(),
  tools: z.string().optional(),
  assistant_id: z.string().optional(),
  lead_id: z.string().optional(),
});

export const Route = createFileRoute("/demo-preview")({
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

    let hash = 0;
    for (let i = 0; i < (name || "").length; i++) {
      hash = (name || "").charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    const logoColor = `hsl(${hue}, 65%, 45%)`;

    return {
      name,
      logoColor,
      logoInitials: initials,
    };
  })();

  // Interactive Live Call Client Setup
  const [vapi, setVapi] = useState<any>(null);
  const [callStatus, setCallStatus] = useState<"idle" | "connecting" | "on-call" | "ended">("idle");
  const [activeConsoleTab, setActiveConsoleTab] = useState<"browser" | "phone">("browser");

  // Simulated Phone Call States
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneCallState, setPhoneCallState] = useState<"idle" | "dialing" | "connected" | "ended">(
    "idle",
  );
  const [phoneCountdown, setPhoneCountdown] = useState(105); // 1:45

  // Feedback States
  const [feedbackRating, setFeedbackRating] = useState<"positive" | "negative" | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Booking Modal
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  // Suggested Questions based on use case
  const suggestedQuestions = [
    `How does Convoa handle exceptions if a driver doesn't match the scheduling requirements?`,
    `Can we trigger automated outbound scheduling calls through our ${personalization.tools.split(",")[0] || "TMS"}?`,
    `How fast can Convoa support call workloads in multiple accents?`,
    `What are the security configurations for storing driver communications?`,
  ];

  // Dynamic load of Vapi
  useEffect(() => {
    if (typeof window === "undefined") return;

    const VAPI_PUBLIC_KEY = (import.meta.env.VITE_VAPI_PUBLIC_KEY as string) || "";
    if (!VAPI_PUBLIC_KEY) {
      console.warn("VITE_VAPI_PUBLIC_KEY is not defined in environment variables.");
    }

    import("@vapi-ai/web").then((VapiModule) => {
      try {
        let VapiClass = VapiModule.default;
        if (typeof VapiClass !== "function" && VapiClass && typeof (VapiClass as any).default === "function") {
          VapiClass = (VapiClass as any).default;
        }
        if (typeof VapiClass !== "function") {
          VapiClass = VapiModule as any;
        }
        const vapiInstance = new (VapiClass as any)(VAPI_PUBLIC_KEY);

        vapiInstance.on("call-start", () => {
          setCallStatus("on-call");
          toast.success("Connected to generated demo agent.");
        });

        vapiInstance.on("call-end", () => {
          setCallStatus("ended");
          toast.info("Demo call ended.");
        });

        vapiInstance.on("error", (err: any) => {
          console.error("Vapi error:", err);
          setCallStatus("idle");
          toast.error("Connection failed.");
        });

        setVapi(vapiInstance);
      } catch (err) {
        console.error("Failed to initialize Vapi:", err);
      }
    });

    return () => {
      if (vapi) {
        vapi.stop();
      }
      // Best-effort unmount cleanup for the Vapi assistant.
      // Removed endDemoSession here because React StrictMode triggers it instantly during dev, deleting the backend agent before the user can even test it!
    };
  }, []);

  // Phone Call simulation timer
  useEffect(() => {
    if (phoneCallState !== "connected") return;
    if (phoneCountdown <= 0) {
      setPhoneCallState("ended");
      return;
    }
    const interval = setInterval(() => {
      setPhoneCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [phoneCallState, phoneCountdown]);

  const handleStartBrowserCall = () => {
    if (!vapi) {
      toast.error("Vapi is initializing. Please try again.");
      return;
    }
    // Prefer dynamic assistant_id from URL params; fall back to static env var
    const assistantId =
      dynamicAssistantId || (import.meta.env.VITE_VAPI_ASSISTANT_ID as string) || "";
    if (!assistantId) {
      toast.error("No assistant ID available. Please complete the onboarding wizard first.");
      return;
    }
    setCallStatus("connecting");
    try {
      vapi.start(assistantId);
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

  const triggerPhoneCallSimulation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) {
      toast.error("Please enter a valid phone number.");
      return;
    }
    setPhoneCallState("dialing");
    setTimeout(() => {
      setPhoneCallState("connected");
      setPhoneCountdown(105);
      toast.success("Outbound call successfully simulated!");
    }, 2500);
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

  const handleCopySlackMessage = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams({
      name: personalization.name,
      company: personalization.company,
      problem: personalization.problem,
      language: personalization.language,
      tools: personalization.tools,
    });
    const shareUrl = `${baseUrl}?${params.toString()}`;

    const text = `Hey team, generated this custom voice assistant for our dispatch floor using Convoa. Check out the sandbox and call the agent live here: ${shareUrl}`;
    navigator.clipboard.writeText(text);
    toast.success("Slack pitch copied to clipboard!");
  };

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackSubmitted(true);
    toast.success(
      feedbackRating === "positive"
        ? "Thank you for the feedback!"
        : "Revision request submitted. An operations engineer is checking your specs.",
    );
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className={cn(theme === "dark" && "dark")}>
      <div
        className="min-h-screen bg-background text-foreground relative overflow-hidden"
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
            className="absolute inset-0 opacity-[0.2] dark:opacity-[0.06]"
            style={{
              backgroundImage: [
                `linear-gradient(to right, var(--border) 1px, transparent 1px)`,
                `linear-gradient(to bottom, var(--border) 1px, transparent 1px)`,
              ].join(", "),
              backgroundSize: "64px 64px",
            }}
          />
          <div
            className="absolute top-[5%] left-[20%] w-[28rem] h-[28rem] bg-amber-500/[0.04] dark:bg-amber-500/[0.025] blur-[110px] rounded-full animate-pulse"
            style={{ animationDuration: "9s" }}
          />
          <div
            className="absolute top-[30%] right-[10%] w-[35rem] h-[35rem] bg-violet-500/[0.035] dark:bg-violet-500/[0.02] blur-[130px] rounded-full animate-pulse"
            style={{ animationDuration: "12s" }}
          />
        </div>

        {/* Header */}
        <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6 no-print">
          <Link
            to="/"
            className="flex items-center gap-3 text-xs text-muted-foreground font-mono group"
          >
            <div className="h-7 w-7 border border-border flex items-center justify-center bg-secondary text-foreground font-bold text-[10px] uppercase tracking-tight group-hover:border-amber-500/50 transition-colors">
              DQ
            </div>
            <span className="flex items-center gap-2 uppercase tracking-widest text-[10px]">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Powered by DataQuartz AI
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 border border-border hover:bg-secondary text-foreground transition-colors cursor-pointer bg-transparent"
              aria-label="Toggle Theme"
            >
              {theme === "dark" ? (
                <Sun className="h-3.5 w-3.5" />
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="relative z-10 mx-auto max-w-6xl px-6 pt-4 pb-20 space-y-12"
        >
          {/* C1: Personalization Signaling banner */}
          <div className="flex items-center gap-2.5 px-4 py-2 border border-amber-500/20 w-fit bg-amber-500/[0.04] mx-auto text-[10px] font-semibold text-amber-500 uppercase tracking-widest font-mono">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            Personalization Node Active for {personalization.name} @ {personalization.company}
          </div>

          <div className="border border-border bg-card/85 backdrop-blur-sm p-10 md:p-14 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-500 via-violet-500 to-emerald-500" />

            <div className="flex flex-col items-center gap-8 text-center">
              {/* Company Logo representation */}
              <motion.div variants={fadeUp} className="flex items-center gap-4">
                <CompanyLogo company={companyRepresentation} size={56} />
                <span className="text-muted-foreground text-xl font-light">×</span>
                <div className="flex h-14 w-14 items-center justify-center border border-border bg-secondary text-foreground">
                  <Sparkles className="h-6 w-6 text-amber-500 animate-pulse" />
                </div>
              </motion.div>

              {/* Dynamic Headline & restatement of intent */}
              <motion.div variants={fadeUp} className="max-w-3xl space-y-5">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-foreground leading-[1.15]">
                  Meet the Convoa voice agent configured for {personalization.company}
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto font-sans">
                  Based on your challenge summary:{" "}
                  <strong className="text-foreground/90 font-medium">
                    "{personalization.problem}"
                  </strong>{" "}
                  and requirements criteria, we've compiled a sandbox integration simulating
                  connections to{" "}
                  <strong className="text-foreground/90 font-medium">
                    {personalization.tools}
                  </strong>{" "}
                  systems, running in an{" "}
                  <strong className="text-foreground/90 font-medium">
                    {personalization.language}
                  </strong>{" "}
                  accent.
                </p>
              </motion.div>

              {/* C2: Live Demonstration Hub (Interactive Console) */}
              <motion.div
                variants={fadeUp}
                className="w-full max-w-xl border border-border bg-secondary/35 p-6 md:p-8 rounded-lg relative no-print shadow-xl"
              >
                <div className="absolute top-3 left-4 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  <span className="text-[10px] font-mono text-foreground/50 uppercase tracking-widest font-semibold">
                    LIVE CONSOLE: Vapi Sandbox Active
                  </span>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border mb-6 mt-4">
                  <button
                    onClick={() => setActiveConsoleTab("browser")}
                    className={cn(
                      "flex-1 pb-3 text-xs uppercase tracking-wider font-semibold font-mono border-b-2 transition-all cursor-pointer bg-transparent",
                      activeConsoleTab === "browser"
                        ? "border-amber-500 text-amber-500"
                        : "border-transparent text-foreground/55 hover:text-foreground",
                    )}
                  >
                    Call in Browser
                  </button>
                  <button
                    onClick={() => setActiveConsoleTab("phone")}
                    className={cn(
                      "flex-1 pb-3 text-xs uppercase tracking-wider font-semibold font-mono border-b-2 transition-all cursor-pointer bg-transparent",
                      activeConsoleTab === "phone"
                        ? "border-amber-500 text-amber-500"
                        : "border-transparent text-foreground/55 hover:text-foreground",
                    )}
                  >
                    Outbound Call Simulation
                  </button>
                </div>

                {/* Tab content A: Browser Vapi call */}
                {activeConsoleTab === "browser" && (
                  <div className="space-y-6">
                    <div className="flex justify-center relative py-2">
                      <button
                        onClick={
                          callStatus === "on-call" ? handleEndBrowserCall : handleStartBrowserCall
                        }
                        disabled={callStatus === "connecting"}
                        className={cn(
                          "h-20 w-20 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-lg outline-none focus:ring-4 font-mono bg-transparent",
                          callStatus === "on-call"
                            ? "bg-rose-500/10 border-rose-500 text-rose-500 hover:bg-rose-500/20 focus:ring-rose-500/20 animate-pulse"
                            : "bg-primary/10 border-primary text-primary hover:bg-primary/20 focus:ring-primary/25",
                        )}
                      >
                        {callStatus === "on-call" ? (
                          <Volume2 className="h-8 w-8 text-rose-500 animate-bounce" />
                        ) : (
                          <Phone className="h-8 w-8 text-primary" />
                        )}
                      </button>
                    </div>

                    {/* reactive audio visualizer waveform */}
                    {callStatus === "on-call" && (
                      <div className="flex items-center gap-1.5 h-6 justify-center bg-transparent my-4">
                        {[...Array(16)].map((_, i) => (
                          <motion.div
                            key={i}
                            className="w-1 bg-amber-500 rounded-full"
                            animate={{ height: [6, 26, 6] }}
                            transition={{
                              duration: 0.5 + i * 0.04,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                          />
                        ))}
                      </div>
                    )}

                    <div className="text-center space-y-1 text-xs">
                      <p className="font-semibold tracking-wider uppercase font-mono">
                        {callStatus === "idle" && "READY TO ENGAGE"}
                        {callStatus === "connecting" && "DIALING VOICE CORE..."}
                        {callStatus === "on-call" && "AGENT SECURED — VOICE ACTIVE"}
                        {callStatus === "ended" && "SESSION COMPLETED"}
                      </p>
                      <p className="text-foreground/50 font-sans max-w-sm mx-auto">
                        {callStatus === "idle" &&
                          "Click the receiver to launch a speech dialog session with your demo agent."}
                        {callStatus === "connecting" &&
                          "Initializing speech protocols and loading credentials..."}
                        {callStatus === "on-call" &&
                          "Talk directly in your browser. Confirm scheduling tasks or ask the agent details."}
                        {callStatus === "ended" &&
                          "Thank you. Use the CTA below if you wish to deploy this configuration."}
                      </p>
                    </div>
                  </div>
                )}

                {/* Tab content B: Outbound simulator */}
                {activeConsoleTab === "phone" && (
                  <div className="space-y-4 text-left">
                    {phoneCallState === "idle" && (
                      <form onSubmit={triggerPhoneCallSimulation} className="space-y-4 font-sans">
                        <p className="text-xs text-foreground/75 leading-relaxed">
                          Receive a direct phone call from this agent to experience it like a
                          driver/client on a standard cellular connection.
                        </p>
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono uppercase tracking-wider text-foreground/60">
                            Phone Number
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="tel"
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                              placeholder="+1 (555) 019-2834"
                              className="flex-1 bg-background border border-border px-3 py-2 text-foreground focus:outline-none focus:border-amber-500 text-xs font-mono"
                              required
                            />
                            <button
                              type="submit"
                              className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors border-0 font-mono"
                            >
                              Call Me
                            </button>
                          </div>
                        </div>
                      </form>
                    )}

                    {phoneCallState === "dialing" && (
                      <div className="text-center py-6 space-y-3">
                        <div className="h-10 w-10 border border-amber-500/30 bg-amber-500/10 text-amber-500 flex items-center justify-center rounded-full mx-auto animate-spin">
                          <Phone className="h-4 w-4" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-mono font-bold uppercase tracking-wider text-amber-500">
                            Dialing Outbound Connection...
                          </p>
                          <p className="text-[11px] text-foreground/50">
                            Calling your mobile line at {phoneNumber}.
                          </p>
                        </div>
                      </div>
                    )}

                    {phoneCallState === "connected" && (
                      <div className="text-center py-6 space-y-4 bg-emerald-500/[0.03] border border-emerald-500/20 p-5">
                        <div className="flex items-center justify-between text-xs font-mono border-b border-border pb-2 border-dashed">
                          <span className="text-emerald-500 flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            ACTIVE OUTBOUND
                          </span>
                          <span>Duration: {formatTime(phoneCountdown)}</span>
                        </div>
                        <p className="text-xs text-foreground/80 leading-relaxed font-sans max-w-sm mx-auto">
                          Our AI dispatcher is speaking with you. Answer the call and verify
                          dispatch tasks, request details, or test exception protocols.
                        </p>
                        <button
                          onClick={() => setPhoneCallState("ended")}
                          className="bg-rose-600/10 border border-rose-500 text-rose-500 hover:bg-rose-600/20 text-xs font-mono uppercase tracking-wider px-4 py-1.5 cursor-pointer font-semibold"
                        >
                          Hang Up Call
                        </button>
                      </div>
                    )}

                    {phoneCallState === "ended" && (
                      <div className="text-center py-6 space-y-3">
                        <div className="h-10 w-10 border border-border bg-secondary text-foreground flex items-center justify-center rounded-full mx-auto">
                          <CheckCircle className="h-5 w-5 text-emerald-500" />
                        </div>
                        <p className="text-xs font-mono font-bold uppercase tracking-wider">
                          Outbound Call Ended
                        </p>
                        <button
                          onClick={() => {
                            setPhoneCallState("idle");
                            setPhoneNumber("");
                          }}
                          className="text-xs text-primary underline cursor-pointer bg-transparent border-0 font-sans"
                        >
                          Simulate again
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Anxiety Reduction Badges (N2) */}
                <div className="flex items-center justify-center gap-4 text-[10px] text-foreground/40 font-mono mt-6 pt-4 border-t border-border/40">
                  <span className="flex items-center gap-1">
                    <Lock className="h-3 w-3" /> SOC 2 SECURED
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> GDPR REGION-LOCKED
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Volume2 className="h-3 w-3" /> AUDIO IS ENCRYPTED
                  </span>
                </div>
              </motion.div>

              {/* C3: Objection Handling Cards ( PROCUREMENT GRID ) */}
              <motion.div
                variants={fadeUp}
                className="w-full grid gap-6 md:grid-cols-3 text-left border-t border-border pt-8 mt-4 font-sans"
              >
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-foreground/90">
                    How long to deploy?
                  </h4>
                  <p className="text-[11px] text-foreground/60 leading-relaxed">
                    Under 3 weeks. Convoa connects natively with Descartes, Trimble, and SAP ERP
                    without locking up custom developer resources.
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-foreground/90">
                    Is my data secure?
                  </h4>
                  <p className="text-[11px] text-foreground/60 leading-relaxed">
                    Yes. All sessions are encrypted in transit and at rest. GDPR compliant,
                    EU-hosted nodes. Sandbox data automatically purges after 30 days.
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-foreground/90">
                    Can we pilot first?
                  </h4>
                  <p className="text-[11px] text-foreground/60 leading-relaxed">
                    We support single-site beta trials with your custom rules and databases so you
                    can verify response accuracy before rollout.
                  </p>
                </div>
              </motion.div>
            </div>
          </div>

          {/* I1: Before/After ROI Narrative Comparison (Proof of Concept) */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="border border-border p-8 md:p-10 space-y-8 bg-card/60 backdrop-blur-sm"
          >
            <div className="space-y-2">
              <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest font-semibold">
                Operational Projections
              </span>
              <h2 className="text-2xl font-normal tracking-tight">
                Before / After Comparison for {personalization.company}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xl font-sans">
                We mapped Convoa's autonomous execution against your stated dispatch floor workload
                bottlenecks:
              </p>
            </div>

            <div className="grid gap-0 md:grid-cols-2 border border-border/80 divide-y md:divide-y-0 md:divide-x divide-border">
              {/* Manual State */}
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2 text-rose-500 font-mono text-xs uppercase tracking-wider">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                  Current Operations State
                </div>
                <ul className="space-y-3 text-xs text-foreground/75 leading-relaxed font-sans list-disc list-inside">
                  <li>Manual dispatcher scheduling: averages 8 minutes per scheduling dispute.</li>
                  <li>Inbound queues suffer drop-offs during high peak scheduling congestion.</li>
                  <li>Descartes/Trimble logging requires manual operator copy-paste entry.</li>
                </ul>
              </div>

              {/* Convoa State */}
              <div className="p-6 space-y-4 bg-emerald-500/[0.02]">
                <div className="flex items-center gap-2 text-emerald-500 font-mono text-xs uppercase tracking-wider">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Convoa Execution State
                </div>
                <ul className="space-y-3 text-xs text-foreground/75 leading-relaxed font-sans list-disc list-inside">
                  <li>AI Dispatcher Handling: under 90 seconds average resolution.</li>
                  <li>100% answer rate: parallel inbound phone lines scale instantly.</li>
                  <li>
                    Automated schema synchronization: writes updates directly via system APIs.
                  </li>
                </ul>
              </div>
            </div>

            {/* ROI Pill Banner */}
            <div className="bg-emerald-500/[0.04] border border-emerald-500/20 p-4 text-center">
              <p className="text-xs font-semibold text-emerald-500 font-mono uppercase tracking-wider">
                📈 Projected ROI for {personalization.company}: 81% reduction in ticket-resolution
                time & $0 cost-per-missed-dispatch.
              </p>
            </div>
          </motion.div>

          {/* I2 & N1: Conversion CTA, Stakeholder Share & Champion Toolkit */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch"
          >
            {/* Left: Call to Actions (6 columns) */}
            <div className="md:col-span-6 border border-border bg-card/60 p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest font-semibold">
                  Action Hub
                </span>
                <h3 className="text-lg font-semibold font-mono uppercase tracking-tight">
                  Deploy This Configuration
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-sans">
                  If this demo matches your expected scheduling workflows, claim this agent to
                  connect it to your testing databases and custom numbers.
                </p>
              </div>

              <div className="space-y-3 font-mono">
                <button
                  onClick={() => setShowBookingModal(true)}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all py-4 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer border-0"
                >
                  <Calendar className="h-4 w-4" /> Claim Agent & Book Hand-off
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleCopyShareLink}
                    className="border border-border bg-transparent text-foreground hover:bg-secondary transition-all py-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Share2 className="h-4 w-4" /> Share Link
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="border border-border bg-transparent text-foreground hover:bg-secondary transition-all py-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="h-4 w-4" /> PDF Summary
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Champion Slack Toolkit & Share (6 columns) */}
            <div className="md:col-span-6 border border-border bg-card/60 p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest font-semibold">
                  Internal Champion Toolkit
                </span>
                <h3 className="text-lg font-semibold font-mono uppercase tracking-tight">
                  Pitch Convoa Internally
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-sans">
                  Need to review this sandboxed configuration with your operations director or
                  logistics lead? Use this pre-composed brief.
                </p>
              </div>

              <div className="bg-secondary/40 border border-border p-4 rounded text-left font-mono space-y-3">
                <div className="flex justify-between items-center text-[9px] text-foreground/40 uppercase tracking-widest border-b border-border pb-2 border-dashed">
                  <span>Pre-written Message</span>
                  <span className="text-amber-500">Copy to Slack</span>
                </div>
                <p className="text-[11px] text-foreground/75 leading-relaxed font-sans line-clamp-3">
                  Hey team, generated this custom voice assistant for our dispatch floor using
                  Convoa. Check out the sandbox and call the agent live here:{" "}
                  {typeof window !== "undefined" ? window.location.href : ""}
                </p>
                <button
                  onClick={handleCopySlackMessage}
                  className="w-full bg-secondary border border-border hover:border-zinc-500/50 text-foreground text-[10px] font-semibold uppercase tracking-wider py-2 cursor-pointer transition-colors"
                >
                  Copy Message Text
                </button>
              </div>
            </div>
          </motion.div>

          {/* I3: Lightweight Feedback Loop (Interactive Form) */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="border border-border p-8 bg-card/60 backdrop-blur-sm relative no-print max-w-xl mx-auto"
          >
            <div className="space-y-4">
              <div className="space-y-1.5 text-center">
                <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest font-semibold">
                  Pipeline Feedback
                </span>
                <h3 className="text-lg font-normal tracking-tight">
                  Was this generated sandbox relevant?
                </h3>
              </div>

              {!feedbackSubmitted ? (
                <form onSubmit={handleFeedbackSubmit} className="space-y-4 font-sans text-xs">
                  {/* Rating Selector */}
                  <div className="flex gap-4 justify-center">
                    <button
                      type="button"
                      onClick={() => setFeedbackRating("positive")}
                      className={cn(
                        "flex items-center gap-2 border px-6 py-3 font-mono uppercase tracking-wider text-xs font-semibold cursor-pointer bg-transparent",
                        feedbackRating === "positive"
                          ? "border-emerald-500 text-emerald-500 bg-emerald-500/[0.03]"
                          : "border-border text-foreground hover:bg-secondary",
                      )}
                    >
                      <ThumbsUp className="h-4 w-4" /> Yes, Accurate
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeedbackRating("negative")}
                      className={cn(
                        "flex items-center gap-2 border px-6 py-3 font-mono uppercase tracking-wider text-xs font-semibold cursor-pointer bg-transparent",
                        feedbackRating === "negative"
                          ? "border-rose-500 text-rose-500 bg-rose-500/[0.03]"
                          : "border-border text-foreground hover:bg-secondary",
                      )}
                    >
                      <ThumbsDown className="h-4 w-4" /> Needs Tweaks
                    </button>
                  </div>

                  {/* Rating text prompt */}
                  {feedbackRating && (
                    <div className="space-y-1.5 text-left animate-fade-in">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-foreground/75">
                        {feedbackRating === "positive"
                          ? "What works well? (Optional)"
                          : "What did the agent miss? (e.g. tools, workflow instructions) *"}
                      </label>
                      <textarea
                        required={feedbackRating === "negative"}
                        rows={2}
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder={
                          feedbackRating === "positive"
                            ? "Provide any comments..."
                            : "Tell us what to adjust so we can rebuild your agent..."
                        }
                        className="w-full bg-secondary border border-border px-3 py-2 text-foreground focus:outline-none focus:border-amber-500 text-xs font-mono resize-none"
                      />
                      <button
                        type="submit"
                        className="w-full bg-primary text-primary-foreground hover:bg-primary/95 transition-all text-[11px] font-mono font-semibold uppercase tracking-wider py-2.5 cursor-pointer border-0 flex items-center justify-center gap-1.5"
                      >
                        <Send className="h-3.5 w-3.5" /> Submit Revision Feedback
                      </button>
                    </div>
                  )}
                </form>
              ) : (
                <div className="text-center py-4 space-y-2 font-mono">
                  <div className="h-10 w-10 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center rounded-full mx-auto">
                    <Check className="h-5 w-5" />
                  </div>
                  <p className="text-xs uppercase tracking-wider font-bold">Feedback Dispatched</p>
                  <p className="text-[11px] text-foreground/50 font-sans leading-relaxed max-w-xs mx-auto">
                    Thank you.{" "}
                    {feedbackRating === "negative"
                      ? "Our engineering team will adjust the pipeline config and trigger a rebuild."
                      : "Your comments are linked to your sandbox configuration profile."}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.section>

        {/* Suggested Questions */}
        <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20 no-print">
          <div className="space-y-4">
            <div>
              <h2 className="text-xs font-semibold text-foreground font-mono uppercase tracking-wider">
                Try asking the agent
              </h2>
              <p className="text-xs text-muted-foreground mt-1 font-sans">
                Suggested questions grounded in {personalization.company}&apos;s public
                documentation and tools.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {suggestedQuestions.map((q, i) => (
                <button
                  key={q}
                  onClick={() => {
                    toast.info(`Ask the voice agent: "${q}"`);
                  }}
                  className="border border-border bg-card/60 backdrop-blur-sm px-5 py-4 text-left text-xs text-foreground transition-all duration-200 hover:border-amber-500/40 hover:bg-amber-500/5 hover:shadow-sm cursor-pointer font-sans"
                >
                  &ldquo;{q}&rdquo;
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative z-10 border-t border-border bg-background">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-[11px] text-muted-foreground font-mono">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="uppercase tracking-widest text-[9px]">
                Demo Active &middot; EU-Frankfurt Node
              </span>
            </div>
            <span>&copy; DataQuartz &middot; Demo prepared 2026 &middot; Expires in 8 days</span>
          </div>
        </footer>

        {/* Calendar Booking Modal Widget (C3) */}
        <AnimatePresence>
          {showBookingModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-card border border-border w-full max-w-md p-6 font-mono relative shadow-2xl rounded-lg"
              >
                <button
                  onClick={() => {
                    setShowBookingModal(false);
                    setBookingConfirmed(false);
                    setSelectedTimeSlot(null);
                  }}
                  className="absolute top-4 right-4 text-foreground/50 hover:text-foreground bg-transparent border-0 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>

                {!bookingConfirmed ? (
                  <div className="space-y-5 text-left">
                    <div className="space-y-1">
                      <span className="text-[9px] text-amber-500 uppercase tracking-widest font-semibold">
                        Scheduler
                      </span>
                      <h3 className="text-base font-bold uppercase">Claim Agent & Book Setup</h3>
                      <p className="text-xs text-foreground/60 font-sans leading-relaxed">
                        Select a 15-minute slot to connect this sandbox agent to your team's
                        Descartes/Trimble live test databases.
                      </p>
                    </div>

                    {/* Time slots */}
                    <div className="space-y-2 font-mono">
                      <p className="text-[10px] text-foreground/45 uppercase tracking-widest">
                        Available Slots (Tomorrow)
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {["09:00 AM", "10:30 AM", "01:00 PM", "03:30 PM"].map((slot) => (
                          <button
                            key={slot}
                            onClick={() => setSelectedTimeSlot(slot)}
                            className={cn(
                              "border py-2.5 font-mono cursor-pointer transition-colors bg-transparent",
                              selectedTimeSlot === slot
                                ? "border-amber-500 text-amber-500 bg-amber-500/5 font-semibold"
                                : "border-border text-foreground hover:bg-secondary",
                            )}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (!selectedTimeSlot) {
                          toast.error("Please select a time slot first.");
                          return;
                        }
                        setBookingConfirmed(true);
                      }}
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/95 transition-all py-3 text-xs font-semibold uppercase tracking-wider border-0 cursor-pointer"
                    >
                      Confirm Booking Slot
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-6 space-y-4">
                    <div className="h-12 w-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center rounded-full mx-auto">
                      <CheckCircle className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold uppercase tracking-wider">
                        Booking Confirmed!
                      </h4>
                      <p className="text-xs text-foreground/60 font-sans leading-relaxed max-w-xs mx-auto">
                        Your hand-off setup session is booked for tomorrow at{" "}
                        <strong className="text-foreground">{selectedTimeSlot}</strong>. A calendar
                        invite has been sent to your registered email.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowBookingModal(false);
                        setBookingConfirmed(false);
                        setSelectedTimeSlot(null);
                      }}
                      className="border border-border text-foreground hover:bg-secondary px-6 py-2 text-xs font-semibold uppercase tracking-wider cursor-pointer"
                    >
                      Close Window
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
