import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Lock,
  Loader2,
  Check,
  AlertCircle,
  User,
  Mail,
  Building2,
  Globe,
  Phone,
  Mic,
  Zap,
  ChevronDown,
  Truck,
  HeartPulse,
  Home,
  Thermometer,
  Smile,
  Scale,
  Droplet,
  HardHat,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { submitLead } from "@/lib/leads";
import { submitDemoRequest, NetworkError } from "@/lib/api";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────────────────
 * Business Info — step 1 of the demo wizard.
 *
 * The submission contract is unchanged: same formData shape, same submitLead
 * (Slack) + submitDemoRequest (backend) calls, same localStorage keys, and the
 * same industry VALUES (they map to the backend scenario library aliases in
 * scenario_library.py). This screen collects the details, validates inline, and
 * hands off to the document-upload step.
 * ────────────────────────────────────────────────────────────────────────── */

// Values map to curated entries in the backend scenario library
// (backend/app/scenario_library.py). Only industries with a vetted playbook are
// offered; anything else goes through "Other" and falls back to GENERIC_ENTRY.
const INDUSTRIES: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "hvac", label: "HVAC & Climate", icon: Thermometer },
  { value: "dental", label: "Dental", icon: Smile },
  { value: "healthcare", label: "Healthcare", icon: HeartPulse },
  { value: "legal", label: "Legal Services", icon: Scale },
  { value: "logistics", label: "Logistics & Transport", icon: Truck },
  { value: "plumbing", label: "Plumbing", icon: Droplet },
  { value: "roofing", label: "Roofing & Construction", icon: HardHat },
  { value: "real_estate", label: "Real Estate", icon: Home },
  { value: "other", label: "Other", icon: MoreHorizontal },
];

const VOICES: { key: "female" | "male"; label: string }[] = [
  { key: "female", label: "Female" },
  { key: "male", label: "Male" },
];

const PROBLEM_PRESETS = [
  "Automate after-hours call routing",
  "Capture caller details and sync to CRM",
  "Answer common FAQs instantly",
  "Schedule appointments and send reminders",
];

// Sections shown in the side stepper, in the order they appear in the form.
const STEP_LABELS = ["About you", "Your business", "What you'd like to solve", "Pick a voice"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Country dial codes with the expected national-number digit count (`len`).
// `len` may be a single count or a list of accepted counts. Used to enforce a
// correct-length phone number for the selected country.
const COUNTRIES: {
  code: string;
  name: string;
  dial: string;
  flag: string;
  len: number | number[];
  sample: string;
}[] = [
  { code: "PK", name: "Pakistan", dial: "+92", flag: "🇵🇰", len: 10, sample: "3001234567" },
  { code: "US", name: "United States", dial: "+1", flag: "🇺🇸", len: 10, sample: "5551234567" },
  { code: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧", len: 10, sample: "7123456789" },
  { code: "IN", name: "India", dial: "+91", flag: "🇮🇳", len: 10, sample: "9876543210" },
  { code: "CA", name: "Canada", dial: "+1", flag: "🇨🇦", len: 10, sample: "5551234567" },
  {
    code: "AE",
    name: "United Arab Emirates",
    dial: "+971",
    flag: "🇦🇪",
    len: 9,
    sample: "501234567",
  },
  { code: "AU", name: "Australia", dial: "+61", flag: "🇦🇺", len: 9, sample: "412345678" },
  { code: "SA", name: "Saudi Arabia", dial: "+966", flag: "🇸🇦", len: 9, sample: "512345678" },
  { code: "SG", name: "Singapore", dial: "+65", flag: "🇸🇬", len: 8, sample: "81234567" },
  { code: "FR", name: "France", dial: "+33", flag: "🇫🇷", len: 9, sample: "612345678" },
  { code: "DE", name: "Germany", dial: "+49", flag: "🇩🇪", len: [10, 11], sample: "15123456789" },
];

const DEFAULT_COUNTRY = "PK";
const findCountry = (code: string) => COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];
const lenOk = (len: number | number[], n: number) =>
  Array.isArray(len) ? len.includes(n) : n === len;
const lenLabel = (len: number | number[]) => (Array.isArray(len) ? len.join(" or ") : String(len));

/* ── Reusable text field with floating label, optional icon, and error slot ── */

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: LucideIcon;
  error?: string;
}

