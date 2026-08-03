import os
import json
import urllib.request
import urllib.error
import re
import time
import hashlib
import logging
import uuid
from datetime import datetime
from typing import Optional, Union, Any
from sqlmodel import Session
from app.db import engine
from app.models import DiscoveryResponse, Lead, AgentStatus

VAPI_API_KEY = os.getenv("VAPI_API_KEY", "")

def compile_agent_prompt(discovery: DiscoveryResponse) -> str:
    """Compiles a highly tailored system prompt for a Vapi Voice Receptionist"""
    company = discovery.company_name
    requirements = discovery.booking_requirements.replace(",", ", ") if discovery.booking_requirements else "name, phone"
    calendar = discovery.calendar_system.replace("_", " ").upper()
    escalation = discovery.escalation_path.replace("_", " ").upper()
    destination = discovery.integration_destination.replace("_", " ").upper()

    prompt = (
        f"You are Convoa, an elite AI Front-Desk Receptionist custom-built for {company}.\n\n"
        f"Your objective is to answer inbound calls professionally, answer client questions, and book appointments. "
        f"Keep your responses short, conversational, and direct (under 2 sentences per turn).\n\n"
        f"STEP 1 - Greet callers politely on behalf of {company} and ask how you can help them.\n"
        f"STEP 2 - When booking a meeting, you MUST gather the following customer details: [{requirements}]. "
        f"Do not ask for all details at once; ask for them one-by-one.\n"
        f"STEP 3 - Once details are collected, schedule the meeting inside the {calendar} integration pipeline.\n"
        f"STEP 4 - Confirm the booking and inform the caller that their details will sync to their {destination}.\n\n"
        f"ESCALATION ROUTING RULES:\n"
        f"If the client has an emergency, asks to speak to a manager, or requests a human transfer, follow this path: {escalation}."
    )
    return prompt

async def provision_vapi_assistant(company_name: str, prompt: str) -> dict:
    """Provisions a real Vapi assistant if VAPI_API_KEY is defined, or falls back to an intelligent mock.
    
    This is the legacy wrapper used by the discovery provisioning endpoint.
    """
    logger = logging.getLogger(__name__)
    try:
        assistant_id = _call_vapi_create_assistant(f"Convoa AI - {company_name}", prompt)
        provider = "mocked" if assistant_id.startswith("vapi_ast_mock_") else "vapi"
        status = "provisioned"
        return {
            "id": assistant_id,
            "name": f"Convoa AI - {company_name}",
            "model": "gpt-4o",
            "voice": "playht/susan",
            "prompt": prompt,
            "status": status,
            "provider": provider
        }
    except Exception as e:
        logger.warning(f"Failed to communicate with Vapi API in legacy call: {e}")
        # Fall back to mock so development does not block on network failure
        mock_id = f"vapi_ast_err_{int(time.time())}"
        return {
            "id": mock_id,
            "name": f"Convoa AI - {company_name} (Fallback)",
            "model": "gpt-4o",
            "voice": "playht/susan",
            "prompt": prompt,
            "status": "failed_real_provisioning_fallback_mock",
            "provider": "mocked"
        }


class VapiAPIError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(f"Vapi API HTTP {status_code}: {message}")


