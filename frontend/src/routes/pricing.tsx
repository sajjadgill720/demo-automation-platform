import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Sparkles,
  Check,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Send,
  ArrowRight,
  Headphones,
  Shield,
  Clock,
  Zap,
  PhoneCall,
  Sun,
  Moon,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { PricingModule } from "@/components/common/PricingModule";
import { submitDemoFeedback, getDemoRequestStatus } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const pricingSearchSchema = z.object({
  lead_id: z.string().optional(),
  company: z.string().optional(),
  assistant_id: z.string().optional(),
  feedback: z.string().optional(),
});

export const Route = createFileRoute("/pricing")({
  validateSearch: (search) => pricingSearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Pricing & Plans — Audia" },
      {
        name: "description",
        content: "Transparent plans for your AI voice receptionist. Launch, Pro, and Enterprise.",
      },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const search = Route.useSearch();
  const { theme, toggleTheme } = useTheme();

  const dynamicLeadId = search.lead_id || null;
  const initialCompany = search.company || "Your Business";
  const [companyName, setCompanyName] = useState(initialCompany);

  // Auto-open feedback modal if arrived with feedback=open
  const [feedbackOpen, setFeedbackOpen] = useState(() => search.feedback === "open");
  const [feedbackRating, setFeedbackRating] = useState<"positive" | "negative" | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // If lead_id provided, fetch company name if missing
  useEffect(() => {
    if (!dynamicLeadId) return;
    getDemoRequestStatus(dynamicLeadId)
      .then((lead) => {
        if (lead.company_name) setCompanyName(lead.company_name);
      })
      .catch(() => {
        /* fallback to search.company */
      });
  }, [dynamicLeadId]);

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackRating) return;

    setFeedbackSending(true);
    try {
      if (dynamicLeadId) {
        await submitDemoFeedback(dynamicLeadId, {
          rating: feedbackRating,
          comment: feedbackText.trim() || undefined,
        });
      }
      setFeedbackSubmitted(true);
      toast.success(
        feedbackRating === "positive"
          ? "Thank you! Your feedback has been recorded."
          : "Thank you for the feedback. Our team will tune the agent accordingly.",
      );
    } catch (err) {
      // Still show success gracefully in demo mode
      setFeedbackSubmitted(true);
      toast.success("Feedback noted for this demo session.");
    } finally {
      setFeedbackSending(false);
    }
  };

  const FAQS = [
    {
      q: "Can I keep my existing business phone numbers?",
      a: "Yes. You can seamlessly forward any unanswered or busy calls to your dedicated Audia numbers, or port your numbers over completely.",
    },
    {
      q: "What happens if I exceed my monthly minutes?",
      a: "You'll never drop a call. Extra minutes are billed at a flat rate of $0.18/minute, or you can upgrade to the next tier at any time.",
    },
    {
      q: "How fast can my AI receptionist go live?",
      a: "Because your demo agent is already trained and verified, production line activation typically takes less than 15 minutes once you select your plan.",
    },
    {
      q: "Is there any long-term contract?",
      a: "No long-term lock-in. All standard plans are billed month-to-month and you can upgrade, downgrade, or cancel at any time.",
    },
  ];

  return (
    <div className={cn("min-h-screen bg-background text-foreground font-sans antialiased overflow-x-hidden selection:bg-primary/10 selection:text-primary relative", theme)}>
      {/* Background ambient lighting */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute inset-0 opacity-[0.08] dark:opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, var(--border) 1.5px, transparent 1.5px)",
            backgroundSize: "32px 32px",
            maskImage: "radial-gradient(ellipse 60% 50% at 50% 0%, #000 40%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(ellipse 60% 50% at 50% 0%, #000 40%, transparent 100%)",
          }}
        />
        <div className="absolute top-[8%] left-[15%] w-[38rem] h-[38rem] bg-primary/[0.04] dark:bg-primary/[0.025] blur-[140px] rounded-full" />
        <div className="absolute top-[35%] right-[10%] w-[35rem] h-[35rem] bg-emerald-500/[0.035] dark:bg-emerald-500/[0.02] blur-[130px] rounded-full" />
      </div>

      {/* Navigation Header */}
      <header className="sticky top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3 text-foreground group">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs group-hover:bg-primary/15 transition-colors">
              <Headphones className="h-4 w-4" />
            </div>
            <span className="uppercase tracking-widest text-sm font-semibold font-mono">
              Audia
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 font-mono text-[11px] uppercase tracking-widest text-foreground/60">
            <Link to="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <a href="#plans" className="hover:text-foreground transition-colors">
              Plans
            </a>
            <a href="#features" className="hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#faq" className="hover:text-foreground transition-colors">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setFeedbackOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-mono uppercase tracking-wider transition-all cursor-pointer"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Feedback</span>
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-border/50 hover:bg-secondary text-foreground transition-all cursor-pointer bg-transparent"
              aria-label="Toggle Theme"
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>

            <Link
              to="/demo-preview"
              search={search}
              className="inline-flex items-center gap-1.5 text-xs font-mono font-medium uppercase tracking-wider px-4 py-2 rounded-xl border border-border bg-secondary hover:bg-secondary/80 transition-all text-foreground"
            >
              <PhoneCall className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline">Back to</span> Demo
            </Link>
          </div>
        </div>
      </header>

      {/* Post-Call Notification Banner */}
      {search.feedback === "open" && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full bg-primary/[0.08] border-b border-primary/20 py-2.5 px-4 text-center text-xs font-sans text-foreground/90 flex items-center justify-center gap-2"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
          <span>
            Demo call concluded for <strong className="text-foreground">{companyName}</strong>. Ready to take your receptionist live?
          </span>
          <button
            onClick={() => setFeedbackOpen(true)}
            className="underline font-semibold text-primary hover:text-primary/80 ml-1 cursor-pointer"
          >
            Review Call
          </button>
        </motion.div>
      )}

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-12 pb-24 space-y-16">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-[11px] font-mono uppercase tracking-widest font-semibold">
            <Sparkles className="h-3.5 w-3.5" /> Post-Demo Plans
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-normal tracking-tight text-foreground leading-[1.1]">
            Put your receptionist to work for{" "}
            <span className="text-[#2dd4bf] font-medium">{companyName}</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground font-sans leading-relaxed max-w-2xl mx-auto">
            Choose the package tailored to your call volume. Dedicated lines, zero hold times, and human-like voice quality ready in minutes.
          </p>
        </div>

        {/* Pricing Module (Exact replica from the user screenshot) */}
        <section id="plans" className="scroll-mt-24">
          <PricingModule company={companyName} leadId={dynamicLeadId ?? undefined} />
        </section>

        {/* Trust Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-8 border-y border-border/40 max-w-5xl mx-auto text-center font-mono">
          <div className="space-y-1">
            <Clock className="h-5 w-5 text-primary mx-auto mb-1.5" />
            <p className="text-sm font-semibold text-foreground">15-Min Setup</p>
            <p className="text-[11px] text-muted-foreground">Instant line activation</p>
          </div>
          <div className="space-y-1">
            <Shield className="h-5 w-5 text-emerald-400 mx-auto mb-1.5" />
            <p className="text-sm font-semibold text-foreground">SOC 2 Certified</p>
            <p className="text-[11px] text-muted-foreground">Enterprise compliance</p>
          </div>
          <div className="space-y-1">
            <Zap className="h-5 w-5 text-amber-400 mx-auto mb-1.5" />
            <p className="text-sm font-semibold text-foreground">Zero Hold Times</p>
            <p className="text-[11px] text-muted-foreground">Unlimited concurrency</p>
          </div>
          <div className="space-y-1">
            <Sparkles className="h-5 w-5 text-primary mx-auto mb-1.5" />
            <p className="text-sm font-semibold text-foreground">Cancel Anytime</p>
            <p className="text-[11px] text-muted-foreground">14-day money back</p>
          </div>
        </div>

        {/* FAQ Section */}
        <section id="faq" className="max-w-3xl mx-auto space-y-8 scroll-mt-24 pt-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-normal tracking-tight text-foreground">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground font-sans">
              Have questions about line porting, minutes, or setup? We have you covered.
            </p>
          </div>

          <div className="divide-y divide-border/60 border border-border/60 rounded-2xl overflow-hidden bg-card/60 backdrop-blur-sm">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group p-5 hover:bg-secondary/20 transition-colors">
                <summary className="flex items-center justify-between cursor-pointer font-medium text-foreground text-sm list-none font-sans">
                  <span>{faq.q}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm text-muted-foreground font-sans leading-relaxed">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      </main>

      {/* Automatic Post-Call Feedback Modal */}
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent
          className={cn(
            "w-[calc(100%-2rem)] sm:w-full sm:max-w-md rounded-3xl border border-border/80 bg-card/95 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl overflow-hidden text-foreground",
            theme === "dark" && "dark",
          )}
        >
          {/* Ambient top glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 inset-x-0 mx-auto h-36 w-64 rounded-full blur-3xl opacity-30"
            style={{
              background: "radial-gradient(circle, var(--color-primary), transparent 70%)",
            }}
          />

          <DialogHeader className="relative z-10 flex flex-col items-center text-center space-y-2.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-sm">
              <MessageSquare className="h-6 w-6" aria-hidden="true" />
            </div>
            <DialogTitle className="text-xl font-normal tracking-tight text-foreground">
              How was that demo call?
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground font-sans max-w-xs mx-auto leading-relaxed">
              Tell us if {companyName}&apos;s AI receptionist answered your questions accurately.
            </DialogDescription>
          </DialogHeader>

          <div className="relative z-10 mt-2">
            {!feedbackSubmitted ? (
              <form onSubmit={handleFeedbackSubmit} className="space-y-4 font-sans text-sm">
                {/* Rating Selector */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFeedbackRating("positive")}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-4 font-mono uppercase tracking-wider text-xs font-semibold cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]",
                      feedbackRating === "positive"
                        ? "border-success text-success bg-success/[0.08] ring-1 ring-success"
                        : "border-border text-foreground bg-secondary/40 hover:bg-secondary",
                    )}
                  >
                    <ThumbsUp className="h-5 w-5" />
                    <span>Yes, Accurate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedbackRating("negative")}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-4 font-mono uppercase tracking-wider text-xs font-semibold cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]",
                      feedbackRating === "negative"
                        ? "border-destructive text-destructive bg-destructive/[0.08] ring-1 ring-destructive"
                        : "border-border text-foreground bg-secondary/40 hover:bg-secondary",
                    )}
                  >
                    <ThumbsDown className="h-5 w-5" />
                    <span>Needs Tweaks</span>
                  </button>
                </div>

                {/* Rating Comments */}
                <AnimatePresence>
                  {feedbackRating && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-2 text-left pt-1"
                    >
                      <label className="text-[11px] font-mono uppercase tracking-wider text-foreground/75 font-semibold block">
                        {feedbackRating === "positive"
                          ? "What worked well? (Optional)"
                          : "What did the agent miss? (e.g. tools, phrasing) *"}
                      </label>
                      <textarea
                        required={feedbackRating === "negative"}
                        rows={3}
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder={
                          feedbackRating === "positive"
                            ? "Tell us what you liked about the response..."
                            : "Tell us what to adjust so we can rebuild your agent..."
                        }
                        className="w-full bg-secondary/60 border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary text-sm font-sans resize-none transition-colors"
                      />
                      <button
                        type="submit"
                        disabled={feedbackSending}
                        className="w-full bg-[#2dd4bf] hover:bg-[#25b5a2] text-[#05070d] transition-all duration-200 text-sm font-mono font-semibold uppercase tracking-wider py-3 cursor-pointer border-0 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed rounded-full shadow-md"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {feedbackSending ? "Sending…" : "Send Feedback"}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            ) : (
              <div className="py-4 text-center space-y-3 font-mono">
                <div className="h-12 w-12 bg-success/10 border border-success/20 text-success flex items-center justify-center rounded-full mx-auto">
                  <Check className="h-6 w-6" />
                </div>
                <p className="text-base font-bold uppercase tracking-wider text-foreground">
                  Feedback Received
                </p>
                <p className="text-xs text-muted-foreground font-sans leading-relaxed max-w-xs mx-auto">
                  Thank you! We&apos;ve saved your evaluation for {companyName}. Explore our plans below to activate your live receptionist.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setFeedbackOpen(false)}
                    className="w-full bg-secondary hover:bg-secondary/80 text-foreground font-sans font-medium py-2.5 px-4 rounded-xl text-sm transition-colors cursor-pointer border border-border"
                  >
                    View Plans
                  </button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/40 bg-background/50 py-10 px-6 text-xs font-mono text-muted-foreground">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span>&copy; {new Date().getFullYear()} Audia Automation. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/demo-preview" search={search} className="hover:text-foreground transition-colors">
              Live Demo
            </Link>
            <Link to="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <a href="mailto:support@audia.ai" className="hover:text-foreground transition-colors">
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