function TextField({ label, icon: Icon, error, value, id, ...props }: FieldProps) {
  const [focused, setFocused] = useState(false);
  const isFilled = value !== undefined && value !== "";
  const floated = focused || isFilled;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="w-full">
      <div className="relative">
        {Icon && (
          <Icon
            aria-hidden="true"
            className={cn(
              "absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] transition-colors pointer-events-none",
              error ? "text-destructive/80" : focused ? "text-primary" : "text-foreground/55",
            )}
          />
        )}
        <input
          {...props}
          id={id}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
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
            "field-box w-full border-2 px-4 pt-6 pb-2.5 text-foreground placeholder:text-foreground/55 focus:outline-none font-sans text-[15px] font-medium transition-all duration-200 input-glow rounded-xl",
            Icon && "pl-11",
          )}
        />
        <label
          htmlFor={id}
          className={cn(
            "absolute pointer-events-none font-sans tracking-wide transition-all duration-200",
            Icon ? "left-11" : "left-4",
            floated
              ? cn("top-2 text-xs font-bold", error ? "text-destructive" : "text-primary")
              : "top-1/2 -translate-y-1/2 text-[15px] text-foreground/70 font-medium",
          )}
        >
          {label}
        </label>
      </div>
      {error && (
        <p
          id={errorId}
          className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-destructive"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

interface AreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  maxChars?: number;
}

function TextArea({ label, error, value, id, maxChars = 500, ...props }: AreaProps) {
  const [focused, setFocused] = useState(false);
  const strValue = typeof value === "string" ? value : "";
  const isFilled = strValue !== "";
  const floated = focused || isFilled;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="w-full">
      <div className="relative">
        <textarea
          {...props}
          id={id}
          value={value}
          maxLength={maxChars}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
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
            "field-box w-full border-2 px-4 pt-6 pb-2.5 text-foreground placeholder:text-foreground/55 focus:outline-none font-sans text-[15px] font-medium leading-relaxed transition-all duration-200 input-glow resize-none rounded-xl",
          )}
        />
        <label
          htmlFor={id}
          className={cn(
            "absolute left-4 pointer-events-none font-sans tracking-wide transition-all duration-200",
            floated
              ? cn("top-2 text-xs font-bold", error ? "text-destructive" : "text-primary")
              : "top-5 text-[15px] text-foreground/70 font-medium",
          )}
        >
          {label}
        </label>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        {error ? (
          <p
            id={errorId}
            className="flex items-center gap-1.5 text-xs font-semibold text-destructive"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        ) : (
          <span />
        )}
        <span className="text-[11px] font-mono text-foreground/55 tabular-nums">
          {strValue.length}/{maxChars}
        </span>
      </div>
    </div>
  );
}