def _call_vapi_create_assistant(
    name: str,
    prompt: str,
    file_id: Optional[str] = None,
    first_message: Optional[str] = None,
    voice_config: dict = None,
) -> str:
    """Creates a Vapi assistant using the API.

    Includes mock fallback if key is missing/mock, and retry logic on transient errors.
    If file_id is provided, includes knowledgeBase directly in creation payload.
    Returns the assistant_id.
    """
    if voice_config is None:
        voice_config = {"voiceId": "Naina", "speed": 0.9}

    logger = logging.getLogger(__name__)
    vapi_key = os.getenv("VAPI_API_KEY", "")
    if not vapi_key or vapi_key.startswith("dummy") or vapi_key.startswith("mock"):
        # Simulated Provisioning Pipeline Response using a custom string hash
        hash_object = hashlib.md5(name.encode('utf-8'))
        return f"vapi_ast_mock_{hash_object.hexdigest()[:8]}"

    url = "https://api.vapi.ai/assistant"
    payload = {
        "name": name,
        "transcriber": {
            "provider": "deepgram",
            "model": "nova-2",
            "language": "en-US"
        },
        "model": {
            "provider": "openai",
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "system",
                    "content": prompt
                }
            ]
        },
        "voice": {
            "provider": "vapi",
            "voiceId": voice_config["voiceId"],
            "speed": voice_config["speed"]
        }
    }

    # Explicit opening. Without BOTH of these Vapi defaults to
    # firstMessageMode="assistant-speaks-first" with nothing scripted, leaving the
    # model to improvise an opener from a 12k-character system prompt — which it
    # sometimes did and sometimes did not, producing calls that connected to dead
    # air. Scripting the greeting makes the first turn deterministic.
    if first_message:
        payload["firstMessage"] = first_message
        payload["firstMessageMode"] = "assistant-speaks-first"

    if file_id:
        payload["model"]["knowledgeBase"] = {
            "provider": "canonical",
            "fileIds": [file_id]
        }
        logger.info(f"Including knowledgeBase in Vapi assistant creation payload for file_id: {file_id}")

    headers = {
        "Authorization": f"Bearer {vapi_key}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    req_body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=req_body, headers=headers, method="POST")
    
    attempts = 2
    for attempt in range(attempts):
        try:
            logger.info(f"Sending Vapi assistant creation request. Attempt {attempt + 1}/{attempts}")
            with urllib.request.urlopen(req, timeout=10) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                created_id = res_data["id"]
                logger.info(f"Vapi assistant created successfully. assistant_id: {created_id}, file_id attached: {file_id}")
                return created_id
        except urllib.error.HTTPError as e:
            status_code = e.code
            err_body = e.read().decode("utf-8") if e.fp else str(e)
            logger.warning(f"Vapi API returned HTTP {status_code} on attempt {attempt + 1}: {err_body}")
            
            # Retry on transient 5xx
            if status_code >= 500 and attempt < attempts - 1:
                time.sleep(1)
                continue
            raise VapiAPIError(status_code, err_body)
        except (urllib.error.URLError, TimeoutError) as e:
            logger.warning(f"Network error/timeout on attempt {attempt + 1}: {e}")
            if attempt < attempts - 1:
                time.sleep(1)
                continue
            raise e


from typing import Optional, Union, Any
from app.utils import sanitize_input, sanitize_profile_text
from app.scenario_library import lookup_industry, resolve_industry_entry, format_scenarios_as_rules


# ── Modular Vapi prompt composition ───────────────────────────────────────────
# The template is split into named sections (see templates/vapi_prompt_template.md).
# This module parses those sections, fills each one's variables, and emits only the
# sections it has real content for.
#
# DETERMINISM CONTRACT: no LLM call may ever be added to this path. Composition is
# conditional assembly plus literal string substitution, so the same inputs always
# produce byte-identical output. This is what makes the rendered prompt reviewable
# and stops lead-supplied text from redefining agent behavior.

# Emission order. A section absent from this list is never emitted, even if the
# template defines it.
SECTION_ORDER = [
    "opening_and_purpose",
    "patience_and_turn_taking",
    "general_role_and_tone",
    "business_context",
    "primary_purpose_and_scenarios",
    "escalation_rules",
    "follow_up_and_clarification_rules",
    "customization_notes",
    "restrictions",
    "closing_behavior",
]

# The company-specific sections. In HYBRID mode these are replaced wholesale by a
# single LLM-generated block (see compile_lead_prompt's company_context_block
# argument and app/prompt_generator.py). Everything NOT in this set is
# conversation-behaviour template text that no LLM ever writes, so it always
# brackets the generated block — restrictions included — and behaviour can never
# be redefined by the generated content.
COMPANY_SECTIONS = {
    "business_context",
    "primary_purpose_and_scenarios",
    "escalation_rules",
    "customization_notes",
}

_SECTION_RE = re.compile(
    r"<!--\s*SECTION:\s*(?P<name>[a-z_]+)\s*-->(?P<body>.*?)<!--\s*/SECTION\s*-->",
    re.DOTALL,
)
_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)

