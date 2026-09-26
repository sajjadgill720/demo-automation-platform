import { useState } from "react";
import { Check, Sparkles, ArrowRight, Shield, Zap, PhoneCall } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export interface PricingPlan {
  id: string;
  name: string;
  price?: string;
  frequency?: string;
  isPopular?: boolean;
  highlightText?: string;
  features: string[];
  ctaText: string;
  ctaVariant: "teal" | "white";
  cardBgClass: string;
  borderColorClass: string;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "launch",
    name: "Launch",
    price: "$249",
    frequency: "Per Month",
    isPopular: false,
    features: [
      "600 minutes per month",
      "3 AI Assistant personas",
      "Call recording, transcript & summaries",
      "Appointment/Calendar Scheduling",
      "Customize your AI",
      "Analytical Dashboard",
      "Minimum 2 dedicated lines",
    ],
    ctaText: "Get Started",
    ctaVariant: "teal",
    cardBgClass: "bg-gradient-to-b from-[#110e2d] via-[#09081a] to-[#04040a]",
    borderColorClass: "border-indigo-900/40 hover:border-indigo-500/50",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$579",
    frequency: "Per Month",
    isPopular: true,
    features: [
      "1800 minutes per month",
      "10 AI Assistant personas",
      "Call recording, transcript & summaries",
      "Appointment/Calendar Scheduling",
      "Customize your AI",
      "Analytical Dashboard",
      "Minimum 5 dedicated lines",
    ],
    ctaText: "Get Started",
    ctaVariant: "white",
    cardBgClass: "bg-gradient-to-b from-[#063932] via-[#0a4b40] to-[#127263]",
    borderColorClass: "border-emerald-500/50 hover:border-emerald-400 shadow-[0_0_40px_-10px_rgba(45,212,191,0.25)]",
  },
  {
    id: "enterprise",
    name: "Audia Enterprise",
    highlightText: "Contact Us",
    isPopular: false,
    features: [
      "Unlimited concurrency",
      "Multilingual assistants",
      "Inbound and outbound automation",
      "Advanced data analytics",
      "API access",
      "Custom integrations",
      "White-glove deployment",
      "Hands on training",
      "Professional support and setup",
    ],
    ctaText: "Contact Us",
    ctaVariant: "teal",
    cardBgClass: "bg-gradient-to-b from-[#0e0e16] via-[#08080c] to-[#030305]",
    borderColorClass: "border-white/10 hover:border-white/25",
  },
];

interface PricingModuleProps {
  company?: string;
  leadId?: string;
  onSelectPlan?: (plan: PricingPlan) => void;
  className?: string;
}

