import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Lock,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { submitLead } from "@/lib/leads";
import { submitDemoRequest, NetworkError } from "@/lib/api";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const INPUT_CLS =
  "w-full bg-secondary border-2 border-border px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary font-sans text-sm transition-all duration-200 input-glow rounded-lg";
const LABEL_CLS = "text-xs font-sans uppercase tracking-wider text-foreground/80 font-bold block mb-1.5";
const SELECT_CLS =
  "w-full bg-secondary border-2 border-border px-4 py-3 text-foreground/90 focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary font-sans text-sm cursor-pointer transition-all duration-200 input-glow rounded-lg";

interface FloatingLabelInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

function FloatingLabelInput({ label, value, ...props }: FloatingLabelInputProps) {
  const [focused, setFocused] = useState(false);
  const isFilled = value !== undefined && value !== "";

  return (
    <div className="relative w-full pt-1.5">
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
        placeholder={focused ? props.placeholder : ""}
        className={cn(
          "w-full bg-secondary/35 border-2 border-border px-4 pt-6 pb-2.5 text-foreground placeholder:text-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary font-sans text-sm transition-all duration-200 input-glow rounded-lg",
          props.className,
        )}
      />
      <label
        className={cn(
          "absolute left-4 pointer-events-none font-sans tracking-wide transition-all duration-200",
          focused || isFilled
            ? "top-2 text-xs text-primary font-bold"
            : "top-4.5 text-sm text-foreground/80 font-semibold",
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
    <div className="relative w-full pt-1.5">
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
        placeholder={focused ? props.placeholder : ""}
        className={cn(
          "w-full bg-secondary/35 border-2 border-border px-4 pt-6 pb-2.5 text-foreground placeholder:text-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary font-sans text-sm transition-all duration-200 input-glow resize-none rounded-lg",
          props.className,
        )}
      />
      <label
        className={cn(
          "absolute left-4 pointer-events-none font-sans tracking-wide transition-all duration-200",
          focused || isFilled
            ? "top-2 text-xs text-primary font-bold"
            : "top-4.5 text-sm text-foreground/80 font-semibold",
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
    industry: "",
    problem_text: "",
    voiceGender: "female" as "male" | "female",
    volume: "under_5k",
    bookingRequirements: ["name", "phone", "reason"],
  });

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Specific messages beat a generic "fill in all fields" — the user knows
    // exactly what's missing instead of hunting for it.
    if (!formData.name.trim()) return toast.error("Please enter your name.");
    if (!formData.email.trim()) return toast.error("Please enter your work email.");
    if (!formData.company.trim()) return toast.error("Please enter your company name.");
    if (!formData.industry) return toast.error("Please select your industry.");
    if (formData.industry === "other" && !customIndustry.trim())
      return toast.error("Please specify your industry.");
    if (!formData.problem_text.trim())
      return toast.error("Tell us what problem you're trying to solve.");

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

      <div className="w-full max-w-5xl mx-auto z-10 space-y-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-mono text-foreground/80 hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded p-1 font-bold"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Homepage
        </Link>

        <div className="glass-card gradient-border p-10 md:p-14 relative overflow-hidden transition-all duration-300 shadow-2xl rounded-2xl border-2 border-border/60 bg-card text-left">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-primary" />

          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-xs font-sans text-primary font-bold uppercase tracking-wider">
                  Free live demo · 2 minutes
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight font-sans">
                Stop losing calls. Start closing them.
              </h1>
              <p className="text-sm text-foreground/90 mt-2 leading-relaxed font-sans font-medium">
                Tell us what's slipping through the cracks. We'll build a working AI
                receptionist for your business that you can call yourself in minutes.
              </p>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-6 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                  <div className="flex flex-wrap gap-1.5 pt-2">
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
                        className="text-xs font-sans px-2.5 py-1 bg-secondary/80 hover:bg-primary/15 hover:text-primary text-foreground/80 border-2 border-border/80 hover:border-primary/50 rounded-md transition-all cursor-pointer shadow-sm font-bold"
                      >
                        {domain}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FloatingLabelInput
                  label="Company Name *"
                  type="text"
                  required
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="Acme Inc."
                  disabled={formSubmitting}
                />
                <FloatingLabelInput
                  label="Company Website (Optional)"
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://acme.com"
                  disabled={formSubmitting}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                    required
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    disabled={formSubmitting}
                    className={cn(SELECT_CLS, !formData.industry && "text-foreground/45")}
                  >
                    <option value="" disabled>
                      Select your industry…
                    </option>
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
                  placeholder="e.g. We miss too many calls after hours and lose the booking..."
                  disabled={formSubmitting}
                />
                <div className="flex flex-wrap gap-2 pt-2 items-center">
                  <span className="text-xs font-sans text-primary font-bold uppercase tracking-wider flex items-center gap-1 opacity-90">
                    <Sparkles className="h-3.5 w-3.5 animate-pulse" /> Try:
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
                      className="text-xs font-sans px-3 py-1.5 bg-secondary/80 hover:bg-primary/15 hover:text-primary text-foreground/80 border-2 border-border/80 hover:border-primary/50 rounded-md transition-all cursor-pointer text-left shadow-sm active:scale-95 font-medium"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice choice — maps to a Vapi built-in voice server-side
                  (female: Emma, male: Elliot). */}
              <div className="space-y-2">
                <label className={LABEL_CLS}>Agent Voice *</label>
                <div className="grid grid-cols-2 gap-4">
                  {([
                    { key: "female", label: "Female" },
                    { key: "male", label: "Male" },
                  ] as const).map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => setFormData({ ...formData, voiceGender: v.key })}
                      className={cn(
                        "flex items-center justify-between gap-2 border-2 px-4 py-3 rounded-lg transition-all cursor-pointer text-left",
                        formData.voiceGender === v.key
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-secondary/35 text-foreground/90 hover:border-primary/50",
                      )}
                    >
                      <span className="font-sans text-sm font-bold tracking-wide">
                        {v.label}
                      </span>
                      {formData.voiceGender === v.key && (
                        <span className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={formSubmitting}
                aria-busy={formSubmitting}
                className={cn(
                  "w-full text-sm font-bold uppercase tracking-wider py-4 flex items-center justify-center gap-2 font-sans border-0 mt-6 rounded-lg shadow-lg transition-all",
                  formSubmitting
                    ? "bg-primary/70 text-primary-foreground cursor-wait"
                    : "bg-primary text-primary-foreground hover:bg-primary/95 hover:shadow-primary/20 active:scale-98 cursor-pointer",
                )}
              >
                {formSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Building your agent…
                  </>
                ) : (
                  <>
                    Build my AI receptionist
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
              
              <p className="text-xs text-foreground/80 font-sans mt-3 text-center flex items-center justify-center gap-1.5 font-bold">
                <Lock className="h-3.5 w-3.5 text-primary" />
                No card, no install. Encrypted, never shared, deleted after 30 days.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
