import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Lock,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { submitLead } from "@/lib/leads";
import { submitDemoRequest, NetworkError } from "@/lib/api";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const INPUT_CLS =
  "w-full bg-secondary border border-border px-3.5 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary font-mono text-xs transition-all duration-200 input-glow rounded-md";
const LABEL_CLS = "text-[10px] font-mono uppercase tracking-wider text-foreground/80 font-bold block mb-1";
const SELECT_CLS =
  "w-full bg-secondary border border-border px-3 py-2.5 text-foreground/90 focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary font-mono text-xs cursor-pointer transition-all duration-200 input-glow rounded-md";

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
          "w-full bg-secondary/35 border border-border px-3.5 pt-6 pb-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary font-mono text-xs transition-all duration-200 input-glow rounded-md",
          props.className,
        )}
      />
      <label
        className={cn(
          "absolute left-3.5 pointer-events-none font-mono uppercase tracking-wider transition-all duration-200 font-bold",
          focused || isFilled
            ? "top-2 text-[9px] text-primary"
            : "top-4.5 text-[11px] text-foreground/60",
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
          "w-full bg-secondary/35 border border-border px-3.5 pt-6 pb-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary font-mono text-xs transition-all duration-200 input-glow resize-none rounded-md",
          props.className,
        )}
      />
      <label
        className={cn(
          "absolute left-3.5 pointer-events-none font-mono uppercase tracking-wider transition-all duration-200 font-bold",
          focused || isFilled
            ? "top-2 text-[9px] text-primary"
            : "top-4.5 text-[11px] text-foreground/60",
        )}
      >
        {label}
      </label>
    </div>
  );
}

export const Route = createFileRoute("/_wizard/build-demo")({
  head: () => ({
    meta: [
      { title: "Generate Custom AI Pilot | DataQuartz Onboarding" },
      {
        name: "description",
        content:
          "Configure and build your customized AI voice agent receptionist in minutes.",
      },
    ],
  }),
  component: BuildDemoPage,
});

function BuildDemoPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [customIndustry, setCustomIndustry] = useState("");

  // The demo is built from company, industry and the problem statement. Fields
  // that only qualified the lead (missed calls, booking value, timeline urgency)
  // or that were never surfaced to the client (persona, accent, tools) were
  // removed from the form; the few the Slack alert still accepts are sent as
  // constants below rather than collected from the user.
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    website: "",
    phone: "",
    industry: "logistics",
    problem_text: "",
    voiceGender: "female" as "male" | "female",
    volume: "under_5k",
    bookingRequirements: ["name", "phone", "reason"],
  });

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.company || !formData.problem_text) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setFormSubmitting(true);

    // Slack alert
    submitLead({
      data: {
        name: formData.name,
        email: formData.email,
        company: formData.company,
        website: formData.website || undefined,
        problem_text: formData.problem_text,
        volume: formData.volume,
        source: "form",
        booking_requirements: formData.bookingRequirements,
      },
    }).catch((err) => console.error("Slack alert failed (non-blocking):", err));

    // Backend demo-request
    try {
      const targetIndustry =
        formData.industry === "other" ? customIndustry || "other" : formData.industry || "general";
      const lead = await submitDemoRequest({
        company_name: formData.company,
        contact_name: formData.name,
        contact_email: formData.email,
        contact_phone: formData.phone || "+0000000000",
        industry: targetIndustry,
        problem_text: formData.problem_text || undefined,
        voice_gender: formData.voiceGender,
      });

      // Save details to localStorage
      localStorage.setItem(
        "convoa_demo_preview_data",
        JSON.stringify({
          name: formData.name,
          email: formData.email,
          company: formData.company,
          problem: formData.problem_text,
          bookingRequirements: formData.bookingRequirements,
        }),
      );

      localStorage.setItem(
        "convoa_pipeline_data",
        JSON.stringify({
          company: formData.company,
          problem: formData.problem_text,
        }),
      );

      if (lead.agent_status === "skipped") {
        setFormSubmitting(false);
        navigate({ to: "/pipeline", search: { leadId: lead.id } });
        return;
      }

      toast.success("Onboarding data registered!");
      navigate({ to: "/upload", search: { leadId: lead.id } });
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

  return (
    <div
      className={cn(
        "skydda-sentinel-theme flex-1 bg-background text-foreground font-sans antialiased overflow-x-hidden relative flex flex-col justify-center py-12 px-6",
        theme,
      )}
    >
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-20">
        <div className="absolute top-[10%] left-[20%] w-[30rem] h-[30rem] bg-primary/[0.04] blur-[100px] rounded-full" />
        <div className="absolute bottom-[20%] right-[15%] w-[35rem] h-[35rem] bg-primary/[0.03] blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-4xl mx-auto z-10 space-y-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-mono text-foreground/60 hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded p-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Homepage
        </Link>

        <div className="glass-card gradient-border p-8 md:p-10 relative overflow-hidden transition-all duration-300 shadow-2xl rounded-xl border bg-card text-left">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-primary" />

          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-[10px] font-mono text-primary font-bold uppercase tracking-widest">
                  Free live demo · 2 minutes
                </span>
              </div>
              <h1 className="text-2xl font-semibold text-foreground uppercase tracking-tight font-mono">
                Stop losing calls. Start closing them.
              </h1>
              <p className="text-xs text-foreground/75 mt-1.5 leading-relaxed">
                Tell us what's slipping through the cracks. We'll build a working AI
                receptionist for your business that you can call yourself in minutes.
              </p>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-5 text-xs">
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
                        className="text-[9.5px] font-mono px-2 py-0.5 bg-secondary/80 hover:bg-primary/15 hover:text-primary text-foreground/80 border border-border/80 hover:border-primary/50 rounded transition-all cursor-pointer shadow-sm font-bold"
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
                  <label htmlFor="industry-select" className={LABEL_CLS}>Industry *</label>
                  <select
                    id="industry-select"
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
                  <span className="text-[9px] font-mono text-primary font-bold uppercase tracking-wider flex items-center gap-1 opacity-90">
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
                      className="text-[10px] font-sans px-2.5 py-1 bg-secondary/80 hover:bg-primary/15 hover:text-primary text-foreground/80 border border-border/80 hover:border-primary/50 rounded transition-all cursor-pointer text-left shadow-sm active:scale-95 font-medium"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice choice — maps to a Vapi built-in voice server-side
                  (female: Emma, male: Elliot). */}
              <div className="space-y-1">
                <label className={LABEL_CLS}>Agent Voice *</label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { key: "female", label: "Female", sub: "Emma" },
                    { key: "male", label: "Male", sub: "Elliot" },
                  ] as const).map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => setFormData({ ...formData, voiceGender: v.key })}
                      className={cn(
                        "flex items-center justify-between gap-2 border px-3.5 py-2.5 rounded-md transition-all cursor-pointer text-left",
                        formData.voiceGender === v.key
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-secondary/35 text-foreground/70 hover:border-primary/50",
                      )}
                    >
                      <span className="flex flex-col leading-tight">
                        <span className="font-mono text-xs font-bold uppercase tracking-wider">
                          {v.label}
                        </span>
                        <span className="text-[10px] font-sans opacity-70">{v.sub}</span>
                      </span>
                      {formData.voiceGender === v.key && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={formSubmitting}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/95 transition-all text-xs font-semibold uppercase tracking-wider py-4.5 cursor-pointer flex items-center justify-center gap-2 font-mono active:scale-98 border-0 mt-6 rounded-lg shadow-lg hover:shadow-primary/20"
              >
                {formSubmitting ? "Building yours..." : "Build my AI receptionist →"}
              </button>
              
              <p className="text-[10px] text-foreground/60 font-sans mt-2 text-center flex items-center justify-center gap-1.5 font-bold">
                <Lock className="h-3 w-3 text-primary" />
                No card, no install. Encrypted, never shared, deleted after 30 days.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
