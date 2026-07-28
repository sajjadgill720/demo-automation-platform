import os
import json
import logging
import time
import uuid
import threading
from datetime import datetime
from typing import TypedDict, Optional, List, Type
from pydantic import BaseModel, Field

from langgraph.graph import StateGraph, END
from langgraph.types import interrupt, Command
from langgraph.checkpoint.postgres import PostgresSaver

from sqlmodel import Session, select
from app.db import engine
from app.models import (
    Document, 
    CompanyProfileDB, 
    ClarificationMessage, 
    ProfileStatus, 
    MessageRole, 
    Lead,
    AgentStatus
)
from app.llm_client import call_structured_llm
from app.utils import sanitize_input, sanitize_document_text, sanitize_profile_text
from app.qualifier import qualify_lead_internal
from app.agents import provision_vapi_assistant_task
from app.scenario_library import lookup_industry, format_scenarios_as_rules

logger = logging.getLogger("app.clarification")

# ── Pydantic Models for Ingestion ──

class CompanyProfile(BaseModel):
    primary_problem: str = Field(
        description="the pain point or gap that led them to look for a solution and we tell them that Convoa is tailor-made for them"
    )
    current_workflow_summary: str = Field(
        description="how calls/inquiries are handled today (from SOP text if documents were uploaded, otherwise from what the user describes in chat)"
    )
    must_handle_scenarios: List[str] = Field(
        default_factory=list,
        description="specific call types/situations the agent needs to handle correctly"
    )
    escalation_preferences: str = Field(
        description="when/how they want a call handed to a human"
    )
    desired_customizations: str = Field(
        description="tone, restrictions, specific behavior requested"
    )

PROFILE_FIELDS = [
    "primary_problem",
    "current_workflow_summary",
    "must_handle_scenarios",
    "escalation_preferences",
    "desired_customizations"
]


class ClarificationAnswer(BaseModel):
    answer: str


class ClarificationStatus(BaseModel):
    lead_id: str
    status: str
    current_question: Optional[str] = None
    recommendations: Optional[List[str]] = None
    conversation_history: List[dict] = Field(default_factory=list)
    profile: Optional[dict] = None
    missing_fields: List[str] = Field(default_factory=list)
    is_final_question: bool = Field(default=False)
    final_question_answered: bool = Field(default=False)


# ── LangGraph State Definition ──

class ClarificationState(TypedDict):
    lead_id: str
    company_name: str
    industry: str
    documents_text: str
    extracted_profile: Optional[dict]
    missing_fields: List[str]
    conversation_history: List[dict]
    status: str
    temp_resume: Optional[dict]
    ai_processing_consent: Optional[bool]
    documents_flagged: Optional[bool]
    final_question_asked: Optional[bool]
    final_question_answered: Optional[bool]
    pending_question: Optional[str]
    pending_recommendations: Optional[List[str]]
    pending_is_final: Optional[bool]
    last_response_was_meta: Optional[bool]
    intro_shown: Optional[bool]
    form_problem: Optional[str]
    # Profile fields we've already asked a question about — so we never re-ask the
    # same topic even if the extractor failed to capture a short answer.
    asked_fields: Optional[List[str]]
    # How many scoping questions we've asked, to bound the interview length.
    questions_asked: Optional[int]


# ── Prompts ──

EXTRACTION_PROMPT = """You are Convoa's profile ingestion analyzer.
You are analyzing a potential B2B customer request for Convoa (our voice-AI front-desk receptionist).
Company: "{company_name}"
Industry: "{industry}"

Problem the business stated on their intake form:
---
{stated_problem}
---

SOP / Process Documents Text:
---
{documents_text}
---

Clarification Conversation History:
{conversation_text}

Your task is to analyze the stated problem, the documents and the conversation history to extract a structured profile for this company.
Treat the stated problem above as an authoritative description of their primary_problem unless the documents or conversation clearly refine or contradict it.
Each field in the returned JSON object must be a flat value:
- primary_problem: a plain string/text description of the main pain point (NOT a nested JSON object).
- current_workflow_summary: a plain string/text description of how calls are handled today (NOT a nested JSON object).
- must_handle_scenarios: a flat list of strings, each string representing a call type/situation (NOT a list of objects).
- escalation_preferences: a plain string/text description of when/how they want a call handed to a human (NOT a nested JSON object).
- desired_customizations: a plain string/text description of tone, restrictions, specific behavior requested (NOT a nested JSON object).

For any field, if you find information in either the documents or the conversation history, extract it. If a field has information from both, prefer the more recent details from the conversation history.
If a field is still completely unknown, set it to "UNKNOWN" (or empty list [] for must_handle_scenarios).

Return your response as a valid JSON object matching the requested schema.
"""

EXTRACTION_PROMPT_NO_DOCS = """You are Convoa's profile ingestion analyzer.
You are analyzing a potential B2B customer request for Convoa.
Company: "{company_name}"
Industry: "{industry}"
No process/SOP documents were uploaded.

Clarification Conversation History:
{conversation_text}

Your task is to extract whatever information is known so far from the conversation history.
Each field in the returned JSON object must be a flat value:
- primary_problem: a plain string/text description of the main pain point (NOT a nested JSON object).

Conversation History so far:
{conversation_text}

Extract values for the following fields if present or inferable from context. Return null for fields that are unknown:
- primary_call_types (list of call reasons/scenarios e.g. ["appointment booking", "emergency dispatch", "billing inquiries"])
- operating_hours (string e.g. "24/7", "8 AM - 5 PM M-F")
- escalation_contacts (list or string of who receives urgent escalations)
- crm_or_tools (string of tools/software used e.g. "Salesforce", "Descartes", "Google Calendar")
- common_faqs (list of dicts with question/answer pairs found)
- key_qualification_criteria (string describing what makes a good lead/client)

Return your response as a valid JSON object matching the requested schema.
"""

