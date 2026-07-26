import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { X, Copy, ExternalLink, ThumbsUp, ThumbsDown, Trash2, Loader2 } from "lucide-react";
import { StatusBadge, statusToTone } from "@/components/common/StatusBadge";
import {
  getFeedbackForLead,
  getClarificationStatus,
  deleteLeadAgent,
  type LeadResponse,
  type DemoFeedback,
  type ClarificationStatusResponse,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Slide-over showing everything known about one lead.
 *
 * The list pages (dashboard, active-demos) fetch the lead record but only render
 * a few columns; clicking a row opens this to reveal the rest — full contact
 * details, qualification reasoning, the provisioned assistant id, any failure
 * reason, the captured company profile, and submitted feedback. The lead's own
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
  const [loading, setLoading] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!lead) return;
    let cancelled = false;
    setLoading(true);
    setFeedback([]);
    setClar(null);
    setConfirmingDelete(false);
    Promise.allSettled([getFeedbackForLead(lead.id), getClarificationStatus(lead.id)]).then(
      ([fb, cs]) => {
        if (cancelled) return;
        if (fb.status === "fulfilled") setFeedback(fb.value);
        if (cs.status === "fulfilled") setClar(cs.value);
        setLoading(false);
      },
    );
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
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-label={`Details for ${lead.company_name}`}
        className="relative z-10 h-full w-full max-w-md overflow-y-auto border-l bg-card shadow-xl"
      >
        {/* Header */}
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b bg-card px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{lead.company_name}</h2>
            <p className="truncate text-xs text-muted-foreground">{lead.industry}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge tone={statusToTone(lead.agent_status)}>{lead.agent_status}</StatusBadge>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-6 px-5 py-5 text-sm">
          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              disabled={!lead.assistant_id}
              onClick={() =>
                navigate({
                  to: "/demo-preview",
                  search: { assistant_id: lead.assistant_id ?? "", lead_id: lead.id },
                })
              }
              className="inline-flex items-center gap-1.5 bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open demo
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(demoUrl);
                toast.success("Demo link copied");
              }}
              className="inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium hover:bg-muted cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5" /> Copy link
            </button>
          </div>

          {/* Contact */}
          <Section title="Contact">
            <Row label="Name" value={lead.contact_name} />
            <Row label="Email" value={lead.contact_email} />
            <Row label="Phone" value={lead.contact_phone} />
          </Section>

          {/* Request */}
          <Section title="Request">
            <Row label="Problem" value={lead.problem_statement || "—"} />
            <Row label="Created" value={formatDateTime(lead.created_at)} />
            <Row label="Updated" value={formatDateTime(lead.updated_at)} />
          </Section>

          {/* Qualification */}
          <Section title="Qualification">
            <Row
              label="Qualified"
              value={
                lead.qualified == null ? "—" : lead.qualified ? "Yes" : "No"
              }
            />
            {lead.qualification_confidence != null && (
              <Row
                label="Confidence"
                value={`${Math.round(lead.qualification_confidence * 100)}%`}
              />
            )}
            {lead.qualification_reasoning && (
              <Row label="Reasoning" value={lead.qualification_reasoning} />
            )}
          </Section>

          {/* Agent */}
          <Section title="Agent">
            <Row label="Assistant ID" value={lead.assistant_id || "Not provisioned"} mono />
            {lead.failure_reason && (
              <Row label="Failure" value={lead.failure_reason} tone="destructive" />
            )}
            {lead.assistant_id && (
              <div className="pt-1">
                {!confirmingDelete ? (
                  <button
                    onClick={() => setConfirmingDelete(true)}
                    className="inline-flex items-center gap-1.5 border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete agent
                  </button>
                ) : (
                  <div className="flex flex-col gap-2 border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-xs text-foreground/80">
                      Tear down this Vapi agent? The demo link stops working. The lead record,
                      profile and feedback are kept.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleDeleteAgent}
                        disabled={deleting}
                        className="inline-flex items-center gap-1.5 bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 cursor-pointer"
                      >
                        {deleting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        {deleting ? "Deleting…" : "Confirm delete"}
                      </button>
                      <button
                        onClick={() => setConfirmingDelete(false)}
                        disabled={deleting}
                        className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* Captured profile */}
          <Section title="Captured profile">
            {loading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : profileEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing captured yet.</p>
            ) : (
              profileEntries.map(([k, v]) => (
                <Row
                  key={k}
                  label={PROFILE_LABELS[k] ?? k}
                  value={Array.isArray(v) ? v.join(", ") : String(v)}
                />
              ))
            )}
          </Section>

          {/* Feedback */}
          <Section title={`Feedback${feedback.length ? ` (${feedback.length})` : ""}`}>
            {loading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : feedback.length === 0 ? (
              <p className="text-xs text-muted-foreground">No feedback submitted.</p>
            ) : (
              <ul className="space-y-2">
                {feedback.map((fb) => (
                  <li key={fb.id} className="border bg-secondary/40 p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider font-semibold",
                          fb.rating === "positive" ? "text-success" : "text-destructive",
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
                      <p className="text-xs leading-relaxed text-foreground/80">{fb.comment}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
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
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-sm break-words",
          mono && "font-mono text-xs",
          tone === "destructive" && "text-destructive",
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
