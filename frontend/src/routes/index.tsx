import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import {
  Mic,
  PhoneOff,
  ArrowRight,
  Sparkles,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Sun,
  Moon,
  Plus,
  AlertTriangle,
  Database,
  Truck,
  Cloud,
  Ship,
  Compass,
  Server,
  Route as RouteIcon,
  Target,
  FileText,
  Lock,
  MessageCircle,
  Clock,
  HelpCircle,
  ExternalLink,
  Bot,
  Upload,
  X,
  Paperclip,
  Play,
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { motion, useInView } from "framer-motion";
import { submitLead } from "@/lib/leads";
import {
  submitDemoRequest,
  getDemoRequestStatus,
  uploadClarificationDocument,
  setClarificationConsent,
  startClarification,
  respondToClarification,
  skipRemainingClarification,
  getClarificationStatus,
  NetworkError,
  type ClarificationStatusResponse,
} from "@/lib/api";
import type { LeadResponse } from "@/lib/api";
import { ProgressTimeline } from "@/components/common/ProgressTimeline";
import { researchSteps } from "@/lib/mock-data";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { ParticleField } from "@/components/common/ParticleField";
import { Holographic3DModel } from "@/components/common/Holographic3DModel";

/* ── Shared class constants ── */
const INPUT_CLS =
  "w-full bg-secondary border border-border px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary/65 font-mono text-xs transition-colors input-glow";
const LABEL_CLS = "text-[10px] font-mono uppercase tracking-wider text-foreground/70";
const SELECT_CLS =
  "w-full bg-secondary border border-border px-3 py-2 text-foreground/80 focus:outline-none focus:border-primary/65 font-mono text-xs cursor-pointer transition-colors input-glow";

/* ── Social Proof Trust Signals ── */
const TRUST_SIGNALS = [
  { value: "240+", label: "Active Teams" },
  { value: "12,000+", label: "Demos Generated" },
  { value: "99.8%", label: "Uptime" },
  { value: "SOC 2", label: "Type II Certified" },
  { value: "<3 min", label: "Avg. Build Time" },
  { value: "GDPR", label: "Compliant" },
];

/* ── Silicon Valley Floating Elements & Number Counters ── */
function AnimatedStepNumber({ number }: { number: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const end = number;
    const duration = 800; // ms
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, number]);

  return (
    <div ref={ref} className="text-[10px] font-mono text-amber-500 font-bold tracking-widest mb-4">
      {count < 10 ? `0${count}` : count}
    </div>
  );
}

interface FloatingLabelInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

function FloatingLabelInput({ label, value, ...props }: FloatingLabelInputProps) {
  const [focused, setFocused] = useState(false);
  const isFilled = value !== undefined && value !== "";

  return (
    <div className="relative w-full pt-1">
      <input
        {...props}
        value={value}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        className={cn(
          "w-full bg-secondary/35 border border-border px-3.5 pt-6 pb-2 text-foreground focus:outline-none focus:border-primary/65 font-mono text-xs transition-all duration-200 input-glow rounded-none",
          props.className,
        )}
      />
      <label
        className={cn(
          "absolute left-3.5 pointer-events-none font-mono uppercase tracking-wider transition-all duration-200",
          focused || isFilled
            ? "top-2.5 text-[9px] text-amber-500 font-bold"
            : "top-5 text-[11px] text-foreground/45",
        )}
      >
        {label}
      </label>
    </div>
  );
}

interface FloatingLabelTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

function FloatingLabelTextarea({ label, value, ...props }: FloatingLabelTextareaProps) {
  const [focused, setFocused] = useState(false);
  const isFilled = value !== undefined && value !== "";

  return (
    <div className="relative w-full pt-1">
      <textarea
        {...props}
        value={value}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        className={cn(
          "w-full bg-secondary/35 border border-border px-3.5 pt-6 pb-2 text-foreground focus:outline-none focus:border-primary/65 font-mono text-xs transition-all duration-200 input-glow resize-none rounded-none",
          props.className,
        )}
      />
      <label
        className={cn(
          "absolute left-3.5 pointer-events-none font-mono uppercase tracking-wider transition-all duration-200",
          focused || isFilled
            ? "top-2.5 text-[9px] text-amber-500 font-bold"
            : "top-5 text-[11px] text-foreground/45",
        )}
      >
        {label}
      </label>
    </div>
  );
}

/* ── Integration cards data ── */
interface IntegrationCard {
  icon: LucideIcon;
  label: string;
  displayName: string;
  borderR?: boolean;
  borderB?: boolean;
  plusHidden?: string;
}

const INTEGRATION_CARDS: IntegrationCard[] = [
  {
    icon: Truck,
    label: "TMS_LOGISTICS",
    displayName: "TMS / Logistics",
    borderR: true,
    borderB: true,
  },
  {
    icon: Cloud,
    label: "SALESFORCE_CRM",
    displayName: "Salesforce CRM",
    borderB: true,
    plusHidden: "hidden md:block",
  },
  { icon: Ship, label: "DESCARTES", displayName: "Descartes", borderR: true, borderB: true },
  { icon: Compass, label: "TRIMBLE", displayName: "Trimble", borderB: true },
  {
    icon: Server,
    label: "SAP_ERP",
    displayName: "SAP ERP",
    borderR: true,
    plusHidden: "md:hidden",
  },
  { icon: RouteIcon, label: "ALPEGA", displayName: "Alpega", borderR: true },
  { icon: Target, label: "HUBSPOT", displayName: "HubSpot", borderR: true },
  { icon: Database, label: "ORACLE_NETSUITE", displayName: "Oracle NetSuite" },
];