# Values that mean "the extractor found nothing", not real content.
_EMPTY_SENTINELS = {"", "UNKNOWN", "NONE", "N/A", "NULL"}


def _is_filled(value: Any) -> bool:
    """True when a profile field carries real content rather than a placeholder."""
    if value is None:
        return False
    if isinstance(value, (list, tuple, set, dict)):
        return len(value) > 0
    return str(value).strip().upper() not in _EMPTY_SENTINELS


def _normalize_profile(profile: Optional[Union[dict, Any]]) -> dict:
    """Coerces the several shapes a profile arrives in into a plain dict.

    Callers pass a CompanyProfile pydantic model, a dict decoded from the jsonb
    column, or None. The jsonb case matters: SQLModel hands back a dict already,
    so callers must not json.loads() it first.
    """
    if profile is None:
        return {}
    if isinstance(profile, dict):
        return profile
    if hasattr(profile, "model_dump"):
        return profile.model_dump()
    if hasattr(profile, "dict"):
        return profile.dict()
    return {}


def _load_template_sections() -> dict:
    """Parses the markdown template into {section_name: raw_body}."""
    template_path = os.path.join(os.path.dirname(__file__), "templates", "vapi_prompt_template.md")
    with open(template_path, "r", encoding="utf-8") as f:
        content = f.read()
    return {m.group("name"): m.group("body") for m in _SECTION_RE.finditer(content)}


def _render_section(body: str, variables: dict) -> str:
    """Strips authoring comments and substitutes {{variables}}."""
    rendered = _COMMENT_RE.sub("", body)
    for key, value in variables.items():
        rendered = rendered.replace("{{" + key + "}}", str(value))
    # Collapse the blank-line runs left behind by stripped comments and omitted lines.
    rendered = re.sub(r"\n{3,}", "\n\n", rendered)
    return rendered.strip()