QUESTION_PROMPT = """You are Convoa AI Advisor, a senior solutions engineer scoping a real AI voice receptionist deployment.
Target Company: "{company_name}"
Industry: "{industry}"

WHAT WE ALREADY KNOW ABOUT THIS BUSINESS
{profile_json}

WHAT OUR {industry_display} PLAYBOOK ALREADY COVERS (never ask about any of this)
{library_rules}

Callers in this industry routinely ask these, and we already handle them:
{library_questions}

QUESTIONS YOU HAVE ALREADY ASKED
Never ask any of these again — not reworded, not from a slightly different angle, not
about the same underlying topic. If it is on this list, that topic is CLOSED:
{already_asked}

CONVERSATION SO FAR
{conversation_text}

WHERE TO GO NEXT
{focus_instruction}

You are NOT working through a fixed form. The details below are what most change how the
agent behaves on a real call — pick whichever is most valuable AND still genuinely unknown
for THIS business. Use your own judgment; you may ask about something not listed if it
matters more:
{topic_menu}

YOUR TASK
Decide the single most valuable thing we do NOT yet know, and ask ONE concrete question
about it, grounded in a real moment a caller might create. Each question must open a NEW
area — never re-litigate an answer you already have with different wording.

HARD RULES
1. NEVER repeat a topic from "QUESTIONS YOU HAVE ALREADY ASKED". If they already told you
   who handles after-hours escalations, that topic is DONE — move to a completely different
   area (hours, what to capture, tools, scheduling, tone, a common caller question, etc.).
2. NEVER ask about anything the industry playbook already covers.
3. Every question must MOVE FORWARD into new territory, not circle the last answer.
4. Ground it in a concrete situation. Give them something to picture, then ask what should
   happen.
5. One question only. No "and"/"also" stacking.
6. Speak as a knowledgeable peer: warm, direct, no filler, no restating their last answer.

QUALITY BAR — GOOD questions (notice each opens a DIFFERENT area):
- "When someone calls at 9pm because their heat is out and it's below freezing, do you want
  us waking the on-call tech, or booking them first thing and texting you the details?"
- "What's the one thing you need us to get off every caller before we let them go — a
  callback number, an account or order number, something else?"
- "When a caller asks a question you'd want answered a specific way — pricing, hours, where
  you're located — should we answer from what you tell us, or always take a message?"

QUALITY BAR — BAD questions. Do not write anything resembling these:
- Re-asking a topic already covered in different words (the worst failure — it makes the
  advisor look broken).
- "What scenarios should the AI agent handle?"  (generic, textbook, asks them to do our job)
- "What are your escalation preferences?"  (reads like a form field, not a conversation)
- "Do you have any specific requirements for tone, escalation, and scheduling?"  (three at once)

RECOMMENDED ANSWERS
Provide 2 to 4 short clickable answer options, 2-7 words each. They must be plausible,
DIFFERENT answers to THIS specific question — not filler, not restatements of each other.
Never reuse an option set across questions.

OUTPUT FORMAT
Return a valid JSON object with EXACTLY these two keys:
- "question": string — the single question to ask.
- "recommendations": array of 2-4 short strings — the clickable answer options.

Both keys are REQUIRED. "recommendations" must never be empty.

Example of a well-formed response:
{{"question": "What's the one detail you need us to get off every caller before they hang up — a callback number, an order number, or something else?", "recommendations": ["Callback number", "Order or tracking number", "Full name and address"]}}
"""

# High-value scoping areas the advisor can draw from — deliberately broader than the five
# structured profile fields, so the interview isn't just those five reworded. The question
# writer is told to pick whatever is most valuable and still unknown, or invent its own.
TOPIC_MENU = """- Who exactly an urgent call should reach (name/role), how to reach them, and what counts as "urgent" to this business
- Operating hours, and how after-hours handling should differ from during-hours
- The details to capture from every caller before they hang up (name spelling, callback number, account/order/tracking number, address)
- Booking / scheduling / dispatch specifics: what gets scheduled and into which system or calendar
- The one or two questions callers ask most that the agent must answer correctly
- Where captured information must land (CRM, calendar, a dispatch board, a specific person's phone)
- Tone and boundaries: how it should sound, and anything it must never say or promise
- Anything unusual about THIS business that a generic receptionist would get wrong"""

# Human-readable focus phrasing per structured field, used to steer (not force) the next
# question toward a still-missing profile gap without sounding like a form.
_FIELD_FOCUS = {
    "primary_problem": "the core problem they came to solve",
    "current_workflow_summary": "how their calls are handled today",
    "must_handle_scenarios": "the specific call types the agent must get right",
    "escalation_preferences": "when a call should be escalated, and to whom",
    "desired_customizations": "how they want the agent to sound or behave",
}

class GeneratedQuestion(BaseModel):
    question: str = Field(description="The friendly, conversational next question to ask the user as Convoa AI Advisor.")
    recommendations: List[str] = Field(default_factory=list, description="2 to 4 recommended answer options for the user to select from.")


RESPONSE_CLASSIFIER_PROMPT = """You are triaging one message a user sent to Convoa AI Advisor during a scoping conversation.
Company: "{company_name}"
Industry: "{industry}"

The question the advisor asked was:
---
{asked_question}
---

The user replied:
---
{user_response}
---

Decide whether the reply ANSWERS the question, or whether it is a meta-response that asks something back.

Set is_direct_answer = true when the reply gives usable information about their business, OR
when it defers the decision to us. All of these are direct answers:
- "We route those to the on-call manager."
- "I don't know, use your best judgment."  (a deferral IS a valid answer)
- "Whatever you think is best."
- "Yes, that's correct." / "No, not exactly."
- Any short or vague reply that still responds to what was asked.

Set is_direct_answer = false ONLY when the user is asking us something rather than
answering — e.g. "Can you give me an example?", "What do you mean by escalation?",
"I don't understand the question", "Why are you asking this?".

If is_direct_answer is false, write helpful_reply: a direct, concrete, genuinely useful
answer to what the user actually asked, 1-3 sentences, grounded in the {industry} industry
and in the specific question above. If they asked for an example, give a real example.
Speak as Convoa AI Advisor: expert, friendly, no filler. Do NOT re-ask the question inside
helpful_reply — it is re-asked separately.
If is_direct_answer is true, set helpful_reply to an empty string.

Return a valid JSON object with exactly these three keys:
- "is_direct_answer": boolean
- "response_type": one of "direct_answer", "deferral", "question_back", "clarification_request", "confusion", "off_topic"
- "helpful_reply": string (empty string when is_direct_answer is true)
"""


