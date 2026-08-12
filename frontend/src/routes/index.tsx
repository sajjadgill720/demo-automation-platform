import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import {
  ArrowRight,
  Sparkles,
  ChevronDown,
  Sun,
  Moon,
  Phone,
  PhoneOff,
  PhoneIncoming,
  Calendar,
  BarChart3,
  Zap,
  Globe,
  Shield,
  Clock,
  Lock,
  Play,
  MessageSquare,
  Headphones,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  Truck,
  Home,
  UtensilsCrossed,
  Scissors,
  Star,
  Twitter,
  Linkedin,
  Github,
  Youtube,
} from "lucide-react";
import { motion, useInView, AnimatePresence, useScroll, useSpring } from "framer-motion";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { ParticleField } from "@/components/common/ParticleField";

/* ── Animation variants ── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
} as const;

const itemVariants = {
  hidden: { y: 24, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 70, damping: 15 },
  },
} as const;

/* ── Live phone call simulation ── */
const CALL_TRANSCRIPT = [
  {
    speaker: "ai",
    text: "Good morning! Thank you for calling Riverside Dental. How can I help you today?",
  },
  { speaker: "caller", text: "Hi, I'd like to book a cleaning appointment." },
  {
    speaker: "ai",
    text: "Of course! I have openings this Thursday at 10 AM or Friday at 2 PM. Which works better?",
  },
  { speaker: "caller", text: "Thursday at 10 works great." },
  {
    speaker: "ai",
    text: "Perfect. I've booked Dr. Chen for Thursday at 10 AM. You'll receive a confirmation text shortly. Is there anything else?",
  },
  { speaker: "caller", text: "That's all, thanks!" },
  { speaker: "ai", text: "Wonderful. Have a great day! Goodbye." },
];

/* ── Feature cards ── */
const FEATURES = [
  {
    icon: PhoneIncoming,
    title: "Answer Every Call",
    desc: "24/7 coverage. Zero hold times. Every caller gets an instant, professional response.",
    color: "text-blue-500",
    bg: "from-blue-500/15 to-blue-500/5",
    border: "border-blue-500/25",
  },
  {
    icon: Calendar,
    title: "Book Appointments",
    desc: "Checks real availability, books slots, sends confirmations, all within the call.",
    color: "text-primary",
    bg: "from-primary/15 to-primary/5",
    border: "border-primary/25",
  },
  {
    icon: MessageSquare,
    title: "Answer FAQs",
    desc: "Trained on your business docs. Handles pricing, hours, locations accurately.",
    color: "text-success",
    bg: "from-success/15 to-success/5",
    border: "border-success/25",
  },
  {
    icon: BarChart3,
    title: "Qualify & Route Leads",
    desc: "Captures caller intent, scores urgency, and routes hot leads to your team instantly.",
    color: "text-primary",
    bg: "from-primary/15 to-primary/5",
    border: "border-primary/25",
  },
  {
    icon: Globe,
    title: "Multilingual",
    desc: "Speaks English, Spanish, German, French — and more. Serves your diverse customer base.",
    color: "text-pink-500",
    bg: "from-pink-500/15 to-pink-500/5",
    border: "border-pink-500/25",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    desc: "SOC 2 Type II · GDPR · HIPAA-ready. Your data stays encrypted and compliant.",
    color: "text-primary",
    bg: "from-primary/15 to-primary/5",
    border: "border-primary/25",
  },
];

/* ── Stats ── */
const STATS = [
  { value: "98%", label: "Calls Answered" },
  { value: "<3s", label: "Avg. Pickup Time" },
  { value: "24/7", label: "Always On" },
  { value: "50+", label: "Languages" },
];

/* ── FAQ ── */
const FAQ_ITEMS = [
  {
    q: "Is this a sales call?",
    a: "No. If clarification is needed, you'll speak with an AI assistant, not a salesperson. It's focused purely on building your demo.",
  },
  {
    q: "How long does it take?",
    a: "Under 5 minutes. The form takes 60 seconds, optional AI clarification averages 2 minutes, and demo generation completes in about 3 minutes.",
  },
  {
    q: "What if I don't like the demo?",
    a: "We'll rebuild it for free. Just tell us what to adjust and we regenerate a new version.",
  },
  {
    q: "Who sees my data?",
    a: "Nobody outside the demo pipeline. Encrypted in transit and at rest, EU-hosted, auto-deleted after 30 days.",
  },
  {
    q: "Do I need to install anything?",
    a: "No. Everything runs in your browser, including the voice call, demo portal, and dashboard.",
  },
  {
    q: "What does it cost?",
    a: "Free to try. Generate your first demo at no cost. Enterprise pricing available on request.",
  },
];