def compile_lead_prompt(
    company_name: str,
    industry: str,
    profile: Optional[Union[dict, Any]] = None,
    business_brief: str = "",
    company_context_block: Optional[str] = None,
) -> str:
    """Assembles the Vapi system prompt from vetted template sections.

    HYBRID COMPOSITION
    ------------------
    The conversation-behaviour sections (opening, patience/turn-taking, tone,
    follow-ups, restrictions, closing) are ALWAYS vetted template text rendered by
    pure string substitution — no LLM writes them, ever. They are what keeps agent
    behaviour reviewable and stops lead-supplied text from redefining it.

    The company-specific sections (business context, scenarios, escalation,
    specific requests — see COMPANY_SECTIONS) are produced one of two ways:

      * company_context_block is provided (the normal path): the block was written
        by the LLM in app/prompt_generator.py from the intake form, the full
        clarification Q&A, the extracted profile and the document brief. It is
        emitted verbatim in place of the four deterministic company sections, at
        the position of the first company section in SECTION_ORDER. The behaviour
        sections still bracket it, restrictions included, so nothing in the block
        can override how the agent behaves.
      * company_context_block is None/empty (the fallback path): the four company
        sections are rendered deterministically from the profile + scenario
        library exactly as before, so a generation failure still yields a complete,
        correct prompt.

    Sections are emitted only when they have real content, so a lead with two
    profile fields gets a shorter complete prompt rather than a full-length one
    with visible gaps. core_identity and closing_behavior are unconditional.

    PRECEDENCE RULE (profile beats library, library fills gaps)
    ----------------------------------------------------------
    Where the lead's own CompanyProfile and the industry scenario library both
    speak to the same category, the profile always wins, because it is what this
    specific business told us about itself, whereas the library is a sensible
    default for businesses of that type:

      * scenario_handling — the lead's must_handle_scenarios are emitted FIRST and
        labelled as their stated priorities. Library (trigger, action) rules are
        then appended to cover situations the lead did not mention. They are
        additive, never contradictory, because library rules describe call types
        the lead simply did not think to list. If the lead named no scenarios at
        all, the section is built from library rules alone.
      * escalation_rules — the lead's escalation_preferences REPLACE the library
        default outright rather than being appended. Two competing escalation
        instructions would be worse than either alone, so only one is ever emitted.
      * business_context — carries THREE independent inputs, and none gates another:
        the industry-stakes sentence from the library, the `business_brief`
        distilled from uploaded documents by app/document_summarizer.py, and the
        profile-derived lines. The brief is emitted whether or not the five
        structured profile fields were ever filled — a lead who skipped the
        clarification questions still gets a richly-informed agent if they
        uploaded a document. The profile lines supplement the brief; they no
        longer block it.
      * customization_notes — profile-only. The library has no equivalent, and the
        section is omitted entirely when the lead gave us nothing.
    """
    sanitized_company = sanitize_input(company_name)
    sanitized_industry = sanitize_input(industry)

    prof = _normalize_profile(profile)
    # Enrich unknown industries with cached, LLM-generated INFO (display name,
    # stakes, common questions); conversation behaviour stays the vetted default.
    library = resolve_industry_entry(industry)
    sections = _load_template_sections()

    # ── business_context ──────────────────────────────────────────────────────
    # Each line is independently conditional so a partial profile yields a
    # shorter honest section rather than one padded with placeholders.
    context_lines = []
    primary_problem = prof.get("primary_problem")
    if _is_filled(primary_problem):
        context_lines.append(
            f"The problem they came to Convoa to solve: {sanitize_profile_text(str(primary_problem))}. "
            f"Keep this in mind on every call — the calls that relate to this are the ones that matter most to them."
        )
    workflow = prof.get("current_workflow_summary")
    if _is_filled(workflow):
        context_lines.append(
            f"How their calls are handled today: {sanitize_profile_text(str(workflow))}. "
            f"You are the improvement on that, so do not replicate its gaps."
        )

    # ── scenario_handling ─────────────────────────────────────────────────────
    # Profile scenarios first and explicitly labelled, then library rules to fill gaps.
    scenario_blocks = []
    lead_scenarios = prof.get("must_handle_scenarios")
    if _is_filled(lead_scenarios) and isinstance(lead_scenarios, (list, tuple)):
        cleaned = [sanitize_profile_text(str(s)).strip() for s in lead_scenarios if str(s).strip()]
        if cleaned:
            scenario_blocks.append(
                f"{sanitized_company} specifically asked that you handle these situations. "
                f"Treat them as the priority calls on this line:\n"
                + "\n".join(f"- {s}" for s in cleaned)
            )

    library_rules = format_scenarios_as_rules(library)
    if library_rules:
        lead_in = (
            f"These are the calls a {library['display_name']} line reliably gets. "
            f"Handle them this way unless the business told you otherwise:"
            if scenario_blocks
            else f"These are the calls a {library['display_name']} line reliably gets:"
        )
        scenario_blocks.append(lead_in + "\n" + "\n".join(f"- {r}" for r in library_rules))

    common_qs = library.get("common_questions") or []
    if common_qs:
        scenario_blocks.append(
            "Callers commonly ask these. Answer from the business information you were given, "
            "and take a message when you were not given it:\n"
            + "\n".join(f"- {q}" for q in common_qs)
        )

    # ── escalation_rules ──────────────────────────────────────────────────────
    # Profile REPLACES the default; the two are never concatenated.
    lead_escalation = prof.get("escalation_preferences")
    if _is_filled(lead_escalation):
        escalation_content = (
            f"{sanitized_company} told us exactly how they want this handled: "
            f"{sanitize_profile_text(str(lead_escalation))}\n\nFollow that instruction as written."
        )
    else:
        escalation_content = (
            f"{sanitized_company} has not told us their escalation preference yet, so use this "
            f"conservative default: {library['default_escalation']}\n\n"
            f"Because this is a default rather than their stated policy, do not promise a specific "
            f"person, a specific timeframe, or a live transfer."
        )

    # ── customization_notes ───────────────────────────────────────────────────
    customizations = prof.get("desired_customizations")
    customization_content = ""
    if _is_filled(customizations):
        customization_content = (
            f"They asked specifically for the following: {sanitize_profile_text(str(customizations))}"
        )

    # ── business_brief (from the document summarizer) ─────────────────────────
    # Deliberately NOT gated on the profile being complete. This is the whole
    # point of the decoupling: a document can carry the operational detail even
    # when the Q&A loop was skipped and every structured field came back UNKNOWN.
    brief_text = (business_brief or "").strip()
    brief_block = ""
    if brief_text:
        brief_block = (
            "Here is what their own operating documentation says about how they work. "
            "Treat it as authoritative:\n\n"
            f"{brief_text}"
        )

    # ── primary_purpose ───────────────────────────────────────────────────────
    # Leads the scenario section with WHY this line exists, so the rules that
    # follow are read as serving a goal rather than as a checklist.
    if _is_filled(primary_problem):
        primary_purpose = (
            f"{sanitized_company} came to us to solve one thing above all: "
            f"{sanitize_profile_text(str(primary_problem))}. "
            f"Calls that touch on this are the ones that matter most — handle them especially well."
        )
    else:
        primary_purpose = (
            f"Your job on this line is to make sure no call to {sanitized_company} goes unanswered, "
            f"and that every caller either gets what they needed or leaves details for a callback."
        )

    variables = {
        "company_name": sanitized_company,
        "industry": sanitized_industry,
        "industry_stakes": library.get("business_stakes", ""),
        "business_brief": brief_block,
        "business_context_lines": "\n\n".join(context_lines),
        "primary_purpose": primary_purpose,
        "scenario_rules": "\n\n".join(scenario_blocks),
        "escalation_content": escalation_content,
        "customization_content": customization_content,
    }

    # Sections with no real content are dropped rather than rendered empty.
    # core_identity and closing_behavior are always emitted.
    # Sections with no real content are dropped rather than rendered as empty
    # scaffolding. The behavioural sections (opening, patience, tone, follow-ups,
    # restrictions, closing) are universal and always emitted.
    has_content = {
        "opening_and_purpose": True,
        "patience_and_turn_taking": True,
        "general_role_and_tone": True,
        "business_context": bool(brief_block)
        or bool(context_lines)
        or bool(library.get("business_stakes")),
        "primary_purpose_and_scenarios": bool(scenario_blocks) or bool(primary_purpose),
        "escalation_rules": bool(escalation_content),
        "follow_up_and_clarification_rules": True,
        "customization_notes": bool(customization_content),
        "restrictions": True,
        "closing_behavior": True,
    }

    hybrid_block = (company_context_block or "").strip()
    company_block_emitted = False

    parts = []
    for name in SECTION_ORDER:
        # Hybrid path: the four company sections are collapsed into the single
        # LLM-generated block, emitted once at the position of the first company
        # section reached, and the deterministic company rendering is skipped.
        if hybrid_block and name in COMPANY_SECTIONS:
            if not company_block_emitted:
                parts.append(hybrid_block)
                company_block_emitted = True
            continue

        if not has_content.get(name):
            continue
        body = sections.get(name)
        if body is None:
            logging.getLogger(__name__).warning(
                f"Prompt template is missing section '{name}' listed in SECTION_ORDER"
            )
            continue
        parts.append(_render_section(body, variables))

    return "\n\n".join(parts) + "\n"