/* ── FAQ data ── */
const FAQ_ITEMS = [
  {
    q: "Is this a sales call?",
    a: "No. If your requirements need clarification, you'll speak with an AI assistant — not a salesperson. It's a 2-minute chat focused purely on understanding your workflow so we build the right demo.",
  },
  {
    q: "How long does the whole process take?",
    a: "Under 5 minutes total. The form takes 60 seconds, the optional AI clarification call averages 2 minutes, and demo generation completes in about 3 minutes.",
  },
  {
    q: "What if I don't like the demo?",
    a: "We'll rebuild it — free. Just tell us what to adjust and we regenerate a new version tailored to your updated requirements.",
  },
  {
    q: "Who sees my data?",
    a: "Nobody outside of the demo generation pipeline. Your data is encrypted in transit and at rest, stored in EU-hosted infrastructure, and automatically deleted after 30 days.",
  },
  {
    q: "Do I need to install anything?",
    a: "No. Everything runs in your browser — the voice call, the demo portal, and the dashboard. No downloads, no plugins, no SDKs.",
  },
  {
    q: "What does it cost?",
    a: "Free to try. You can generate your first demo at no cost. Enterprise pricing with custom integrations is available on request.",
  },
];

/* ── Mock Knowledge Base API Stubs ── */

interface IngestResponse {
  status: "queued";
  documentsReceived: number;
  kbId: string;
}

// TODO: replace with real API call to <endpoint>
// Expected input: files: File[]
// Expected output: { status: 'queued'; documentsReceived: number; kbId: 'kb_mock_123'; }
async function ingestDocuments(files: File[]): Promise<IngestResponse> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        status: "queued",
        documentsReceived: files.length,
        kbId: "kb_mock_123",
      });
    }, 1500);
  });
}

// TODO: replace with real API call to GET /api/kb/questions?kbId=<kbId>
// Expected input: kbId: string
// Expected output: string[]
async function getSuggestedQuestions(kbId: string): Promise<string[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        "What are the key requirements outlined in the uploaded spec?",
        "What integrations are mentioned in these documents?",
        "Are there any compliance or security standards specified?",
        "What is the expected SLA and support turnaround time?",
        "Who are the target user personas for this integration?",
      ]);
    }, 1500);
  });
}

// TODO: replace with real API call to POST /api/kb/query
// Expected input: { question: string; kbId: string }
// Expected output: { answer: string }
async function queryKnowledgeBase(question: string, kbId: string): Promise<{ answer: string }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const q = question.toLowerCase();
      let answer = "";
      if (q.includes("requirement")) {
        answer =
          "Based on the uploaded documents, the system requires automated intake validation, human escalation policies for complex queries, and detailed activity tracking logs.";
      } else if (q.includes("integration") || q.includes("connect")) {
        answer =
          "The documents suggest integrating with Trimble TMS for logistics routing, Descartes for customs optimization, and Salesforce CRM for dispatch auditing.";
      } else if (q.includes("compliance") || q.includes("security")) {
        answer =
          "All workflows are bound to SOC 2 security protocols. The spec mandates TLS 1.3 encryption for voice streams and EU-Frankfurt hosting for regulatory compliance.";
      } else if (q.includes("sla") || q.includes("support")) {
        answer =
          "A critical SLA response time of under 2 hours is outlined, with standard operations targeted at 99.9% uptime during operational shifts.";
      } else if (q.includes("persona") || q.includes("user")) {
        answer =
          "Primary personas identified are Fleet Operators, Driver Dispatchers, and Compliance Officers needing audit-ready telemetry logs.";
      } else {
        answer = `Here is an AI-generated synthesis based on your query: '${question}'. The platform's knowledge base indicates that these specifications will be mapped dynamically to customize your Vapi voice agent and data pipeline settings.`;
      }
      resolve({ answer });
    }, 1200);
  });
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
} as const;

const itemVariants = {
  hidden: { y: 24, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 70,
      damping: 15,
    },
  },
} as const;

/* badgeVariants removed — hero badge eliminated for cleaner design */

