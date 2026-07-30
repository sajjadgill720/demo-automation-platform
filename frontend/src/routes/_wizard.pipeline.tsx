import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Sparkles,
  AlertTriangle,
  XCircle,
  Check,
  Loader2,
  PhoneCall,
  FileText,
} from "lucide-react";
import { getDemoRequestStatus, type LeadResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import { z } from "zod";

const pipelineSearchSchema = z.object({
  leadId: z.string(),
});

export const Route = createFileRoute("/_wizard/pipeline")({
  validateSearch: pipelineSearchSchema,
  component: PipelineRoute,
});

/**
 * The pipeline stages shown while an agent is generated.
 *
 * Each entry maps to a REAL AgentStatus the backend sets at an actual transition
 * point in provision_vapi_assistant_task — there is no timer and no simulated
 * progression. `summarizing_documents` only occurs when a document was actually
 * uploaded and passed the consent + injection gates, so that row simply stays
 * pending-then-done for leads without documents.
 */
const PIPELINE_STAGES = [
  { key: "pending", label: "Your details, captured", icon: Check },
  { key: "summarizing_documents", label: "Reading your documents", icon: FileText },
  { key: "building_profile", label: "Building your agent", icon: Sparkles },
  { key: "provisioning", label: "Setting up the voice line", icon: PhoneCall },
] as const;

const STAGE_RANK: Record<string, number> = {
  pending: 0,
  summarizing_documents: 1,
  building_profile: 2,
  provisioning: 3,
  active: 4,
  completed: 4,
};

/** done | active | todo for one row, given the live backend status. */
function stageState(
  current: LeadResponse["agent_status"],
  rowKey: string,
): "done" | "active" | "todo" {
  const cur = STAGE_RANK[current] ?? 0;
  const row = STAGE_RANK[rowKey] ?? 0;
  if (cur > row) return "done";
  if (cur === row) return "active";
  return "todo";
}


function PipelineRoute() {
  const { leadId } = Route.useSearch();
  const navigate = useNavigate();

  const [isFormBuilding, setIsFormBuilding] = useState(true);
  // The real backend stage, straight from agent_status. Never inferred or timed.
  const [stage, setStage] = useState<LeadResponse["agent_status"]>("pending");
  
  const [provisionedAssistantId, setProvisionedAssistantId] = useState<string | null>(null);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [skippedReason, setSkippedReason] = useState<string | null>(null);
  const [flowStep, setFlowStep] = useState<"pipeline" | "completed">("pipeline");

  // Retrieve company name from local storage (saved on submit)
  const [formBuildCompany, setFormBuildCompany] = useState("your company");
  const [leadIndustry, setLeadIndustry] = useState<string>("");

  useEffect(() => {
    try {
      const data = localStorage.getItem("convoa_pipeline_data");
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.company) setFormBuildCompany(parsed.company);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Poll getDemoRequestStatus every 2s
  useEffect(() => {
    if (!isFormBuilding || !leadId) return;

    const POLL_INTERVAL_MS = 2000;
    // Document map-reduce summarization alone can take ~40s on a long SOP, so a
    // 60s ceiling used to abort mid-generation. Sized for the real worst case.
    const MAX_POLL_DURATION_MS = 300000;
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
        if (lead.industry) setLeadIndustry(lead.industry);
        setStage(lead.agent_status);

        if (lead.agent_status === "active" || lead.agent_status === "completed") {
          clearInterval(pollId);
          setProvisionedAssistantId(lead.assistant_id);
          setIsFormBuilding(false);
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

  // The timer-driven step/log animation that used to live here was removed. It
  // advanced a "progress" indicator on a 1500ms interval and printed ten
  // hardcoded log lines with invented timestamps ("Provisioning Vapi voice agent
  // in EU-Frankfurt cluster…"), none of which reflected backend state.
  //
  // AgentStatus only exposes pending | active | completed | failed | skipped, and
  // a lead goes straight from pending to active — there is no observable
  // qualifying or provisioning phase. So the UI below reports exactly two real
  // states (working / done) plus the two real terminal failures, rather than
  // implying granular progress we cannot actually see.

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4">
      {flowStep === "completed" ? (
        <div className="w-full max-w-4xl mx-auto glass-card gradient-border bg-card rounded-2xl border-2 border-border/60 shadow-2xl p-10 font-mono relative overflow-hidden text-center space-y-8 animate-fade-in transition-all">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-success" />
          <div className="flex flex-col items-center space-y-4">
            <div className="h-16 w-16 bg-success/10 border border-success/20 text-success flex items-center justify-center rounded-full">
              <Sparkles className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-foreground text-2xl font-bold tracking-tight font-sans">
                Your agent is live
              </h3>
              <p className="text-xs text-foreground/75 mt-1 font-sans">
                It's answering as {formBuildCompany} right now. Call it and hear what your
                customers would hear.
              </p>
            </div>
          </div>
          <div className="max-w-md mx-auto border border-border bg-secondary rounded-xl p-6 text-left space-y-3.5 text-xs text-foreground/80">
            <div className="flex justify-between items-center border-b border-border pb-2.5 text-[10px] text-foreground/50 uppercase tracking-widest font-mono border-dashed">
              <span>Pipeline Artifacts</span>
              <span className="text-success flex items-center gap-1.5 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse"></span>
                Live & Online
              </span>
            </div>
            <div className="flex justify-between">
              <span>Demo ID:</span>
              <span className="text-foreground font-semibold">{leadId.slice(0, 8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span>Target Company:</span>
              <span className="text-foreground font-semibold">{formBuildCompany}</span>
            </div>
          </div>
          <div className="space-y-4 font-sans max-w-xs mx-auto">
            <Link
              to="/demo-preview"
              search={{
                assistant_id: provisionedAssistantId || "",
                lead_id: leadId,
                company: formBuildCompany,
                industry: leadIndustry,
              }}
              className="w-full bg-success hover:bg-success text-black font-mono font-medium py-4 text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-98 border-0"
            >
              <Sparkles className="h-4 w-4" />
              Call your agent now
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
        <div className="w-full max-w-3xl mx-auto glass-card gradient-border bg-card rounded-2xl border-2 border-border/60 shadow-2xl p-8 font-mono relative overflow-hidden animate-fade-in transition-all">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-primary" />
          <div className="flex flex-col items-center text-center space-y-6 py-6">
            <div className="h-16 w-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-foreground text-xl font-bold tracking-tight font-sans">
                Lead not qualified
              </h3>
              <p className="text-xs text-foreground/60 max-w-md font-sans">
                Our qualification system determined this submission does not meet
                the criteria for automated demo provisioning.
              </p>
            </div>
            <div className="bg-secondary border border-border rounded-xl p-4 text-left max-w-lg w-full">
              <div className="text-[10px] font-mono uppercase tracking-wider text-foreground/50 mb-2">
                Why this happened
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
      ) : pollingError ? (
        /* FAILED — a real terminal state, given its own treatment rather than a
           generic spinner that keeps turning. */
        <div className="w-full max-w-3xl mx-auto glass-card gradient-border bg-card rounded-2xl border-2 border-border/60 shadow-2xl p-8 font-mono relative overflow-hidden animate-fade-in transition-all">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-destructive" />
          <div className="flex flex-col items-center text-center space-y-6 py-6">
            <div className="h-16 w-16 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h3 className="text-foreground text-xl font-bold tracking-tight font-sans">
                Build didn't finish
              </h3>
              <p className="text-xs text-foreground/60 max-w-md font-sans">
                Your details are saved — retrying picks up where this left off.
              </p>
            </div>
            <div className="bg-secondary border border-border rounded-xl p-4 text-left max-w-lg w-full">
              <div className="text-[10px] font-mono uppercase tracking-wider text-foreground/50 mb-2">
                What went wrong
              </div>
              <p className="text-sm text-foreground/80 font-sans leading-relaxed">
                {pollingError}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setPollingError(null);
                  setIsFormBuilding(true);
                }}
                className="px-6 py-2.5 bg-primary text-primary-foreground text-xs font-mono uppercase tracking-wider hover:bg-primary/90 transition-colors cursor-pointer border-0 rounded"
              >
                Try again
              </button>
              <button
                onClick={() => navigate({ to: "/" })}
                className="text-xs text-foreground/55 hover:text-foreground underline underline-offset-4 font-sans cursor-pointer bg-transparent border-0"
              >
                Start over
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* WORKING — the one real in-progress state. Indeterminate on purpose: the
           backend reports pending until provisioning completes, so any finer
           breakdown here would be invented. */
        <div className="w-full max-w-2xl mx-auto glass-card gradient-border bg-card rounded-2xl border-2 border-border/60 p-10 font-mono relative overflow-hidden animate-fade-in transition-all shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-primary animate-pulse" />
          <div className="flex flex-col items-center text-center space-y-8">
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 border border-primary/30 text-primary">
                <Sparkles className="h-8 w-8" aria-hidden="true" />
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-foreground text-xl font-bold tracking-tight font-sans">
                Building your agent
              </h3>
              <p className="text-xs text-foreground/70 font-sans max-w-sm">
                We're training it on everything you told us about {formBuildCompany}. This usually takes under a minute.
              </p>
            </div>

            {/* Stages come from the backend's agent_status, which now reports real
                intermediate transitions (summarizing_documents -> building_profile
                -> provisioning -> active). Nothing here is on a timer. */}
            <ol className="w-full max-w-sm space-y-3 text-left" aria-live="polite">
              {PIPELINE_STAGES.map((st) => {
                const state = stageState(stage, st.key);
                return (
                  <li key={st.key} className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full border shrink-0",
                        state === "done" &&
                          "bg-success/15 border-success/40 text-success",
                        state === "active" &&
                          "bg-primary/15 border-primary/40 text-primary",
                        state === "todo" && "border-border text-foreground/30",
                      )}
                    >
                      {state === "done" ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : state === "active" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <st.icon className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-sans",
                        state === "active"
                          ? "text-foreground font-medium"
                          : state === "done"
                            ? "text-foreground/70"
                            : "text-foreground/40",
                      )}
                    >
                      {st.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
