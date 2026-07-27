/**
 * API client for the FastAPI backend.
 *
 * All demo-request lifecycle calls go through here so the rest of the
 * frontend never constructs URLs or parses responses directly.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:8000";

/* ── Error types ── */

/** Thrown when the backend is unreachable or returns a non-2xx before any
 *  agent_status exists (network failure, server down, validation error). */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

/** Thrown when the backend accepted the request but Vapi provisioning
 *  failed (agent_status === "failed"). Carries the failure_reason from DB. */
export class ProvisioningError extends Error {
  failureReason: string;
  constructor(failureReason: string) {
    super(`Vapi provisioning failed: ${failureReason}`);
    this.name = "ProvisioningError";
    this.failureReason = failureReason;
  }
}

/* ── Response types ── */

export interface DemoRequestPayload {
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  industry: string;
  problem_text?: string;
  voice_gender?: "male" | "female";
}

export interface LeadResponse {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  industry: string;
  problem_statement?: string | null;
  voice_gender?: string | null;
  agent_status:
    | "pending"
    | "summarizing_documents"
    | "building_profile"
    | "provisioning"
    | "active"
    | "completed"
    | "failed"
    | "skipped";
  assistant_id: string | null;
  failure_reason: string | null;
  qualified?: boolean | null;
  qualification_confidence?: number | null;
  qualification_reasoning?: string | null;
  created_at: string;
  updated_at: string;
}

/* ── API functions ── */

/**
 * POST /api/demo-request
 *
 * Creates a new lead and enqueues Vapi assistant provisioning.
 * Returns immediately with agent_status="pending".
 *
 * @throws {NetworkError} if the backend is unreachable or returns non-2xx.
 */
export async function submitDemoRequest(payload: DemoRequestPayload): Promise<LeadResponse> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/demo-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // Network-level failure (DNS, CORS, backend down)
    throw new NetworkError("Could not reach the backend server. Make sure it is running.");
  }

  if (!res.ok) {
    let detail = `Server returned ${res.status}`;
    try {
      const body = await res.json();
      if (body.detail) {
        detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      // ignore parse failure
    }
    throw new NetworkError(detail);
  }

  return res.json();
}

/**
 * GET /api/demo-request/{lead_id}
 *
 * Polls the current state of a lead, including agent_status and
 * assistant_id once provisioning completes.
 *
 * @throws {NetworkError} on fetch/HTTP errors.
 */
/**
 * GET /api/leads
 *
 * Lists leads newest-first for the internal dashboard and active-demos views.
 * `status` filters by agent_status.
 */
export interface DemoFeedback {
  id: string;
  lead_id: string;
  rating: "positive" | "negative";
  comment: string | null;
  created_at: string;
}

export interface DemoFeedbackWithLead extends DemoFeedback {
  company_name: string;
  industry: string;
}

/* ── Call records (conversations with a provisioned agent) ── */

export interface TranscriptTurn {
  role: "assistant" | "user";
  text: string;
}

export interface CallRecord {
  id: string;
  lead_id: string;
  vapi_call_id: string | null;
  assistant_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  turn_count: number;
  transcript: TranscriptTurn[];
  summary: string | null;
  recording_url: string | null;
  ended_reason: string | null;
  cost: number | null;
  status: string; // "processing" | "completed" | "failed"
  created_at: string;
}

export interface CallRecordWithLead extends CallRecord {
  company_name: string;
  industry: string;
}

export interface CallRecordInput {
  vapi_call_id: string;
  assistant_id?: string;
  started_at?: string;
  ended_at?: string;
}

/** POST /api/demo-request/{lead_id}/calls — persist a finished agent conversation. */
export async function saveCallRecord(
  leadId: string,
  payload: CallRecordInput,
): Promise<CallRecord> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/demo-request/${leadId}/calls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new NetworkError("Could not reach the server to save the call.");
  }
  if (!res.ok) throw new NetworkError(`Call could not be saved (${res.status})`);
  return res.json();
}

/** GET /api/demo-request/{lead_id}/calls — calls recorded for one lead. */
export async function getCallsForLead(leadId: string): Promise<CallRecord[]> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/demo-request/${leadId}/calls`);
  } catch {
    throw new NetworkError("Lost connection to the backend.");
  }
  if (!res.ok) throw new NetworkError(`Failed to load calls (${res.status})`);
  return res.json();
}

/** GET /api/calls — every recorded call, joined with its company, for the team. */
export async function listAllCalls(limit?: number): Promise<CallRecordWithLead[]> {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/calls?${params.toString()}`);
  } catch {
    throw new NetworkError("Lost connection to the backend.");
  }
  if (!res.ok) throw new NetworkError(`Failed to load calls (${res.status})`);
  return res.json();
}

/** POST /api/demo-request/{lead_id}/feedback — client submits demo feedback. */
export async function submitDemoFeedback(
  leadId: string,
  payload: { rating: "positive" | "negative"; comment?: string },
): Promise<DemoFeedback> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/demo-request/${leadId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new NetworkError("Could not reach the server to send your feedback.");
  }
  if (!res.ok) throw new NetworkError(`Feedback could not be saved (${res.status})`);
  return res.json();
}