/* ── Animated phone mockup component ── */
function PhoneMockup() {
  const [currentLine, setCurrentLine] = useState(0);
  const [isRinging, setIsRinging] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (!isInView) return;
    // Ring for 2s, then start transcript
    const ringTimer = setTimeout(() => {
      setIsRinging(false);
    }, 2000);
    return () => clearTimeout(ringTimer);
  }, [isInView]);

  useEffect(() => {
    if (isRinging || !isInView) return;
    if (currentLine >= CALL_TRANSCRIPT.length) return;
    const delay = currentLine === 0 ? 800 : 2200;
    const timer = setTimeout(() => {
      setCurrentLine((prev) => prev + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [currentLine, isRinging, isInView]);

  return (
    <div ref={ref} className="relative">
      {/* Phone glow */}
      <div className="absolute inset-0 bg-primary/8 blur-[80px] rounded-full scale-150" />

      {/* Phone frame */}
      <div className="relative w-[280px] sm:w-[320px] h-[560px] sm:h-[640px] bg-card border border-border/60 rounded-[2.5rem] shadow-2xl overflow-hidden">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-background rounded-b-2xl z-20" />

        {/* Status bar */}
        <div className="relative z-10 flex items-center justify-between px-8 pt-10 pb-2">
          <span className="text-[10px] font-mono text-foreground/50">9:41</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-2 border border-foreground/40 rounded-[2px] relative">
              <div className="absolute inset-[1px] right-[2px] bg-success rounded-[1px]" />
            </div>
          </div>
        </div>

        {/* Screen content */}
        <div className="px-5 pt-2 h-full flex flex-col">
          <AnimatePresence mode="wait">
            {isRinging ? (
              /* Incoming call screen */
              <motion.div
                key="ringing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex-1 flex flex-col items-center justify-center text-center space-y-6"
              >
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/40 flex items-center justify-center"
                >
                  <Phone className="h-8 w-8 text-primary" />
                </motion.div>
                <div>
                  <p className="text-foreground font-semibold text-lg">Incoming Call</p>
                  <p className="text-foreground/50 text-sm font-mono mt-1">+1 (555) 234-5678</p>
                </div>
                <div className="flex gap-12 pt-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-14 w-14 rounded-full bg-destructive/20 border border-destructive/40 flex items-center justify-center">
                      <PhoneOff className="h-5 w-5 text-destructive" />
                    </div>
                    <span className="text-[10px] text-foreground/40 font-mono">Decline</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <motion.div
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ repeat: Infinity, duration: 0.8 }}
                      className="h-14 w-14 rounded-full bg-success/20 border border-success/40 flex items-center justify-center"
                    >
                      <Phone className="h-5 w-5 text-success" />
                    </motion.div>
                    <span className="text-[10px] text-foreground/40 font-mono">Accept</span>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Active call + transcript */
              <motion.div
                key="active"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex flex-col"
              >
                {/* Call header */}
                <div className="text-center py-3 space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                    <span className="text-[10px] font-mono text-success uppercase tracking-widest">
                      Live Call
                    </span>
                  </div>
                  <p className="text-foreground font-medium text-sm">Convoa AI Receptionist</p>
                  <p className="text-foreground/40 text-[11px] font-mono">
                    00:{String(Math.min(currentLine * 8, 59)).padStart(2, "0")}
                  </p>
                </div>

                {/* Waveform visualization */}
                <div className="flex items-center justify-center gap-[3px] h-8 my-2">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        height:
                          currentLine < CALL_TRANSCRIPT.length ? [4, Math.random() * 20 + 4, 4] : 4,
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.5 + Math.random() * 0.5,
                        delay: i * 0.05,
                      }}
                      className="w-[2px] bg-primary/60 rounded-full"
                    />
                  ))}
                </div>

                {/* Chat transcript */}
                <div className="flex-1 overflow-y-auto space-y-3 py-3 scrollbar-hide">
                  {CALL_TRANSCRIPT.slice(0, currentLine).map((line, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={cn(
                        "flex",
                        line.speaker === "ai" ? "justify-start" : "justify-end",
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] px-3.5 py-2.5 text-[12px] leading-relaxed rounded-2xl",
                          line.speaker === "ai"
                            ? "bg-primary/10 text-foreground rounded-bl-md"
                            : "bg-secondary text-foreground/80 rounded-br-md",
                        )}
                      >
                        {line.text}
                      </div>
                    </motion.div>
                  ))}
                  {currentLine < CALL_TRANSCRIPT.length && currentLine > 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={cn(
                        "flex",
                        CALL_TRANSCRIPT[currentLine]?.speaker === "ai"
                          ? "justify-start"
                          : "justify-end",
                      )}
                    >
                      <div className="px-4 py-3 flex gap-1">
                        {[0, 1, 2].map((d) => (
                          <motion.div
                            key={d}
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ repeat: Infinity, duration: 0.8, delay: d * 0.2 }}
                            className="w-1.5 h-1.5 bg-primary/50 rounded-full"
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Home indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-28 h-1 bg-foreground/20 rounded-full" />
      </div>

      {/* Floating "incoming caller" card — top left */}
      <motion.div
        initial={{ opacity: 0, x: -20, y: 10 }}
        animate={{ opacity: 1, x: 0, y: [0, -10, 0] }}
        transition={{
          opacity: { delay: 1, duration: 0.6 },
          x: { delay: 1, duration: 0.6 },
          y: { repeat: Infinity, duration: 4, ease: "easeInOut" },
        }}
        className="hidden sm:flex absolute -left-8 top-16 z-20 items-center gap-2.5 rounded-2xl border border-border/50 bg-card/90 backdrop-blur-md shadow-xl px-3.5 py-2.5"
      >
        <img
          src={HERO_AVATARS[0]}
          alt="Caller"
          loading="lazy"
          className="h-9 w-9 rounded-full object-cover border border-border/40"
        />
        <div className="pr-1">
          <p className="text-[11px] font-semibold text-foreground leading-tight">New booking</p>
          <p className="text-[10px] font-mono text-success flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Confirmed
          </p>
        </div>
      </motion.div>

      {/* Floating "answered" stat card — bottom right */}
      <motion.div
        initial={{ opacity: 0, x: 20, y: -10 }}
        animate={{ opacity: 1, x: 0, y: [0, 10, 0] }}
        transition={{
          opacity: { delay: 1.4, duration: 0.6 },
          x: { delay: 1.4, duration: 0.6 },
          y: { repeat: Infinity, duration: 5, ease: "easeInOut", delay: 0.5 },
        }}
        className="hidden sm:flex absolute -right-6 bottom-24 z-20 items-center gap-2.5 rounded-2xl border border-border/50 bg-card/90 backdrop-blur-md shadow-xl px-3.5 py-2.5"
      >
        <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
          <PhoneIncoming className="h-4 w-4 text-primary" />
        </div>
        <div className="pr-1">
          <p className="text-[15px] font-bold text-foreground font-mono leading-none">98%</p>
          <p className="text-[10px] font-mono text-foreground/45 mt-0.5">calls answered</p>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Animated counter ── */
function AnimatedStat({ value, label }: { value: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
      className="text-center space-y-1"
    >
      <p className="text-3xl sm:text-4xl font-bold text-foreground font-mono tracking-tight stat-glow">
        {value}
      </p>
      <p className="text-[11px] text-foreground/50 font-mono uppercase tracking-widest">{label}</p>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Industry Slider — auto-sliding carousel of use-case visuals
   ───────────────────────────────────────────────────────────── */

const SLIDES = [
  {
    icon: Stethoscope,
    industry: "Healthcare & Dental",
    headline: "Appointments booked while you sleep",
    stat: "1,240",
    statLabel: "Bookings / mo",
    accent: "text-blue-500",
    gradient: "from-blue-500/20 via-blue-500/5 to-transparent",
    ring: "border-blue-500/30",
    image: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&q=80",
  },
  {
    icon: Truck,
    industry: "Logistics & Dispatch",
    headline: "Loads dispatched 24/7, zero missed calls",
    stat: "98%",
    statLabel: "Calls Answered",
    accent: "text-primary",
    gradient: "from-primary/20 via-primary/5 to-transparent",
    ring: "border-primary/30",
    image: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=800&q=80",
  },
  {
    icon: Home,
    industry: "Real Estate",
    headline: "Every lead qualified the moment it calls",
    stat: "3.2×",
    statLabel: "More Leads",
    accent: "text-success",
    gradient: "from-success/20 via-success/5 to-transparent",
    ring: "border-success/30",
    image: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80",
  },
  {
    icon: UtensilsCrossed,
    industry: "Restaurants",
    headline: "Reservations taken — never a busy signal",
    stat: "<3s",
    statLabel: "Pickup Time",
    accent: "text-pink-500",
    gradient: "from-pink-500/20 via-pink-500/5 to-transparent",
    ring: "border-pink-500/30",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
  },
  {
    icon: Scissors,
    industry: "Salons & Spas",
    headline: "Bookings on autopilot, day and night",
    stat: "24/7",
    statLabel: "Always On",
    accent: "text-primary",
    gradient: "from-primary/20 via-primary/5 to-transparent",
    ring: "border-primary/30",
    image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80",
  },
];

function IndustrySlider() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);

  const go = (dir: number) => {
    setDirection(dir);
    setIndex((prev) => (prev + dir + SLIDES.length) % SLIDES.length);
  };

  // Auto-advance
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setDirection(1);
      setIndex((prev) => (prev + 1) % SLIDES.length);
    }, 3800);
    return () => clearInterval(timer);
  }, [paused]);

  const slide = SLIDES[index];
  const Icon = slide.icon;

  return (
    <div
      className="relative w-full max-w-[480px] select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 bg-primary/8 blur-[70px] rounded-full scale-110 pointer-events-none" />

      {/* Slide viewport */}
      <div className="relative aspect-[1.3] rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md overflow-hidden shadow-2xl">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={index}
            custom={direction}
            initial={{ x: direction > 0 ? "100%" : "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction > 0 ? "-100%" : "100%", opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 flex flex-col p-7 sm:p-8"
          >
            {/* Background photo */}
            <img
              src={slide.image}
              alt={slide.industry}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-25 dark:opacity-20"
            />
            {/* Readability scrim + colored wash */}
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/85 to-card/40 pointer-events-none" />
            <div
              className={cn(
                "absolute inset-0 bg-gradient-to-br pointer-events-none",
                slide.gradient,
              )}
            />

            {/* Top row: industry tag */}
            <div className="relative z-10 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/50 bg-background/40 text-[10px] font-mono font-semibold uppercase tracking-widest text-foreground/60">
                <span
                  className={cn("h-1.5 w-1.5 rounded-full", slide.accent.replace("text-", "bg-"))}
                />
                {slide.industry}
              </span>
              <span className="text-[10px] font-mono text-foreground/30">
                {String(index + 1).padStart(2, "0")}/{String(SLIDES.length).padStart(2, "0")}
              </span>
            </div>

            {/* Icon */}
            <div className="relative z-10 mt-6">
              <div
                className={cn(
                  "h-16 w-16 rounded-2xl border bg-background/50 backdrop-blur flex items-center justify-center",
                  slide.ring,
                  slide.accent,
                )}
              >
                <Icon className="h-8 w-8" />
              </div>
            </div>

            {/* Headline */}
            <h4 className="relative z-10 mt-5 text-lg sm:text-xl font-medium tracking-tight text-foreground leading-snug max-w-[85%]">
              {slide.headline}
            </h4>

            {/* Stat pinned to bottom */}
            <div className="relative z-10 mt-auto flex items-end justify-between">
              <div>
                <p
                  className={cn(
                    "text-4xl sm:text-5xl font-bold font-mono tracking-tight",
                    slide.accent,
                  )}
                >
                  {slide.stat}
                </p>
                <p className="text-[11px] font-mono uppercase tracking-widest text-foreground/40 mt-1">
                  {slide.statLabel}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-success uppercase tracking-widest">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                Live
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Prev / Next controls */}
        <button
          onClick={() => go(-1)}
          aria-label="Previous slide"
          className="absolute left-3 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full border border-border/50 bg-background/60 backdrop-blur flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-background transition-all cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => go(1)}
          aria-label="Next slide"
          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full border border-border/50 bg-background/60 backdrop-blur flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-background transition-all cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-2 mt-5">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              setDirection(i > index ? 1 : -1);
              setIndex(i);
            }}
            aria-label={`Go to slide ${i + 1}`}
            className={cn(
              "h-1.5 rounded-full transition-all cursor-pointer",
              i === index ? "w-6 bg-primary" : "w-1.5 bg-foreground/20 hover:bg-foreground/40",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Avatar cluster for social proof ── */
const HERO_AVATARS = [
  "https://randomuser.me/api/portraits/women/44.jpg",
  "https://randomuser.me/api/portraits/men/32.jpg",
  "https://randomuser.me/api/portraits/women/68.jpg",
  "https://randomuser.me/api/portraits/men/75.jpg",
];

function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });
  return (
    <motion.div
      style={{ scaleX }}
      className="fixed top-0 left-0 right-0 z-[60] h-0.5 origin-left bg-gradient-to-r from-primary via-primary to-success"
    />
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Convoa — AI Receptionist That Never Misses a Call" },
      {
        name: "description",
        content:
          "Convoa is an AI-powered receptionist that answers every call, books appointments, and qualifies leads 24/7. Get a personalized demo in minutes.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div
      className={cn(
        "skydda-sentinel-theme min-h-screen bg-background text-foreground font-sans antialiased overflow-x-hidden selection:bg-primary/10 selection:text-primary relative",
        theme,
      )}
    >
      <ScrollProgressBar />

      {/* Background grid + ambient glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute inset-0 opacity-[0.08] dark:opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, var(--border) 1.5px, transparent 1.5px)",
            backgroundSize: "32px 32px",
            maskImage: "radial-gradient(ellipse 60% 50% at 50% 0%, #000 40%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 60% 50% at 50% 0%, #000 40%, transparent 100%)",
          }}
        />
        <motion.div
          animate={{
            y: [0, -15, 0],
            x: [0, 10, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-[10%] left-[10%] w-[40rem] h-[40rem] bg-primary/[0.04] dark:bg-primary/[0.025] blur-[140px] rounded-full"
        />
        <motion.div
          animate={{
            y: [0, 20, 0],
            x: [0, -15, 0],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-[40%] right-[5%] w-[35rem] h-[35rem] bg-primary/[0.035] dark:bg-primary/[0.02] blur-[120px] rounded-full"
        />
        <motion.div
          animate={{
            y: [0, -10, 0],
            x: [0, 15, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute bottom-[10%] left-[20%] w-[30rem] h-[30rem] bg-success/[0.03] dark:bg-success/[0.015] blur-[100px] rounded-full"
        />
      </div>

      {/* Page guide lines */}
      <div className="pointer-events-none fixed inset-0 z-50">
        <div className="mx-auto h-full max-w-7xl">
          <div className="relative h-full">
            <div className="absolute left-0 top-0 h-full w-px bg-border/20" />
            <div className="absolute right-0 top-0 h-full w-px bg-border/20" />
          </div>
        </div>
      </div>

      {/* ─── Navigation ─── */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-background/70 backdrop-blur-xl border-b border-border/30 transition-colors supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3 text-foreground group">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs group-hover:bg-primary/15 transition-colors">
              <Headphones className="h-4 w-4" />
            </div>
            <span className="uppercase tracking-widest text-sm font-semibold font-mono">
              Convoa
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 font-mono text-[11px] uppercase tracking-widest text-foreground/50">
            <a href="#features" className="hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">
              How It Works
            </a>
            <a href="#faq" className="hover:text-foreground transition-colors">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-border/50 hover:bg-secondary text-foreground transition-all duration-200 cursor-pointer bg-transparent btn-themed-shadow hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.95]"
              aria-label="Toggle Theme"
              title="Toggle theme"
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <Link
              to="/build-demo"
              className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 font-mono font-medium text-xs tracking-wider uppercase px-5 py-2.5 cursor-pointer border-0 inline-flex items-center gap-2 rounded-xl shadow-lg shadow-primary/10 btn-themed-shadow hover:-translate-y-[2px] active:translate-y-0 active:scale-[0.97]"
            >
              Get My Demo
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════
          HERO — Split layout: headline left, phone mockup right
      ═══════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen w-full overflow-hidden flex items-center pt-20 px-6">
        {/* Particles */}
        <ParticleField
          className="z-[1]"
          particleCount={80}
          connectionDistance={100}
          particleColor="rgba(99, 102, 241, 0.25)"
          lineColor="rgba(99, 102, 241, 0.04)"
        />

        <div className="relative z-10 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left — Copy */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8 text-center lg:text-left"
          >
            <motion.h1
              variants={itemVariants}
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-normal tracking-tight leading-[1.08] gradient-text hero-text-shadow"
            >
              Your AI That
              <br />
              <span className="gradient-underline">Answers Every Call</span>
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="text-base lg:text-lg text-foreground/55 max-w-lg leading-relaxed font-sans mx-auto lg:mx-0"
            >
              AI receptionist that picks up the phone, books appointments, answers questions, and
              qualifies leads — personalized to your business in minutes.
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="flex items-center gap-4 flex-wrap justify-center lg:justify-start"
            >
              <Link
                to="/build-demo"
                className="glow-button bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 px-8 py-4 text-sm font-semibold uppercase tracking-wider inline-flex items-center gap-2.5 cursor-pointer border-0 rounded-2xl shadow-xl shadow-primary/15 btn-themed-shadow hover:-translate-y-[3px] active:translate-y-0 active:scale-[0.97]"
              >
                Build My Demo
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="/demo-preview"
                className="bg-white text-zinc-950 hover:bg-zinc-100 transition-all duration-200 px-8 py-4 text-sm font-semibold uppercase tracking-wider inline-flex items-center gap-2.5 cursor-pointer border-0 rounded-2xl shadow-xl btn-themed-shadow hover:-translate-y-[3px] active:translate-y-0 active:scale-[0.97]"
              >
                <Play className="h-4 w-4 text-primary fill-primary/20 group-hover:scale-110 transition-transform" />
                View Simple Demo
              </a>
            </motion.div>

            {/* Mini trust bar */}
            <motion.div
              variants={itemVariants}
              className="flex items-center gap-6 flex-wrap justify-center lg:justify-start pt-2"
            >
              {[
                { icon: Clock, text: "Setup in 5 min" },
                { icon: Shield, text: "SOC 2 Certified" },
                { icon: Zap, text: "No code needed" },
              ].map((item) => (
                <span
                  key={item.text}
                  className="flex items-center gap-1.5 text-[11px] text-foreground/40 font-mono"
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.text}
                </span>
              ))}
            </motion.div>

            {/* Social proof — avatar cluster */}
            <motion.div
              variants={itemVariants}
              className="flex items-center gap-3 justify-center lg:justify-start pt-1"
            >
              <div className="flex -space-x-2.5">
                {HERO_AVATARS.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt="Customer"
                    loading="lazy"
                    className="h-8 w-8 rounded-full object-cover border-2 border-background ring-1 ring-border/50"
                  />
                ))}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1 text-primary">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-primary" />
                  ))}
                </div>
                <p className="text-[11px] text-foreground/45 font-mono mt-0.5">
                  <span className="text-foreground/70 font-semibold">2,400+</span> businesses trust
                  Convoa
                </p>
              </div>
            </motion.div>
          </motion.div>

          {/* Right — Phone Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
            className="flex justify-center lg:justify-end"
          >
            <PhoneMockup />
          </motion.div>
        </div>
      </section>

      {/* ─── Stats Bar ─── */}
      <section className="w-full border-y border-border/30 bg-secondary/5">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 py-12 px-6">
          {STATS.map((stat) => (
            <AnimatedStat key={stat.label} value={stat.value} label={stat.label} />
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          FEATURES — Visual-first bento grid
      ═══════════════════════════════════════════════════════════════ */}
      <section id="features" className="w-full py-24 md:py-32 px-6 scroll-mt-20">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-[11px] font-mono text-primary font-bold uppercase tracking-widest"
            >
              What Convoa Does
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-foreground"
            >
              Everything your front desk does.
              <br />
              <span className="text-foreground/50">But never calls in sick.</span>
            </motion.h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.08 }}
                  className="group relative p-8 rounded-xl border border-border/40 bg-card/50 hover:border-border/80 hover:bg-card transition-all duration-300 cursor-default overflow-hidden"
                >
                  {/* Hover glow */}
                  <div
                    className={cn(
                      "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br",
                      feature.bg,
                    )}
                  />

                  <div className="relative z-10 space-y-4">
                    <div
                      className={cn(
                        "h-12 w-12 rounded-xl bg-gradient-to-br border flex items-center justify-center",
                        feature.bg,
                        feature.border,
                        feature.color,
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground font-mono tracking-tight">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-foreground/55 leading-relaxed font-sans">
                      {feature.desc}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          HOW IT WORKS — Visual 3-step with icons
      ═══════════════════════════════════════════════════════════════ */}
      <section
        id="how-it-works"
        className="w-full bg-secondary/5 py-24 md:py-32 border-y border-border/30 px-6 scroll-mt-20"
      >
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-foreground"
            >
              Live in 5 minutes. Seriously.
            </motion.h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
            {[
              {
                step: "01",
                title: "Describe Your Business",
                desc: "Tell us what you do, who calls you, and how you handle bookings. 60 seconds.",
                color: "text-blue-500",
              },
              {
                step: "02",
                title: "AI Builds Your Agent",
                desc: "We train a voice agent on your docs, FAQs, and business rules automatically.",
                color: "text-primary",
              },
              {
                step: "03",
                title: "Test It Live",
                desc: "Call your AI receptionist. Hear it answer like your best employee on day one.",
                color: "text-success",
              },
            ].map((step, idx) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.55, delay: idx * 0.45, ease: "easeOut" }}
                className={cn(
                  "relative p-10 border border-border/40 bg-background",
                  idx < 2 && "md:border-r-0",
                )}
              >
                {/* Step number */}
                <span
                  className={cn(
                    "text-[10px] font-mono font-bold uppercase tracking-widest mb-6 block",
                    step.color,
                  )}
                >
                  Step {step.step}
                </span>

                <h3 className="text-lg font-semibold text-foreground tracking-tight mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-foreground/50 leading-relaxed font-sans">{step.desc}</p>

                {/* Connector arrow */}
                {idx < 2 && (
                  <div className="hidden md:flex absolute top-1/2 -right-3 -translate-y-1/2 z-10">
                    <div className="h-6 w-6 rounded-full bg-background border border-border/60 flex items-center justify-center">
                      <ArrowRight className="h-3 w-3 text-foreground/30" />
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SOCIAL PROOF — Simple + powerful
      ═══════════════════════════════════════════════════════════════ */}
      <section className="w-full py-24 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-foreground">
              See a real demo we built.
            </h2>
            <p className="text-sm text-foreground/50 font-sans">
              Generated in 2 minutes 47 seconds for a logistics company.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="border border-border/50 bg-card/40 backdrop-blur-md rounded-2xl p-6 sm:p-8 lg:p-10 relative overflow-hidden max-w-5xl mx-auto"
          >
            {/* Top border ambient glow */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              {/* Left Side: CTA Focus */}
              <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left space-y-6">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5 text-[10px] font-semibold text-primary uppercase tracking-widest font-mono">
                    <Sparkles className="h-3 w-3 text-primary animate-pulse" /> Live Experience
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-normal tracking-tight text-foreground">
                    Interactive Demo Portal
                  </h3>
                  <p className="text-sm text-foreground/50 leading-relaxed font-sans">
                    Voice agent + dashboard, fully personalized. Call the agent, ask questions, and
                    see database metrics update in real-time.
                  </p>
                </div>

                <div className="relative group w-full sm:w-auto">
                  {/* Glowing background aura */}
                  <div className="absolute -inset-1 bg-gradient-to-r from-primary to-amber-500 rounded-lg blur-lg opacity-70 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse" />

                  <Link
                    to="/demo-preview"
                    className="relative w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4.5 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all border-0 font-mono rounded-lg shadow-xl cursor-pointer"
                  >
                    <Play className="h-4 w-4 fill-current" /> View Sample Demo
                  </Link>
                </div>
              </div>

              {/* Right Side: Auto-sliding industry carousel */}
              <div className="lg:col-span-7 flex justify-center w-full">
                <IndustrySlider />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          CTA — Final push
      ═══════════════════════════════════════════════════════════════ */}
      <section className="w-full py-28 px-6 border-y border-border/30 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-5"
          >
            <h2 className="text-3xl sm:text-5xl font-normal tracking-tight text-foreground">
              Ready to stop missing calls?
            </h2>
            <p className="text-foreground/50 font-sans max-w-md mx-auto">
              Get a personalized AI receptionist demo for your business. No credit card. No
              commitment.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col items-center gap-4"
          >
            <Link
              to="/build-demo"
              className="glow-button bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 px-12 py-5 text-sm font-semibold uppercase tracking-wider inline-flex items-center gap-3 cursor-pointer border-0 rounded-2xl shadow-xl shadow-primary/15 btn-themed-shadow hover:-translate-y-[3px] active:translate-y-0 active:scale-[0.97]"
            >
              Build My AI Receptionist
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="text-[10px] text-foreground/40 font-mono flex items-center gap-1.5">
              <Lock className="h-3 w-3" />
              Free · No login · Encrypted · Deleted after 30 days
            </p>
          </motion.div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="w-full bg-background py-24 px-6 scroll-mt-20">
        <div className="max-w-2xl mx-auto space-y-10">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-normal tracking-tight text-foreground">
              Questions
            </h2>
          </div>

          <div className="divide-y divide-border/50 border border-border/50 rounded-xl overflow-hidden">
            {FAQ_ITEMS.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
              >
                <details className="group">
                  <summary className="flex items-center justify-between cursor-pointer px-6 py-5 text-sm font-medium text-foreground hover:bg-secondary/30 transition-colors font-sans">
                    {item.q}
                    <ChevronDown className="h-4 w-4 text-foreground/30 transition-transform duration-300 group-open:rotate-180" />
                  </summary>
                  <div className="px-6 pb-5 text-sm text-foreground/55 leading-relaxed font-sans">
                    {item.a}
                  </div>
                </details>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-background text-foreground/60 pt-16 pb-10 px-6 text-xs font-mono border-t border-border/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10 md:gap-8">
            {/* Brand + blurb */}
            <div className="col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                  <Headphones className="h-4 w-4" />
                </div>
                <span className="font-semibold tracking-widest uppercase text-foreground/80 text-sm">
                  Convoa
                </span>
              </div>
              <p className="text-[11px] text-foreground/45 font-sans leading-relaxed max-w-xs">
                The AI receptionist that answers every call, books appointments, and qualifies leads
                24/7.
              </p>
              <div className="flex items-center gap-2 text-foreground/35 text-[11px]">
                <Lock className="h-3 w-3" />
                <span>SOC 2 · GDPR · HIPAA-ready</span>
              </div>
            </div>

            {/* Link columns */}
            {[
              {
                title: "Product",
                links: [
                  { label: "Features", href: "#features" },
                  { label: "How It Works", href: "#how-it-works" },
                  { label: "View Simple Demo", href: "/demo-preview" },
                ],
              },
              {
                title: "Company",
                links: [
                  { label: "FAQ", href: "#faq" },
                  { label: "Contact", href: "mailto:operations@dataquartz.ai" },
                ],
              },
              {
                title: "Legal",
                links: [
                  { label: "Privacy", href: "#" },
                  { label: "Terms", href: "#" },
                  { label: "Security", href: "#" },
                ],
              },
            ].map((col) => (
              <div key={col.title} className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/70">
                  {col.title}
                </p>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-[11px] text-foreground/45 hover:text-foreground/80 transition-colors font-sans"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="mt-14 pt-6 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-foreground/35 text-[11px]">
              © 2026 Convoa. All rights reserved.
            </span>
            <div className="flex items-center gap-4 text-foreground/40">
              <a
                href="#"
                aria-label="Twitter"
                className="hover:text-foreground/70 transition-colors"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="#"
                aria-label="LinkedIn"
                className="hover:text-foreground/70 transition-colors"
              >
                <Linkedin className="h-4 w-4" />
              </a>
              <a
                href="#"
                aria-label="GitHub"
                className="hover:text-foreground/70 transition-colors"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href="#"
                aria-label="YouTube"
                className="hover:text-foreground/70 transition-colors"
              >
                <Youtube className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