class ResponseClassification(BaseModel):
    is_direct_answer: bool = Field(
        description="True if the reply answers the question (including deferrals like 'use your best judgment'); false if it asks something back."
    )
    response_type: str = Field(
        default="direct_answer",
        description="One of: direct_answer, deferral, question_back, clarification_request, confusion, off_topic"
    )
    helpful_reply: str = Field(
        default="",
        description="When is_direct_answer is false, a concrete helpful answer to what the user actually asked. Empty otherwise."
    )


# ── Helpers ──

def get_postgres_conn_str() -> str:
    from app.config import DATABASE_URL
    conn_str = DATABASE_URL.replace("postgresql+psycopg2://", "postgresql://")
    conn_str = conn_str.split("?")[0]
    return conn_str


# ── Shared checkpointer ──
# Opening a fresh Postgres connection and re-running checkpointer.setup() on every
# API call cost ~1.5-3.4s per call against the remote DB. The pool is opened once
# per process and setup() runs once, so subsequent calls reuse a warm connection.
_CHECKPOINTER = None
_COMPILED_GRAPH = None
_CHECKPOINTER_POOL = None
_CHECKPOINTER_LOCK = threading.Lock()


def close_checkpointer_pool() -> None:
    """Releases pooled connections on shutdown so repeated restarts/reloads
    don't accumulate open connections against the database."""
    global _CHECKPOINTER, _COMPILED_GRAPH, _CHECKPOINTER_POOL
    with _CHECKPOINTER_LOCK:
        if _CHECKPOINTER_POOL is not None:
            try:
                _CHECKPOINTER_POOL.close()
            except Exception as e:
                logger.warning(f"Error closing checkpointer pool: {e}")
        _CHECKPOINTER_POOL = None
        _CHECKPOINTER = None
        _COMPILED_GRAPH = None


def get_compiled_graph():
    """Returns the process-wide compiled graph bound to a pooled PostgresSaver."""
    global _CHECKPOINTER, _COMPILED_GRAPH, _CHECKPOINTER_POOL
    if _COMPILED_GRAPH is not None:
        return _COMPILED_GRAPH

    with _CHECKPOINTER_LOCK:
        if _COMPILED_GRAPH is not None:
            return _COMPILED_GRAPH

        from psycopg_pool import ConnectionPool

        t0 = time.perf_counter()
        pool = ConnectionPool(
            conninfo=get_postgres_conn_str(),
            min_size=1,
            max_size=10,
            open=True,
            kwargs={"autocommit": True, "prepare_threshold": 0},
        )
        checkpointer = PostgresSaver(pool)
        checkpointer.setup()
        _CHECKPOINTER_POOL = pool
        _CHECKPOINTER = checkpointer
        _COMPILED_GRAPH = workflow.compile(checkpointer=checkpointer)
        logger.info(
            f"PHASE_TIMING fn=get_compiled_graph one_time_pool_init_ms={(time.perf_counter() - t0) * 1000:.1f}"
        )
        return _COMPILED_GRAPH


# ── Audit instrumentation (STEP 1 / STEP 2) ──
# Counts how many times each node body actually executes, per lead, per process.
_NODE_EXEC_COUNTS: dict = {}
_NODE_COUNT_LOCK = threading.Lock()


def _node_exec_seq(lead_id: str, node_name: str) -> int:
    key = (lead_id, node_name)
    with _NODE_COUNT_LOCK:
        _NODE_EXEC_COUNTS[key] = _NODE_EXEC_COUNTS.get(key, 0) + 1
        return _NODE_EXEC_COUNTS[key]


def timed_node(node_name: str):
    """Logs start/end/duration for a node body, plus how many times it has run for this lead."""
    def decorator(fn):
        def wrapper(state: "ClarificationState"):
            lead_id_str = state.get("lead_id")
            seq = _node_exec_seq(lead_id_str, node_name)
            t0 = time.perf_counter()
            logger.info(f"NODE_START node={node_name} lead_id={lead_id_str} exec_seq={seq}")
            interrupted = False
            try:
                return fn(state)
            except BaseException as e:
                interrupted = type(e).__name__ == "GraphInterrupt"
                raise
            finally:
                dur_ms = (time.perf_counter() - t0) * 1000
                logger.info(
                    f"NODE_END node={node_name} lead_id={lead_id_str} exec_seq={seq} "
                    f"duration_ms={dur_ms:.1f} paused_on_interrupt={interrupted}"
                )
        wrapper.__name__ = getattr(fn, "__name__", node_name)
        return wrapper
    return decorator


def compile_conversation(history: List[dict]) -> str:
    if not history:
        return "None"
    lines = []
    for msg in history:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        lines.append(f"{role.capitalize()}: {content}")
    return "\n".join(lines)


def _get_db_history(lead_id_uuid: uuid.UUID) -> list[dict]:
    with Session(engine) as session:
        statement = select(ClarificationMessage).where(
            ClarificationMessage.lead_id == lead_id_uuid
        ).order_by(ClarificationMessage.created_at.asc())
        msgs = session.exec(statement).all()
        return [{"role": m.role.value, "content": m.content} for m in msgs]


# ── LangGraph Nodes ──

@timed_node("parse_documents")
def parse_documents_node(state: ClarificationState) -> ClarificationState:
    lead_id_str = state.get("lead_id")
    lead_id = uuid.UUID(lead_id_str)

    with Session(engine) as session:
        lead = session.get(Lead, lead_id)
        statement = select(Document).where(Document.lead_id == lead_id)
        docs = session.exec(statement).all()

    consent = lead.ai_processing_consent if lead else False
    doc_lengths = [len(d.extracted_text or "") for d in docs]
    logger.info(
        f"[{lead_id_str}] parse_documents: consent={consent}, docs_count={len(docs)}, lengths={doc_lengths}"
    )

    if not consent or not docs:
        logger.info(f"[{lead_id_str}] Skipping document text extraction (consent={consent})")
        return {**state, "documents_text": ""}

    combined_text = []
    for doc in docs:
        if doc.extracted_text:
            text = doc.extracted_text
            sanitized_text, flagged, match_count, matched_patterns = sanitize_document_text(text)
            doc_name = getattr(doc, 'filename', None) or getattr(doc, 'file_url', 'uploaded_document')
            if flagged:
                logger.warning(
                    f"[{lead_id_str}] Prompt injection detected in document '{doc_name}'. Ignoring content."
                )
                continue
            combined_text.append(f"--- Document: {doc_name} ---\n{sanitized_text}")

    full_text = "\n\n".join(combined_text)
    logger.info(f"[{lead_id_str}] parse_documents finished. Total chars: {len(full_text)}")
    return {**state, "documents_text": full_text}


