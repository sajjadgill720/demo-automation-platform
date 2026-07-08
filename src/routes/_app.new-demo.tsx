import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Sparkles,
  Check,
  ArrowRight,
  ArrowLeft,
  Globe,
  Linkedin,
  Newspaper,
  Users,
} from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { ProgressTimeline } from "@/components/common/ProgressTimeline";
import { StatusBadge } from "@/components/common/StatusBadge";
import { products, type Product } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { addDemoJob } from "@/lib/db";

export const Route = createFileRoute("/_app/new-demo")({
  head: () => ({
    meta: [
      { title: "New Demo — DataQuartz" },
      {
        name: "description",
        content: "Generate a personalized AI voice demo for a new prospect in four steps.",
      },
    ],
  }),
  component: NewDemo,
});

const steps = [
  { id: "client", label: "Client info" },
  { id: "product", label: "Select product" },
  { id: "research", label: "Research toggles" },
  { id: "summary", label: "Summary" },
];

function NewDemo() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    company: "Northwind Freight",
    website: "https://northwindfreight.com",
    email: "buyer@northwindfreight.com",
    industry: "Freight & Supply Chain",
    country: "Netherlands",
  });
  const [product, setProduct] = useState<Product>("Convoa");
  const [toggles, setToggles] = useState({
    website: true,
    linkedin: true,
    news: false,
    competitors: true,
  });

  return (
    <>
      <TopNav title="Create new demo" />
      <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
        <ProgressTimeline steps={steps} currentIndex={step} orientation="horizontal" />

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Client information</h2>
                <p className="text-sm text-muted-foreground">
                  We'll research the company from these details to generate a tailored demo.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Company name"
                  value={form.company}
                  onChange={(v) => setForm({ ...form, company: v })}
                />
                <Field
                  label="Website"
                  value={form.website}
                  onChange={(v) => setForm({ ...form, website: v })}
                />
                <Field
                  label="Contact email"
                  value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })}
                />
                <Field
                  label="Industry"
                  value={form.industry}
                  onChange={(v) => setForm({ ...form, industry: v })}
                />
                <Field
                  label="Country"
                  value={form.country}
                  onChange={(v) => setForm({ ...form, country: v })}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Select a product</h2>
                <p className="text-sm text-muted-foreground">
                  Convoa is recommended based on the client's industry and public data.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {products.map((p) => {
                  const selected = product === p.id;
                  const recommended = p.id === "Convoa";
                  return (
                    <button
                      key={p.id}
                      onClick={() => setProduct(p.id)}
                      className={cn(
                        "group rounded-xl border bg-background p-4 text-left transition-all",
                        selected
                          ? "border-primary ring-2 ring-primary/20"
                          : "hover:border-foreground/20",
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{p.id}</p>
                          <p className="text-xs text-muted-foreground">{p.tagline}</p>
                        </div>
                        {recommended && <StatusBadge tone="brand">AI recommended</StatusBadge>}
                      </div>
                      <p className="mt-3 text-sm text-foreground/80">{p.description}</p>
                      <p className="mt-3 text-[11px] uppercase tracking-wide text-muted-foreground">
                        Best for
                      </p>
                      <p className="text-xs text-foreground/70">{p.bestFor}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Research sources</h2>
                <p className="text-sm text-muted-foreground">
                  Toggle the sources our research agent should use.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <ResearchToggle
                  icon={Globe}
                  label="Website crawl"
                  description="Pages, services, pricing, docs"
                  checked={toggles.website}
                  onChange={(v) => setToggles({ ...toggles, website: v })}
                />
                <ResearchToggle
                  icon={Linkedin}
                  label="LinkedIn"
                  description="Headcount, hiring, leadership"
                  checked={toggles.linkedin}
                  onChange={(v) => setToggles({ ...toggles, linkedin: v })}
                />
                <ResearchToggle
                  icon={Newspaper}
                  label="News mentions"
                  description="Last 90 days of press coverage"
                  checked={toggles.news}
                  onChange={(v) => setToggles({ ...toggles, news: v })}
                />
                <ResearchToggle
                  icon={Users}
                  label="Competitors"
                  description="Direct competitors + market position"
                  checked={toggles.competitors}
                  onChange={(v) => setToggles({ ...toggles, competitors: v })}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-foreground">Ready to generate</h2>
                <p className="text-sm text-muted-foreground">
                  Review the setup and kick off research.
                </p>
              </div>
              <dl className="grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
                <SummaryRow label="Company" value={form.company} />
                <SummaryRow label="Website" value={form.website} />
                <SummaryRow label="Industry" value={form.industry} />
                <SummaryRow label="Country" value={form.country} />
                <SummaryRow label="Product" value={product} />
                <SummaryRow
                  label="Sources"
                  value={Object.entries(toggles)
                    .filter(([, v]) => v)
                    .map(([k]) => k)
                    .join(", ")}
                />
              </dl>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between border-t pt-4">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium text-foreground disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            {step < steps.length - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => {
                  const activeSources = Object.entries(toggles)
                    .filter(([, v]) => v)
                    .map(([k]) => k);
                  addDemoJob(
                    {
                      name: form.company,
                      website: form.website,
                      email: form.email,
                      industry: form.industry,
                      country: form.country,
                    },
                    product,
                    activeSources,
                  );
                  toast.success(`Pipeline started for ${form.company}`);
                  navigate({ to: "/research-progress" });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Sparkles className="h-4 w-4" /> Generate demo
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}

function ResearchToggle({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-background p-4 text-left transition-colors",
        checked ? "border-primary ring-1 ring-primary/20" : "hover:border-foreground/20",
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md",
          checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-md border",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-border",
        )}
      >
        {checked && <Check className="h-3.5 w-3.5" />}
      </div>
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}
