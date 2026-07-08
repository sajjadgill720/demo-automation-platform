import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Phone,
  MessageSquare,
  Calendar,
  Sun,
  Moon,
  Sparkles,
  ArrowLeft,
  ShieldCheck,
  Rocket,
  Gauge,
} from "lucide-react";
import { CompanyLogo } from "@/components/common/CompanyCard";
import { companies } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";

export const Route = createFileRoute("/demo-preview")({
  head: () => ({
    meta: [
      { title: "Your personalized demo — ABC Logistics × Convoa" },
      { name: "description", content: "A tailored AI voice demo prepared for ABC Logistics." },
    ],
  }),
  component: DemoPreview,
});

const company = companies[0];

const features = [
  {
    icon: Rocket,
    title: "Dispatch on autopilot",
    body: "Convoa handles inbound driver calls, updates the TMS in real time, and hands off exceptions to your dispatchers.",
  },
  {
    icon: ShieldCheck,
    title: "SOC 2 · GDPR ready",
    body: "EU-hosted voice pipeline, region-locked storage and configurable retention for enterprise procurement.",
  },
  {
    icon: Gauge,
    title: "Live TMS integration",
    body: "Native connectors to Descartes, Trimble and Alpega — go live in under 3 weeks with your existing stack.",
  },
];

const suggestedQuestions = [
  "How does Convoa handle multi-language driver calls in DACH?",
  "Can we pilot on a single warehouse before rolling out?",
  "What does the Descartes integration look like?",
  "How is call data stored under GDPR?",
];

function DemoPreview() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className={cn(theme === "dark" && "dark")}>
      <div className="min-h-screen bg-background text-foreground">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link
            to="/active-demos"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to admin
          </Link>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Powered by DataQuartz
            <button
              onClick={toggleTheme}
              className="ml-3 rounded-md border p-1.5 hover:bg-muted cursor-pointer"
            >
              {theme === "dark" ? (
                <Sun className="h-3.5 w-3.5" />
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </header>

        <section className="mx-auto max-w-6xl px-6 pt-8 pb-16">
          <div className="rounded-3xl border bg-gradient-to-br from-primary/5 via-card to-secondary/5 p-10 shadow-sm">
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="flex items-center gap-3">
                <CompanyLogo company={company} size={56} />
                <span className="text-muted-foreground">×</span>
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Sparkles className="h-6 w-6" />
                </div>
              </div>
              <div className="max-w-2xl space-y-3">
                <p className="text-xs font-medium uppercase tracking-widest text-primary">
                  Personalized for {company.name}
                </p>
                <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                  Meet the Convoa agent built for your dispatch floor.
                </h1>
                <p className="text-base text-muted-foreground">
                  We reviewed your operations across 42 warehouses and prepared a live agent that
                  already knows your services, competitors and driver workflow.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">
                  <MessageSquare className="h-4 w-4" /> Start conversation
                </button>
                <button className="inline-flex items-center gap-2 rounded-lg border bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted">
                  <Phone className="h-4 w-4" /> Call the agent
                </button>
                <button className="inline-flex items-center gap-2 rounded-lg border bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted">
                  <Calendar className="h-4 w-4" /> Book a meeting
                </button>
              </div>
            </div>
          </div>

          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-4 w-4" />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-foreground">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-14">
            <h2 className="text-sm font-semibold text-foreground">Try asking the agent</h2>
            <p className="text-sm text-muted-foreground">
              Suggested questions grounded in {company.name}'s public data.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  className="rounded-lg border bg-card px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  “{q}”
                </button>
              ))}
            </div>
          </div>
        </section>

        <footer className="border-t">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-muted-foreground">
            <span>© DataQuartz · Demo prepared 6 Jul 2026 · Expires in 8 days</span>
            <span>Secured · EU-hosted</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