@timed_node("extract_profile")
def extract_profile_node(state: ClarificationState) -> ClarificationState:
    lead_id_str = state.get("lead_id")
    company = state.get("company_name", "")
    industry = state.get("industry", "")
    docs_text = state.get("documents_text", "")
    history = state.get("conversation_history", [])
    form_problem = sanitize_profile_text(str(state.get("form_problem") or ""), max_len=400)

    logger.info(f"[{lead_id_str}] extract_profile node started")

    # Fast-path optimization: when there are no documents and no conversation history,
    # the LLM can extract nothing about workflow/scenarios/preferences. Avoid a 12-15s LLM call.
    if not docs_text and not history:
        logger.info(f"[{lead_id_str}] extract_profile: No documents and no history. Bypassing LLM call.")
        extracted_dict = {
            "primary_problem": form_problem or "UNKNOWN",
            "current_workflow_summary": "UNKNOWN",
            "must_handle_scenarios": [],
            "escalation_preferences": "UNKNOWN",
            "desired_customizations": "UNKNOWN",
        }
        return {
            **state,
            "extracted_profile": extracted_dict
        }

    prompt = EXTRACTION_PROMPT.format(
        company_name=company,
        industry=industry,
        stated_problem=form_problem or "None provided",
        documents_text=docs_text[:6000] if docs_text else "None",
        conversation_text=compile_conversation(history)
    )

    _llm_t0 = time.perf_counter()
    try:
        res = call_structured_llm(prompt, CompanyProfile, retry_on_failure=True)
        extracted_dict = res.model_dump()
        logger.info(
            f"LLM_TIMING call=extract_profile lead_id={lead_id_str} "
            f"duration_ms={(time.perf_counter() - _llm_t0) * 1000:.1f}"
        )
    except Exception as e:
        logger.error(f"[{lead_id_str}] Profile extraction failed: {e}", exc_info=True)
        extracted_dict = state.get("extracted_profile") or {}

    # The form's problem statement is authoritative for primary_problem. If the LLM
    # didn't surface one (e.g. no docs, no conversation yet), fall back to it so the
    # gap detector never re-asks about a problem the lead already described.
    if form_problem:
        pp = extracted_dict.get("primary_problem")
        if not pp or str(pp).strip().upper() in ("", "UNKNOWN"):
            extracted_dict["primary_problem"] = form_problem

    return {
        **state,
        "extracted_profile": extracted_dict
    }


@timed_node("detect_gaps")
def detect_gaps_node(state: ClarificationState) -> ClarificationState:
    """Determine missing fields from extracted profile."""
    profile = state.get("extracted_profile") or {}
    missing = []

    for key in PROFILE_FIELDS:
        val = profile.get(key)
        if val is None or val == "" or val == [] or val == "UNKNOWN":
            missing.append(key)

    logger.info(f"[{state.get('lead_id')}] detect_gaps node. Missing fields: {missing}")
    return {
        **state,
        "missing_fields": missing
    }


#: Fallback questions used only when the LLM call fails, keyed to the profile
#: field still missing. Previously ONE static string was used for every failure,
#: so three consecutive failures asked the identical question three times and the
#: conversation could not progress. Keying them to the gap means even a fully
#: degraded run still moves through the profile.
_FALLBACK_QUESTIONS = {
    "primary_problem":
        "What's the main thing going wrong with your calls at the moment?",
    "current_workflow_summary":
        "How are your calls handled today — who picks up, and what happens after hours?",
    "must_handle_scenarios":
        "What kinds of calls do you most need this to handle well?",
    "escalation_preferences":
        "When a call needs a human, what should happen — transfer it, text you, or take a message?",
    "desired_customizations":
        "Is there any particular way you'd want it to sound or behave on the phone?",
}

_GENERIC_FALLBACK = (
    "Could you tell us more about what calls you want Convoa to handle and what "
    "happens when they need to be escalated?"
)


def _fallback_question(missing: List[str], history: List[dict]) -> str:
    """Picks a fallback question for a still-missing field, avoiding repetition.

    Skips any question already asked in this conversation, so a run of LLM
    failures walks through the remaining gaps instead of looping on one line.
    """
    asked = {m.get("content", "").strip() for m in history if m.get("role") == "assistant"}
    for field in PROFILE_FIELDS:
        if field in missing:
            q = _FALLBACK_QUESTIONS.get(field)
            if q and q not in asked:
                return q
    # Everything field-specific has been asked already — fall back to the generic
    # line, and only if that too was asked, vary it so we never repeat verbatim.
    if _GENERIC_FALLBACK not in asked:
        return _GENERIC_FALLBACK
    return "Is there anything else about how you'd like your calls handled that we haven't covered?"


def _generate_question_with_retry(prompt: str, tag: str):
    """Calls the question LLM, retrying through transient/rate-limit failures.

    The question step had no retry at all, so a single 429 dropped straight to the
    static fallback — which is what produced the same question repeating. Capped
    deliberately low (two retries, ~15s worst case) because a user is waiting on
    this request, unlike the background summarizer.
    """
    delays = [5, 10]
    last_err = None
    for attempt in range(len(delays) + 1):
        try:
            return call_structured_llm(prompt, GeneratedQuestion, retry_on_failure=True)
        except Exception as e:
            last_err = e
            if attempt >= len(delays):
                break
            msg = f"{e}".lower()
            rate_limited = "429" in msg or "rate limit" in msg or "rate_limit" in msg
            # A per-DAY quota does not recover in seconds — Groq reports waits of
            # minutes to hours for TPD. Sleeping through the user's request buys
            # nothing, so drop straight to the fallback question instead.
            if "per day" in msg or "tpd" in msg:
                logger.error(
                    f"{tag} generate_question: daily token quota exhausted — "
                    f"using fallback immediately rather than retrying"
                )
                break
            logger.warning(
                f"{tag} generate_question attempt {attempt + 1} failed "
                f"({'rate limited' if rate_limited else type(e).__name__}), "
                f"retrying in {delays[attempt]}s"
            )
            time.sleep(delays[attempt])
    raise last_err