#: Vapi built-in voices offered to the client. Male maps to Elliot per product
#: decision; female uses Naina.
VOICE_CONFIGS = {
    "male": {"voiceId": "Elliot", "speed": 0.8},
    "female": {"voiceId": "Naina", "speed": 0.9}
}
DEFAULT_CONFIG = {"voiceId": "Naina", "speed": 0.9}


def resolve_voice_config(voice_gender: Optional[str]) -> dict:
    """Maps a stored voice preference to a Vapi voice config (id and speed), defaulting to female."""
    return VOICE_CONFIGS.get((voice_gender or "").strip().lower(), DEFAULT_CONFIG)


def compile_first_message(company_name: str) -> str:
    """The exact line the agent speaks when the call connects.

    Deterministic and intentionally identical to the greeting modelled in the
    prompt's opening_and_purpose section, so the scripted opener and the prompt
    never disagree about how the business answers its phone.
    """
    company = sanitize_input(company_name) or "this business"
    return f"Thanks for calling {company}, how can I help you today?"


def _set_stage(session, lead, status, logger) -> None:
    """Commits an intermediate provisioning stage so pollers observe it.

    Each call marks a REAL transition in the pipeline below — there is no timer
    and no simulated progression. The commit matters: the processing screen polls
    GET /api/demo-request/{id}, so an uncommitted stage would never be visible.
    """
    lead.agent_status = status
    lead.updated_at = datetime.utcnow()
    session.add(lead)
    session.commit()
    logger.info(
        f"Provisioning stage -> {status.value}",
        extra={"extra_data": {"lead_id": str(lead.id), "stage": status.value}},
    )