export function PricingModule({ company, leadId, onSelectPlan, className }: PricingModuleProps) {
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handlePlanClick = (plan: PricingPlan) => {
    setSelectedPlan(plan);
    setModalOpen(true);
    if (onSelectPlan) onSelectPlan(plan);
  };

  const handleActivationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // Simulate activation lead submission
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      toast.success(
        selectedPlan?.id === "enterprise"
          ? "Request submitted! An enterprise solutions engineer will contact you shortly."
          : `Activation initiated for ${selectedPlan?.name}! Our team will set up your lines.`,
      );
    }, 700);
  };

  return (
    <div className={cn("w-full py-8", className)}>
      {/* 3-Column Pricing Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 xl:gap-8 max-w-6xl mx-auto items-stretch">
        {PRICING_PLANS.map((plan, idx) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: idx * 0.1 }}
            className={cn(
              "relative flex flex-col justify-between rounded-3xl border p-8 md:p-9 text-white transition-all duration-300 overflow-hidden",
              plan.cardBgClass,
              plan.borderColorClass,
              plan.isPopular && "scale-[1.02] z-10",
            )}
          >
            {/* Ribbon for Popular Plan */}
            {plan.isPopular && (
              <div className="absolute top-0 right-0 w-32 h-32 overflow-hidden pointer-events-none">
                <div className="absolute top-7 -right-9 w-36 bg-[#6366f1] text-white text-[11px] font-bold font-mono tracking-widest uppercase py-1 text-center rotate-45 shadow-lg">
                  POPULAR
                </div>
              </div>
            )}

            <div>
              {/* Header / Title */}
              <div className="text-center pt-2 pb-6">
                <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
                  {plan.name}
                </h3>

                {/* Price or Callout */}
                <div className="mt-8 mb-4 min-h-[90px] flex flex-col items-center justify-center">
                  {plan.price ? (
                    <>
                      <div className="text-5xl md:text-6xl font-extrabold tracking-tight text-[#2dd4bf]">
                        {plan.price}
                      </div>
                      {plan.frequency && (
                        <p className="text-xs md:text-sm font-sans text-white/60 mt-1 font-medium">
                          {plan.frequency}
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#2dd4bf]">
                      {plan.highlightText}
                    </div>
                  )}
                </div>
              </div>

              {/* Feature List with Checkmarks and Dividers */}
              <div className="space-y-0 pt-4 pb-8">
                {plan.features.map((feature) => (
                  <div
                    key={feature}
                    className="flex items-center gap-3 py-3 border-b border-white/10 last:border-b-0"
                  >
                    <Check className="h-4 w-4 text-white shrink-0 stroke-[2.5]" />
                    <span className="text-sm font-normal text-white/90 leading-snug font-sans">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom CTA Button */}
            <div className="pt-4 mt-auto">
              <button
                type="button"
                onClick={() => handlePlanClick(plan)}
                className={cn(
                  "w-full py-3.5 px-6 rounded-full font-semibold text-sm transition-all duration-200 cursor-pointer shadow-lg active:scale-[0.98]",
                  plan.ctaVariant === "white"
                    ? "bg-white text-[#063932] hover:bg-zinc-100 hover:shadow-white/20"
                    : "bg-[#2dd4bf] text-[#05070d] hover:bg-[#25b5a2] hover:shadow-[#2dd4bf]/20",
                )}
              >
                {plan.ctaText}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Activation / Contact Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:w-full sm:max-w-md rounded-3xl border border-border/80 bg-card/95 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl overflow-hidden text-foreground">
          <DialogHeader className="text-center space-y-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary mx-auto mb-1">
              <Sparkles className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {selectedPlan?.id === "enterprise"
                ? "Contact Enterprise Solutions"
                : `Deploy ${selectedPlan?.name} Plan`}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground font-sans max-w-xs mx-auto">
              {company
                ? `Activate dedicated AI receptionist lines for ${company}.`
                : "Enter your contact details to begin instant line provisioning."}
            </DialogDescription>
          </DialogHeader>

          {!submitted ? (
            <form onSubmit={handleActivationSubmit} className="space-y-4 pt-3 font-sans text-sm">
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Full Name
                </label>
                <input
                  required
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full bg-secondary/60 border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary text-sm font-sans"
                />
              </div>

              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Work Email
                </label>
                <input
                  required
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="jane@company.com"
                  className="w-full bg-secondary/60 border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary text-sm font-sans"
                />
              </div>

              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Phone Number
                </label>
                <input
                  required
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full bg-secondary/60 border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary text-sm font-sans"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#2dd4bf] hover:bg-[#25b5a2] text-[#05070d] font-semibold text-sm py-3.5 rounded-full transition-all duration-200 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {submitting ? "Processing..." : `Confirm ${selectedPlan?.name} Request`}
                </button>
              </div>

              <p className="text-[11px] text-center text-muted-foreground font-mono">
                No credit card charged immediately · 14-day money-back guarantee
              </p>
            </form>
          ) : (
            <div className="py-6 text-center space-y-4 font-mono">
              <div className="h-12 w-12 bg-success/10 border border-success/20 text-success flex items-center justify-center rounded-full mx-auto">
                <Check className="h-6 w-6" />
              </div>
              <p className="text-base font-bold text-foreground">Request Received</p>
              <p className="text-xs text-muted-foreground font-sans leading-relaxed max-w-xs mx-auto">
                Thank you, {contactName || "valued customer"}! Our onboarding team will contact you
                at {contactEmail} to finalize your dedicated receptionist setup.
              </p>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setSubmitted(false);
                }}
                className="w-full bg-secondary hover:bg-secondary/80 text-foreground font-sans font-medium py-2.5 px-4 rounded-xl text-sm transition-colors cursor-pointer border border-border mt-2"
              >
                Close
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