def _fallback_recommendations(target_field: Optional[str], library: dict) -> List[str]:
    """Click-options used only when the LLM returned none.

    Keyed on the profile field the question targets and seeded from the industry
    playbook, so the options still change from question to question instead of
    showing the same static list on every turn.
    """
    display = library.get("display_name", "your business")
    first_scenario = ""
    scenarios = library.get("caller_scenarios") or []
    if scenarios:
        first_scenario = scenarios[0][0]

    if target_field == "primary_problem":
        return [
            "Missing calls after hours",
            "Nobody free to pick up",
            "Losing callers to voicemail",
        ]
    if target_field == "current_workflow_summary":
        return [
            "Receptionist answers, else voicemail",
            "Rings a mobile, then voicemail",
            "Answering service takes messages",
        ]
    if target_field == "must_handle_scenarios":
        # Library triggers are full sentences, so they cannot be used as chips —
        # slicing them produced options cut off mid-word.
        return [
            "Urgent and emergency calls",
            "Bookings and scheduling",
            "Everything after hours",
        ]
    if target_field == "escalation_preferences":
        return [
            "Transfer to on-call phone",
            "Text me the details",
            "Just take a message",
        ]
    if target_field == "desired_customizations":
        return [
            "Calm and professional",
            "Friendly and casual",
            "Always confirm callback number",
        ]
    return [
        f"Handle standard {display} calls",
        "Escalate anything urgent",
        "Take a message and confirm",
    ]


def compile_chat_intro(company_name: str, industry: str, profile: Optional[dict] = None) -> str:
    """Builds the opening line the clarification chat shows before its first question.

    Deterministic, no LLM. Reflects back what we already know — company, industry,
    and (when it was extracted from an uploaded document) the problem they want to
    solve — so the conversation opens by demonstrating context rather than asking
    cold. Each clause is dropped when we don't have it, so we never assert a fact
    the lead never gave us.
    """
    company = sanitize_input(company_name) or "your business"
    library = lookup_industry(industry)

    if library.get("matched"):
        label = library.get("display_name", "")
        # "an" before a vowel sound, including the acronym HVAC ("an aitch-vac").
        article = "an" if (label[:1].lower() in "aeiou" or label.upper().startswith("HVAC")) else "a"
        identity = f"you're {company}, {article} {label} business"
    else:
        identity = f"you're {company}"

    problem = (profile or {}).get("primary_problem")
    if problem and str(problem).strip().upper() not in ("", "UNKNOWN"):
        problem_clause = (
            f", and the main thing you want to solve is "
            f"{sanitize_profile_text(str(problem), max_len=160).rstrip('.')}"
        )
    else:
        problem_clause = ""

    return (
        f"Hi! Before we dive in — from what we know so far, {identity}{problem_clause}. "
        f"I'll ask a few quick questions so we can tailor your demo agent to how you "
        f"actually handle calls. Let's get started."
    )


def _maybe_prepend_intro(state: ClarificationState, history: list) -> tuple[list, bool]:
    """Writes the one-time contextual intro as the first assistant message.

    Returns (possibly-updated history, intro_was_written). No-op after the first
    call for a thread — guarded by the intro_shown flag, which the checkpointer
    persists — so it never repeats before later questions. Placed at the start of
    the question nodes rather than at graph entry so the profile has already been
    extracted and the problem clause can be included when a document provided it.
    """
    if state.get("intro_shown"):
        return history, False

    lead_id_str = state.get("lead_id")
    intro_text = compile_chat_intro(
        state.get("company_name", ""),
        state.get("industry", ""),
        state.get("extracted_profile") or {},
    )

    updated = list(history)
    updated.append({"role": "assistant", "content": intro_text})

    with Session(engine) as session:
        session.add(ClarificationMessage(
            lead_id=uuid.UUID(lead_id_str),
            role=MessageRole.assistant,
            content=intro_text,
        ))
        session.commit()

    logger.info(f"[{lead_id_str}] clarification intro shown")
    return updated, True