def provision_vapi_assistant_task(lead_id: str):
    """Background task to provision a Vapi AI assistant for the given lead."""
    logger = logging.getLogger(__name__)
    logger.info("Starting background Vapi provisioning task", extra={"extra_data": {"lead_id": lead_id}})
    
    with Session(engine) as session:
        db_lead_id = uuid.UUID(lead_id) if isinstance(lead_id, str) else lead_id
        lead = session.get(Lead, db_lead_id)
        if not lead:
            logger.error("Lead not found for provisioning", extra={"extra_data": {"lead_id": lead_id}})
            return
            
        try:
            # Recompile prompt using the finalized company profile
            from app.models import CompanyProfileDB, Document
            from sqlmodel import select
            from app.utils import sanitize_document_text
            from app.document_summarizer import summarize_documents
            from app.vapi_knowledge_base import upload_to_knowledge_base, attach_knowledge_base
            import json
            
            statement = select(CompanyProfileDB).where(CompanyProfileDB.lead_id == db_lead_id)
            profile_db = session.exec(statement).first()
            
            # company_profile.profile is a jsonb column, so SQLModel returns a dict
            # already. json.loads() on it raises TypeError, and swallowing that
            # silently meant every provisioned assistant fell back to the
            # no-profile prompt. Only decode when it really is a string.
            profile_data = None
            if profile_db and profile_db.profile:
                raw = profile_db.profile
                if isinstance(raw, dict):
                    profile_data = raw
                elif isinstance(raw, (str, bytes, bytearray)):
                    try:
                        profile_data = json.loads(raw)
                    except Exception:
                        logger.warning(
                            "Could not decode stored company profile JSON",
                            extra={"extra_data": {"lead_id": lead_id}},
                        )
                if profile_data is not None:
                    logger.info(
                        "Loaded company profile for prompt composition",
                        extra={"extra_data": {
                            "lead_id": lead_id,
                            "filled_fields": [k for k, v in profile_data.items()
                                              if v not in (None, "", "UNKNOWN", [])],
                        }},
                    )
            
            # ── Stage 1: distil uploaded documents into a business brief ──────
            # Runs BEFORE prompt assembly so the brief can be injected into it.
            # Both existing gates are preserved exactly: nothing is summarized
            # without ai_processing_consent, and nothing that sanitize_document_text
            # flagged for injection is ever passed on.
            doc_statement = select(Document).where(Document.lead_id == db_lead_id)
            docs = session.exec(doc_statement).all()

            business_brief = ""
            sanitized_text = ""
            file_id = None
            has_text = bool(docs) and any(
                d.extracted_text and d.extracted_text.strip() for d in docs
            )

            if not has_text:
                logger.info(
                    "Document stage skipped: no document with extracted text",
                    extra={"extra_data": {"lead_id": lead_id}},
                )
            elif not lead.ai_processing_consent:
                logger.info(
                    "Document stage skipped: ai_processing_consent is False",
                    extra={"extra_data": {"lead_id": lead_id}},
                )
            else:
                combined_docs_text = "\n\n".join(
                    d.extracted_text.strip()
                    for d in docs
                    if d.extracted_text and d.extracted_text.strip()
                )
                # Full-length sanitization: the old 5000-char default silently
                # discarded ~79% of a long SOP. Length is handled by summarization.
                sanitized_text, was_flagged, match_count, pattern_names = sanitize_document_text(
                    combined_docs_text
                )
                if was_flagged:
                    logger.warning(
                        "Document rejected due to prompt injection flags — not summarized, not uploaded",
                        extra={"extra_data": {
                            "lead_id": lead_id,
                            "match_count": match_count,
                            "patterns": pattern_names,
                        }},
                    )
                    sanitized_text = ""
                else:
                    _set_stage(session, lead, AgentStatus.summarizing_documents, logger)
                    business_brief = summarize_documents(
                        sanitized_text,
                        lead.company_name,
                        lead.industry,
                        lead_id=str(lead_id),
                    )
                    logger.info(
                        "Document brief produced",
                        extra={"extra_data": {
                            "lead_id": lead_id,
                            "input_chars": len(sanitized_text),
                            "brief_chars": len(business_brief),
                        }},
                    )

            # ── Stage 2: assemble the prompt (hybrid: template + LLM block) ───
            # The LLM writes only the company-specific block from everything we
            # gathered; the behaviour sections stay vetted template text and
            # bracket it. On any generation failure the block is "" and
            # compile_lead_prompt falls back to deterministic company sections,
            # so provisioning never breaks on a degraded generator.
            _set_stage(session, lead, AgentStatus.building_profile, logger)

            from app.models import ClarificationMessage
            from app.prompt_generator import generate_company_context_block

            msg_stmt = (
                select(ClarificationMessage)
                .where(ClarificationMessage.lead_id == db_lead_id)
                .order_by(ClarificationMessage.created_at.asc())
            )
            clar_msgs = session.exec(msg_stmt).all()
            conversation_history = [
                {"role": m.role.value, "content": m.content} for m in clar_msgs
            ]

            library = resolve_industry_entry(lead.industry)
            company_context_block = generate_company_context_block(
                lead.company_name,
                lead.industry,
                profile_data,
                business_brief=business_brief,
                conversation_history=conversation_history,
                library=library,
                voice_gender=getattr(lead, "voice_gender", None),
                lead_id=str(lead_id),
            )
            if company_context_block:
                logger.info(
                    "Company context block generated by LLM",
                    extra={"extra_data": {"lead_id": lead_id, "block_chars": len(company_context_block)}},
                )
            else:
                logger.warning(
                    "Company context block empty — falling back to deterministic company sections",
                    extra={"extra_data": {"lead_id": lead_id}},
                )

            rendered_prompt = compile_lead_prompt(
                lead.company_name,
                lead.industry,
                profile_data,
                business_brief=business_brief,
                company_context_block=company_context_block,
            )
            lead.rendered_prompt = rendered_prompt

            # ── Knowledge base upload (reuses the same sanitized text) ────────
            if sanitized_text:
                doc_obj = docs[0]
                fname = getattr(doc_obj, "file_name", None)
                if not fname and doc_obj.file_url:
                    base = os.path.basename(doc_obj.file_url)
                    fname = base.split("_", 1)[1] if "_" in base and len(base.split("_", 1)[0]) == 36 else base
                primary_filename = fname or "document.txt"
                file_id = upload_to_knowledge_base(
                    sanitized_text, str(lead_id), filename=primary_filename
                )
                if file_id:
                    logger.info(
                        f"Document uploaded to Vapi Files library. file_id: {file_id}, filename: {primary_filename}",
                        extra={"extra_data": {"lead_id": lead_id, "file_id": file_id, "filename": primary_filename}},
                    )

            # ── Stage 3: provision the voice agent ────────────────────────────
            _set_stage(session, lead, AgentStatus.provisioning, logger)
            assistant_name = f"Convoa AI - {lead.company_name}"[:40]
            assistant_id = _call_vapi_create_assistant(
                assistant_name,
                rendered_prompt,
                file_id=file_id,
                first_message=compile_first_message(lead.company_name),
                voice_config=resolve_voice_config(getattr(lead, "voice_gender", None)),
            )
            
            lead.assistant_id = assistant_id
            lead.agent_status = AgentStatus.active
            session.add(lead)
            session.commit()
            logger.info(f"Vapi assistant provisioned successfully. assistant_id: {assistant_id}, file_id: {file_id}", extra={"extra_data": {"lead_id": lead_id, "assistant_id": assistant_id, "file_id": file_id}})

            # Fallback/verification attach call if file_id exists
            if file_id:
                try:
                    attached = attach_knowledge_base(assistant_id, file_id, prompt=rendered_prompt)
                    if attached:
                        logger.info(f"Knowledge Base attached to Vapi assistant successfully. assistant_id: {assistant_id}, file_id: {file_id}", extra={"extra_data": {"lead_id": lead_id, "assistant_id": assistant_id, "file_id": file_id}})
                    else:
                        logger.warning(f"KB attach update call returned False for assistant_id: {assistant_id}", extra={"extra_data": {"lead_id": lead_id, "assistant_id": assistant_id, "file_id": file_id}})
                except Exception as attach_err:
                    logger.warning(f"Non-blocking error during fallback KB attach: {attach_err}", extra={"extra_data": {"lead_id": lead_id, "assistant_id": assistant_id, "file_id": file_id}})
        except VapiAPIError as e:
            lead.agent_status = AgentStatus.failed
            lead.failure_reason = str(e)
            session.add(lead)
            session.commit()
            logger.error("Vapi assistant provisioning failed persistently (HTTP error)", extra={"extra_data": {"lead_id": lead_id, "status_code": e.status_code}})
        except Exception as e:
            lead.agent_status = AgentStatus.failed
            lead.failure_reason = f"Provisioning error: {str(e)}"
            session.add(lead)
            session.commit()
            logger.error("Vapi assistant provisioning failed persistently", extra={"extra_data": {"lead_id": lead_id}}, exc_info=True)


