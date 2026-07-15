import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, ArrowRight, Terminal, Clock, Sparkles } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { ProgressTimeline } from "@/components/common/ProgressTimeline";
import { StatusBadge } from "@/components/common/StatusBadge";
import { CompanyLogo } from "@/components/common/CompanyCard";
import { researchSteps, companies } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/research-progress")({
  head: () => ({
    meta: [{ title: "Research in progress — DataQuartz" }],
  }),
  component: ResearchPage,
});

const logLines = [
  { t: "0.2s", msg: "Connecting to enrichment sources…" },
  { t: "0.9s", msg: "GET https://northwindfreight.com (200)" },
  { t: "1.4s", msg: "Parsed 42 pages, 6 service categories" },
  { t: "2.1s", msg: "Extracting service catalog…" },
  { t: "2.8s", msg: "Identified freight forwarding, warehousing, last-mile" },
  { t: "3.6s", msg: "Competitor scan: 4 direct competitors found" },
  { t: "4.5s", msg: "Industry match: Freight & Supply Chain (0.96)" },
  { t: "5.4s", msg: "Composing business summary…" },
  { t: "6.7s", msg: "Recommending Convoa (confidence 0.92)" },
];

function ResearchPage() {
  const [step, setStep] = useState(0);
  const [logIdx, setLogIdx] = useState(0);
  const done = step >= researchSteps.length;
  const company = companies[0];

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setStep((s) => s + 1), 1400);
    return () => clearTimeout(t);
  }, [step, done]);

  useEffect(() => {
    if (logIdx >= logLines.length) return;
    const t = setTimeout(() => setLogIdx((i) => i + 1), 700);
    return () => clearTimeout(t);
  }, [logIdx]);

  const eta = Math.max(0, (researchSteps.length - step) * 1.4).toFixed(1);

  return (
    <>
      <TopNav title="Research in progress" />
      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Pipeline</h2>
                <p className="text-xs text-muted-foreground">
                  Researching ABC Logistics · Freight & Supply Chain
                </p>
              </div>
              {done ? (
                <StatusBadge tone="success">Complete</StatusBadge>
              ) : (
                <StatusBadge tone="brand">Running</StatusBadge>
              )}
            </div>
            <ProgressTimeline steps={researchSteps} currentIndex={step} />
          </div>

          <div className="rounded-xl border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Live log</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> ETA {eta}s
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto p-4 font-mono text-xs text-foreground/80">
              {logLines.slice(0, logIdx).map((l, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex gap-3 py-1"
                >
                  <span className="text-muted-foreground">[{l.t}]</span>
                  <span>{l.msg}</span>
                </motion.div>
              ))}
              {logIdx < logLines.length && (
                <motion.span
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="inline-block h-3 w-1.5 translate-y-0.5 bg-primary"
                />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <CompanyLogo company={company} size={48} />
              <div>
                <p className="text-sm font-semibold">{company.name}</p>
                <p className="text-xs text-muted-foreground">{company.domain}</p>
              </div>
            </div>
            {done ? (
              <>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Overview</p>
                <p className="mt-1 text-sm text-foreground/80">{company.summary}</p>

                <p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">
                  Pain points
                </p>
                <ul className="mt-1 space-y-1">
                  {company.painPoints.map((p) => (
                    <li key={p} className="flex gap-2 text-sm text-foreground/80">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-destructive" />
                      {p}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold">
                        Recommended: {company.recommendedProduct}
                      </p>
                    </div>
                    <StatusBadge tone="success">
                      {Math.round(company.confidence * 100)}% match
                    </StatusBadge>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Link
                    to="/voice-agent"
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Continue <ArrowRight className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => {
                      setStep(0);
                      setLogIdx(0);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                  >
                    <RefreshCw className="h-4 w-4" /> Regenerate
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
                <p className="text-xs text-muted-foreground">
                  The research summary will appear here once analysis completes.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