@timed_node("generate_question")
def generate_question_node(state: ClarificationState) -> ClarificationState:
    lead_id_str = state.get("lead_id")
    company = state.get("company_name", "")
    industry = state.get("industry", "")
    profile = state.get("extracted_profile") or {}
    missing = state.get("missing_fields", [])
    history = state.get("conversation_history", [])

    logger.info(f"[{lead_id_str}] generate_question node started")

    # One-time contextual greeting, before the first question is generated.
    history, intro_written = _maybe_prepend_intro(state, history)

    # Scenario-library context. The question writer needs to know what our vetted
    # playbook already covers so it does not spend a turn asking something we can
    # already answer for this industry.
    library = lookup_industry(industry)
    library_rules = format_scenarios_as_rules(library)

    # Show only the fields we actually have, so "what we know" reads as knowledge
    # rather than as a list of UNKNOWNs the model then feels obliged to ask about.
    known = {k: v for k, v in (profile or {}).items()
             if v not in (None, "", "UNKNOWN", [])}

    # Pick the next focus. A structured gap we have NOT already asked about comes
    # first; once those are exhausted the advisor asks its own broader questions.
    # Tracking asked_fields (not just current gaps) is what stops the loop: a field
    # the extractor keeps failing to fill is still only asked once.
    asked_fields = state.get("asked_fields") or []
    remaining_fields = [f for f in missing if f not in asked_fields]
    target_field = remaining_fields[0] if remaining_fields else None

    if target_field:
        focus_instruction = (
            f"The most useful gap we still have is {_FIELD_FOCUS.get(target_field, target_field)}. "
            f"Aim your next question there — but frame it as a real situation, not a form field. "
            f"If that area already came up naturally in the conversation above, skip it and pick "
            f"the next most valuable unknown instead."
        )
    else:
        focus_instruction = (
            "You've already covered the core gaps. Now ask the single most valuable thing we "
            "still don't know about running this business's phone line — use your own judgment "
            "about what would most change how the agent behaves on a real call."
        )

    # Every prior question, so the model can see exactly what NOT to repeat. The
    # one-time intro is excluded — it isn't a question.
    asked_qs = [
        m.get("content", "").strip()
        for m in history
        if m.get("role") == "assistant"
        and not m.get("content", "").strip().startswith("Hi! Before we dive in")
    ]
    already_asked = "\n".join(f"- {q}" for q in asked_qs) or "- (none yet — this is the first question)"

    prompt = QUESTION_PROMPT.format(
        company_name=company,
        industry=industry,
        industry_display=library.get("display_name", industry),
        profile_json=json.dumps(known, indent=2) if known else "Nothing yet — this is the first question.",
        library_rules="\n".join(f"- {r}" for r in library_rules) or "- (no playbook entries)",
        library_questions="\n".join(f"- {q}" for q in (library.get("common_questions") or [])) or "- (none)",
        already_asked=already_asked,
        focus_instruction=focus_instruction,
        topic_menu=TOPIC_MENU,
        conversation_text=compile_conversation(history)
    )

    recommendations = []
    _llm_t0 = time.perf_counter()
    try:
        res = _generate_question_with_retry(prompt, f"[{lead_id_str}]")
        question_text = res.question
        recommendations = res.recommendations or []
        logger.info(
            f"LLM_TIMING call=generate_question lead_id={lead_id_str} "
            f"duration_ms={(time.perf_counter() - _llm_t0) * 1000:.1f}"
        )
    except Exception as e:
        logger.error(
            f"[{lead_id_str}] Failed to generate question after retries: {e} — using fallback",
            exc_info=True,
        )
        question_text = _fallback_question(missing, history)
        # Left empty so the field-aware fallback below fills it, rather than pinning
        # a third static option set that never varies between questions.
        recommendations = []

    # Final guard: never ask the previous question again verbatim, whatever its
    # source. A repeated question makes the assistant look broken and gives the
    # user nothing new to answer.
    prev_assistant = next(
        (m.get("content", "").strip() for m in reversed(history) if m.get("role") == "assistant"),
        "",
    )
    if question_text.strip() and question_text.strip() == prev_assistant:
        logger.warning(f"[{lead_id_str}] question repeated previous turn — substituting fallback")
        question_text = _fallback_question(missing, history)

    if not recommendations:
        # Fallback options, keyed on the field this question is actually targeting.
        # These previously branched on crm_or_tools / operating_hours /
        # escalation_contacts, none of which are in PROFILE_FIELDS, so every
        # fallback produced the same three static options regardless of question.
        target = next((f for f in PROFILE_FIELDS if f in missing), None)
        recommendations = _fallback_recommendations(target, library)

    updated_history = list(history)
    updated_history.append({"role": "assistant", "content": question_text})

    with Session(engine) as session:
        msg = ClarificationMessage(
            lead_id=uuid.UUID(lead_id_str),
            role=MessageRole.assistant,
            content=question_text
        )
        session.add(msg)

        statement = select(CompanyProfileDB).where(CompanyProfileDB.lead_id == uuid.UUID(lead_id_str))
        profile_db = session.exec(statement).first()
        if profile_db:
            profile_db.status = ProfileStatus.awaiting_user
            profile_db.missing_fields = json.dumps(missing)
            profile_db.updated_at = datetime.utcnow()
            session.add(profile_db)
        session.commit()

    logger.info(f"[{lead_id_str}] generate_question produced question={question_text!r}")

    # The interrupt lives in await_answer, not here. A node that interrupts is
    # re-executed in full when the thread resumes, so any side effect placed
    # before interrupt() (the LLM call and the DB append above) would run twice
    # per question. Handing the question to await_answer via state means this
    # node's work is checkpointed and never replayed.
    # Mark this turn's focus field as asked so it is never targeted again, and
    # count the question toward the interview budget.
    new_asked_fields = list(asked_fields)
    if target_field and target_field not in new_asked_fields:
        new_asked_fields.append(target_field)

    return {
        **state,
        "conversation_history": updated_history,
        "pending_question": question_text,
        "pending_recommendations": recommendations,
        "pending_is_final": False,
        "intro_shown": state.get("intro_shown") or intro_written,
        "asked_fields": new_asked_fields,
        "questions_asked": (state.get("questions_asked") or 0) + 1,
    }


@timed_node("await_answer")
def await_answer_node(state: ClarificationState) -> ClarificationState:
    """Pauses the graph until the user answers. Must stay free of side effects:
    this is the node LangGraph replays from the top on every resume."""
    lead_id_str = state.get("lead_id")
    question_text = state.get("pending_question") or ""
    recommendations = state.get("pending_recommendations") or []
    is_final = bool(state.get("pending_is_final"))

    logger.info(
        f"INTERRUPT_FIRE node=await_answer lead_id={lead_id_str} "
        f"thread_id={lead_id_str} is_final={is_final} question={question_text!r}"
    )

    resume_val = interrupt({
        "question": question_text,
        "recommendations": recommendations,
        "is_final": is_final,
    })

    logger.info(
        f"INTERRUPT_RESUMED node=await_answer lead_id={lead_id_str} "
        f"thread_id={lead_id_str} resume_val={resume_val!r}"
    )

    return {
        **state,
        "temp_resume": resume_val
    }


@timed_node("ask_final_question")
def ask_final_question_node(state: ClarificationState) -> ClarificationState:
    lead_id_str = state.get("lead_id")
    history = state.get("conversation_history", [])

    logger.info(f"[{lead_id_str}] ask_final_question node started")

    # Covers the path where the profile was already complete and the graph skipped
    # straight here without ever running generate_question — the intro still shows once.
    history, intro_written = _maybe_prepend_intro(state, history)

    question_text = "Is there anything else about how you'd want your AI receptionist to handle calls or behave that we haven't covered yet?"
    recommendations = [
        "No, that covers everything!",
        "Prefer a calm & professional tone",
        "Send SMS notifications for urgent calls",
        "Make sure to confirm caller details"
    ]

    updated_history = list(history)
    updated_history.append({"role": "assistant", "content": question_text})

    with Session(engine) as session:
        msg = ClarificationMessage(
            lead_id=uuid.UUID(lead_id_str),
            role=MessageRole.assistant,
            content=question_text
        )
        session.add(msg)

        statement = select(CompanyProfileDB).where(CompanyProfileDB.lead_id == uuid.UUID(lead_id_str))
        profile_db = session.exec(statement).first()
        if profile_db:
            profile_db.status = ProfileStatus.awaiting_user
            profile_db.missing_fields = json.dumps([])
            profile_db.updated_at = datetime.utcnow()
            session.add(profile_db)
        session.commit()

    logger.info(f"[{lead_id_str}] Queued mandatory final catch-all question for await_answer")

    return {
        **state,
        "final_question_asked": True,
        "conversation_history": updated_history,
        "pending_question": question_text,
        "pending_recommendations": recommendations,
        "pending_is_final": True,
        "intro_shown": state.get("intro_shown") or intro_written,
    }