def delete_vapi_assistant(assistant_id: str) -> None:
    """Synchronous deletion of Vapi assistant.
    
    Implements retries on transient errors and fails immediately on persistent errors.
    """
    logger = logging.getLogger(__name__)
    logger.info("Starting Vapi assistant deletion", extra={"extra_data": {"assistant_id": assistant_id}})
    
    if not assistant_id:
        logger.warning("Empty assistant_id provided for deletion")
        return
        
    if assistant_id.startswith("vapi_ast_mock_"):
        logger.info("Simulating successful deletion of mock assistant", extra={"extra_data": {"assistant_id": assistant_id}})
        return
        
    vapi_key = os.getenv("VAPI_API_KEY", "")
    if not vapi_key:
        logger.warning("No VAPI_API_KEY configured. Skipping deletion.")
        return
        
    url = f"https://api.vapi.ai/assistant/{assistant_id}"
    headers = {
        "Authorization": f"Bearer {vapi_key}",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    req = urllib.request.Request(url, headers=headers, method="DELETE")
    
    attempts = 2
    for attempt in range(attempts):
        try:
            logger.info(f"Attempting Vapi assistant deletion. Attempt {attempt + 1}/{attempts}", extra={"extra_data": {"assistant_id": assistant_id}})
            with urllib.request.urlopen(req, timeout=10) as response:
                logger.info("Vapi assistant deleted successfully", extra={"extra_data": {"assistant_id": assistant_id}})
                return
        except urllib.error.HTTPError as e:
            status_code = e.code
            err_body = e.read().decode("utf-8") if e.fp else str(e)
            logger.warning(f"Vapi API delete returned HTTP {status_code} on attempt {attempt + 1}", extra={"extra_data": {"assistant_id": assistant_id, "response": err_body}})
            
            # Retry once on 5xx transient failures
            if status_code >= 500 and attempt < attempts - 1:
                time.sleep(1)
                continue
            
            # Persistent 4xx or retries exhausted
            logger.error("Vapi assistant deletion failed persistently", extra={"extra_data": {"assistant_id": assistant_id, "status_code": status_code}})
            raise e
        except (urllib.error.URLError, TimeoutError) as e:
            logger.warning(f"Network error/timeout on delete attempt {attempt + 1}: {e}", extra={"extra_data": {"assistant_id": assistant_id}})
            if attempt < attempts - 1:
                time.sleep(1)
                continue
            
            logger.error("Vapi assistant deletion failed persistently due to network error", extra={"extra_data": {"assistant_id": assistant_id}})
            raise e

