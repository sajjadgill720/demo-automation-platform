import { createFileRoute, Link } from "@tanstack/react-router";
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
import { submitDemoRequest, getDemoRequestStatus, NetworkError } from "@/lib/api";
import type { LeadResponse } from "@/lib/api";
import { ProgressTimeline } from "@/components/common/ProgressTimeline";
import { researchSteps } from "@/lib/mock-data";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { ParticleField } from "@/components/common/ParticleField";

/* ── Shared class constants ── */
const INPUT_CLS = "w-full bg-secondary border border-border px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary/65 font-mono text-xs transition-colors input-glow";
const LABEL_CLS = "text-[10px] font-mono uppercase tracking-wider text-foreground/70";
const SELECT_CLS = "w-full bg-secondary border border-border px-3 py-2 text-foreground/80 focus:outline-none focus:border-primary/65 font-mono text-xs cursor-pointer transition-colors input-glow";

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
          props.className
        )}
      />
      <label
        className={cn(
          "absolute left-3.5 pointer-events-none font-mono uppercase tracking-wider transition-all duration-200",
          focused || isFilled
            ? "top-2.5 text-[9px] text-amber-500 font-bold"
            : "top-5 text-[11px] text-foreground/45"
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
          props.className
        )}
      />
      <label
        className={cn(
          "absolute left-3.5 pointer-events-none font-mono uppercase tracking-wider transition-all duration-200",
          focused || isFilled
            ? "top-2.5 text-[9px] text-amber-500 font-bold"
            : "top-5 text-[11px] text-foreground/45"
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
  { icon: Truck, label: "TMS_LOGISTICS", displayName: "TMS / Logistics", borderR: true, borderB: true },
  { icon: Cloud, label: "SALESFORCE_CRM", displayName: "Salesforce CRM", borderB: true, plusHidden: "hidden md:block" },
  { icon: Ship, label: "DESCARTES", displayName: "Descartes", borderR: true, borderB: true },
  { icon: Compass, label: "TRIMBLE", displayName: "Trimble", borderB: true },
  { icon: Server, label: "SAP_ERP", displayName: "SAP ERP", borderR: true, plusHidden: "md:hidden" },
  { icon: RouteIcon, label: "ALPEGA", displayName: "Alpega", borderR: true },
  { icon: Target, label: "HUBSPOT", displayName: "HubSpot", borderR: true },
  { icon: Database, label: "ORACLE_NETSUITE", displayName: "Oracle NetSuite" },
];

/* ── FAQ data ── */
const FAQ_ITEMS = [
  { q: "Is this a sales call?", a: "No. If your requirements need clarification, you'll speak with an AI assistant — not a salesperson. It's a 2-minute chat focused purely on understanding your workflow so we build the right demo." },
  { q: "How long does the whole process take?", a: "Under 5 minutes total. The form takes 60 seconds, the optional AI clarification call averages 2 minutes, and demo generation completes in about 3 minutes." },
  { q: "What if I don't like the demo?", a: "We'll rebuild it — free. Just tell us what to adjust and we regenerate a new version tailored to your updated requirements." },
  { q: "Who sees my data?", a: "Nobody outside of the demo generation pipeline. Your data is encrypted in transit and at rest, stored in EU-hosted infrastructure, and automatically deleted after 30 days." },
  { q: "Do I need to install anything?", a: "No. Everything runs in your browser — the voice call, the demo portal, and the dashboard. No downloads, no plugins, no SDKs." },
  { q: "What does it cost?", a: "Free to try. You can generate your first demo at no cost. Enterprise pricing with custom integrations is available on request." },
];

/* ── Mock Knowledge Base API Stubs ── */

interface IngestResponse {
  status: 'queued';
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
        status: 'queued',
        documentsReceived: files.length,
        kbId: 'kb_mock_123',
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
        "Who are the target user personas for this integration?"
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
        answer = "Based on the uploaded documents, the system requires automated intake validation, human escalation policies for complex queries, and detailed activity tracking logs.";
      } else if (q.includes("integration") || q.includes("connect")) {
        answer = "The documents suggest integrating with Trimble TMS for logistics routing, Descartes for customs optimization, and Salesforce CRM for dispatch auditing.";
      } else if (q.includes("compliance") || q.includes("security")) {
        answer = "All workflows are bound to SOC 2 security protocols. The spec mandates TLS 1.3 encryption for voice streams and EU-Frankfurt hosting for regulatory compliance.";
      } else if (q.includes("sla") || q.includes("support")) {
        answer = "A critical SLA response time of under 2 hours is outlined, with standard operations targeted at 99.9% uptime during operational shifts.";
      } else if (q.includes("persona") || q.includes("user")) {
        answer = "Primary personas identified are Fleet Operators, Driver Dispatchers, and Compliance Officers needing audit-ready telemetry logs.";
      } else {
        answer = `Here is an AI-generated synthesis based on your query: '${question}'. The platform's knowledge base indicates that these specifications will be mapped dynamically to customize your Vapi voice agent and data pipeline settings.`;
      }
      resolve({ answer });
    }, 1200);
  });
}

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

  const calculatedLeakage = Math.round(
    formData.missedCalls * 4.34 * formData.bookingValue * 0.25
  );

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Pipeline simulation states
  const [isFormBuilding, setIsFormBuilding] = useState(false);
  const [formBuildStep, setFormBuildStep] = useState(0);
  const [formLogIdx, setFormLogIdx] = useState(0);
  const [formBuildCompany, setFormBuildCompany] = useState("");
  const [formBuildProblem, setFormBuildProblem] = useState("");

  // Unified onboarding step state machine
  const [flowStep, setFlowStep] = useState<"intake" | "upload" | "questions" | "pipeline" | "completed">("intake");

  // Step 1: Document Upload states
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isIngesting, setIsIngesting] = useState(false);
  const [kbId, setKbId] = useState<string | null>(null);
  const [step1Skipped, setStep1Skipped] = useState(false);

  // Step 2: Specialized Questions states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [qaList, setQaList] = useState<{ question: string; answer: string }[]>([]);
  const [isQuerying, setIsQuerying] = useState(false);
  const [currentQuestionText, setCurrentQuestionText] = useState("");
  const [step2Skipped, setStep2Skipped] = useState(false);

  // Backend integration state
  const [leadId, setLeadId] = useState<string | null>(null);
  const [provisionedAssistantId, setProvisionedAssistantId] = useState<string | null>(null);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [customIndustry, setCustomIndustry] = useState("");

  // Refs for scrolling
  const intakeRef = useRef<HTMLDivElement>(null);

  // Real backend polling: replaces the old simulated timer.
  // Polls getDemoRequestStatus every 2s when the pipeline step is active.
  // Caps total polling at 60 seconds to avoid spinning indefinitely.
  useEffect(() => {
    if (!isFormBuilding || !leadId) return;

    const POLL_INTERVAL_MS = 2000;
    const MAX_POLL_DURATION_MS = 60000;
    const startTime = Date.now();

    const pollId = setInterval(async () => {
      // Timeout check
      if (Date.now() - startTime > MAX_POLL_DURATION_MS) {
        clearInterval(pollId);
        setIsFormBuilding(false);
        setPollingError("This is taking longer than expected. Please try again.");
        return;
      }

      try {
        const lead = await getDemoRequestStatus(leadId);

        if (lead.agent_status === "active") {
          clearInterval(pollId);
          setProvisionedAssistantId(lead.assistant_id);
          setIsFormBuilding(false);
          setFormSubmitted(true);
          setFormBuildStep(7);
          setFormLogIdx(10);
          setFlowStep("completed");
        } else if (lead.agent_status === "failed") {
          clearInterval(pollId);
          setIsFormBuilding(false);
          setPollingError(lead.failure_reason || "Vapi agent provisioning failed.");
        }
        // If still "pending", keep polling
      } catch {
        // Swallow transient network blips during polling — keep trying
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(pollId);
  }, [isFormBuilding, leadId]);

  // Animate the console log lines while pipeline is active
  useEffect(() => {
    if (!isFormBuilding) return;

    // Advance build step visually every 1.5s while we wait for the real poll result
    const stepInterval = setInterval(() => {
      setFormBuildStep((prev) => (prev >= 7 ? 7 : prev + 1));
    }, 1500);

    const logInterval = setInterval(() => {
      setFormLogIdx((prev) => (prev >= 10 ? 10 : prev + 1));
    }, 1000);

    return () => {
      clearInterval(stepInterval);
      clearInterval(logInterval);
    };
  }, [isFormBuilding]);

  // Step 2: Auto-fetch suggested questions when entering Step 2 with ingested documents
  useEffect(() => {
    if (flowStep === "questions" && kbId && !step1Skipped) {
      setIsAnalyzing(true);
      getSuggestedQuestions(kbId)
        .then((questions) => {
          setSuggestedQuestions(questions);
        })
        .catch((err) => {
          console.error("Failed to load suggested questions:", err);
          toast.error("Failed to load suggested questions.");
        })
        .finally(() => {
          setIsAnalyzing(false);
        });
    }
  }, [flowStep, kbId, step1Skipped]);

  // Step 2 Greeting: Initialize AI conversation dynamically based on form inputs
  useEffect(() => {
    if (flowStep === "questions" && qaList.length === 0) {
      const company = formData.company || "your company";
      const leakageStr = calculatedLeakage.toLocaleString();
      const requirements = formData.bookingRequirements.length > 0
        ? formData.bookingRequirements.map(r => r.toUpperCase()).join(", ")
        : "NONE";
      
      const greeting = `Hi! I'm your AI Solutions Architect. I've designed a voice receptionist pilot for **${company}** collecting client details: [${requirements}]. Currently, with **${formData.missedCalls}** weekly missed calls and a ticket value of **$${formData.bookingValue}**, your monthly revenue leakage is estimated at **$${leakageStr}**. Let's refine this! Try typing: "actually we miss 45 calls", "require email address", or "sync to Salesforce".`;
      
      setQaList([{ question: "[SYSTEM ONBOARDING]", answer: greeting }]);
    }
  }, [flowStep]);

  const getBuildLogLines = (company: string, problem: string) => [
    { t: "0.2s", msg: `Initializing builder sequence for "${company}"…` },
    {
      t: "0.8s",
      msg: `GET https://${company.toLowerCase().replace(/[^a-z0-9]/g, "") || "unknown"}.com…`,
    },
    { t: "1.4s", msg: `Crawling site structure & compliance headers for ${company}…` },
    { t: "2.1s", msg: `Identified tools schema: Salesforce, Descartes, Trimble…` },
    { t: "2.8s", msg: `Target compliance requirement parsed: "${problem.substring(0, 50)}..."` },
    { t: "3.6s", msg: `Provisioning Vapi voice agent in EU-Frankfurt cluster…` },
    { t: "4.5s", msg: `Synthesizing driver/dispatch dialogues in English & German…` },
    { t: "5.4s", msg: `Deploying mock database schemas for shifts & schedules…` },
    { t: "6.3s", msg: `Compliance human gate verification check [OK]…` },
    { t: "7.1s", msg: `Interactive preview bundle created successfully (DMO-8024).` },
  ];

  // Dynamically load Vapi to prevent SSR crashes (since Vapi uses browser APIs)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const VAPI_PUBLIC_KEY = (import.meta.env.VITE_VAPI_PUBLIC_KEY as string) || "";
    if (!VAPI_PUBLIC_KEY) {
      console.warn("VITE_VAPI_PUBLIC_KEY is not defined in environment variables.");
    }

    import("@vapi-ai/web").then((VapiModule) => {
      try {
        const VapiClass = VapiModule.default;
        const vapiInstance = new VapiClass(VAPI_PUBLIC_KEY);

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
    setSubmitError(null);
    setPollingError(null);
    const submittedCompany = formData.company;
    const submittedProblem = formData.problem_text;
    setFormBuildCompany(submittedCompany);
    setFormBuildProblem(submittedProblem);

    // Fire both calls independently:
    // 1. submitDemoRequest -> backend (creates lead, triggers Vapi provisioning)
    // 2. submitLead -> existing Slack/console alert (unchanged)

    // Slack alert — fire and forget, do not block the pipeline
    submitLead({
      data: {
        name: formData.name,
        email: formData.email,
        company: formData.company,
        website: formData.website || undefined,
        problem_text: formData.problem_text,
        tools: formData.tools || undefined,
        persona: formData.persona,
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
      const targetIndustry = formData.industry === "other" ? (customIndustry || "other") : (formData.industry || "general");
      const lead = await submitDemoRequest({
        company_name: formData.company,
        contact_name: formData.name,
        contact_email: formData.email,
        contact_phone: formData.phone || "+0000000000",
        industry: targetIndustry,
      });

      setLeadId(lead.id);

      // Save details to localStorage for personalization on the /demo-preview page
      localStorage.setItem("convoa_demo_preview_data", JSON.stringify({
        name: formData.name,
        email: formData.email,
        company: formData.company,
        problem: formData.problem_text,
        language: formData.language === "en-US" ? "English (US Accent)" : formData.language === "en-GB" ? "English (UK Accent)" : formData.language === "de-DE" ? "German (DE Native)" : "Spanish (ES Native)",
        tools: formData.tools || "Not specified",
        missedCalls: formData.missedCalls,
        bookingValue: formData.bookingValue,
        bookingRequirements: formData.bookingRequirements,
      }));

      setFlowStep("upload");
      toast.success("Requirements submitted successfully!");
      setCustomIndustry("");
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
        setSubmitError(err.message);
        toast.error("Could not reach the server. Is the backend running?");
      } else {
        setSubmitError("An unexpected error occurred.");
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
    const submittedCompany = voiceForm.company;
    setFormBuildCompany(submittedCompany);
    setFormBuildProblem("Client spoke with AI Solutions Advisor via Vapi voice agent.");

    try {
      // Save details to localStorage for personalization on the /demo-preview page
      localStorage.setItem("convoa_demo_preview_data", JSON.stringify({
        name: voiceForm.name,
        email: voiceForm.email,
        company: voiceForm.company,
        problem: "Spoke with AI Solutions Advisor via Vapi voice call.",
        language: "English (US Accent)",
        tools: "Vapi Voice Integration",
      }));

      await submitLead({
        data: {
          name: voiceForm.name,
          email: voiceForm.email,
          company: voiceForm.company,
          problem_text:
            "Client spoke with AI Solutions Advisor via Vapi voice agent. (Call completed successfully).",
          source: "voice",
          urgency: voiceForm.urgency,
        },
      });
      setIsVoiceFormReady(false);
      setVoiceForm({ name: "", email: "", company: "", urgency: "exploring" });

      setFlowStep("upload");
    } catch (err) {
      console.error("Failed to submit voice lead:", err);
    }
  };



  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const resetOnboardingWizard = () => {
    setFormSubmitted(false);
    setIsFormBuilding(false);
    setFlowStep("intake");
    setUploadedFiles([]);
    setKbId(null);
    setStep1Skipped(false);
    setStep2Skipped(false);
    setQaList([]);
    setSuggestedQuestions([]);
    setCurrentQuestionText("");
    setLeadId(null);
    setProvisionedAssistantId(null);
    setPollingError(null);
    setSubmitError(null);
    setCustomIndustry("");
  };

  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const allowedExtensions = ["pdf", "docx", "txt", "csv"];
      const newFiles: File[] = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext && allowedExtensions.includes(ext)) {
          newFiles.push(file);
        } else {
          toast.error(`Invalid file type: ${file.name}. Only pdf, docx, txt, and csv are allowed.`);
        }
      }
      if (newFiles.length > 0) {
        setUploadedFiles((prev) => [...prev, ...newFiles]);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const allowedExtensions = ["pdf", "docx", "txt", "csv"];
      const newFiles: File[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext && allowedExtensions.includes(ext)) {
          newFiles.push(file);
        } else {
          toast.error(`Invalid file type: ${file.name}. Only pdf, docx, txt, and csv are allowed.`);
        }
      }
      if (newFiles.length > 0) {
        setUploadedFiles((prev) => [...prev, ...newFiles]);
      }
    }
  };

  const removeFile = (idx: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUploadSubmit = async () => {
    if (uploadedFiles.length === 0) {
      toast.error("Please select files or skip this step.");
      return;
    }
    setIsIngesting(true);
    try {
      const res = await ingestDocuments(uploadedFiles);
      setKbId(res.kbId);
      setStep1Skipped(false);
      toast.success("Knowledge base created successfully!");
      setFlowStep("questions");
    } catch (err) {
      console.error(err);
      toast.error("Failed to ingest documents.");
    } finally {
      setIsIngesting(false);
    }
  };

  const handleSkipUpload = () => {
    setUploadedFiles([]);
    setKbId(null);
    setStep1Skipped(true);
    toast.info("Document upload skipped. Proceeding to pipeline build.");
    startPipelineBuild(true);
  };

  const parseAgentInstruction = (msg: string) => {
    const text = msg.toLowerCase().trim();
    let reply = "";
    let updatedFields: string[] = [];

    // 1. Parse Missed Calls
    // e.g. "missed calls are 45", "missed calls to 50", "actually we miss 40 calls", "change calls to 10"
    const callMatch = text.match(/(?:calls\s+(?:are|is|to)\s+|miss\s+|calls\s+of\s+)(\d+)/) || text.match(/(\d+)\s+missed\s+calls/);
    if (callMatch) {
      const val = parseInt(callMatch[1]);
      if (!isNaN(val) && val >= 0) {
        setFormData((prev) => ({ ...prev, missedCalls: val }));
        updatedFields.push(`missed calls per week to **${val}**`);
      }
    }

    // 2. Parse Ticket/Booking Value
    // e.g. "ticket value is 200", "booking value to 100", "price of 300", "each ticket is $150"
    const valueMatch = text.match(/(?:value|price|ticket|booking|ticket\s+value|booking\s+value)\s+(?:is|are|to|of|\$)\s*(\d+)/) || text.match(/(?:is|\$)\s*(\d+)\s+(?:each|per\s+booking)/);
    if (valueMatch) {
      const val = parseInt(valueMatch[1]);
      if (!isNaN(val) && val >= 0) {
        setFormData((prev) => ({ ...prev, bookingValue: val }));
        updatedFields.push(`ticket/booking value to **$${val}**`);
      }
    }

    // 3. Parse Booking Requirements (Toggles)
    // Full Name, Phone, Email, Reason, Postal
    const toggleReq = (id: string, name: string) => {
      const isAdd = text.includes("add") || text.includes("require") || text.includes("need") || text.includes("ask") || text.includes("collect") || text.includes("include");
      const isRemove = text.includes("remove") || text.includes("delete") || text.includes("skip") || text.includes("don't") || text.includes("dont") || text.includes("no");
      
      const containsField = text.includes(id.replace("_", "")) || text.includes(name.toLowerCase());
      
      if (containsField) {
        if (isAdd) {
          setFormData((prev) => {
            if (!prev.bookingRequirements.includes(id)) {
              return { ...prev, bookingRequirements: [...prev.bookingRequirements, id] };
            }
            return prev;
          });
          updatedFields.push(`added **${name}** requirement`);
        } else if (isRemove) {
          setFormData((prev) => ({
            ...prev,
            bookingRequirements: prev.bookingRequirements.filter((r) => r !== id),
          }));
          updatedFields.push(`removed **${name}** requirement`);
        }
      }
    };

    toggleReq("name", "Full Name");
    toggleReq("phone", "Phone Number");
    toggleReq("email", "Email Address");
    toggleReq("reason", "Booking Reason");
    toggleReq("postal_code", "Postal Code");

    // 4. Parse Integration Hub
    // e.g. "sync to salesforce", "use hubspot", "integrate sap"
    const isIntegration = text.includes("sync") || text.includes("use") || text.includes("integrate") || text.includes("connection") || text.includes("destination");
    if (isIntegration) {
      let matchedTool = "";
      if (text.includes("salesforce")) matchedTool = "Salesforce CRM";
      else if (text.includes("hubspot")) matchedTool = "HubSpot";
      else if (text.includes("sap")) matchedTool = "SAP ERP";
      else if (text.includes("descartes")) matchedTool = "Descartes";
      else if (text.includes("trimble")) matchedTool = "Trimble";
      else if (text.includes("alpega")) matchedTool = "Alpega";
      else if (text.includes("oracle") || text.includes("netsuite")) matchedTool = "Oracle NetSuite";
      
      if (matchedTool) {
        setFormData((prev) => ({ ...prev, tools: matchedTool }));
        updatedFields.push(`integration destination to **${matchedTool}**`);
      }
    }

    if (updatedFields.length > 0) {
      const calcLeakage = Math.round(
        (updatedFields.some(f => f.includes("missed calls")) ? parseInt(callMatch![1]) : formData.missedCalls) * 4.34 *
        (updatedFields.some(f => f.includes("ticket/booking value")) ? parseInt(valueMatch![1]) : formData.bookingValue) * 0.25
      );
      reply = `Understood! I have dynamically updated your system configuration: changed ${updatedFields.join(", ")}. Your Monthly Revenue Leakage is recalculated to **$${calcLeakage.toLocaleString()} / month**. Should we make any other edits?`;
    }

    return reply;
  };

  const handleQuestionSubmit = async (e?: React.FormEvent, questionText?: string) => {
    if (e) e.preventDefault();
    const query = questionText || currentQuestionText;
    if (!query.trim()) return;

    if (!questionText) {
      setCurrentQuestionText("");
    }

    setQaList((prev) => [...prev, { question: query, answer: "" }]);
    setIsQuerying(true);

    try {
      // 1. Run local parser first to see if this is a configuration change command
      const autoReply = parseAgentInstruction(query);
      if (autoReply) {
        setTimeout(() => {
          setQaList((prev) => {
            const updated = [...prev];
            if (updated.length > 0) {
              updated[updated.length - 1].answer = autoReply;
            }
            return updated;
          });
          setIsQuerying(false);
        }, 1000);
      } else {
        // 2. Otherwise fall back to Standard Knowledge Base query
        const mockKbId = kbId || "kb_mock_skipped";
        const res = await queryKnowledgeBase(query, mockKbId);

        setQaList((prev) => {
          const updated = [...prev];
          if (updated.length > 0) {
            updated[updated.length - 1].answer = res.answer;
          }
          return updated;
        });
        setIsQuerying(false);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to query Solution Architect.");
      setQaList((prev) => {
        const updated = [...prev];
        if (updated.length > 0) {
          updated[updated.length - 1].answer = "Error: Could not retrieve solution response.";
        }
        return updated;
      });
      setIsQuerying(false);
    }
  };

  const startPipelineBuild = (skipped: boolean) => {
    setStep2Skipped(skipped);
    setFlowStep("pipeline");
    setIsFormBuilding(true);
    setFormBuildStep(0);
    setFormLogIdx(0);
  };

  return (
    <div
      className={cn(
        "skydda-sentinel-theme min-h-screen bg-background text-foreground font-sans antialiased overflow-x-hidden selection:bg-primary/10 selection:text-primary relative",
        theme
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
        <div className="absolute top-[8%] left-[15%] w-[30rem] h-[30rem] bg-amber-500/[0.05] dark:bg-amber-500/[0.03] blur-[120px] rounded-full" style={{ animationDuration: '8s' }} />
        <div className="absolute top-[35%] right-[10%] w-[40rem] h-[40rem] bg-violet-500/[0.04] dark:bg-violet-500/[0.025] blur-[140px] rounded-full" style={{ animationDuration: '12s' }} />
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

      {/* 2. Navigation Header */}
      <header className="absolute top-0 left-0 right-0 z-40 bg-transparent border-0 transition-colors duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-6">
          <Link to="/" className="flex items-center gap-3 text-foreground">
            <div className="h-7 w-7 border border-border flex items-center justify-center bg-secondary text-foreground font-bold text-xs uppercase tracking-tight">
              DQ
            </div>
            <span className="uppercase tracking-widest text-sm font-semibold font-mono">
              DataQuartz
            </span>
          </Link>



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
        <div
          className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/80 to-background"
        />

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
          <div className="absolute bottom-[20%] left-[30%] w-[24rem] h-[24rem] bg-emerald-500/[0.04] dark:bg-emerald-500/[0.025] blur-[90px] rounded-full animate-float" style={{ animationDelay: '4s' }} />
        </div>

        {/* Radial vignette for focal depth */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--background)_75%)] z-[3]" />

        <div className="relative z-10 max-w-5xl mx-auto w-full text-center flex flex-col items-center justify-center space-y-8">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="inline-flex items-center gap-3 border border-border bg-secondary/50 px-6 py-2.5 relative overflow-hidden backdrop-blur-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <span className="font-mono uppercase tracking-widest text-[11px] sm:text-xs text-foreground/80">
              This isn't a pitch deck. It's your solution, running.
            </span>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full"
              animate={{ translateX: ["-100%", "100%"] }}
              transition={{ repeat: Infinity, duration: 4, ease: "linear", repeatDelay: 1 }}
            />
          </motion.div>

          {/* Main Headline — gradient shimmer text */}
          <div className="relative w-full flex justify-center z-10">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28rem] h-[12rem] bg-amber-500/[0.07] dark:bg-amber-500/[0.045] blur-[90px] rounded-full pointer-events-none -z-10 animate-pulse" style={{ animationDuration: '6s' }} />
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-normal tracking-tight leading-[1.15] max-w-5xl gradient-text">
              {"Never Miss Another Customer Call. Ai Receptionalist Personalized to Your Business in Minutes.".split(" ").map((word, i) => (
                <motion.span
                  key={i}
                  initial={{ filter: "blur(10px)", opacity: 0 }}
                  whileInView={{ filter: "blur(0px)", opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="inline-block mr-[0.25em] font-sans"
                >
                  {word}
                </motion.span>
              ))}
            </h1>
          </div>

          <p className="text-sm md:text-base text-foreground/70 max-w-2xl leading-relaxed font-sans">
            Tell us about your business. If we need more detail, our AI will ask — no forms to babysit. Then watch a demo built specifically for your calls, your industry, your customers.
          </p>

          {/* Persona targeting */}
          <p className="text-xs text-foreground/50 font-mono uppercase tracking-widest">
            Built for sales engineers, demo teams, and SaaS founders
          </p>

          <div className="flex items-center gap-5 flex-wrap justify-center">
            <button
              onClick={() => handleScrollTo(intakeRef)}
              className="glow-button bg-primary text-primary-foreground hover:bg-primary/95 transition-all px-10 py-4 text-sm font-semibold uppercase tracking-wider flex items-center gap-2.5 cursor-pointer border-0"
            >
              Build My Demo
              <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="/demo-preview"
              className="bg-transparent border border-border text-foreground hover:bg-secondary/40 px-10 py-4 text-sm font-semibold uppercase tracking-wider flex items-center gap-2.5 cursor-pointer transition-all duration-300 font-sans backdrop-blur-sm relative overflow-hidden group rounded-none"
            >
              <Play className="h-4 w-4 text-amber-500 fill-amber-500/20 group-hover:scale-110 transition-transform" />
              Watch Demo
              <span className="absolute inset-0 border border-amber-500/0 group-hover:border-amber-500/40 transition-colors pointer-events-none" />
            </a>
            <span className="text-[10px] text-foreground/40 font-mono flex items-center gap-1.5 ml-2">
              <Clock className="h-3 w-3" /> Under 5 minutes total
            </span>
          </div>
        </div>
      </section>

      {/* 3.5 Social Proof Marquee Ticker */}
      <section className="w-full border-b border-border/30 py-5 overflow-hidden bg-secondary/5 relative">
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
        <div className="marquee-track">
          {[...TRUST_SIGNALS, ...TRUST_SIGNALS].map((item, idx) => (
            <div key={idx} className="flex items-center gap-2.5 whitespace-nowrap">
              <span className="text-foreground font-bold text-sm font-mono stat-glow">
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
      </section>

      {/* 4. Integrations Section (rebranded from fake logos) */}
      <section className="relative w-full border-b border-border/30 py-20 px-6 bg-secondary/10">
        <div className="max-w-7xl mx-auto">
          <h2 className="mb-4 text-center font-normal text-4xl text-foreground tracking-tight md:text-5xl">
            Connects to your existing stack
          </h2>
          <p className="text-sm text-foreground/60 text-center max-w-lg mx-auto mb-12 font-sans">
            Native connectors for the tools your operations team already uses. Go live in under 3 weeks.
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
                      className={cn("-right-[12.5px] -bottom-[12.5px] absolute z-10 size-6 text-border/30", card.plusHidden)}
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
      <section className="w-full bg-background py-24 md:py-32 border-b border-border/30">
        <div className="mx-auto max-w-7xl px-6 md:px-12 lg:px-16 space-y-14">
          <div className="text-center space-y-4">
            <div className="flex items-center gap-3 px-4 py-2 border border-border w-fit bg-secondary/50 mx-auto">
              <div className="w-2.5 h-2.5 bg-amber-500" />
              <span className="text-xs font-semibold text-foreground/80 font-mono tracking-wide uppercase">
                How It Works
              </span>
            </div>
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
              className="p-8 md:border-r border-b md:border-b-0 border-border relative"
            >
              <AnimatedStepNumber number={1} />
              <div className="flex h-10 w-10 items-center justify-center border border-amber-500/30 bg-amber-500/10 text-amber-500 mb-5">
                <FileText className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-foreground font-mono uppercase tracking-tight">Describe Your Challenge</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Fill out a short form with your workflow pain points. Takes 60 seconds.
              </p>
              {/* Connecting line */}
              <div className="hidden md:block absolute top-12 -right-4 w-8 border-t border-dashed border-amber-500/40 z-10" />
            </motion.div>
            {/* Step 2 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="p-8 md:border-r border-b md:border-b-0 border-border relative"
            >
              <AnimatedStepNumber number={2} />
              <div className="flex h-10 w-10 items-center justify-center border border-violet-500/30 bg-violet-500/10 text-violet-500 mb-5">
                <Mic className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-foreground font-mono uppercase tracking-tight">Quick AI Clarification</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                If anything's unclear, our AI assistant calls for a 2-minute voice chat — just to nail the details. No selling, no pressure.
              </p>
              <span className="inline-block mt-3 text-[10px] font-mono text-foreground/40 uppercase tracking-widest border border-border px-2 py-0.5">
                Only if needed
              </span>
              {/* Connecting line */}
              <div className="hidden md:block absolute top-12 -right-4 w-8 border-t border-dashed border-violet-500/40 z-10" />
            </motion.div>
            {/* Step 3 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="p-8 relative"
            >
              <AnimatedStepNumber number={3} />
              <div className="flex h-10 w-10 items-center justify-center border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 mb-5">
                <Sparkles className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-foreground font-mono uppercase tracking-tight">Your Live Demo Is Ready</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                In under 3 minutes, we deploy a personalized voice agent + dashboard. You'll get an instant link — no email wait, no sales follow-up unless you ask.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 6. Proof Section — See a sample demo (I3, I4) */}
      <section className="w-full bg-secondary/10 py-24 md:py-28 border-b border-border/30">
        <div className="mx-auto max-w-5xl px-6 text-center space-y-8">
          <div className="flex items-center gap-3 px-4 py-2 border border-border w-fit bg-secondary/50 mx-auto">
            <div className="w-2.5 h-2.5 bg-emerald-500" />
            <span className="text-xs font-semibold text-foreground/80 font-mono tracking-wide uppercase">
              See It In Action
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal text-foreground tracking-tight">
            Don't take our word for it. See a real demo.
          </h2>
          <p className="text-sm text-foreground/60 max-w-lg mx-auto font-sans">
            This is a real personalized demo we built for a logistics company. It took 2 minutes and 47 seconds to generate.
          </p>
          <div className="border border-border bg-card p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-500 via-violet-500 to-emerald-500" />
            <div className="flex flex-col items-center gap-6 py-8">
              <div className="flex h-16 w-16 items-center justify-center border border-border bg-secondary text-foreground">
                <Sparkles className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <p className="text-foreground font-medium text-lg font-sans">Interactive Demo Portal</p>
                <p className="text-sm text-muted-foreground">Live voice agent + dashboard, personalized for ABC Logistics</p>
              </div>
              <a
                href="/demo-preview"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-semibold uppercase tracking-wider hover:bg-primary/90 transition-all border-0 font-mono"
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
            <div className="flex items-center gap-3 px-4 py-2 border border-border w-fit bg-secondary/50 mx-auto">
              <span className="h-1.5 w-1.5 bg-amber-500 animate-pulse"></span>
              <span className="text-xs font-semibold text-foreground/80 font-mono tracking-wide uppercase">
                Get Your Demo
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-normal tracking-tight text-foreground">
              See It Working — For Your Use Case
            </h2>
            <p
              className="text-sm text-foreground/70 max-w-xl mx-auto leading-relaxed font-sans"
            >
              Tell us about your workflow in your own words, or talk to our AI assistant. Your personalized demo will be ready in minutes.
            </p>
          </div>

          {/* Onboarding Flow Stepper */}
          {flowStep !== "completed" && (
            <div className="max-w-xl mx-auto mb-8 border border-border bg-secondary/30 p-4 font-mono text-xs">
              <div className="flex items-center justify-between">
                {/* Step 1: Intake */}
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "h-5 w-5 flex items-center justify-center rounded-full text-[10px] font-bold border",
                    flowStep === "intake" ? "border-primary text-primary bg-primary/10 animate-pulse" : "border-emerald-500 text-emerald-500 bg-emerald-500/10"
                  )}>
                    {flowStep !== "intake" ? "✓" : "1"}
                  </span>
                  <span className={cn("tracking-tight font-semibold", flowStep === "intake" ? "text-foreground" : "text-foreground/50")}>
                    INTAKE
                  </span>
                </div>

                <ChevronRight className="h-3 w-3 text-foreground/30" />

                {/* Step 2: Upload */}
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "h-5 w-5 flex items-center justify-center rounded-full text-[10px] font-bold border",
                    flowStep === "upload" ? "border-primary text-primary bg-primary/10 animate-pulse" :
                      (flowStep === "intake" ? "border-border text-foreground/45" : "border-emerald-500 text-emerald-500 bg-emerald-500/10")
                  )}>
                    {flowStep === "questions" || flowStep === "pipeline" ? (step1Skipped ? "⚡" : "✓") : "2"}
                  </span>
                  <span className={cn("tracking-tight font-semibold", flowStep === "upload" ? "text-foreground" : "text-foreground/50")}>
                    UPLOAD
                  </span>
                </div>

                <ChevronRight className="h-3 w-3 text-foreground/30" />

                {/* Step 3: Q&A */}
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "h-5 w-5 flex items-center justify-center rounded-full text-[10px] font-bold border",
                    flowStep === "questions" ? "border-primary text-primary bg-primary/10 animate-pulse" :
                      (flowStep === "pipeline" ? (step2Skipped ? "⚡" : "✓") : "border-border text-foreground/45")
                  )}>
                    {flowStep === "pipeline" ? (step2Skipped ? "⚡" : "✓") : "3"}
                  </span>
                  <span className={cn("tracking-tight font-semibold", flowStep === "questions" ? "text-foreground" : "text-foreground/50")}>
                    AI CHAT
                  </span>
                </div>

                <ChevronRight className="h-3 w-3 text-foreground/30" />

                {/* Step 4: Build */}
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "h-5 w-5 flex items-center justify-center rounded-full text-[10px] font-bold border",
                    flowStep === "pipeline" ? "border-primary text-primary bg-primary/10 animate-spin" : "border-border text-foreground/45"
                  )}>
                    4
                  </span>
                  <span className={cn("tracking-tight font-semibold", flowStep === "pipeline" ? "text-foreground animate-pulse" : "text-foreground/50")}>
                    BUILD
                  </span>
                </div>
              </div>
            </div>
          )}

          {flowStep === "completed" ? (
            <div className="w-full bg-card border border-border p-10 font-mono relative overflow-hidden text-center space-y-8 animate-fade-in transition-all">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-emerald-500" />

              <div className="flex flex-col items-center space-y-4">
                <div className="h-16 w-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-foreground text-xl font-bold uppercase tracking-tight font-mono">
                    Demo Generation Complete
                  </h3>
                  <p className="text-xs text-foreground/75 mt-1 font-sans">
                    Autonomous node provisioning for {formBuildCompany} finished successfully.
                  </p>
                </div>
              </div>

              <div className="max-w-md mx-auto border border-border bg-secondary p-6 text-left space-y-3.5 text-xs text-foreground/80">
                <div className="flex justify-between items-center border-b border-border pb-2.5 text-[10px] text-foreground/50 uppercase tracking-widest font-mono border-dashed">
                  <span>Pipeline Artifacts</span>
                  <span className="text-emerald-500 flex items-center gap-1.5 font-mono">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Live & Online
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Demo ID:</span>
                  <span className="text-foreground font-semibold">DMO-8024</span>
                </div>
                <div className="flex justify-between">
                  <span>Audio Server:</span>
                  <span className="text-foreground font-semibold">EU-Frankfurt Vapi Node</span>
                </div>
                <div className="flex justify-between">
                  <span>Integration Seed:</span>
                  <span className="text-foreground font-semibold">
                    Trimble Logistics compliances
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Target Company:</span>
                  <span className="text-foreground font-semibold">{formBuildCompany}</span>
                </div>
              </div>

              <div className="space-y-4 font-sans max-w-xs mx-auto">
                <a
                  href={`/demo-preview${provisionedAssistantId && leadId ? `?assistant_id=${encodeURIComponent(provisionedAssistantId)}&lead_id=${encodeURIComponent(leadId)}` : ''}`}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-medium py-4 text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-98 border-0"
                >
                  <Sparkles className="h-4 w-4" />
                  Launch Interactive Demo Portal
                </a>

                <button
                  onClick={resetOnboardingWizard}
                  className="text-xs text-foreground/55 hover:text-primary font-mono underline cursor-pointer bg-transparent border-0"
                >
                  Reset pipeline wizard
                </button>
              </div>
            </div>
          ) : flowStep === "pipeline" ? (
            <div className="w-full bg-card border border-border p-8 font-mono relative overflow-hidden animate-fade-in transition-all">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-primary animate-pulse" />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Side: Steps Timeline */}
                <div className="lg:col-span-5 space-y-6 text-left">
                  <div>
                    <h3 className="text-foreground text-lg font-bold uppercase tracking-tight">
                      Active Pipeline Build
                    </h3>
                    <p className="text-xs text-foreground/75 mt-1 font-sans">
                      Compiling personalized voice agent and sandbox environment for{" "}
                      {formBuildCompany}
                    </p>
                  </div>

                  <div className="bg-secondary border border-border p-6">
                    <ProgressTimeline steps={researchSteps} currentIndex={formBuildStep} />
                  </div>
                </div>

                {/* Right Side: Live Console Log */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                      <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                        CONSOLE_OUTPUT
                      </span>
                    </div>
                    <div className="text-[10px] text-foreground/55">
                      ETA: {Math.max(0, (7 - formBuildStep) * 1.5).toFixed(1)}s
                    </div>
                  </div>

                  <div className="bg-secondary border border-border p-5 min-h-[300px] max-h-[380px] overflow-y-auto space-y-2.5 text-left font-mono">
                    {getBuildLogLines(formBuildCompany, formBuildProblem)
                      .slice(0, formLogIdx)
                      .map((log, idx) => (
                        <div key={idx} className="flex gap-3 text-xs leading-relaxed">
                          <span className="text-foreground/45">[{log.t}]</span>
                          <span
                            className={
                              idx === formLogIdx - 1
                                ? "text-primary animate-pulse font-bold"
                                : "text-foreground/75"
                            }
                          >
                            {log.msg}
                          </span>
                        </div>
                      ))}
                    {formLogIdx < 10 && !pollingError && (
                      <span className="inline-block h-3.5 w-2 bg-primary animate-pulse mt-1" />
                    )}
                    {pollingError && (
                      <div className="mt-3 p-3 border border-red-500/40 bg-red-500/10 text-red-400 text-xs font-mono">
                        <span className="font-bold">ERROR:</span> {pollingError}
                        <button
                          onClick={() => {
                            setPollingError(null);
                            setIsFormBuilding(true);
                            setFormBuildStep(0);
                            setFormLogIdx(0);
                          }}
                          className="ml-3 underline text-amber-400 hover:text-amber-300 cursor-pointer bg-transparent border-0 font-mono text-xs"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : flowStep === "upload" ? (
            <div className="w-full glass-card gradient-border p-8 font-mono relative overflow-hidden text-left space-y-6 animate-fade-in transition-all">
              <div className="absolute top-0 left-0 w-full h-[3px] gradient-line-animated" />

              <div>
                <h3 className="text-foreground text-lg font-bold uppercase tracking-tight font-mono">
                  Step 1: Ingest Context Documents (Optional)
                </h3>
                <p className="text-xs text-foreground/75 mt-1 font-sans">
                  Upload API specs, SOPs, databases descriptions, or call logs to feed your custom Knowledge Base. Skip if not needed.
                </p>
              </div>

              {/* Drag and Drop Container */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById("file-upload-input")?.click()}
                className={cn(
                  "border-2 border-dashed p-10 flex flex-col items-center justify-center gap-3 cursor-pointer text-center transition-all bg-secondary/10 relative",
                  dragActive ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50"
                )}
              >
                <input
                  id="file-upload-input"
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  accept=".pdf,.docx,.txt,.csv"
                  className="hidden"
                />

                {isIngesting ? (
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                ) : (
                  <Upload className="h-10 w-10 text-foreground/60 hover:text-primary transition-colors" />
                )}

                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    Drag and drop your files here, or <span className="text-primary underline">browse</span>
                  </p>
                  <p className="text-[10px] text-foreground/50 font-sans">
                    Supports PDF, DOCX, TXT, CSV up to 10MB each
                  </p>
                </div>
              </div>

              {/* Uploaded Files List & Next-Step Interrelation Preview */}
              {uploadedFiles.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                  {/* Left Column: Uploaded files list */}
                  <div className="space-y-2">
                    <div className="text-[10px] uppercase tracking-wider text-foreground/70 font-mono border-b border-border pb-1 border-dashed">
                      Uploaded Documents ({uploadedFiles.length})
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                      {uploadedFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-secondary/40 border border-border text-xs">
                          <div className="flex items-center gap-2.5 truncate">
                            <Paperclip className="h-4 w-4 text-primary shrink-0" />
                            <span className="truncate font-medium text-foreground">{file.name}</span>
                            <span className="text-[10px] text-foreground/40 shrink-0 font-sans">({formatFileSize(file.size)})</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(idx);
                            }}
                            className="p-1 hover:bg-secondary text-foreground/60 hover:text-rose-500 transition-colors cursor-pointer border-0 bg-transparent"
                            aria-label="Remove file"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Interrelated Next-Step RAG Compilation Preview */}
                  <div className="space-y-3 bg-secondary/20 border border-border p-4 relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 right-0 px-2.5 py-0.5 bg-primary/10 border-l border-b border-border text-[8px] font-mono text-primary uppercase tracking-widest font-semibold animate-pulse">
                      Step 2 Preview
                    </div>

                    <div className="space-y-2 text-left">
                      <div className="flex items-center gap-1.5">
                        <Database className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                        <span className="text-[10px] uppercase tracking-wider text-foreground/75 font-mono font-bold">
                          Knowledge Base RAG Compiler
                        </span>
                      </div>
                      <p className="text-[10px] text-foreground/50 font-sans leading-relaxed">
                        Compiling context chunks from your uploaded {uploadedFiles.length === 1 ? "document" : `${uploadedFiles.length} documents`}.
                        The following verification queries will be ready for testing in Step 2:
                      </p>
                    </div>

                    <div className="space-y-1.5 font-mono text-[9px] text-foreground/80 bg-background/30 p-2.5 border border-border/50">
                      <div className="flex items-start gap-1">
                        <span className="text-amber-500 font-bold">Q1:</span>
                        <span className="truncate">"What are the key requirements outlined in the uploaded spec?"</span>
                      </div>
                      <div className="flex items-start gap-1">
                        <span className="text-amber-500 font-bold">Q2:</span>
                        <span className="truncate">"What integrations are mentioned in these documents?"</span>
                      </div>
                    </div>

                    <div className="text-[9px] text-emerald-500/90 font-mono flex items-center gap-1">
                      <span className="h-1 w-1 bg-emerald-500 rounded-full animate-ping" />
                      <span>Extraction Ready · advance to verify RAG responses</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading State Overlay */}
              {isIngesting && (
                <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center z-50 gap-3 font-mono">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <span className="text-xs uppercase tracking-widest text-primary animate-pulse font-bold">
                    Adding to knowledge base...
                  </span>
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex items-center justify-between gap-4 pt-4 border-t border-border/50">
                <button
                  type="button"
                  onClick={handleSkipUpload}
                  className="bg-transparent border border-border text-foreground hover:bg-secondary transition-colors font-mono font-medium text-xs tracking-wider uppercase px-5 py-3 cursor-pointer"
                >
                  Skip this step
                </button>
                <button
                  type="button"
                  onClick={handleUploadSubmit}
                  disabled={uploadedFiles.length === 0 || isIngesting}
                  className={cn(
                    "font-mono font-medium text-xs tracking-wider uppercase px-6 py-3 cursor-pointer transition-all border-0",
                    uploadedFiles.length === 0
                      ? "bg-secondary text-foreground/40 cursor-not-allowed"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
                  Upload & Continue →
                </button>
              </div>
            </div>
          ) : flowStep === "questions" ? (
            <div className="w-full glass-card gradient-border p-8 font-mono relative overflow-hidden text-left space-y-6 animate-fade-in transition-all">
              <div className="absolute top-0 left-0 w-full h-[3px] gradient-line-animated" />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                {/* Left Side: Live System Telemetry Config */}
                <div className="lg:col-span-5 flex flex-col justify-between">
                  <div className="space-y-4 border border-border bg-secondary/15 p-5 h-full">
                    <div className="text-[10px] uppercase tracking-wider text-amber-500 font-bold border-b border-border/40 pb-2 flex items-center gap-1.5 font-mono">
                      <Database className="h-3.5 w-3.5 animate-pulse" /> Telemetry: Config Schema
                    </div>
                    
                    <div className="space-y-1">
                      <dt className="text-[9px] uppercase tracking-wider text-foreground/50 font-sans">Company Profile</dt>
                      <dd className="text-xs text-foreground font-bold font-mono uppercase">{formData.company || "Pending Spec..."}</dd>
                    </div>

                    <div className="space-y-1">
                      <dt className="text-[9px] uppercase tracking-wider text-foreground/50 font-sans">Monthly Revenue Leakage</dt>
                      <dd className="text-lg text-red-500 font-bold font-mono">${calculatedLeakage.toLocaleString()} / mo</dd>
                      <p className="text-[8px] text-foreground/40 font-sans">
                        ({formData.missedCalls} calls/wk @ ${formData.bookingValue} avg. ticket)
                      </p>
                    </div>

                    <div className="space-y-2 border-t border-border/20 pt-3">
                      <dt className="text-[9px] uppercase tracking-wider text-foreground/50 font-sans">Required Client Details</dt>
                      <div className="grid gap-1.5 grid-cols-1">
                        {[
                          { id: "name", label: "Full Name" },
                          { id: "phone", label: "Phone Number" },
                          { id: "email", label: "Email Address" },
                          { id: "reason", label: "Booking Reason" },
                          { id: "postal_code", label: "Postal Code" },
                        ].map((item) => {
                          const checked = formData.bookingRequirements.includes(item.id);
                          return (
                            <div
                              key={item.id}
                              className={cn(
                                "flex items-center justify-between p-2 border font-mono text-[9px] uppercase tracking-wider bg-background/50 transition-colors",
                                checked ? "border-amber-500/60 text-amber-500 font-bold" : "border-border/30 text-foreground/35"
                              )}
                            >
                              <span>{item.label}</span>
                              <span>{checked ? "✓ ACTIVE" : "• INACTIVE"}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5 border-t border-border/20 pt-3">
                      <dt className="text-[9px] uppercase tracking-wider text-foreground/50 font-sans">Integration Target</dt>
                      <dd className="text-xs text-emerald-500 font-mono flex items-center gap-1.5 font-bold">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        {formData.tools ? formData.tools.toUpperCase().replace(/\s+/g, "_") : "EMAIL_DIGEST"}
                      </dd>
                    </div>
                  </div>
                </div>

                {/* Right Side: AI Solutions Architect Chat */}
                <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
                  <div>
                    <h3 className="text-foreground text-lg font-bold uppercase tracking-tight font-mono">
                      Step 2: AI Solution Architect Loop
                    </h3>
                    <p className="text-xs text-foreground/75 mt-1 font-sans">
                      Verify specifications or direct the architect to override system parameters on the left telemetry dashboard (e.g. "change calls to 40", "sync to Salesforce").
                    </p>
                  </div>

                  {/* Step 1 Skipped Alert/Empty State */}
                  {step1Skipped ? (
                    <div className="border border-amber-500/30 bg-amber-500/5 p-4 text-xs space-y-1.5 leading-relaxed text-amber-500/90 font-mono">
                      <div className="font-bold uppercase tracking-wide flex items-center gap-1.5">
                        <span>⚡ INFO: Document Ingestion Skipped</span>
                      </div>
                      <p className="font-sans text-[11px] text-foreground/70">
                        No custom context documents were uploaded. You can still direct the Architect to configure parameters, sync databases, or build the demo below.
                      </p>
                    </div>
                  ) : (
                    /* Suggested Questions Area */
                    <div className="space-y-3">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-foreground/60">
                        Suggested Ingestion Queries
                      </label>

                      {isAnalyzing ? (
                        <div className="flex items-center gap-3 py-6 justify-center bg-secondary/15 border border-border border-dashed">
                          <Loader2 className="h-5 w-5 text-primary animate-spin" />
                          <span className="text-xs tracking-wider animate-pulse text-foreground/60">
                            Analyzing your documents...
                          </span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {suggestedQuestions.slice(0, 4).map((q, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleQuestionSubmit(undefined, q)}
                              disabled={isQuerying}
                              className="p-2.5 text-left border border-border bg-secondary/20 hover:border-primary/50 hover:bg-secondary/40 transition-all text-[10px] leading-snug cursor-pointer group flex items-start gap-2 text-foreground/80 hover:text-foreground rounded-none"
                            >
                              <HelpCircle className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                              <span className="truncate">{q}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Chat Conversation Thread */}
                  {(qaList.length > 0 || isQuerying) && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-foreground/60">
                        Solution Design Conversation Thread
                      </label>
                      <div className="h-48 border border-border bg-secondary/30 p-4 space-y-4 overflow-y-auto font-mono text-xs flex flex-col justify-start">
                        {qaList.map((qa, idx) => (
                          <div key={idx} className="space-y-2">
                            {/* User Question */}
                            {qa.question !== "[SYSTEM ONBOARDING]" && (
                              <div className="flex gap-2 text-left">
                                <span className="text-emerald-500 shrink-0">[USER]:</span>
                                <span className="text-foreground/90">{qa.question}</span>
                              </div>
                            )}
                            {/* AI Answer */}
                            {qa.answer ? (
                              <div className="flex gap-2 text-left bg-secondary/20 p-2.5 border-l-2 border-primary text-left">
                                <span className="text-primary shrink-0">[ARCHITECT]:</span>
                                <span className="text-foreground/75 leading-relaxed font-sans text-[11px]">{qa.answer}</span>
                              </div>
                            ) : (
                              <div className="flex gap-2 text-left bg-secondary/20 p-2.5 border-l-2 border-primary animate-pulse">
                                <span className="text-primary shrink-0">[ARCHITECT]:</span>
                                <span className="text-foreground/45 flex items-center gap-1">
                                  Inferencing<span className="animate-bounce">.</span><span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span><span className="animate-bounce" style={{ animationDelay: '0.4s' }}>.</span>
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Free-form Input Area */}
                  <form onSubmit={(e) => handleQuestionSubmit(e)} className="flex items-center gap-3">
                    <input
                      type="text"
                      value={currentQuestionText}
                      onChange={(e) => setCurrentQuestionText(e.target.value)}
                      placeholder="Ask spec questions or type updates (e.g. 'require phone number')..."
                      className={INPUT_CLS}
                      disabled={isQuerying}
                    />
                    <button
                      type="submit"
                      disabled={isQuerying || !currentQuestionText.trim()}
                      className={cn(
                        "px-5 py-2.5 font-mono font-semibold uppercase text-xs cursor-pointer border border-border h-full flex items-center gap-2 rounded-none",
                        isQuerying || !currentQuestionText.trim()
                          ? "bg-secondary text-foreground/40 cursor-not-allowed"
                          : "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                      )}
                    >
                      Send
                    </button>
                  </form>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between gap-4 pt-4 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => startPipelineBuild(true)}
                  className="bg-transparent border border-border text-foreground hover:bg-secondary transition-colors font-mono font-medium text-xs tracking-wider uppercase px-5 py-3 cursor-pointer"
                >
                  Skip this step
                </button>
                <button
                  type="button"
                  onClick={() => startPipelineBuild(false)}
                  className="bg-primary text-primary-foreground hover:bg-primary/95 font-mono font-medium text-xs tracking-wider uppercase px-6 py-3 cursor-pointer border-0 active:scale-98 rounded-none"
                >
                  Build Convoa Pilot →
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch font-mono">
              {/* PATH A: VOICE (VAPI WEB WIDGET) */}
              <div className="lg:col-span-6 glass-card gradient-border p-8 flex flex-col justify-between relative overflow-hidden transition-all duration-300">
                <div className="absolute top-0 left-0 w-full h-[3px] gradient-line-animated" />
                <div className="absolute top-0 right-0 px-4 py-1.5 bg-secondary border-l border-b border-border text-[9px] font-mono text-primary uppercase tracking-widest font-semibold">
                  Path A: Voice Advisor
                </div>

                <div className="space-y-6 text-left mt-2">
                  <div>
                    <h3 className="text-base font-semibold text-foreground font-mono uppercase tracking-tight">
                      Quick Voice Chat with AI
                    </h3>
                    <p className="text-xs text-foreground/70 mt-1.5 font-sans leading-relaxed">
                      Have a 2-minute voice chat with our AI assistant — no sales pitch, just clarifying questions so we build the right demo. You can hang up anytime.
                    </p>
                  </div>

                  {!isVoiceFormReady ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!voiceForm.name || !voiceForm.email || !voiceForm.company) {
                          toast.error("Please fill in contact details.");
                          return;
                        }
                        setIsVoiceFormReady(true);
                      }}
                      className="space-y-4 font-sans text-xs"
                    >
                      <FloatingLabelInput
                        label="Your Name *"
                        type="text"
                        value={voiceForm.name}
                        onChange={(e) => setVoiceForm({ ...voiceForm, name: e.target.value })}
                        required
                        placeholder="Elena Marchetti"
                      />
                      <FloatingLabelInput
                        label="Work Email *"
                        type="email"
                        value={voiceForm.email}
                        onChange={(e) => setVoiceForm({ ...voiceForm, email: e.target.value })}
                        required
                        placeholder="elena@logistics-global.com"
                      />
                      <FloatingLabelInput
                        label="Company *"
                        type="text"
                        value={voiceForm.company}
                        onChange={(e) => setVoiceForm({ ...voiceForm, company: e.target.value })}
                        required
                        placeholder="Logistics Global"
                      />
                      <button
                        type="submit"
                        className="w-full bg-secondary border border-border hover:border-zinc-500/50 text-foreground text-xs font-semibold uppercase tracking-wider py-3 cursor-pointer font-mono"
                      >
                        Continue to AI Call →
                      </button>
                      <p className="text-[10px] text-foreground/50 font-sans mt-2 text-center">
                        🔒 Your data is encrypted, never shared, and deleted after 30 days.{" "}
                        <a href="/privacy" className="underline hover:text-foreground/70 transition-colors">Read our Privacy Policy →</a>
                      </p>
                    </form>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 space-y-6 font-mono">
                      {/* Call Status UI */}
                      <div className="relative">
                        {callStatus === "on-call" && (
                          <span className="absolute -top-1 -right-1 flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                          </span>
                        )}

                        <button
                          onClick={
                            callStatus === "on-call" ? handleEndVoiceCall : handleStartVoiceCall
                          }
                          disabled={callStatus === "connecting"}
                          className={cn(
                            "h-24 w-24 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-lg outline-none focus:ring-4 font-mono bg-transparent",
                            callStatus === "on-call"
                              ? "bg-rose-600/10 border-rose-500 text-rose-500 hover:bg-rose-600/20 focus:ring-rose-500/20"
                              : "bg-primary/10 border-primary text-primary hover:bg-primary/20 focus:ring-primary/25",
                          )}
                        >
                          {callStatus === "on-call" ? (
                            <PhoneOff className="h-8 w-8 text-rose-500 animate-pulse bg-transparent" />
                          ) : (
                            <Mic className="h-8 w-8 text-primary" />
                          )}
                        </button>
                      </div>

                      {/* Pulsing Visual Waveform */}
                      {callStatus === "on-call" && (
                        <div className="flex items-center gap-1.5 h-6 justify-center bg-transparent">
                          {[...Array(12)].map((_, i) => (
                            <motion.div
                              key={i}
                              className="w-1 bg-primary rounded-full"
                              animate={{ height: [8, 24, 8] }}
                              transition={{
                                duration: 0.6 + i * 0.05,
                                repeat: Infinity,
                                ease: "easeInOut",
                              }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Pill badge — anxiety reduction (C3) */}
                      {callStatus === "idle" && (
                        <div className="flex items-center gap-3 text-[10px] text-foreground/50 font-mono">
                          <span className="flex items-center gap-1">⏱ Avg. call: 2 min</span>
                          <span className="text-border">·</span>
                          <span className="flex items-center gap-1"><Bot className="h-3 w-3" /> AI-powered</span>
                          <span className="text-border">·</span>
                          <span className="flex items-center gap-1">🔇 No recordings shared</span>
                        </div>
                      )}

                      <div className="text-center space-y-1.5 font-mono text-xs">
                        <p className="text-foreground font-semibold tracking-wider">
                          {callStatus === "idle" && "READY TO CONNECT"}
                          {callStatus === "connecting" && "ESTABLISHING CHANNEL..."}
                          {callStatus === "on-call" && "Advisor Online — Speak Now"}
                          {callStatus === "ended" && "CALL SUMMARY DISPATCHED"}
                        </p>
                        <p className="text-foreground/50 max-w-xs font-sans text-xs leading-relaxed mx-auto">
                          {callStatus === "idle" &&
                            "Click the microphone to start an interactive speech session."}
                          {callStatus === "connecting" && "Requesting microphone permissions..."}
                          {callStatus === "on-call" &&
                            "The advisor is listening. Speak clearly and confirm when finished."}
                          {callStatus === "ended" &&
                            "Thank you. Our pipeline is parsing your specifications."}
                        </p>
                      </div>

                      {callStatus === "ended" && (
                        <button
                          onClick={() => setIsVoiceFormReady(false)}
                          className="text-xs text-primary hover:text-primary/80 font-mono cursor-pointer underline bg-transparent border-0"
                        >
                          Reset Call
                        </button>
                      )}
                    </div>
                  )}
                </div>


              </div>

              {/* PATH B: FORM (SPECIFICATION SUBMIT) */}
              <div className="lg:col-span-6 glass-card gradient-border p-8 flex flex-col justify-between relative overflow-hidden transition-all duration-300">
                <div className="absolute top-0 left-0 w-full h-[3px] gradient-line-animated" />
                <div className="absolute top-0 right-0 px-4 py-1.5 bg-secondary border-l border-b border-border text-[9px] font-mono text-primary uppercase tracking-widest font-semibold">
                  Path B: Custom Spec
                </div>

                <div className="space-y-6 text-left mt-2">
                  <div>
                    <h3 className="text-base font-semibold text-foreground font-mono uppercase tracking-tight">
                      Describe via Form specs
                    </h3>
                    <p className="text-xs text-foreground/70 mt-1.5 font-sans leading-relaxed">
                      Complete this outline to specify operational details, target tooling
                      connections, and delivery urgency.
                    </p>
                  </div>

                  <form onSubmit={handleFormSubmit} className="space-y-4 font-sans text-xs">
                    <div className="grid grid-cols-2 gap-4">
                      <FloatingLabelInput
                        label="Name *"
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Elena Marchetti"
                        disabled={formSubmitting}
                      />
                      <FloatingLabelInput
                        label="Work Email *"
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="elena@dataquartz.ai"
                        disabled={formSubmitting}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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

                    <div className="grid grid-cols-2 gap-4">
                      <FloatingLabelInput
                        label="Phone Number"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+1 555-123-4567"
                        disabled={formSubmitting}
                      />
                      <div className="space-y-1">
                        <label className={LABEL_CLS}>
                          Industry *
                        </label>
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
                      <div className="animate-fade-in mt-2">
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

                    <FloatingLabelTextarea
                      label="What problem are you trying to solve? *"
                      required
                      rows={3}
                      value={formData.problem_text}
                      onChange={(e) => setFormData({ ...formData, problem_text: e.target.value })}
                      placeholder="Describe key scenario steps and dispatch tasks..."
                      disabled={formSubmitting}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className={LABEL_CLS}>
                          Target Persona *
                        </label>
                        <select
                          value={formData.persona}
                          onChange={(e) => setFormData({ ...formData, persona: e.target.value })}
                          className={SELECT_CLS}
                        >
                          <option value="driver_dispatch">Driver Dispatcher</option>
                          <option value="customer_service">Customer Service Rep</option>
                          <option value="supplier_support">Supplier Support Desk</option>
                          <option value="sales_intake">Sales Intake Agent</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className={LABEL_CLS}>
                          Agent Accent / Language *
                        </label>
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

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className={LABEL_CLS}>
                          Avg. Missed Calls / Week *
                        </label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={formData.missedCalls}
                          onChange={(e) => setFormData({ ...formData, missedCalls: Math.max(0, parseInt(e.target.value) || 0) })}
                          className={INPUT_CLS}
                          disabled={formSubmitting}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className={LABEL_CLS}>
                          Avg. Booking / Ticket Value ($) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={formData.bookingValue}
                          onChange={(e) => setFormData({ ...formData, bookingValue: Math.max(0, parseInt(e.target.value) || 0) })}
                          className={INPUT_CLS}
                          disabled={formSubmitting}
                        />
                      </div>
                    </div>

                    {/* Required Booking Details checkboxes */}
                    <div className="space-y-2 mt-2 text-left">
                      <label className={LABEL_CLS}>Required Client Details to Book</label>
                      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
                        {[
                          { id: "name", label: "Full Name" },
                          { id: "phone", label: "Phone Number" },
                          { id: "email", label: "Email Address" },
                          { id: "reason", label: "Booking Reason" },
                          { id: "postal_code", label: "Postal Code" },
                        ].map((item) => {
                          const checked = formData.bookingRequirements.includes(item.id);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  bookingRequirements: prev.bookingRequirements.includes(item.id)
                                    ? prev.bookingRequirements.filter((r) => r !== item.id)
                                    : [...prev.bookingRequirements, item.id],
                                }));
                              }}
                              className={cn(
                                "flex items-center justify-between p-2.5 border font-mono text-[9px] uppercase tracking-wider text-left transition-all duration-200 cursor-pointer bg-secondary/20 rounded-none",
                                checked ? "border-amber-500 bg-amber-500/10 text-amber-500" : "border-border hover:border-foreground/25"
                              )}
                            >
                              <span>{item.label}</span>
                              <div className={cn(
                                "h-3.5 w-3.5 border flex items-center justify-center rounded-none shrink-0",
                                checked ? "bg-amber-500 border-amber-500 text-black font-bold" : "border-border"
                              )}>
                                {checked && "✓"}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Urgency and Tools grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className={LABEL_CLS}>
                          Timeline Urgency *
                        </label>
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
                        <label className={LABEL_CLS}>
                          Current Tools & Database Systems
                        </label>
                        <input
                          type="text"
                          value={formData.tools}
                          onChange={(e) => setFormData({ ...formData, tools: e.target.value })}
                          placeholder="e.g. Descartes, Trimble, Salesforce"
                          className={INPUT_CLS}
                          disabled={formSubmitting}
                        />
                      </div>
                    </div>

                    {submitError && (
                      <div className="p-3 border border-red-500/40 bg-red-500/10 text-red-400 text-xs font-mono mt-2">
                        <span className="font-bold">ERROR:</span> {submitError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={formSubmitting}
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/95 transition-all text-xs font-semibold uppercase tracking-wider py-3 cursor-pointer flex items-center justify-center gap-1.5 font-mono active:scale-98 border-0 mt-4"
                    >
                      {formSubmitting ? "Dispatching..." : "Submit Build Request"}
                    </button>
                    <p className="text-[10px] text-foreground/50 font-sans mt-2 text-center">
                      🔒 Your data is encrypted, never shared, and deleted after 30 days.{" "}
                      <a href="/privacy" className="underline hover:text-foreground/70 transition-colors">Read our Privacy Policy →</a>
                    </p>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>


      {/* 8. FAQ Section (C5) */}
      <section className="bg-background py-24 px-6 border-b border-border">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="text-center space-y-4">
            <div className="flex items-center gap-3 px-4 py-2 border border-border w-fit bg-secondary/50 mx-auto">
              <HelpCircle className="h-3 w-3 text-foreground/60" />
              <span className="text-xs font-semibold text-foreground/80 font-mono tracking-wide uppercase">
                FAQ
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-normal tracking-tight text-foreground">
              Questions before you start
            </h2>
          </div>

          <div className="divide-y divide-border border border-border">
            {FAQ_ITEMS.map((item, idx) => (
              <details key={idx} className="group">
                <summary className="flex items-center justify-between cursor-pointer px-6 py-5 text-sm font-medium text-foreground hover:bg-secondary/30 transition-colors font-sans">
                  {item.q}
                  <ChevronRight className="h-4 w-4 text-foreground/40 transition-transform group-open:rotate-90" />
                </summary>
                <div className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed font-sans">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Footer */}
      <footer className="bg-background text-foreground/70 py-16 px-6 text-xs font-mono border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-8 border-b border-dashed border-border/40 pb-10">
          <div className="space-y-1.5 text-center sm:text-left">
            <div className="font-bold text-foreground tracking-widest uppercase font-mono">DATAQUARTZ AI</div>
            <p className="text-[11px] text-foreground/60 font-sans">
              Autonomous sandbox generation & Vapi agent portals.
            </p>
          </div>

          <div className="text-center sm:text-right font-sans text-foreground/60 text-[11px] space-y-1.5">
            <p>Support: operations@dataquartz.ai</p>
            <p>&copy; 2026 DataQuartz, Inc. All rights reserved.</p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
          <span className="text-[10px] text-foreground/50 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            SYS: STABLE
          </span>
          <div className="flex items-center gap-4 text-[10px] text-foreground/50 font-sans">
            <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <span className="text-border">&middot;</span>
            <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
            <span className="text-border">&middot;</span>
            <a href="#" className="hover:text-foreground transition-colors">SOC 2 Compliance</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