@timed_node("ingest_answer")
def ingest_answer_node(state: ClarificationState) -> ClarificationState:
    lead_id_str = state.get("lead_id")
    company = state.get("company_name", "")
    industry = state.get("industry", "")
    history = state.get("conversation_history", [])
    resume_val = state.get("temp_resume") or {}
    user_answer = resume_val.get("answer", "")
    asked_question = state.get("pending_question") or ""

    sanitized_answer = sanitize_input(user_answer)
    updated_history = list(history)
    updated_history.append({"role": "user", "content": sanitized_answer})

    # Classify before extracting: a question back ("can you give me an example?")
    # is not profile information, and running extraction on it would silently
    # mark the field as answered.
    classification = None
    _llm_t0 = time.perf_counter()
    try:
        classification = call_structured_llm(
            RESPONSE_CLASSIFIER_PROMPT.format(
                company_name=company,
                industry=industry,
                asked_question=asked_question,
                user_response=sanitized_answer,
            ),
            ResponseClassification,
            retry_on_failure=True,
        )
        logger.info(
            f"LLM_TIMING call=classify_response lead_id={lead_id_str} "
            f"duration_ms={(time.perf_counter() - _llm_t0) * 1000:.1f} "
            f"is_direct_answer={classification.is_direct_answer} "
            f"response_type={classification.response_type}"
        )
    except Exception as e:
        # Fail open: treat an unclassifiable response as a real answer so the
        # conversation always advances rather than looping on the same question.
        logger.error(f"[{lead_id_str}] Response classification failed: {e} — treating as direct answer", exc_info=True)

    is_meta = bool(classification) and not classification.is_direct_answer

    with Session(engine) as session:
        session.add(ClarificationMessage(
            lead_id=uuid.UUID(lead_id_str),
            role=MessageRole.user,
            content=sanitized_answer
        ))
        if is_meta:
            helpful_reply = (classification.helpful_reply or "").strip() or (
                "Happy to clarify — tell me how calls like this are handled today and I can work from there."
            )
            updated_history.append({"role": "assistant", "content": helpful_reply})
            session.add(ClarificationMessage(
                lead_id=uuid.UUID(lead_id_str),
                role=MessageRole.assistant,
                content=helpful_reply
            ))
            if asked_question:
                updated_history.append({"role": "assistant", "content": asked_question})
                session.add(ClarificationMessage(
                    lead_id=uuid.UUID(lead_id_str),
                    role=MessageRole.assistant,
                    content=asked_question
                ))
        session.commit()

    if is_meta:
        logger.info(
            f"[{lead_id_str}] META_RESPONSE type={classification.response_type} — "
            f"answering the user and re-asking the original question without extracting a profile field"
        )
        return {
            **state,
            "conversation_history": updated_history,
            "status": "in_progress",
            "temp_resume": None,
            "last_response_was_meta": True,
        }

    final_asked = state.get("final_question_asked", False)
    return {
        **state,
        "conversation_history": updated_history,
        "status": "in_progress",
        "temp_resume": None,
        "last_response_was_meta": False,
        "final_question_answered": final_asked
    }


@timed_node("finalize")
def finalize_node(state: ClarificationState) -> ClarificationState:
    lead_id_str = state.get("lead_id")
    profile = state.get("extracted_profile") or {}
    
    logger.info(f"[{lead_id_str}] finalize node started. Profile: {profile}")
    
    with Session(engine) as session:
        statement = select(CompanyProfileDB).where(CompanyProfileDB.lead_id == uuid.UUID(lead_id_str))
        profile_db = session.exec(statement).first()
        if profile_db:
            profile_db.status = ProfileStatus.completed
            profile_db.profile = json.dumps(profile)
            profile_db.updated_at = datetime.utcnow()
            session.add(profile_db)
            
        lead = session.get(Lead, uuid.UUID(lead_id_str))
        if lead:
            session.add(lead)
        session.commit()
        
    return {
        **state,
        "status": "completed"
    }


# ── Assemble the StateGraph ──

workflow = StateGraph(ClarificationState)

workflow.add_node("parse_documents", parse_documents_node)
workflow.add_node("extract_profile", extract_profile_node)
workflow.add_node("detect_gaps", detect_gaps_node)
workflow.add_node("generate_question", generate_question_node)
workflow.add_node("ask_final_question", ask_final_question_node)
workflow.add_node("await_answer", await_answer_node)
workflow.add_node("ingest_answer", ingest_answer_node)
workflow.add_node("finalize", finalize_node)

workflow.set_entry_point("parse_documents")

workflow.add_edge("parse_documents", "extract_profile")
workflow.add_edge("extract_profile", "detect_gaps")

#: Interview length bounds. We ask at least MIN (so even a lead whose fields fill
#: in fast still gets a few tailored questions for breadth), and never more than
#: MAX (so the conversation always ends). Between the two, we keep going only while
#: there is a still-unasked gap.
MIN_QUESTIONS = 3
MAX_QUESTIONS = 5


def route_after_gaps(state: ClarificationState):
    missing = state.get("missing_fields", [])
    asked_fields = state.get("asked_fields") or []
    questions_asked = state.get("questions_asked") or 0
    final_asked = state.get("final_question_asked", False)

    # Only structured gaps we have NOT already asked about count as "remaining" —
    # a field the extractor keeps failing to fill is asked once, not forever.
    remaining_fields = [f for f in missing if f not in asked_fields]

    if questions_asked < MAX_QUESTIONS and (remaining_fields or questions_asked < MIN_QUESTIONS):
        return "generate_question"
    if not final_asked:
        return "ask_final_question"
    return "finalize"

workflow.add_conditional_edges("detect_gaps", route_after_gaps)
workflow.add_edge("generate_question", "await_answer")
workflow.add_edge("ask_final_question", "await_answer")


def route_after_ingest(state: ClarificationState):
    """A meta-response carries no profile information, so skip extraction and
    pause on the same question again instead of advancing."""
    if state.get("last_response_was_meta"):
        return "await_answer"
    return "extract_profile"


workflow.add_conditional_edges("ingest_answer", route_after_ingest)
workflow.add_edge("await_answer", "ingest_answer")
workflow.add_edge("finalize", END)


