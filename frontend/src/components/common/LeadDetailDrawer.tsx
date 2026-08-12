import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { X, Copy, ExternalLink, ThumbsUp, ThumbsDown, Trash2, Loader2 } from "lucide-react";
import { StatusBadge, statusToTone } from "@/components/common/StatusBadge";
import { CallItem } from "@/components/common/CallItem";
import {
  getFeedbackForLead,
  getClarificationStatus,
  getCallsForLead,
  deleteLeadAgent,
  type LeadResponse,
  type DemoFeedback,
  type ClarificationStatusResponse,
  type CallRecord,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Slide-over showing everything known about one lead.
 *
 * The list pages (dashboard, active-demos) fetch the lead record but only render
 * a few columns; clicking a row opens this to reveal the rest — full contact
 * details, the provisioned assistant id, any failure reason, the captured
 * company profile, and submitted feedback. The lead's own
 * fields come from the row (no refetch); the profile and feedback are loaded
 * lazily from their existing endpoints when the drawer opens.
 */

const PROFILE_LABELS: Record<string, string> = {
  primary_problem: "Primary problem",
  current_workflow_summary: "Current workflow",
  must_handle_scenarios: "Must-handle scenarios",
  escalation_preferences: "Escalation",
  desired_customizations: "Customizations",
};

function isFilled(v: unknown): boolean {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  return String(v).trim() !== "" && String(v).trim().toUpperCase() !== "UNKNOWN";
}

export function LeadDetailDrawer({
  lead,
  onClose,
  onAgentDeleted,
}: {
  lead: LeadResponse | null;
  onClose: () => void;
  /** Called after the lead's agent is torn down, so the list can refresh. */
  onAgentDeleted?: (leadId: string) => void;
}) {
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState<DemoFeedback[]>([]);
  const [clar, setClar] = useState<ClarificationStatusResponse | null>(null);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "calls" | "feedback">("profile");

  useEffect(() => {
    if (!lead) return;
    let cancelled = false;
    setLoading(true);
    setFeedback([]);
    setClar(null);
    setCalls([]);
    setConfirmingDelete(false);
    setActiveTab("profile");
    Promise.allSettled([
      getFeedbackForLead(lead.id),
      getClarificationStatus(lead.id),
      getCallsForLead(lead.id),
    ]).then(([fb, cs, cl]) => {
      if (cancelled) return;
      if (fb.status === "fulfilled") setFeedback(fb.value);
      if (cs.status === "fulfilled") setClar(cs.value);
      if (cl.status === "fulfilled") setCalls(cl.value);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [lead]);

  // Close on Escape.
  useEffect(() => {
    if (!lead) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lead, onClose]);

  const handleDeleteAgent = async () => {
    if (!lead) return;
    setDeleting(true);
    try {
      await deleteLeadAgent(lead.id);
      toast.success(`Agent deleted — ${lead.company_name}`);
      onAgentDeleted?.(lead.id);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete agent.");
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  if (!lead) return null;

  const demoUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/demo-preview?assistant_id=${lead.assistant_id ?? ""}&lead_id=${lead.id}`
      : "";

  const profileEntries = clar?.profile
    ? Object.entries(clar.profile).filter(([, v]) => isFilled(v))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 lg:p-10">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-label={`Details for ${lead.company_name}`}
        className="relative z-10 h-full w-full md:h-[90vh] md:w-[95vw] max-w-7xl overflow-hidden rounded-none md:rounded-2xl border border-border/85 bg-card shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-300"
      >
        {/* Header */}
        <div className="sticky top-0 z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 bg-card/95 px-6 py-5 backdrop-blur-md shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold tracking-tight text-foreground truncate">
                {lead.company_name}
              </h2>
              <StatusBadge tone={statusToTone(lead.agent_status)}>{lead.agent_status}</StatusBadge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {lead.industry} • Lead ID:{" "}
              <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{lead.id}</span>
            </p>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
            {/* Quick Actions */}
            <button
              disabled={!lead.assistant_id}
              onClick={() =>
                navigate({
                  to: "/demo-preview",
                  search: { assistant_id: lead.assistant_id ?? "", lead_id: lead.id },
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-sm"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open demo
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(demoUrl);
                toast.success("Demo link copied");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3.5 py-2 text-xs font-medium text-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all cursor-pointer shadow-sm"
            >
              <Copy className="h-3.5 w-3.5" /> Copy link
            </button>
            <div className="h-8 w-[1px] bg-border/70 hidden sm:block" />
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-muted/15">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start max-w-7xl mx-auto">
            {/* Column 1: Static Sidebar (1/3 width) */}
            <div className="space-y-6 lg:col-span-1">
              {/* Contact Card */}
              <Section title="Contact Info">
                <Row label="Contact Name" value={lead.contact_name || "—"} />
                <Row label="Email Address" value={lead.contact_email || "—"} />
                <Row label="Phone Number" value={lead.contact_phone || "—"} />
              </Section>

              {/* Request Metadata */}
              <Section title="Request Metadata">
                <Row label="Initial Problem Statement" value={lead.problem_statement || "—"} />
                <Row label="Lead Created At" value={formatDateTime(lead.created_at)} />
                <Row label="Last Updated At" value={formatDateTime(lead.updated_at)} />
              </Section>

              {/* Agent Settings */}
              <Section title="Agent Configuration">
                <Row
                  label="Vapi Assistant ID"
                  value={lead.assistant_id || "Not provisioned"}
                  mono
                />
                {lead.failure_reason && (
                  <Row
                    label="Provisioning Failure"
                    value={lead.failure_reason}
                    tone="destructive"
                  />
                )}
                {lead.assistant_id && (
                  <div className="pt-2">
                    {!confirmingDelete ? (
                      <button
                        onClick={() => setConfirmingDelete(true)}
                        className="inline-flex w-full justify-center items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete agent
                      </button>
                    ) : (
                      <div className="flex flex-col gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                        <p className="text-xs text-foreground/80 leading-relaxed">
                          Are you sure you want to tear down this Vapi agent? The demo link will
                          stop working. The lead record, company profile, and call history are
                          preserved.
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={handleDeleteAgent}
                            disabled={deleting}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 cursor-pointer transition-colors"
                          >
                            {deleting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            {deleting ? "Deleting…" : "Confirm Delete"}
                          </button>
                          <button
                            onClick={() => setConfirmingDelete(false)}
                            disabled={deleting}
                            className="flex-1 rounded-lg border border-border/80 bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Section>
            </div>

            {/* Right Column: Tabbed Workspace (2/3 width) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Tab Navigation */}
              <div className="flex border border-border/60 bg-card rounded-xl p-1.5 shadow-sm">
                <button
                  onClick={() => setActiveTab("profile")}
                  className={cn(
                    "flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center",
                    activeTab === "profile"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                >
                  Profile
                </button>
                <button
                  onClick={() => setActiveTab("calls")}
                  className={cn(
                    "flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center flex items-center justify-center gap-1.5",
                    activeTab === "calls"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                >
                  Calls Log
                  {calls.length > 0 && (
                    <span
                      className={cn(
                        "px-2 py-0.5 text-[10px] font-bold rounded-full",
                        activeTab === "calls"
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground border border-border/40",
                      )}
                    >
                      {calls.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("feedback")}
                  className={cn(
                    "flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center flex items-center justify-center gap-1.5",
                    activeTab === "feedback"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                >
                  Feedback Log
                  {feedback.length > 0 && (
                    <span
                      className={cn(
                        "px-2 py-0.5 text-[10px] font-bold rounded-full",
                        activeTab === "feedback"
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground border border-border/40",
                      )}
                    >
                      {feedback.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Tab Panels */}
              <div className="space-y-6 animate-in fade-in duration-200">
                {activeTab === "profile" && (
                  <>
                    {/* Captured Company Profile */}
                    <Section title="Captured Profile Characteristics">
                      {loading ? (
                        <div className="flex items-center gap-2 text-muted-foreground text-xs py-8 justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          <span>Loading profile details...</span>
                        </div>
                      ) : profileEntries.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic py-8 text-center bg-muted/20 rounded-xl border border-dashed border-border">
                          No profile characteristics captured yet.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {profileEntries.map(([k, v]) => (
                            <Row
                              key={k}
                              label={PROFILE_LABELS[k] ?? k}
                              value={Array.isArray(v) ? v.join(", ") : String(v)}
                            />
                          ))}
                        </div>
                      )}
                    </Section>
                  </>
                )}

                {activeTab === "calls" && (
                  <Section title="Recorded Vapi Interactions">
                    {loading ? (
                      <div className="flex items-center gap-2 text-muted-foreground text-xs py-8 justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <span>Loading call history...</span>
                      </div>
                    ) : calls.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-8 text-center bg-muted/20 rounded-xl border border-dashed border-border">
                        No call interactions recorded yet.
                      </p>
                    ) : (
                      <ul className="space-y-4">
                        {calls.map((c) => (
                          <CallItem key={c.id} call={c} />
                        ))}
                      </ul>
                    )}
                  </Section>
                )}

                {activeTab === "feedback" && (
                  <Section title="User Feedback Comments">
                    {loading ? (
                      <div className="flex items-center gap-2 text-muted-foreground text-xs py-8 justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <span>Loading feedback submissions...</span>
                      </div>
                    ) : feedback.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-8 text-center bg-muted/20 rounded-xl border border-dashed border-border">
                        No user feedback submitted yet.
                      </p>
                    ) : (
                      <ul className="space-y-4">
                        {feedback.map((fb) => (
                          <li
                            key={fb.id}
                            className="rounded-xl border border-border/80 bg-secondary/30 p-5 space-y-4 transition-colors hover:bg-secondary/40"
                          >
                            <div className="flex items-center justify-between gap-2 border-b border-border/30 pb-3">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider font-bold",
                                  fb.rating === "positive"
                                    ? "text-success bg-success/10 px-2.5 py-1 rounded-full"
                                    : "text-destructive bg-destructive/10 px-2.5 py-1 rounded-full",
                                )}
                              >
                                {fb.rating === "positive" ? (
                                  <ThumbsUp className="h-3 w-3" />
                                ) : (
                                  <ThumbsDown className="h-3 w-3" />
                                )}
                                {fb.rating === "positive" ? "Accurate" : "Needs tweaks"}
                              </span>
                              <time className="text-[10px] font-mono text-muted-foreground">
                                {formatDateTime(fb.created_at)}
                              </time>
                            </div>
                            {fb.comment && (
                              <p className="text-xs leading-relaxed text-foreground/85 whitespace-pre-wrap">
                                {fb.comment}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md",
        className,
      )}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wider text-primary border-b border-border/50 pb-2 mb-4">
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "destructive";
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/40 pb-2 last:border-0 last:pb-0">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-medium text-foreground break-words leading-relaxed",
          mono && "font-mono text-xs text-primary bg-muted px-1.5 py-0.5 rounded w-fit",
          tone === "destructive" && "text-destructive font-semibold",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}