/* ── Section heading ── */
function SectionLabel({ step, title, hint }: { step: number; title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-xs font-bold text-primary font-mono">
        {step}
      </span>
      <div>
        <h2 className="text-lg font-bold tracking-tight text-foreground font-sans leading-tight">
          {title}
        </h2>
        {hint && <p className="text-[13px] text-foreground/65 font-medium mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

/* ── Phone field: country dial-code picker + length-enforced number ── */
interface PhoneFieldProps {
  country: string;
  digits: string;
  error?: string;
  disabled?: boolean;
  onCountry: (code: string) => void;
  onDigits: (digits: string) => void;
  onKeyUp?: () => void;
  onBlur?: () => void;
}

function PhoneField({
  country,
  digits,
  error,
  disabled,
  onCountry,
  onDigits,
  onKeyUp,
  onBlur,
}: PhoneFieldProps) {
  const c = findCountry(country);
  const maxLen = Array.isArray(c.len) ? Math.max(...c.len) : c.len;

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="w-full">
      <label
        htmlFor="field-phone"
        className="mb-2 block text-[13px] font-sans uppercase tracking-wider text-foreground/80 font-bold"
      >
        Phone number *
      </label>
      <div
        data-invalid={error ? "true" : undefined}
        className="field-box flex items-stretch rounded-xl border-2 input-glow transition-all"
      >
        <div
          ref={dropdownRef}
          className="relative flex items-center border-r-2 border-border bg-secondary/40 rounded-l-[10px]"
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 bg-transparent pl-3.5 pr-2.5 py-3 text-[15px] font-bold text-foreground focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
          >
            <img
              src={`https://flagcdn.com/w40/${c.code.toLowerCase()}.png`}
              alt={c.name}
              className="w-[20px] h-[14px] object-cover rounded-[2px] shrink-0"
              loading="lazy"
            />
            <span>{c.dial}</span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "h-4 w-4 text-foreground/50 transition-transform duration-200",
                isOpen && "rotate-180",
              )}
            />
          </button>

          {isOpen && (
            <div className="absolute left-0 top-full mt-1.5 z-50 min-w-[240px] max-h-[260px] overflow-y-auto rounded-xl border border-border bg-card dropdown-menu-shadow shadow-2xl p-1.5 animate-in fade-in slide-in-from-top-1 duration-150 scrollbar-thin">
              {COUNTRIES.map((o) => (
                <button
                  key={o.code}
                  type="button"
                  onClick={() => {
                    onCountry(o.code);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm rounded-lg hover:bg-secondary text-foreground transition-colors cursor-pointer select-none",
                    o.code === country &&
                      "bg-primary/10 text-primary font-semibold hover:bg-primary/15",
                  )}
                >
                  <img
                    src={`https://flagcdn.com/w40/${o.code.toLowerCase()}.png`}
                    alt={o.name}
                    className="w-[18px] h-[12px] object-cover rounded-[1px] shrink-0"
                    loading="lazy"
                  />
                  <span className="font-mono text-xs text-foreground/55 min-w-[26px]">
                    {o.code}
                  </span>
                  <span className="font-medium text-foreground flex-1 truncate">{o.name}</span>
                  <span className="font-semibold text-foreground/80 text-xs shrink-0">
                    {o.dial}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-1 items-center gap-2.5 px-4">
          <Phone aria-hidden="true" className="h-[18px] w-[18px] text-foreground/55 shrink-0" />
          <input
            id="field-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            aria-invalid={error ? true : undefined}
            aria-describedby="field-phone-desc"
            value={digits}
            disabled={disabled}
            onChange={(e) => onDigits(e.target.value.replace(/\D/g, "").slice(0, maxLen))}
            onKeyUp={onKeyUp}
            onBlur={onBlur}
            placeholder={c.sample}
            className="w-full min-w-0 bg-transparent py-3 text-[15px] font-medium text-foreground placeholder:text-foreground/45 focus:outline-none"
          />
        </div>
      </div>
      <p
        id="field-phone-desc"
        className={cn(
          "mt-1.5 flex items-center gap-1.5 font-medium",
          error ? "text-xs font-semibold text-destructive" : "text-[11px] text-foreground/55",
        )}
      >
        {error ? (
          <>
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </>
        ) : (
          `Enter your ${lenLabel(c.len)}-digit number after ${c.dial}.`
        )}
      </p>
    </div>
  );
}

export const Route = createFileRoute("/_wizard/build-demo")({
  head: () => ({
    meta: [
      { title: "Generate Custom AI Pilot | DataQuartz Onboarding" },
      {
        name: "description",
        content: "Configure and build your customized AI voice agent receptionist in minutes.",
      },
    ],
  }),
  component: BuildDemoPage,
});

const TURNSTILE_SITEKEY = (import.meta.env.VITE_TURNSTILE_SITEKEY as string) || "1x00000000000000000000AA";

interface TurnstileProps {
  sitekey: string;
  onVerify: (token: string) => void;
}

function Turnstile({ sitekey, onVerify }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const scriptId = "cloudflare-turnstile-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const initializeTurnstile = () => {
      if (!active || !containerRef.current || !(window as any).turnstile) return;
      try {
        if (widgetIdRef.current) {
          (window as any).turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
        const id = (window as any).turnstile.render(containerRef.current, {
          sitekey,
          callback: (token: string) => {
            if (active) onVerify(token);
          },
          "expired-callback": () => {
            if (active) onVerify("");
          },
          "error-callback": () => {
            if (active) onVerify("");
          },
        });
        widgetIdRef.current = id;
      } catch (err) {
        console.error("Turnstile render error:", err);
      }
    };

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
      (window as any).onloadTurnstileCallback = () => {
        initializeTurnstile();
      };
    } else if ((window as any).turnstile) {
      initializeTurnstile();
    } else {
      const interval = setInterval(() => {
        if ((window as any).turnstile) {
          clearInterval(interval);
          initializeTurnstile();
        }
      }, 100);
      return () => {
        clearInterval(interval);
        active = false;
      };
    }

    return () => {
      active = false;
      if (widgetIdRef.current && (window as any).turnstile) {
        try {
          (window as any).turnstile.remove(widgetIdRef.current);
        } catch (e) {
          // ignore
        }
      }
    };
  }, [sitekey, onVerify]);

  return <div ref={containerRef} className="cf-turnstile min-h-[65px] flex justify-center py-2" />;
}

type FormErrors = Partial<
  Record<
    "name" | "email" | "company" | "phone" | "industry" | "customIndustry" | "problem_text" | "captcha",
    string
  >
>;

function BuildDemoPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const prefersReduced = useReducedMotion();
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [customIndustry, setCustomIndustry] = useState("");
  const [phoneCountry, setPhoneCountry] = useState(DEFAULT_COUNTRY);
  const [phoneDigits, setPhoneDigits] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [captchaToken, setCaptchaToken] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const [activeStep, setActiveStep] = useState(0);

  // Track which section is in view so the side stepper follows the scroll.
  useEffect(() => {
    const els = sectionRefs.current.filter(Boolean) as HTMLElement[];
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting);
        if (!vis.length) return;
        vis.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const idx = sectionRefs.current.indexOf(vis[0].target as HTMLElement);
        if (idx !== -1) setActiveStep(idx);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.5, 1] },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

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
    industry: "",
    problem_text: "",
    voiceGender: "female" as "male" | "female",
    volume: "under_5k",
    bookingRequirements: ["name", "phone", "reason"],
  });

  /* ── Validation ── */
  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!formData.name.trim()) next.name = "Please enter your name.";
    if (!formData.email.trim()) next.email = "Please enter your work email.";
    else if (!EMAIL_RE.test(formData.email.trim()))
      next.email = "That doesn't look like a valid email.";
    if (!formData.company.trim()) next.company = "Please enter your company name.";
    const dc = findCountry(phoneCountry);
    if (!phoneDigits.trim()) next.phone = "Please enter your phone number.";
    else if (!lenOk(dc.len, phoneDigits.length))
      next.phone = `Enter a valid ${lenLabel(dc.len)}-digit number for ${dc.dial}.`;
    if (!formData.industry) next.industry = "Please select your industry.";
    if (formData.industry === "other" && !customIndustry.trim())
      next.customIndustry = "Please specify your industry.";
    if (!formData.problem_text.trim()) next.problem_text = "Tell us what you'd like to solve.";
    else if (formData.problem_text.trim().length < 10)
      next.problem_text = "A little more detail helps us tailor the agent.";
    if (!captchaToken) next.captcha = "Please complete the CAPTCHA challenge.";
    return next;
  };

  // Live-clear a field's error the moment it becomes valid, once it's been touched.
  const clearIfValid = (field: keyof FormErrors) => {
    if (!touched[field]) return;
    setErrors((prev) => {
      const fresh = validate();
      return { ...prev, [field]: fresh[field] };
    });
  };

  // Validate a single field immediately (used on blur, when the field is now
  // "touched" — so an invalid entry surfaces as soon as the user leaves it).
  const validateField = (field: keyof FormErrors) =>
    setErrors((prev) => ({ ...prev, [field]: validate()[field] }));

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    setTouched({
      name: true,
      email: true,
      company: true,
      phone: true,
      industry: true,
      customIndustry: true,
      problem_text: true,
      captcha: true,
    });

    if (Object.keys(found).length > 0) {
      const firstKey = Object.keys(found)[0];
      toast.error(found[firstKey as keyof FormErrors] ?? "Please complete the highlighted fields.");
      // Focus the first invalid control for keyboard users.
      const el = formRef.current?.querySelector<HTMLElement>(
        `[aria-invalid="true"], #field-${firstKey}`,
      );
      el?.focus();
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
        contact_phone: `${findCountry(phoneCountry).dial}${phoneDigits}`,
        industry: targetIndustry,
        problem_text: formData.problem_text || undefined,
        voice_gender: formData.voiceGender,
        captcha_token: captchaToken,
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

  // Per-section completion, for the side stepper's check marks.
  const liveErrors = validate();
  const stepDone = [
    !liveErrors.name && !liveErrors.email,
    !liveErrors.company && !liveErrors.phone && !liveErrors.industry && !liveErrors.customIndustry,
    !liveErrors.problem_text,
    true, // voice always has a valid default
  ];
  const scrollToStep = (i: number) =>
    sectionRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" });

  const sectionMotion = (delay: number) =>
    prefersReduced
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <div
      className={cn(
        "skydda-sentinel-theme dq-form-surface flex-1 bg-background text-foreground font-sans antialiased overflow-x-hidden relative flex flex-col py-10 px-4 sm:px-6",
        theme,
      )}
    >
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-20">
        <div className="absolute top-[8%] left-[15%] w-[30rem] h-[30rem] bg-primary/[0.05] blur-[110px] rounded-full" />
        <div className="absolute bottom-[15%] right-[10%] w-[35rem] h-[35rem] bg-primary/[0.035] blur-[130px] rounded-full" />
      </div>
      <div className="absolute inset-0 dot-grid-bg opacity-[0.5] pointer-events-none z-0" />

      <div className="w-full max-w-5xl mx-auto z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-mono text-foreground/75 hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded p-1 font-bold mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Homepage
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[210px_1fr] gap-6 lg:gap-8 items-start">
          {/* ── Section stepper (side) ── */}
          <aside className="hidden lg:block" aria-label="Form sections">
            <div className="lg:sticky lg:top-24 rounded-2xl border-2 border-border/60 bg-card/70 backdrop-blur-sm p-4">
              <p className="text-[10px] font-mono uppercase tracking-wider text-foreground/55 mb-3 px-1">
                Your details
              </p>
              <ol className="relative space-y-0.5">
                <span
                  aria-hidden="true"
                  className="absolute left-4 top-5 bottom-5 w-px bg-border"
                />
                {STEP_LABELS.map((label, i) => {
                  const active = activeStep === i;
                  const done = stepDone[i];
                  return (
                    <li key={label} className="relative">
                      <button
                        type="button"
                        onClick={() => scrollToStep(i)}
                        aria-current={active ? "step" : undefined}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left transition-colors",
                          active ? "bg-primary/10" : "hover:bg-secondary/50",
                        )}
                      >
                        <span
                          className={cn(
                            "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold font-mono transition-colors",
                            active
                              ? "border-primary bg-primary/15 text-primary"
                              : done
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-card text-foreground/45",
                          )}
                        >
                          {done && !active ? <Check className="h-3 w-3" /> : i + 1}
                        </span>
                        <span
                          className={cn(
                            "text-[13px] font-semibold leading-tight",
                            active
                              ? "text-primary"
                              : done
                                ? "text-foreground/85"
                                : "text-foreground/55",
                          )}
                        >
                          {label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          </aside>

          {/* ── Form card ── */}
          <motion.div
            {...(prefersReduced
              ? {}
              : {
                  initial: { opacity: 0, y: 20 },
                  animate: { opacity: 1, y: 0 },
                  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
                })}
            className="glass-card gradient-border p-7 sm:p-10 md:p-12 relative overflow-hidden shadow-2xl rounded-2xl border-2 border-border/60 bg-card text-left"
          >
            <div className="absolute top-0 left-0 w-full h-[3px] gradient-line-animated" />

            <div className="mb-9">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> Free live demo · 2 min
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight font-sans gradient-text hero-text-shadow leading-[1.1]">
                Stop losing calls. Start closing them.
              </h1>
              <p className="text-base text-foreground/80 mt-3 leading-relaxed font-sans font-medium max-w-xl">
                Tell us what's slipping through the cracks. We'll build a working AI receptionist
                for your business that you can call yourself in minutes.
              </p>
            </div>

            <form ref={formRef} onSubmit={handleFormSubmit} className="space-y-9" noValidate>
              {/* Section 1 — About you */}
              <motion.section
                ref={(el) => {
                  sectionRefs.current[0] = el;
                }}
                {...sectionMotion(0.05)}
                className="space-y-4 scroll-mt-28"
              >
                <SectionLabel
                  step={1}
                  title="About you"
                  hint="So we know who's testing the agent."
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextField
                    id="field-name"
                    label="Full name *"
                    icon={User}
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                    }}
                    onKeyUp={() => clearIfValid("name")}
                    onBlur={() => {
                      setTouched((t) => ({ ...t, name: true }));
                      validateField("name");
                    }}
                    placeholder="Elena Marchetti"
                    error={errors.name}
                    disabled={formSubmitting}
                    autoFocus
                  />
                  <div>
                    <TextField
                      id="field-email"
                      label="Work email *"
                      icon={Mail}
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      onKeyUp={() => clearIfValid("email")}
                      onBlur={() => {
                        setTouched((t) => ({ ...t, email: true }));
                        validateField("email");
                      }}
                      placeholder="elena@dataquartz.ai"
                      error={errors.email}
                      disabled={formSubmitting}
                    />
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {["@gmail.com", "@outlook.com", "@yahoo.com"].map((domain) => (
                        <button
                          key={domain}
                          type="button"
                          disabled={formSubmitting}
                          onClick={() => {
                            const prefix = formData.email.includes("@")
                              ? formData.email.split("@")[0]
                              : formData.email;
                            setFormData({ ...formData, email: prefix + domain });
                            setTouched((t) => ({ ...t, email: true }));
                          }}
                          className="text-xs font-sans px-2.5 py-1 bg-secondary/70 hover:bg-primary/15 hover:text-primary text-foreground/75 border border-border hover:border-primary/50 rounded-md transition-all cursor-pointer font-bold"
                        >
                          {domain}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.section>

              <div className="gradient-divider" />

              {/* Section 2 — Your business */}
              <motion.section
                ref={(el) => {
                  sectionRefs.current[1] = el;
                }}
                {...sectionMotion(0.1)}
                className="space-y-4 scroll-mt-28"
              >
                <SectionLabel
                  step={2}
                  title="Your business"
                  hint="This shapes how your agent speaks and what it handles."
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextField
                    id="field-company"
                    label="Company name *"
                    icon={Building2}
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    onKeyUp={() => clearIfValid("company")}
                    onBlur={() => {
                      setTouched((t) => ({ ...t, company: true }));
                      validateField("company");
                    }}
                    placeholder="Acme Inc."
                    error={errors.company}
                    disabled={formSubmitting}
                  />
                  <TextField
                    id="field-website"
                    label="Company website (optional)"
                    icon={Globe}
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://acme.com"
                    disabled={formSubmitting}
                  />
                </div>

                <PhoneField
                  country={phoneCountry}
                  digits={phoneDigits}
                  error={errors.phone}
                  disabled={formSubmitting}
                  onCountry={(code) => {
                    setPhoneCountry(code);
                    if (touched.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  onDigits={(d) => setPhoneDigits(d)}
                  onKeyUp={() => clearIfValid("phone")}
                  onBlur={() => {
                    setTouched((t) => ({ ...t, phone: true }));
                    validateField("phone");
                  }}
                />

                {/* Industry picker — icon chips (values map to backend scenario library) */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[13px] font-sans uppercase tracking-wider text-foreground/80 font-bold">
                      Industry *
                    </label>
                    {errors.industry && (
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                        <AlertCircle className="h-3.5 w-3.5" /> {errors.industry}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {INDUSTRIES.map((ind) => {
                      const Icon = ind.icon;
                      const selected = formData.industry === ind.value;
                      return (
                        <button
                          key={ind.value}
                          type="button"
                          disabled={formSubmitting}
                          aria-pressed={selected}
                          onClick={() => {
                            setFormData({ ...formData, industry: ind.value });
                            setTouched((t) => ({ ...t, industry: true }));
                            setErrors((prev) => ({ ...prev, industry: undefined }));
                          }}
                          className={cn(
                            "group flex items-center gap-2.5 rounded-xl border-2 px-3.5 py-3 text-left transition-all duration-200 cursor-pointer btn-themed-shadow hover:-translate-y-[2px] active:translate-y-0 active:scale-[0.97]",
                            selected
                              ? "border-primary bg-primary/10 text-primary shadow-sm shadow-primary/10"
                              : "border-border bg-secondary/60 text-foreground/80 hover:border-primary/40 hover:bg-secondary/80",
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-5 w-5 shrink-0 transition-transform",
                              selected && "scale-110",
                            )}
                          />
                          <span className="text-[13px] font-bold leading-tight font-sans">
                            {ind.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {formData.industry === "other" && (
                    <motion.div
                      {...(prefersReduced
                        ? {}
                        : {
                            initial: { opacity: 0, height: 0 },
                            animate: { opacity: 1, height: "auto" },
                          })}
                      className="pt-1"
                    >
                      <TextField
                        id="field-customIndustry"
                        label="Specify your industry *"
                        type="text"
                        value={customIndustry}
                        onChange={(e) => setCustomIndustry(e.target.value)}
                        onKeyUp={() => clearIfValid("customIndustry")}
                        onBlur={() => {
                          setTouched((t) => ({ ...t, customIndustry: true }));
                          validateField("customIndustry");
                        }}
                        placeholder="e.g. Veterinary, Home Services, SaaS…"
                        error={errors.customIndustry}
                        disabled={formSubmitting}
                      />
                    </motion.div>
                  )}
                </div>
              </motion.section>

              <div className="gradient-divider" />

              {/* Section 3 — What you need */}
              <motion.section
                ref={(el) => {
                  sectionRefs.current[2] = el;
                }}
                {...sectionMotion(0.15)}
                className="space-y-4 scroll-mt-28"
              >
                <SectionLabel
                  step={3}
                  title="What you'd like to solve"
                  hint="The clearer this is, the sharper your demo agent."
                />
                <TextArea
                  id="field-problem_text"
                  label="What problem are you trying to solve? *"
                  rows={3}
                  value={formData.problem_text}
                  onChange={(e) => setFormData({ ...formData, problem_text: e.target.value })}
                  onKeyUp={() => clearIfValid("problem_text")}
                  onBlur={() => {
                    setTouched((t) => ({ ...t, problem_text: true }));
                    validateField("problem_text");
                  }}
                  placeholder="e.g. We miss too many calls after hours and lose the booking…"
                  error={errors.problem_text}
                  disabled={formSubmitting}
                />
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-sans text-foreground/65 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-primary" /> Quick fill
                  </span>
                  {PROBLEM_PRESETS.map((preset, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      disabled={formSubmitting}
                      onClick={() => {
                        setFormData({ ...formData, problem_text: preset });
                        setTouched((t) => ({ ...t, problem_text: true }));
                        setErrors((prev) => ({ ...prev, problem_text: undefined }));
                      }}
                      className="text-xs font-sans px-3 py-1.5 bg-secondary/60 hover:bg-primary/15 hover:text-primary text-foreground/75 border border-border hover:border-primary/50 rounded-full transition-all duration-200 cursor-pointer btn-themed-shadow hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.97] font-semibold"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </motion.section>

              <div className="gradient-divider" />

              {/* Section 4 — Voice */}
              <motion.section
                ref={(el) => {
                  sectionRefs.current[3] = el;
                }}
                {...sectionMotion(0.2)}
                className="space-y-4 scroll-mt-28"
              >
                <SectionLabel
                  step={4}
                  title="Pick a voice"
                  hint="You can hear it on your live call."
                />
                <div className="grid grid-cols-2 gap-3">
                  {VOICES.map((v) => {
                    const selected = formData.voiceGender === v.key;
                    return (
                      <button
                        key={v.key}
                        type="button"
                        disabled={formSubmitting}
                        aria-pressed={selected}
                        onClick={() => setFormData({ ...formData, voiceGender: v.key })}
                        className={cn(
                          "flex items-center gap-3 border-2 px-4 py-3.5 rounded-xl transition-all duration-200 cursor-pointer text-left btn-themed-shadow hover:-translate-y-[2px] active:translate-y-0 active:scale-[0.97]",
                          selected
                            ? "border-primary bg-primary/10 shadow-sm shadow-primary/10"
                            : "border-border bg-secondary/60 hover:border-primary/40",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
                            selected
                              ? "bg-primary/20 text-primary"
                              : "bg-secondary text-foreground/55",
                          )}
                        >
                          <Mic className="h-[18px] w-[18px]" />
                        </span>
                        <span
                          className={cn(
                            "text-[15px] font-bold font-sans",
                            selected ? "text-primary" : "text-foreground/90",
                          )}
                        >
                          {v.label}
                        </span>
                        {selected && (
                          <Check className="ml-auto h-[18px] w-[18px] text-primary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.section>

              {/* CAPTCHA Widget */}
              <div className="pt-2">
                <Turnstile
                  sitekey={TURNSTILE_SITEKEY}
                  onVerify={setCaptchaToken}
                />
                {errors.captcha && (
                  <p className="mt-1.5 flex items-center justify-center gap-1.5 text-xs font-semibold text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {errors.captcha}
                  </p>
                )}
              </div>

              {/* Submit */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={formSubmitting}
                  aria-busy={formSubmitting}
                  className={cn(
                    "w-full text-[15px] font-bold uppercase tracking-wider py-4 flex items-center justify-center gap-2 font-sans border-0 rounded-xl transition-all duration-200",
                    formSubmitting
                      ? "bg-primary/70 text-primary-foreground cursor-wait"
                      : "bg-primary text-primary-foreground glow-button magnetic-hover cursor-pointer btn-themed-shadow hover:-translate-y-[3px] active:translate-y-0 active:scale-[0.97]",
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
                <p className="text-xs text-foreground/70 font-sans mt-3.5 text-center flex items-center justify-center gap-1.5 font-semibold">
                  <Lock className="h-3.5 w-3.5 text-primary" />
                  No card, no install. Encrypted, never shared, deleted after 30 days.
                </p>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