# ── API Interface Functions ──

def start_clarification(lead_id: str) -> ClarificationStatus:
    lead_id_uuid = uuid.UUID(lead_id)
    with Session(engine) as session:
        lead = session.get(Lead, lead_id_uuid)
        if not lead:
            raise ValueError("Lead not found")
        company_name = lead.company_name
        industry = lead.industry
        form_problem = lead.problem_statement or ""
        
        statement = select(CompanyProfileDB).where(CompanyProfileDB.lead_id == lead_id_uuid)
        profile_db = session.exec(statement).first()
        if not profile_db:
            profile_db = CompanyProfileDB(
                lead_id=lead_id_uuid,
                status=ProfileStatus.in_progress,
                profile=None,
                missing_fields=None
            )
            session.add(profile_db)
            session.commit()

        if profile_db.status == ProfileStatus.awaiting_user:
            return get_clarification_status(lead_id)

    history = _get_db_history(lead_id_uuid)
            
    initial_state = {
        "lead_id": lead_id,
        "company_name": company_name,
        "industry": industry,
        "documents_text": "",
        "extracted_profile": None,
        "missing_fields": [],
        "conversation_history": history,
        "status": "in_progress",
        "temp_resume": None,
        "final_question_asked": False,
        "final_question_answered": False,
        "pending_question": None,
        "pending_recommendations": [],
        "pending_is_final": False,
        "last_response_was_meta": False,
        "intro_shown": False,
        "form_problem": form_problem,
        "asked_fields": [],
        "questions_asked": 0,
    }

    config = {"configurable": {"thread_id": lead_id}}
    graph = get_compiled_graph()
    _t0 = time.perf_counter()
    graph.invoke(initial_state, config=config)
    _t1 = time.perf_counter()
    result = _build_status(lead_id, graph, config)
    logger.info(
        f"PHASE_TIMING fn=start_clarification lead_id={lead_id} "
        f"graph_invoke_ms={(_t1-_t0)*1000:.1f} build_status_ms={(time.perf_counter()-_t1)*1000:.1f}"
    )
    return result


def submit_clarification_answer(lead_id: str, answer: str) -> ClarificationStatus:
    config = {"configurable": {"thread_id": lead_id}}
    graph = get_compiled_graph()
    _t0 = time.perf_counter()
    graph.invoke(Command(resume={"answer": answer}), config=config)
    _t1 = time.perf_counter()
    result = _build_status(lead_id, graph, config)
    logger.info(
        f"PHASE_TIMING fn=submit_answer lead_id={lead_id} "
        f"graph_invoke_ms={(_t1-_t0)*1000:.1f} build_status_ms={(time.perf_counter()-_t1)*1000:.1f}"
    )
    return result


def skip_remaining_questions(lead_id: str) -> ClarificationStatus:
    lead_id_uuid = uuid.UUID(lead_id)
    config = {"configurable": {"thread_id": lead_id}}
    extracted_profile = None

    try:
        state_snap = get_compiled_graph().get_state(config)
        if state_snap and state_snap.values:
            extracted_profile = state_snap.values.get("extracted_profile")
    except Exception as e:
        logger.warning(f"[{lead_id}] Could not retrieve graph state during skip: {e}")

    profile_json_str = json.dumps(extracted_profile) if extracted_profile else None

    with Session(engine) as session:
        statement = select(CompanyProfileDB).where(CompanyProfileDB.lead_id == lead_id_uuid)
        profile_db = session.exec(statement).first()
        if not profile_db:
            profile_db = CompanyProfileDB(
                lead_id=lead_id_uuid,
                status=ProfileStatus.completed,
                profile=profile_json_str,
                missing_fields=json.dumps([])
            )
            session.add(profile_db)
        else:
            profile_db.status = ProfileStatus.completed
            if profile_json_str:
                profile_db.profile = profile_json_str
            profile_db.missing_fields = json.dumps([])
            profile_db.updated_at = datetime.utcnow()
            session.add(profile_db)
        session.commit()

    return get_clarification_status(lead_id)


def get_clarification_status(lead_id: str) -> ClarificationStatus:
    config = {"configurable": {"thread_id": lead_id}}
    return _build_status(lead_id, get_compiled_graph(), config)


def _build_status(lead_id: str, graph, config: dict) -> ClarificationStatus:
    """Assembles the API status payload from an already-open graph.

    Callers that just ran the graph pass their own handle in rather than
    re-opening the checkpointer, which previously cost a second connection
    round trip on every start/submit call.
    """
    lead_id_uuid = uuid.UUID(lead_id)
    _t0 = time.perf_counter()
    state_snap = graph.get_state(config)
    logger.info(
        f"PHASE_TIMING fn=build_status lead_id={lead_id} "
        f"get_state_ms={(time.perf_counter()-_t0)*1000:.1f}"
    )

    values = state_snap.values if state_snap else {}
    current_question = None
    recommendations = None
    is_final_question = False
    final_question_answered = values.get("final_question_answered", False)

    if state_snap and state_snap.next:
        if state_snap.tasks and state_snap.tasks[0].interrupts:
            curr_interrupt = state_snap.tasks[0].interrupts[0]
            val = getattr(curr_interrupt, 'value', None) or curr_interrupt
            if isinstance(val, dict):
                current_question = val.get("question")
                recommendations = val.get("recommendations")
                if val.get("is_final") or values.get("final_question_asked", False):
                    is_final_question = True
                
    db_history = _get_db_history(lead_id_uuid)
    history = db_history if db_history else (values.get("conversation_history") or [])
    extracted = values.get("extracted_profile")
    missing = values.get("missing_fields") or []
    
    db_status = "in_progress"
    with Session(engine) as session:
        statement = select(CompanyProfileDB).where(CompanyProfileDB.lead_id == lead_id_uuid)
        profile_db = session.exec(statement).first()
        if profile_db:
            db_status = profile_db.status.value

    if db_status == ProfileStatus.completed.value:
        current_question = None
        recommendations = None
        missing = []
        is_final_question = False

    return ClarificationStatus(
        lead_id=lead_id,
        status=db_status,
        current_question=current_question,
        recommendations=recommendations,
        conversation_history=history,
        profile=extracted,
        missing_fields=missing,
        is_final_question=is_final_question,
        final_question_answered=final_question_answered
    )
