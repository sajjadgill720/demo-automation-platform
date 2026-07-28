import { useRouterState, Link } from "@tanstack/react-router";
import { Check, ClipboardList, FileText, MessagesSquare, Sparkles, PhoneCall, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";

/**
 * Persistent journey indicator for the demo-request wizard.
 *
 * Mounted ONCE by the _wizard layout route, never by an individual screen. The
 * active step is derived from the current pathname rather than passed in as a
 * prop, so it cannot drift out of sync with the screen actually being shown —
 * the previous FunnelStepper took a `current` prop and had already drifted
 * (pipeline passed current={4} into a 3-step array, and two of the five screens
 * never rendered it at all).
 *
 * Display only: no step is clickable. Steps are shown in three states —
 * completed (filled + check), current (emphasised), upcoming (muted outline).
 */

export const WIZARD_STEPS = [
  { path: "/build-demo", label: "Business Info", short: "Info", icon: ClipboardList },
  { path: "/upload", label: "Documents", short: "Docs", icon: FileText, optional: true },
  { path: "/clarification", label: "Solution Scoping", short: "Scoping", icon: MessagesSquare },
  { path: "/pipeline", label: "Generating Demo", short: "Building", icon: Sparkles },
  { path: "/demo-preview", label: "Try It", short: "Try It", icon: PhoneCall },
] as const;

export function JourneyHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggleTheme } = useTheme();

  const currentIndex = WIZARD_STEPS.findIndex((s) => pathname.startsWith(s.path));
  // A path outside the wizard renders nothing rather than guessing at a step.
  if (currentIndex === -1) return null;

  const stepNumber = currentIndex + 1;
  const total = WIZARD_STEPS.length;
  const current = WIZARD_STEPS[currentIndex];

  return (
    <nav
      aria-label="Progress"
      className="w-full border-b border-border/60 bg-background/80 backdrop-blur-sm z-50 sticky top-0"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between min-h-[64px] gap-4">
        {/* Left Side: Logo */}
        <Link to="/" className="flex items-center gap-2 text-foreground font-mono font-bold tracking-widest text-[11px] uppercase group shrink-0">
          <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold text-[10px] group-hover:bg-primary/15 transition-colors">
            DQ
          </div>
          <span className="hidden sm:inline">DataQuartz</span>
        </Link>

        {/* Center Section: Wizard Steps */}
        <div className="flex-1 flex justify-center max-w-2xl">
          {/* Compact view — narrow viewports. Matches the sm: breakpoint the rest of
              the wizard already uses rather than introducing a new one. */}
          <div className="sm:hidden w-full py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <current.icon className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-foreground truncate">
                  {current.label}
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-foreground/60 shrink-0">
                Step {stepNumber} of {total}
              </span>
            </div>
            <div
              className="mt-2 h-1 w-full bg-border/60 overflow-hidden rounded-full"
              role="progressbar"
              aria-valuenow={stepNumber}
              aria-valuemin={1}
              aria-valuemax={total}
              aria-label={`Step ${stepNumber} of ${total}: ${current.label}`}
            >
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${(stepNumber / total) * 100}%` }}
              />
            </div>
          </div>

          {/* Full view — sm and up. */}
          <ol className="hidden sm:flex items-center justify-center gap-1 md:gap-2 py-4">
            {WIZARD_STEPS.map((step, i) => {
              const state = i < currentIndex ? "done" : i === currentIndex ? "active" : "upcoming";
              const Icon = step.icon;
              return (
                <li key={step.path} className="flex items-center">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border transition-colors shrink-0",
                        state === "done" && "border-primary bg-primary text-primary-foreground",
                        state === "active" &&
                          "border-primary bg-primary/10 text-primary shadow-sm shadow-primary/20",
                        state === "upcoming" && "border-border text-foreground/35",
                      )}
                    >
                      {state === "done" ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </span>
                    <span
                      className={cn(
                        "hidden md:flex flex-col leading-tight",
                        state === "upcoming" ? "text-foreground/40" : "text-foreground/85",
                        state === "active" && "text-primary",
                      )}
                    >
                      <span
                        aria-current={state === "active" ? "step" : undefined}
                        className="text-[10px] font-mono font-bold uppercase tracking-wider"
                      >
                        {step.label}
                      </span>
                      {"optional" in step && step.optional && (
                        <span className="text-[9px] font-mono uppercase tracking-wider text-foreground/40">
                          Optional
                        </span>
                      )}
                    </span>
                    {/* Below md the label is hidden, so expose it to screen readers. */}
                    <span className="sr-only md:hidden">
                      {step.label}
                      {state === "done" ? " (completed)" : state === "active" ? " (current)" : ""}
                    </span>
                  </div>
                  {i < WIZARD_STEPS.length - 1 && (
                    <div
                      aria-hidden="true"
                      className={cn(
                        "mx-1.5 md:mx-3 h-px w-5 md:w-8 transition-colors",
                        i < currentIndex ? "bg-primary" : "bg-border",
                      )}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {/* Right Side: Theme Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-border/50 hover:bg-secondary text-foreground transition-colors cursor-pointer bg-transparent"
            aria-label="Toggle Theme"
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </nav>
  );
}