const modelVariants = {
  hidden: { opacity: 0, scale: 0.82 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 1.5,
      ease: [0.16, 1, 0.3, 1], // easeOutExpo
      delay: 0.2,
    },
  },
} as const;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DataQuartz. Tailored Sales Demos in Minutes" },
      {
        name: "description",
        content:
          "Stop wasting days preparing sales demos. DataQuartz builds tailored client demos in minutes from your raw use case inputs.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Vapi integration states
  const [vapi, setVapi] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [callStatus, setCallStatus] = useState<"idle" | "connecting" | "on-call" | "ended">("idle");
  const [voiceForm, setVoiceForm] = useState({
    name: "",
    email: "",
    company: "",
    urgency: "exploring",
  });
  const [isVoiceFormReady, setIsVoiceFormReady] = useState(false);

  // Form pathway states
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    website: "",
    phone: "",
    industry: "logistics",
    problem_text: "",
    tools: "",
    persona: "driver_dispatch",
    language: "en-US",
    volume: "under_5k",
    urgency: "exploring",
    missedCalls: 25,
    bookingValue: 150,
    bookingRequirements: ["name", "phone", "reason"],
  });

  const calculatedLeakage = Math.round(formData.missedCalls * 4.34 * formData.bookingValue * 0.25);

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [customIndustry, setCustomIndustry] = useState("");
  const [customPersona, setCustomPersona] = useState("");

  // Refs for scrolling
  const intakeRef = useRef<HTMLDivElement>(null);

  // Real backend polling: replaces the old simulated timer.
  // Polls getDemoRequestStatus every 2s when the pipeline step is active.
  // Caps total polling at 60 seconds to avoid spinning indefinitely.
  // Dynamically load Vapi to prevent SSR crashes (since Vapi uses browser APIs)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const VAPI_PUBLIC_KEY = (import.meta.env.VITE_VAPI_PUBLIC_KEY as string) || "";
    if (!VAPI_PUBLIC_KEY) {
      console.warn("VITE_VAPI_PUBLIC_KEY is not defined in environment variables.");
    }

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

        vapiInstance.on("call-start", () => {
          setCallStatus("on-call");
          toast.success("Connected to advisor agent.");
        });

        vapiInstance.on("call-end", () => {
          setCallStatus("ended");
          toast.info("Call completed.");
          // Trigger lead submission on call end
          submitVoiceLead();
        });

        vapiInstance.on("error", (err: any) => {
          // eslint-disable-line @typescript-eslint/no-explicit-any
          console.error("Vapi error:", err);
          setCallStatus("idle");
          toast.error("Vapi agent connection failed.");
        });

        setVapi(vapiInstance);
      } catch (err) {
        console.error("Failed to initialize Vapi instance:", err);
      }
    });

    return () => {
      if (vapi) {
        vapi.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Submit standard Form Lead
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.company || !formData.problem_text) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setFormSubmitting(true);

    // Fire both calls independently:
    // 1. submitDemoRequest -> backend (creates lead, triggers Vapi provisioning)
    // 2. submitLead -> existing Slack/console alert (unchanged)

    const targetPersona =
      formData.persona === "other" ? customPersona || "other" : formData.persona;

    // Slack alert — fire and forget, do not block the pipeline
    submitLead({
      data: {
        name: formData.name,
        email: formData.email,
        company: formData.company,
        website: formData.website || undefined,
        problem_text: formData.problem_text,
        tools: formData.tools || undefined,
        persona: targetPersona,
        language: formData.language,
        volume: formData.volume,
        source: "form",
        urgency: formData.urgency,
        missed_calls: formData.missedCalls,
        booking_value: formData.bookingValue,
        booking_requirements: formData.bookingRequirements,
      },
    }).catch((err) => console.error("Slack alert failed (non-blocking):", err));

    // Backend demo-request — this one gates the pipeline UI
    try {
      const targetIndustry =
        formData.industry === "other" ? customIndustry || "other" : formData.industry || "general";
      const lead = await submitDemoRequest({
        company_name: formData.company,
        contact_name: formData.name,
        contact_email: formData.email,
        contact_phone: formData.phone || "+0000000000",
        industry: targetIndustry,
      });

      // Lead ID is obtained here
      // Save details to localStorage for personalization on the /demo-preview page
      localStorage.setItem(
        "convoa_demo_preview_data",
        JSON.stringify({
          name: formData.name,
          email: formData.email,
          company: formData.company,
          problem: formData.problem_text,
          language:
            formData.language === "en-US"
              ? "English (US Accent)"
              : formData.language === "en-GB"
                ? "English (UK Accent)"
                : formData.language === "de-DE"
                  ? "German (DE Native)"
                  : "Spanish (ES Native)",
          tools: formData.tools || "Not specified",
          missedCalls: formData.missedCalls,
          bookingValue: formData.bookingValue,
          bookingRequirements: formData.bookingRequirements,
        }),
      );

      // Save pipeline details
      localStorage.setItem(
        "convoa_pipeline_data",
        JSON.stringify({
          company: formData.company,
          problem: formData.problem_text,
        }),
      );

      // If the lead was immediately disqualified by the qualifier microservice,
      // skip directly to the pipeline view showing the qualification result
      if (lead.agent_status === "skipped") {
        setFormSubmitting(false);
        navigate({ to: "/pipeline", search: { leadId: lead.id } });
        return;
      }

      toast.success("Requirements submitted successfully!");
      navigate({ to: "/upload", search: { leadId: lead.id } });

      setCustomIndustry("");
      setCustomPersona("");
      setFormData({
        name: "",
        email: "",
        company: "",
        website: "",
        phone: "",
        industry: "logistics",
        problem_text: "",
        tools: "",
        persona: "driver_dispatch",
        language: "en-US",
        volume: "under_5k",
        urgency: "exploring",
        missedCalls: 25,
        bookingValue: 150,
        bookingRequirements: ["name", "phone", "reason"],
      });
    } catch (err) {
      if (err instanceof NetworkError) {
        toast.error("Could not reach the server. Is the backend running?");
      } else {
        toast.error("Submission failed. Please try again.");
      }
      console.error(err);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Start Vapi call
  const handleStartVoiceCall = () => {
    if (!voiceForm.name || !voiceForm.email || !voiceForm.company) {
      toast.error("Please enter your name, email, and company before calling.");
      return;
    }

    if (!vapi) {
      toast.error("Vapi SDK is still loading. Please try again in a moment.");
      return;
    }

    const VAPI_ASSISTANT_ID = (import.meta.env.VITE_VAPI_ASSISTANT_ID as string) || "";
    if (!VAPI_ASSISTANT_ID) {
      toast.error("VITE_VAPI_ASSISTANT_ID environment variable is missing.");
      return;
    }

    setCallStatus("connecting");
    try {
      vapi.start(VAPI_ASSISTANT_ID);
    } catch (err) {
      console.error("Vapi start call failed:", err);
      setCallStatus("idle");
      toast.error("Failed to start voice call.");
    }
  };

  // End Vapi call
  const handleEndVoiceCall = () => {
    if (vapi) {
      vapi.stop();
    }
  };

  // Submit Voice Lead summary automatically on call-end
  const submitVoiceLead = async () => {
    try {
      // Save details to localStorage for personalization on the /demo-preview page
      localStorage.setItem(
        "convoa_demo_preview_data",
        JSON.stringify({
          name: voiceForm.name,
          email: voiceForm.email,
          company: voiceForm.company,
          problem: "Spoke with AI Solutions Advisor via Vapi voice call.",
          language: "English (US Accent)",
          tools: "Vapi Voice Integration",
        }),
      );

      localStorage.setItem(
        "convoa_pipeline_data",
        JSON.stringify({
          company: voiceForm.company,
          problem: "Spoke with AI Solutions Advisor via Vapi voice call.",
        }),
      );

      submitLead({
        data: {
          name: voiceForm.name,
          email: voiceForm.email,
          company: voiceForm.company,
          problem_text:
            "Client spoke with AI Solutions Advisor via Vapi voice agent. (Call completed successfully).",
          source: "voice",
          urgency: voiceForm.urgency,
        },
      }).catch((err) => console.error("Slack alert failed (non-blocking):", err));

      const lead = await submitDemoRequest({
        company_name: voiceForm.company,
        contact_name: voiceForm.name,
        contact_email: voiceForm.email,
        contact_phone: "+0000000000",
        industry: "other",
      });

      setIsVoiceFormReady(false);
      setVoiceForm({ name: "", email: "", company: "", urgency: "exploring" });

      if (lead && lead.id) {
        navigate({ to: "/upload", search: { leadId: lead.id } });
      } else {
        toast.error("Failed to retrieve lead ID.");
      }
    } catch (err) {
      console.error("Failed to submit voice lead:", err);
    }
  };

  return (
    <div
      className={cn(
        "skydda-sentinel-theme min-h-screen bg-background text-foreground font-sans antialiased overflow-x-hidden selection:bg-primary/10 selection:text-primary relative",
        theme,
      )}
    >
      {/* Dynamic Background — Fine-Line Grid & Ambient Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Fine-line crosshatch grid */}
        <div
          className="absolute inset-0 opacity-[0.25] dark:opacity-[0.08]"
          style={{
            backgroundImage: [
              `linear-gradient(to right, var(--border) 1px, transparent 1px)`,
              `linear-gradient(to bottom, var(--border) 1px, transparent 1px)`,
            ].join(", "),
            backgroundSize: "64px 64px",
          }}
        />

        {/* Ambient colorful cyber glow spheres */}
        <div
          className="absolute top-[8%] left-[15%] w-[30rem] h-[30rem] bg-amber-500/[0.05] dark:bg-amber-500/[0.03] blur-[120px] rounded-full"
          style={{ animationDuration: "8s" }}
        />
        <div
          className="absolute top-[35%] right-[10%] w-[40rem] h-[40rem] bg-violet-500/[0.04] dark:bg-violet-500/[0.025] blur-[140px] rounded-full"
          style={{ animationDuration: "12s" }}
        />
        <div className="absolute bottom-[15%] left-[8%] w-[35rem] h-[35rem] bg-emerald-500/[0.035] dark:bg-emerald-500/[0.02] blur-[110px] rounded-full" />
        <div className="absolute top-[60%] right-[35%] w-[25rem] h-[25rem] bg-primary/[0.04] dark:bg-primary/[0.02] blur-[100px] rounded-full" />
      </div>

      {/* 1. Global Page Guidelines */}
      <div className="pointer-events-none fixed inset-0 z-50">
        <div className="mx-auto h-full max-w-7xl">
          <div className="relative h-full">
            <div className="absolute left-0 top-0 h-full w-px bg-border/30" />
            <div className="absolute right-0 top-0 h-full w-px bg-border/30" />
          </div>
        </div>
      </div>

      {/* 2. Navigation Header — sticky with backdrop blur */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-background/70 backdrop-blur-md border-b border-border/40 transition-colors duration-300 supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3 text-foreground">
            <div className="h-7 w-7 border border-border flex items-center justify-center bg-secondary text-foreground font-bold text-xs uppercase tracking-tight">
              DQ
            </div>
            <span className="uppercase tracking-widest text-sm font-semibold font-mono">
              DataQuartz
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 font-mono text-[11px] uppercase tracking-widest text-foreground/60">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">
              How It Works
            </a>
            <a href="#proof" className="hover:text-foreground transition-colors">
              Live Demo
            </a>
            <a href="#faq" className="hover:text-foreground transition-colors">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 border border-border hover:bg-secondary text-foreground transition-colors cursor-pointer bg-transparent"
              aria-label="Toggle Theme"
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <button
              onClick={() => handleScrollTo(intakeRef)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all font-mono font-medium text-xs tracking-wider uppercase px-4 py-2 cursor-pointer border-0"
            >
              Build My Demo
            </button>
          </div>
        </div>
      </header>

      {/* 3. Hero Section */}
      <section className="relative h-screen w-full overflow-hidden flex items-center border-b border-border/30 pt-20 px-6">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30 dark:opacity-15"
          style={{
            backgroundImage: "url('/images/hero-bg.jpg')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/80 to-background" />

        {/* Interactive Holographic 3D Backdrop Model */}
        <motion.div
          variants={modelVariants}
          initial="hidden"
          animate="visible"
          className="absolute inset-0 w-full h-full z-[1]"
        >
          <Holographic3DModel theme={theme} />
        </motion.div>

        {/* Particle constellation background */}
        <ParticleField
          className="z-[2]"
          particleCount={140}
          connectionDistance={130}
          particleColor="rgba(245, 158, 11, 0.35)"
          lineColor="rgba(245, 158, 11, 0.06)"
        />

        {/* Animated floating glow orbs */}
        <div className="absolute inset-0 pointer-events-none z-[1]">
          <div className="absolute top-[20%] left-[20%] w-[28rem] h-[28rem] bg-amber-500/[0.06] dark:bg-amber-500/[0.04] blur-[100px] rounded-full animate-float" />
          <div className="absolute top-[40%] right-[15%] w-[32rem] h-[32rem] bg-violet-500/[0.05] dark:bg-violet-500/[0.03] blur-[120px] rounded-full animate-float-delayed" />
          <div
            className="absolute bottom-[20%] left-[30%] w-[24rem] h-[24rem] bg-emerald-500/[0.04] dark:bg-emerald-500/[0.025] blur-[90px] rounded-full animate-float"
            style={{ animationDelay: "4s" }}
          />
        </div>

        {/* Radial vignette for focal depth */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--background)_75%)] z-[3]" />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 max-w-5xl mx-auto w-full text-center flex flex-col items-center justify-center space-y-8"
        >
          {/* Main Headline — single animated h1 to avoid background-clip breakage */}
          <div className="relative w-full flex justify-center z-10">
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[14rem] bg-amber-500/[0.06] dark:bg-amber-500/[0.04] blur-[100px] rounded-full pointer-events-none -z-10 animate-pulse"
              style={{ animationDuration: "6s" }}
            />
            <motion.h1
              initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-normal tracking-tight leading-[1.12] max-w-5xl gradient-text hero-text-shadow"
            >
              Never Miss Another Customer Call.{" "}
              <span className="gradient-underline">An AI Receptionist</span> Personalized to Your
              Business in Minutes.
            </motion.h1>
          </div>

          <motion.p
            variants={itemVariants}
            className="text-base md:text-lg text-foreground/65 max-w-2xl leading-relaxed font-sans"
          >
            Tell us about your business. If we need more detail, our AI will ask — no forms to
            babysit. Then watch a demo built specifically for your calls, your industry, your
            customers.
          </motion.p>

          {/* Persona targeting — frosted pill badges */}
          <motion.div
            variants={itemVariants}
            className="flex items-center gap-3 flex-wrap justify-center"
          >
            {["Sales Engineers", "Demo Teams", "SaaS Founders"].map((persona) => (
              <span
                key={persona}
                className="frosted-badge px-4 py-1.5 text-[11px] font-mono uppercase tracking-widest text-foreground/70 cursor-default"
              >
                {persona}
              </span>
            ))}
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="flex items-center gap-5 flex-wrap justify-center"
          >
            <button
              onClick={() => handleScrollTo(intakeRef)}
              className="glow-button magnetic-hover bg-primary text-primary-foreground hover:bg-primary/95 transition-all px-10 py-4 text-sm font-semibold uppercase tracking-wider flex items-center gap-2.5 cursor-pointer border-0"
            >
              Build My Demo
              <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="/demo-preview"
              className="magnetic-hover frosted-badge px-10 py-4 text-sm font-semibold uppercase tracking-wider flex items-center gap-2.5 cursor-pointer transition-all duration-300 font-sans relative overflow-hidden group rounded-none"
            >
              <Play className="h-4 w-4 text-amber-500 fill-amber-500/20 group-hover:scale-110 transition-transform" />
              Watch Demo
              <span className="absolute inset-0 border border-amber-500/0 group-hover:border-amber-500/40 transition-colors pointer-events-none" />
            </a>
            <span className="text-[10px] text-foreground/40 font-mono flex items-center gap-1.5 ml-2">
              <Clock className="h-3 w-3" /> Under 5 minutes total
            </span>
          </motion.div>
        </motion.div>
      </section>

      {/* 3.5 Social Proof Marquee Ticker */}
      <section className="w-full border-b border-border/30 overflow-hidden bg-secondary/5 relative">
        <div className="gradient-divider" />
        <div className="py-5 relative">
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
          <div className="marquee-track">
            {[...TRUST_SIGNALS, ...TRUST_SIGNALS].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2.5 whitespace-nowrap">
                <span className="text-foreground font-bold text-base font-mono stat-glow">
                  {item.value}
                </span>
                <span className="text-foreground/50 text-[11px] font-mono uppercase tracking-wider">
                  {item.label}
                </span>
                {idx < TRUST_SIGNALS.length * 2 - 1 && (
                  <span className="text-border/50 mx-4">·</span>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="gradient-divider" />
      </section>

      {/* 4. Integrations Section (rebranded from fake logos) */}
      <section className="relative w-full border-b border-border/30 py-20 px-6 bg-secondary/10">
        <div className="max-w-7xl mx-auto">
          <h2 className="mb-4 text-center font-normal text-4xl text-foreground tracking-tight md:text-5xl">
            Connects to your existing stack
          </h2>
          <p className="text-sm text-foreground/60 text-center max-w-lg mx-auto mb-12 font-sans">
            Native connectors for the tools your operations team already uses. Go live in under 3
            weeks.
          </p>

          <div className="relative grid grid-cols-2 border-x border-border/30 md:grid-cols-4">
            <div className="-translate-x-1/2 -top-px pointer-events-none absolute left-1/2 w-screen border-t border-border/30" />

            {INTEGRATION_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: INTEGRATION_CARDS.indexOf(card) * 0.08 }}
                  className={cn(
                    "group flex flex-col items-center justify-center p-8 relative bg-background integration-card-premium cursor-pointer border-border/30",
                    card.borderR && "border-r",
                    card.borderB && "border-b",
                  )}
                >
                  <div className="flex items-center justify-center h-12 w-12 border border-border bg-secondary/40 text-foreground/60 mb-4 group-hover:text-amber-500 group-hover:border-amber-500/50 group-hover:bg-amber-500/5 transition-all duration-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="font-semibold font-mono text-[11px] uppercase tracking-wider text-foreground/70 group-hover:text-foreground transition-colors text-center">
                    {card.displayName}
                  </span>
                  {card.plusHidden !== undefined && (
                    <Plus
                      className={cn(
                        "-right-[12.5px] -bottom-[12.5px] absolute z-10 size-6 text-border/30",
                        card.plusHidden,
                      )}
                      strokeWidth={1}
                    />
                  )}
                  {card.plusHidden === undefined && card.borderR && card.borderB && (
                    <Plus
                      className="-right-[12.5px] -bottom-[12.5px] absolute z-10 size-6 text-border/30"
                      strokeWidth={1}
                    />
                  )}
                </motion.div>
              );
            })}

            <div className="-translate-x-1/2 -bottom-px pointer-events-none absolute left-1/2 w-screen border-b border-border/30" />
          </div>
        </div>
      </section>

      {/* 5. How It Works — 3-Step Process (C1, I6) */}
      <section
        id="how-it-works"
        className="w-full bg-background py-24 md:py-32 border-b border-border/30 scroll-mt-20"
      >
        <div className="mx-auto max-w-7xl px-6 md:px-12 lg:px-16 space-y-14">
          <div className="text-center space-y-4">
            <h2 className="text-4xl md:text-5xl font-normal text-foreground tracking-tight">
              How Your Demo Gets Built
            </h2>
            <p className="text-sm text-foreground/60 max-w-lg mx-auto font-sans">
              Three steps. Under 5 minutes. No sales pitch.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-border">
            {/* Step 1 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0 }}
              className="p-8 md:border-r border-b md:border-b-0 border-border relative step-card-glow"
            >
              <AnimatedStepNumber number={1} />
              <div className="flex h-11 w-11 items-center justify-center bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/30 text-amber-500 mb-5 shadow-[0_0_20px_-5px_oklch(0.79_0.17_70/0.25)]">
                <FileText className="h-4.5 w-4.5" />
              </div>
              <h3 className="text-sm font-semibold text-foreground font-mono uppercase tracking-tight">
                Describe Your Challenge
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Fill out a short form with your workflow pain points. Takes 60 seconds.
              </p>
              {/* Animated connecting line */}
              <div className="hidden md:block absolute top-14 -right-4 w-8 h-px bg-gradient-to-r from-amber-500/60 to-violet-500/40 z-10" />
            </motion.div>
            {/* Step 2 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="p-8 md:border-r border-b md:border-b-0 border-border relative step-card-glow"
            >
              <AnimatedStepNumber number={2} />
              <div className="flex h-11 w-11 items-center justify-center bg-gradient-to-br from-violet-500/20 to-violet-500/5 border border-violet-500/30 text-violet-500 mb-5 shadow-[0_0_20px_-5px_oklch(0.67_0.22_292/0.25)]">
                <Mic className="h-4.5 w-4.5" />
              </div>
              <h3 className="text-sm font-semibold text-foreground font-mono uppercase tracking-tight">
                Quick AI Clarification
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                If anything's unclear, our AI assistant calls for a 2-minute voice chat — just to
                nail the details. No selling, no pressure.
              </p>
              <span className="inline-flex items-center gap-1.5 mt-3 text-[10px] font-mono text-foreground/45 uppercase tracking-widest frosted-badge px-2.5 py-1">
                <span className="h-1 w-1 rounded-full bg-violet-500/60" />
                Only if needed
              </span>
              {/* Animated connecting line */}
              <div className="hidden md:block absolute top-14 -right-4 w-8 h-px bg-gradient-to-r from-violet-500/60 to-emerald-500/40 z-10" />
            </motion.div>
            {/* Step 3 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="p-8 relative step-card-glow"
            >
              <AnimatedStepNumber number={3} />
              <div className="flex h-11 w-11 items-center justify-center bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/30 text-emerald-500 mb-5 shadow-[0_0_20px_-5px_oklch(0.72_0.19_149/0.25)]">
                <Sparkles className="h-4.5 w-4.5" />
              </div>
              <h3 className="text-sm font-semibold text-foreground font-mono uppercase tracking-tight">
                Your Live Demo Is Ready
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                In under 3 minutes, we deploy a personalized voice agent + dashboard. You'll get an
                instant link — no email wait, no sales follow-up unless you ask.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 6. Proof Section — See a sample demo (I3, I4) */}
      <section
        id="proof"
        className="w-full bg-secondary/10 py-24 md:py-28 border-b border-border/30 scroll-mt-20"
      >
        <div className="mx-auto max-w-5xl px-6 text-center space-y-8">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal text-foreground tracking-tight">
            Don't take our word for it. See a real demo.
          </h2>
          <p className="text-sm text-foreground/60 max-w-lg mx-auto font-sans">
            This is a real personalized demo we built for a logistics company. It took 2 minutes and
            47 seconds to generate.
          </p>
          <div className="border border-border bg-card p-8 relative overflow-hidden proof-card-glow glass-card">
            <div className="absolute top-0 left-0 right-0 h-[3px] gradient-line-animated" />
            <div className="flex flex-col items-center gap-6 py-8">
              <div className="relative">
                <div
                  className="absolute inset-0 bg-amber-500/10 blur-[24px] rounded-full animate-pulse"
                  style={{ animationDuration: "4s" }}
                />
                <div className="relative flex h-16 w-16 items-center justify-center bg-gradient-to-br from-amber-500/15 to-violet-500/10 border border-amber-500/25 text-foreground shadow-[0_0_30px_-8px_oklch(0.79_0.17_70/0.3)]">
                  <Sparkles className="h-7 w-7" />
                </div>
                <span className="absolute -top-1 -right-2 flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-[8px] font-mono font-bold uppercase tracking-wider">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </div>
              <div className="space-y-2 text-center">
                <p className="text-foreground font-medium text-lg font-sans">
                  Interactive Demo Portal
                </p>
                <p className="text-sm text-muted-foreground">
                  Live voice agent + dashboard, personalized for ABC Logistics
                </p>
                <p className="text-[10px] text-amber-500/70 font-mono">Built in 2 min 47 sec</p>
              </div>
              <a
                href="/demo-preview"
                className="magnetic-hover inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-semibold uppercase tracking-wider hover:bg-primary/90 transition-all border-0 font-mono"
              >
                <ExternalLink className="h-3.5 w-3.5" /> View Sample Demo
              </a>
              <p className="text-[10px] text-foreground/40 font-mono">
                No login required · Opens in a new page
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Intake / Simulation Section */}
      <section
        ref={intakeRef}
        className="bg-background py-24 px-6 border-b border-border relative dot-grid-bg"
      >
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-3xl sm:text-4xl font-normal tracking-tight text-foreground">
              See It Working — For Your Use Case
            </h2>
            <p className="text-sm text-foreground/70 max-w-xl mx-auto leading-relaxed font-sans">
              Tell us about your workflow in your own words, or talk to our AI assistant. Your
              personalized demo will be ready in minutes.
            </p>
          </div>

          <div className="max-w-4xl mx-auto glass-card gradient-border p-8 md:p-10 relative overflow-hidden transition-all duration-300 font-mono shadow-2xl rounded-xl">
            <div className="absolute top-0 left-0 w-full h-[3px] gradient-line-animated" />

            <div className="space-y-6 text-left">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                  <span className="text-[10px] font-mono text-primary font-bold uppercase tracking-widest">
                    AI Agent Builder Spec
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-foreground font-mono uppercase tracking-tight">
                  AI Voice Receptionist Specification
                </h3>
                <p className="text-xs text-foreground/70 mt-1.5 font-sans leading-relaxed">
                  Specify your company operational details, target persona, and workflow
                  requirements to generate your custom AI voice agent pilot.
                </p>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-5 font-sans text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FloatingLabelInput
                    label="Name *"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Elena Marchetti"
                    disabled={formSubmitting}
                  />
                  <div>
                    <FloatingLabelInput
                      label="Work Email *"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="elena@dataquartz.ai"
                      disabled={formSubmitting}
                    />
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      {["@gmail.com", "@outlook.com", "@yahoo.com"].map((domain) => (
                        <button
                          key={domain}
                          type="button"
                          onClick={() => {
                            if (!formData.email.includes("@")) {
                              setFormData({ ...formData, email: formData.email + domain });
                            } else {
                              const prefix = formData.email.split("@")[0];
                              setFormData({ ...formData, email: prefix + domain });
                            }
                          }}
                          className="text-[9.5px] font-mono px-2 py-0.5 bg-secondary/50 hover:bg-primary/15 hover:text-primary text-foreground/60 border border-border/50 hover:border-primary/40 rounded transition-all cursor-pointer text-left shadow-sm"
                        >
                          {domain}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FloatingLabelInput
                    label="Company Name *"
                    type="text"
                    required
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Logistics Corp"
                    disabled={formSubmitting}
                  />
                  <FloatingLabelInput
                    label="Company Website (Optional)"
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://logisticscorp.com"
                    disabled={formSubmitting}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FloatingLabelInput
                    label="Phone Number"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 555-123-4567"
                    disabled={formSubmitting}
                  />
                  <div className="space-y-1">
                    <label className={LABEL_CLS}>Industry *</label>
                    <select
                      value={formData.industry}
                      onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                      className={SELECT_CLS}
                    >
                      <option value="logistics">Logistics & Transport</option>
                      <option value="healthcare">Healthcare</option>
                      <option value="real_estate">Real Estate</option>
                      <option value="hospitality">Hospitality</option>
                      <option value="finance">Finance & Banking</option>
                      <option value="education">Education</option>
                      <option value="retail">Retail & E-commerce</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                {formData.industry === "other" && (
                  <div className="animate-fade-in">
                    <FloatingLabelInput
                      label="Specify Industry *"
                      type="text"
                      required
                      value={customIndustry}
                      onChange={(e) => setCustomIndustry(e.target.value)}
                      placeholder="e.g. Logistics, Healthcare, Tech..."
                      disabled={formSubmitting}
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <FloatingLabelTextarea
                    label="What problem are you trying to solve? *"
                    required
                    rows={3}
                    value={formData.problem_text}
                    onChange={(e) => setFormData({ ...formData, problem_text: e.target.value })}
                    placeholder="Describe key scenario steps and dispatch tasks..."
                    disabled={formSubmitting}
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1.5 items-center">
                    <span className="text-[9px] font-mono text-primary font-bold uppercase tracking-wider flex items-center gap-1 opacity-80">
                      <Sparkles className="h-3 w-3" /> Try:
                    </span>
                    {[
                      "Automate after-hours call routing",
                      "Capture caller details and sync to CRM",
                      "Answer common FAQs instantly",
                      "Schedule appointments and send reminders",
                    ].map((preset, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => setFormData({ ...formData, problem_text: preset })}
                        className="text-[10px] font-sans px-2 py-1 bg-secondary/50 hover:bg-primary/15 hover:text-primary text-foreground/70 border border-border/60 hover:border-primary/40 rounded transition-all cursor-pointer text-left shadow-sm active:scale-95"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={LABEL_CLS}>Target Persona *</label>
                    <select
                      value={formData.persona}
                      onChange={(e) => setFormData({ ...formData, persona: e.target.value })}
                      className={SELECT_CLS}
                    >
                      <option value="driver_dispatch">Driver Dispatcher</option>
                      <option value="customer_service">Customer Service Rep</option>
                      <option value="supplier_support">Supplier Support Desk</option>
                      <option value="sales_intake">Sales Intake Agent</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className={LABEL_CLS}>Agent Accent / Language *</label>
                    <select
                      value={formData.language}
                      onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                      className={SELECT_CLS}
                    >
                      <option value="en-US">English (US Accent)</option>
                      <option value="en-GB">English (UK Accent)</option>
                      <option value="de-DE">German (DE Native)</option>
                      <option value="es-ES">Spanish (ES Native)</option>
                    </select>
                  </div>
                </div>
                {formData.persona === "other" && (
                  <div className="animate-fade-in">
                    <FloatingLabelInput
                      label="Specify Persona *"
                      type="text"
                      required
                      value={customPersona}
                      onChange={(e) => setCustomPersona(e.target.value)}
                      placeholder="e.g. Sales Associate, Patient Coordinator..."
                      disabled={formSubmitting}
                    />
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={LABEL_CLS}>Avg. Missed Calls / Week *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={formData.missedCalls}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          missedCalls: Math.max(0, parseInt(e.target.value) || 0),
                        })
                      }
                      className={INPUT_CLS}
                      disabled={formSubmitting}
                    />
                    <div className="flex flex-wrap gap-1 pt-1">
                      {[15, 25, 50, 100].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setFormData({ ...formData, missedCalls: num })}
                          className={cn(
                            "text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors cursor-pointer",
                            formData.missedCalls === num
                              ? "bg-primary/20 text-primary border-primary font-bold"
                              : "bg-secondary/40 text-foreground/60 border-border hover:border-primary/50",
                          )}
                        >
                          {num}/wk
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className={LABEL_CLS}>Avg. Booking / Ticket Value ($) *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={formData.bookingValue}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bookingValue: Math.max(0, parseInt(e.target.value) || 0),
                        })
                      }
                      className={INPUT_CLS}
                      disabled={formSubmitting}
                    />
                    <div className="flex flex-wrap gap-1 pt-1">
                      {[50, 150, 300, 500].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setFormData({ ...formData, bookingValue: val })}
                          className={cn(
                            "text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors cursor-pointer",
                            formData.bookingValue === val
                              ? "bg-primary/20 text-primary border-primary font-bold"
                              : "bg-secondary/40 text-foreground/60 border-border hover:border-primary/50",
                          )}
                        >
                          ${val}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Urgency and Tools grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={LABEL_CLS}>Timeline Urgency *</label>
                    <select
                      value={formData.urgency}
                      onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
                      className={SELECT_CLS}
                      disabled={formSubmitting}
                    >
                      <option value="exploring">Just exploring</option>
                      <option value="evaluating">Evaluating solutions</option>
                      <option value="ready now">Ready to deploy now</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className={LABEL_CLS}>Current Tools & Database Systems</label>
                    <input
                      type="text"
                      value={formData.tools}
                      onChange={(e) => setFormData({ ...formData, tools: e.target.value })}
                      placeholder="e.g. Descartes, Trimble, Salesforce"
                      className={INPUT_CLS}
                      disabled={formSubmitting}
                    />
                    <div className="flex flex-wrap gap-1 pt-1">
                      {["Salesforce", "HubSpot", "Zapier", "Descartes", "Google Sheets"].map(
                        (tool) => (
                          <button
                            key={tool}
                            type="button"
                            onClick={() => {
                              const current = formData.tools
                                ? formData.tools.split(",").map((s) => s.trim())
                                : [];
                              const updated = current.includes(tool)
                                ? current.filter((t) => t !== tool)
                                : [...current.filter(Boolean), tool];
                              setFormData({ ...formData, tools: updated.join(", ") });
                            }}
                            className={cn(
                              "text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors cursor-pointer",
                              formData.tools.includes(tool)
                                ? "bg-primary/20 text-primary border-primary font-bold"
                                : "bg-secondary/40 text-foreground/60 border-border hover:border-primary/50",
                            )}
                          >
                            {formData.tools.includes(tool) ? "✓ " : "+ "}
                            {tool}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </div>
                {/* Form Actions */}{" "}
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/95 transition-all text-xs font-semibold uppercase tracking-wider py-3.5 cursor-pointer flex items-center justify-center gap-2 font-mono active:scale-98 border-0 mt-6 rounded-lg shadow-lg hover:shadow-primary/20"
                >
                  {formSubmitting ? "Dispatching Pipeline..." : "Generate Custom AI Pilot →"}
                </button>
                <p className="text-[10px] text-foreground/50 font-sans mt-2 text-center">
                  🔒 Your data is encrypted, never shared, and deleted after 30 days.{" "}
                  <a
                    href="/privacy"
                    className="underline hover:text-foreground/70 transition-colors"
                  >
                    Read our Privacy Policy →
                  </a>
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FAQ Section (C5) */}
      <section id="faq" className="bg-background py-24 px-6 border-b border-border scroll-mt-20">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="text-center space-y-4">
            <h2 className="text-3xl sm:text-4xl font-normal tracking-tight text-foreground">
              Questions before you start
            </h2>
          </div>

          <div className="divide-y divide-border border border-border">
            {FAQ_ITEMS.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.06 }}
              >
                <details className="group">
                  <summary className="flex items-center justify-between cursor-pointer px-6 py-5 text-sm font-medium text-foreground hover:bg-secondary/30 transition-colors font-sans">
                    {item.q}
                    <ChevronDown className="h-4 w-4 text-foreground/40 transition-transform duration-300 group-open:rotate-180" />
                  </summary>
                  <div className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed font-sans">
                    {item.a}
                  </div>
                </details>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Footer */}
      <footer className="bg-background text-foreground/70 py-16 px-6 text-xs font-mono border-t border-border relative">
        <div className="absolute top-0 left-0 right-0 gradient-divider" />
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 border-b border-dashed border-border/40 pb-12">
          <div className="space-y-3 sm:col-span-2">
            <Link to="/" className="flex items-center gap-3 text-foreground w-fit">
              <div className="h-7 w-7 border border-border flex items-center justify-center bg-secondary font-bold text-xs uppercase tracking-tight">
                DQ
              </div>
              <span className="font-bold tracking-widest uppercase">DataQuartz AI</span>
            </Link>
            <p className="text-[11px] text-foreground/60 font-sans max-w-xs leading-relaxed">
              Autonomous sandbox generation & Vapi agent portals. Personalized voice-agent demos,
              built in minutes.
            </p>
            <p className="text-[10px] text-foreground/50 flex items-center gap-1.5 pt-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              All systems operational
            </p>
          </div>

          <div className="space-y-3">
            <div className="text-[10px] uppercase tracking-widest text-foreground/45 font-semibold">
              Product
            </div>
            <ul className="space-y-2.5 font-sans text-[11px] text-foreground/60">
              <li>
                <a href="#how-it-works" className="hover:text-foreground transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#proof" className="hover:text-foreground transition-colors">
                  Sample Demo
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-foreground transition-colors">
                  FAQ
                </a>
              </li>
              <li>
                <a href="/demo-preview" className="hover:text-foreground transition-colors">
                  Demo Portal
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <div className="text-[10px] uppercase tracking-widest text-foreground/45 font-semibold">
              Company
            </div>
            <ul className="space-y-2.5 font-sans text-[11px] text-foreground/60">
              <li>
                <a
                  href="mailto:operations@dataquartz.ai"
                  className="hover:text-foreground transition-colors"
                >
                  operations@dataquartz.ai
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  SOC 2 Compliance
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
          <p className="text-[10px] text-foreground/50 font-sans">
            &copy; 2026 DataQuartz, Inc. All rights reserved.
          </p>
          <span className="text-[10px] text-foreground/40 flex items-center gap-1.5">
            <Lock className="h-3 w-3" />
            GDPR Compliant · EU-Hosted · SOC 2 Type II
          </span>
        </div>
      </footer>
    </div>
  );
}
