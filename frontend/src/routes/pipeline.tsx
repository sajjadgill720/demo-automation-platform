import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Sparkles, AlertTriangle } from "lucide-react";
import { ProgressTimeline } from "@/components/common/ProgressTimeline";
import { researchSteps } from "@/lib/mock-data";
import { getDemoRequestStatus } from "@/lib/api";
import { z } from "zod";

const pipelineSearchSchema = z.object({
  leadId: z.string(),
});

export const Route = createFileRoute("/pipeline")({
  validateSearch: pipelineSearchSchema,
  component: PipelineRoute,
});

function PipelineRoute() {
  const { leadId } = Route.useSearch();
  const navigate = useNavigate();

  const [isFormBuilding, setIsFormBuilding] = useState(true);
  const [formBuildStep, setFormBuildStep] = useState(0);
  const [formLogIdx, setFormLogIdx] = useState(0);
  
  const [provisionedAssistantId, setProvisionedAssistantId] = useState<string | null>(null);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [skippedReason, setSkippedReason] = useState<string | null>(null);
  const [flowStep, setFlowStep] = useState<"pipeline" | "completed">("pipeline");

  // Retrieve company and problem from local storage (saved in index.tsx)
  const [formBuildCompany, setFormBuildCompany] = useState("your company");
  const [formBuildProblem, setFormBuildProblem] = useState("");

  useEffect(() => {
    try {
      const data = localStorage.getItem("convoa_pipeline_data");
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.company) setFormBuildCompany(parsed.company);
        if (parsed.problem) setFormBuildProblem(parsed.problem);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Poll getDemoRequestStatus every 2s
  useEffect(() => {
    if (!isFormBuilding || !leadId) return;

    const POLL_INTERVAL_MS = 2000;
    const MAX_POLL_DURATION_MS = 60000;
    const startTime = Date.now();

    const pollId = setInterval(async () => {
      if (Date.now() - startTime > MAX_POLL_DURATION_MS) {
        clearInterval(pollId);
        setIsFormBuilding(false);
        setPollingError("This is taking longer than expected. Please try again.");
        return;
      }

      try {
        const lead = await getDemoRequestStatus(leadId);
        if (lead.company_name) setFormBuildCompany(lead.company_name);

        if (lead.agent_status === "active" || lead.agent_status === "completed") {
          clearInterval(pollId);
          setProvisionedAssistantId(lead.assistant_id);
          setIsFormBuilding(false);
          setFormBuildStep(7);
          setFormLogIdx(10);
          setFlowStep("completed");
        } else if (lead.agent_status === "skipped") {
          clearInterval(pollId);
          setIsFormBuilding(false);
          setSkippedReason(lead.qualification_reasoning || "Lead did not meet qualification criteria.");
        } else if (lead.agent_status === "failed") {
          clearInterval(pollId);
          setIsFormBuilding(false);
          setPollingError(lead.failure_reason || "Vapi agent provisioning failed.");
        }
      } catch (err) {
        // Swallow transient network blips during polling
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(pollId);
  }, [isFormBuilding, leadId]);

  // Animate the console log lines while pipeline is active
  useEffect(() => {
    if (!isFormBuilding) return;
    const stepInterval = setInterval(() => {
      setFormBuildStep((prev) => (prev >= 7 ? 7 : prev + 1));
    }, 1500);

    const logInterval = setInterval(() => {
      setFormLogIdx((prev) => (prev >= 10 ? 10 : prev + 1));
    }, 1000);

    return () => {
      clearInterval(stepInterval);
      clearInterval(logInterval);
    };
  }, [isFormBuilding]);

  const getBuildLogLines = (company: string, problem: string) => [
    { t: "0.2s", msg: `Initializing builder sequence for "${company}"…` },
    { t: "0.8s", msg: `GET https://${company.toLowerCase().replace(/[^a-z0-9]/g, "") || "unknown"}.com…` },
    { t: "1.4s", msg: `Crawling site structure & compliance headers for ${company}…` },
    { t: "2.1s", msg: `Identified tools schema: Salesforce, Descartes, Trimble…` },
    { t: "2.8s", msg: `Target compliance requirement parsed: "${(problem || "").substring(0, 50)}..."` },
    { t: "3.6s", msg: `Provisioning Vapi voice agent in EU-Frankfurt cluster…` },
    { t: "4.5s", msg: `Synthesizing driver/dispatch dialogues in English & German…` },
    { t: "5.4s", msg: `Deploying mock database schemas for shifts & schedules…` },
    { t: "6.3s", msg: `Compliance human gate verification check [OK]…` },
    { t: "7.1s", msg: `Interactive preview bundle created successfully (DMO-8024).` },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {flowStep === "completed" ? (
        <div className="w-full max-w-4xl mx-auto bg-card border border-border p-10 font-mono relative overflow-hidden text-center space-y-8 animate-fade-in transition-all">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-emerald-500" />
          <div className="flex flex-col items-center space-y-4">
            <div className="h-16 w-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center rounded-full">
              <Sparkles className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-foreground text-xl font-bold uppercase tracking-tight font-mono">
                Demo Generation Complete
              </h3>
              <p className="text-xs text-foreground/75 mt-1 font-sans">
                Autonomous node provisioning for {formBuildCompany} finished successfully.
              </p>
            </div>
          </div>
          <div className="max-w-md mx-auto border border-border bg-secondary p-6 text-left space-y-3.5 text-xs text-foreground/80">
            <div className="flex justify-between items-center border-b border-border pb-2.5 text-[10px] text-foreground/50 uppercase tracking-widest font-mono border-dashed">
              <span>Pipeline Artifacts</span>
              <span className="text-emerald-500 flex items-center gap-1.5 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Live & Online
              </span>
            </div>
            <div className="flex justify-between">
              <span>Demo ID:</span>
              <span className="text-foreground font-semibold">DMO-8024</span>
            </div>
            <div className="flex justify-between">
              <span>Target Company:</span>
              <span className="text-foreground font-semibold">{formBuildCompany}</span>
            </div>
          </div>
          <div className="space-y-4 font-sans max-w-xs mx-auto">
            <Link
              to="/demo-preview"
              search={{ assistant_id: provisionedAssistantId || "", lead_id: leadId }}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-medium py-4 text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-98 border-0"
            >
              <Sparkles className="h-4 w-4" />
              Launch Interactive Demo Portal
            </Link>
            <button
              onClick={() => navigate({ to: "/" })}
              className="text-xs text-foreground/55 hover:text-primary font-mono underline cursor-pointer bg-transparent border-0"
            >
              Start New Request
            </button>
          </div>
        </div>
      ) : skippedReason ? (
        <div className="w-full max-w-3xl mx-auto bg-card border border-amber-500/30 p-8 font-mono relative overflow-hidden animate-fade-in transition-all">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-amber-500" />
          <div className="flex flex-col items-center text-center space-y-6 py-6">
            <div className="h-16 w-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-foreground text-lg font-bold uppercase tracking-tight">
                Lead Not Qualified
              </h3>
              <p className="text-xs text-foreground/60 max-w-md font-sans">
                Our qualification system determined this submission does not meet
                the criteria for automated demo provisioning.
              </p>
            </div>
            <div className="bg-secondary border border-border p-4 text-left max-w-lg w-full">
              <div className="text-[10px] font-mono uppercase tracking-wider text-foreground/50 mb-2">
                QUALIFICATION_REASONING
              </div>
              <p className="text-sm text-foreground/80 font-sans leading-relaxed">
                {skippedReason}
              </p>
            </div>
            <button
              onClick={() => navigate({ to: "/" })}
              className="mt-4 px-6 py-2.5 bg-primary/10 border border-primary/30 text-primary text-xs font-mono uppercase tracking-wider hover:bg-primary/20 transition-colors cursor-pointer"
            >
              ← Try another lead
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-5xl mx-auto bg-card border border-border p-8 font-mono relative overflow-hidden animate-fade-in transition-all shadow-xl">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-primary animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 space-y-6 text-left">
              <div>
                <h3 className="text-foreground text-lg font-bold uppercase tracking-tight">
                  Active Pipeline Build
                </h3>
                <p className="text-xs text-foreground/75 mt-1 font-sans">
                  Compiling personalized voice agent and sandbox environment for{" "}
                  {formBuildCompany}
                </p>
              </div>
              <div className="bg-secondary border border-border p-6">
                <ProgressTimeline steps={researchSteps} currentIndex={formBuildStep} />
              </div>
            </div>
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    CONSOLE_OUTPUT
                  </span>
                </div>
                <div className="text-[10px] text-foreground/55">
                  ETA: {Math.max(0, (7 - formBuildStep) * 1.5).toFixed(1)}s
                </div>
              </div>
              <div className="bg-secondary border border-border p-5 min-h-[300px] max-h-[380px] overflow-y-auto space-y-2.5 text-left font-mono">
                {getBuildLogLines(formBuildCompany, formBuildProblem)
                  .slice(0, formLogIdx)
                  .map((log, idx) => (
                    <div key={idx} className="flex gap-3 text-xs leading-relaxed">
                      <span className="text-foreground/45">[{log.t}]</span>
                      <span
                        className={
                          idx === formLogIdx - 1
                            ? "text-primary animate-pulse font-bold"
                            : "text-foreground/75"
                        }
                      >
                        {log.msg}
                      </span>
                    </div>
                  ))}
                {formLogIdx < 10 && !pollingError && (
                  <span className="inline-block h-3.5 w-2 bg-primary animate-pulse mt-1" />
                )}
                {pollingError && (
                  <div className="mt-3 p-3 border border-red-500/40 bg-red-500/10 text-red-400 text-xs font-mono">
                    <span className="font-bold">ERROR:</span> {pollingError}
                    <button
                      onClick={() => {
                        setPollingError(null);
                        setIsFormBuilding(true);
                        setFormBuildStep(0);
                        setFormLogIdx(0);
                      }}
                      className="ml-3 underline text-amber-400 hover:text-amber-300 cursor-pointer bg-transparent border-0 font-mono text-xs"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