/** GET /api/demo-request/{lead_id}/feedback — what this client already sent. */
export async function getFeedbackForLead(leadId: string): Promise<DemoFeedback[]> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/demo-request/${leadId}/feedback`);
  } catch {
    throw new NetworkError("Lost connection to the backend.");
  }
  if (!res.ok) throw new NetworkError(`Failed to load feedback (${res.status})`);
  return res.json();
}

/** GET /api/feedback — all client feedback, for the internal team view. */
export async function listAllFeedback(
  opts: { limit?: number; rating?: "positive" | "negative" } = {},
): Promise<DemoFeedbackWithLead[]> {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.rating) params.set("rating", opts.rating);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/feedback?${params.toString()}`);
  } catch {
    throw new NetworkError("Lost connection to the backend.");
  }
  if (!res.ok) throw new NetworkError(`Failed to load feedback (${res.status})`);
  return res.json();
}

export async function listLeads(
  opts: { limit?: number; status?: LeadResponse["agent_status"] } = {},
): Promise<LeadResponse[]> {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.status) params.set("status", opts.status);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/leads?${params.toString()}`);
  } catch {
    throw new NetworkError("Lost connection to the backend.");
  }
  if (!res.ok) throw new NetworkError(`Failed to load leads (${res.status})`);
  return res.json();
}

export async function getDemoRequestStatus(leadId: string): Promise<LeadResponse> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/demo-request/${leadId}`);
  } catch {
    throw new NetworkError("Lost connection to the backend while polling.");
  }

  if (!res.ok) {
    throw new NetworkError(`Polling failed with status ${res.status}`);
  }

  return res.json();
}

/**
 * POST /api/demo-request/{lead_id}/end-session
 *
 * Triggers Vapi assistant deletion and marks the lead as completed.
 *
 * Best-effort: callers should not crash if this fails (e.g. on tab close).
 */
/**
 * DELETE /api/demo-request/{lead_id}/agent — internal team action.
 * Tears down the Vapi assistant and clears it from the lead, keeping the record.
 */
export async function deleteLeadAgent(leadId: string): Promise<LeadResponse> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/demo-request/${leadId}/agent`, {
      method: "DELETE",
    });
  } catch {
    throw new NetworkError("Could not reach the backend to delete the agent.");
  }
  if (!res.ok) throw new NetworkError(`Delete agent failed with status ${res.status}`);
  return res.json();
}

export async function endDemoSession(
  leadId: string,
): Promise<{ message: string; agent_status: string }> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/demo-request/${leadId}/end-session`, {
      method: "POST",
    });
  } catch {
    throw new NetworkError("Could not reach the backend to end session.");
  }

  if (!res.ok) {
    throw new NetworkError(`End session failed with status ${res.status}`);
  }

  return res.json();
}

/* ── Clarification Module API Functions ── */

export interface ClarificationMessageItem {
  role: "assistant" | "user";
  content: string;
}

export interface ClarificationStatusResponse {
  status: "not_started" | "in_progress" | "awaiting_user" | "completed";
  current_question: string | null;
  recommendations?: string[] | null;
  missing_fields: string[];
  conversation_history: ClarificationMessageItem[];
  profile: Record<string, any> | null;
  is_final_question?: boolean;
  final_question_answered?: boolean;
}

export async function uploadClarificationDocument(
  leadId: string,
  file: File
): Promise<{ message: string; document_id: string; file_url: string }> {
  const formData = new FormData();
  formData.append("file", file);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/clarification/${leadId}/documents`, {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new NetworkError("Could not reach backend to upload document.");
  }

  if (!res.ok) {
    let detail = `Upload failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {}
    throw new NetworkError(detail);
  }

  return res.json();
}

export async function setClarificationConsent(
  leadId: string,
  consent: boolean
): Promise<{ message: string; ai_processing_consent: boolean }> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/clarification/${leadId}/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ai_processing_consent: consent }),
    });
  } catch {
    throw new NetworkError("Could not reach backend to update consent.");
  }

  if (!res.ok) {
    throw new NetworkError(`Consent setting failed with status ${res.status}`);
  }

  return res.json();
}

export async function startClarification(
  leadId: string
): Promise<ClarificationStatusResponse> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/clarification/${leadId}/start`, {
      method: "POST",
    });
  } catch {
    throw new NetworkError("Could not reach backend to start clarification.");
  }

  if (!res.ok) {
    throw new NetworkError(`Start clarification failed with status ${res.status}`);
  }

  return res.json();
}

export async function respondToClarification(
  leadId: string,
  answer: string
): Promise<ClarificationStatusResponse> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/clarification/${leadId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    });
  } catch {
    throw new NetworkError("Could not reach backend to submit answer.");
  }

  if (!res.ok) {
    throw new NetworkError(`Submitting answer failed with status ${res.status}`);
  }

  return res.json();
}

export async function skipRemainingClarification(
  leadId: string
): Promise<ClarificationStatusResponse> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/clarification/${leadId}/skip-remaining`, {
      method: "POST",
    });
  } catch {
    throw new NetworkError("Could not reach backend to skip questions.");
  }

  if (!res.ok) {
    throw new NetworkError(`Skip clarification failed with status ${res.status}`);
  }

  return res.json();
}

export async function getClarificationStatus(
  leadId: string
): Promise<ClarificationStatusResponse> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/clarification/${leadId}`);
  } catch {
    throw new NetworkError("Could not reach backend to fetch clarification status.");
  }

  if (!res.ok) {
    throw new NetworkError(`Getting clarification status failed with status ${res.status}`);
  }

  return res.json();
}
