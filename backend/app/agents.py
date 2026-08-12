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
from app.prompt_lint import lint_compiled_prompt

VAPI_API_KEY = os.getenv("VAPI_API_KEY", "")


def _document_content_type(filename: str) -> str:
    """Maps a document filename to the MIME type Vapi's /file part must declare.

    Only PDF and TXT are accepted at upload time (see main.py), so those are the
    real cases; anything else falls back to a generic binary type.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext == "pdf":
        return "application/pdf"
    if ext == "txt":
        return "text/plain"
    return "application/octet-stream"


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
            "model": "gpt-4.1",
            "voice": "vapi/Naina",
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
            "model": "gpt-4.1",
            "voice": "vapi/Naina",
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
    file_ids: Optional[list] = None,
    first_message: Optional[str] = None,
    voice_config: dict = None,
) -> str:
    """Creates a Vapi assistant using the API.

    Includes mock fallback if key is missing/mock, and retry logic on transient errors.
    If file_ids is provided (one or more Vapi file ids), includes knowledgeBase
    directly in the creation payload with all of them attached.
    Returns the assistant_id.
    """
    if voice_config is None:
        voice_config = {"voiceId": "Naina", "speed": 1.0}

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
            "model": "gpt-4.1",
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
            # Vapi native TTS "version 2" model: noticeably more human and
            # consistent than v1 (and cheaper). It is opt-in per assistant via
            # this field — without it Vapi falls back to the older v1 model. v2
            # is human-sounding by default, superseding v1's "humanness" tuning
            # (which is not a v2 API parameter).
            "version": 2,
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

    if file_ids:
        payload["model"]["knowledgeBase"] = {
            "provider": "canonical",
            "fileIds": file_ids
        }
        logger.info(f"Including knowledgeBase in Vapi assistant creation payload for file_ids: {file_ids}")

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
                logger.info(f"Vapi assistant created successfully. assistant_id: {created_id}, file_ids attached: {file_ids}")
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
    "data_capture_policy",
    "escalation_rules",
    "follow_up_and_clarification_rules",
    "customization_notes",
    "kb_discipline",
    "knowledge_base_directive",
    "restrictions",
    "closing_behavior",
]

# The VARIABLE-layer sections — filled from per-business slots and dropped when a
# slot has no real content. Everything NOT in this set is INVARIANT behaviour
# text that no LLM ever writes and that is always emitted (a rule per section,
# each stated exactly once — enforced by app/prompt_lint.py). The variable
# sections carry only {{slots}}; the LLM may write the four content fields those
# slots are filled from (greeting_line, business_context, escalation_terms,
# escalation_action) but never the structure or any invariant block.
COMPANY_SECTIONS = {
    "business_context",
    "primary_purpose_and_scenarios",
    "escalation_rules",
    "customization_notes",
}

# Tolerant of an optional `RULE: <ids>` clause after the section name in the
# marker — the rule ids document which invariant block owns which rule; the lint
# uses distinctive sentinels (app/prompt_lint.py), not this parse.
_SECTION_RE = re.compile(
    r"<!--\s*SECTION:\s*(?P<name>[a-z_]+)[^>]*?-->(?P<body>.*?)<!--\s*/SECTION\s*-->",
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


def _clean_field(value: Any) -> str:
    """A trimmed string, or '' if the value is empty or an UNKNOWN-style sentinel."""
    if value is None:
        return ""
    s = str(value).strip()
    return "" if s.upper() in _EMPTY_SENTINELS else s


def _join_terms(terms: list) -> str:
    """Renders escalation triggers as a natural 'a, b, or c' phrase."""
    cleaned = [str(t).strip() for t in (terms or []) if str(t).strip()]
    if not cleaned:
        return "anything the caller clearly presents as an emergency or as urgent"
    if len(cleaned) == 1:
        return cleaned[0]
    if len(cleaned) == 2:
        return f"{cleaned[0]} or {cleaned[1]}"
    return ", ".join(cleaned[:-1]) + f", or {cleaned[-1]}"


def _deterministic_business_context(company: str, prof: dict) -> str:
    """The 2-3 sentence business-context slot when no generated field is supplied.

    Built only from profile fields the business actually gave us — never invented,
    never pulled from KB text. The industry-stakes line in the template already
    frames the sector, so an all-UNKNOWN profile simply yields an empty slot.
    """
    lines = []
    services = prof.get("services_and_offerings")
    if _is_filled(services):
        lines.append(f"{company} provides {sanitize_profile_text(str(services))}.")
    problem = prof.get("primary_problem")
    if _is_filled(problem):
        lines.append(
            f"The problem they came to Convoa to solve is {sanitize_profile_text(str(problem))} — "
            f"the calls that relate to it are the ones that matter most to them."
        )
    scenarios = prof.get("must_handle_scenarios")
    if _is_filled(scenarios) and isinstance(scenarios, (list, tuple)):
        cleaned = [sanitize_profile_text(str(s)).strip() for s in scenarios if str(s).strip()]
        if cleaned:
            # Descriptive — the calls the business said matter most, not an if-then
            # branch (retrieval + the generic capture rule handle topic coverage).
            lines.append("The calls they most want handled well include: " + ", ".join(cleaned) + ".")
    workflow = prof.get("current_workflow_summary")
    if _is_filled(workflow):
        lines.append(
            f"Today their calls are handled like this: {sanitize_profile_text(str(workflow))}. "
            f"You are the improvement on that, so do not replicate its gaps."
        )
    return " ".join(lines)


def compile_lead_prompt(
    company_name: str,
    industry: str,
    profile: Optional[Union[dict, Any]] = None,
    business_brief: str = "",
    content_fields: Optional[dict] = None,
    has_documents: bool = False,
) -> str:
    """Assembles the Vapi system prompt as two layers: invariant + variable.

    TWO LAYERS
    ----------
    The INVARIANT behaviour sections (opening, turn-taking, speech style, KB
    discipline, generic data capture, follow-ups, restrictions, closing, and the
    conditional KB retrieval directive) are vetted template text rendered by pure
    substitution — no LLM writes them, ever. Each owns its rule exactly once,
    enforced by app/prompt_lint.py.

    The VARIABLE sections carry only {{slots}} filled per business:
      * Identity — {{business_name}}, {{industry}}, and the optional hours/address
        notes — is SINGLE-SOURCED from intake + profile, never from KB text. That
        is what stops a document letterhead drifting from the intake name.
      * The four CONTENT fields — greeting_line, business_context, escalation_terms,
        escalation_action — come from `content_fields` when a (constrained,
        lint-gated) LLM produced them, and otherwise from a deterministic fallback
        built from the profile + scenario library. Either way they are just text
        dropped into fixed slots; they can never alter structure or an invariant
        block.

    PRECEDENCE (business's own words > generated > library default)
    --------------------------------------------------------------
      * escalation_action — the lead's stated escalation_preferences win; then the
        generated field; then the library's conservative default.
      * escalation_terms — generated/stated triggers win; otherwise the industry
        library's vetted default triggers.
      * customization — profile-only and deterministic; the section is omitted when
        the business asked for nothing.
    """
    sanitized_company = sanitize_input(company_name)
    sanitized_industry = sanitize_input(industry)

    prof = _normalize_profile(profile)
    # Enrich unknown industries with cached, LLM-generated INFO (display name,
    # stakes, escalation-term defaults); conversation behaviour stays the vetted default.
    library = resolve_industry_entry(industry)
    sections = _load_template_sections()
    cf = content_fields or {}

    # ── identity notes (single-sourced from intake/profile; never from LLM/KB) ──
    hours = prof.get("hours_and_availability")
    hours_note = f" They operate {sanitize_profile_text(str(hours))}." if _is_filled(hours) else ""
    address = prof.get("service_area_and_locations")
    address_note = f" They serve {sanitize_profile_text(str(address))}." if _is_filled(address) else ""

    # ── greeting_line ─────────────────────────────────────────────────────────
    greeting_line = _clean_field(cf.get("greeting_line")) or (
        f"Thanks for calling {sanitized_company}, how can I help you today?"
    )

    # ── business_context (2-3 sentences) ──────────────────────────────────────
    business_context = _clean_field(cf.get("business_context")) or _deterministic_business_context(
        sanitized_company, prof
    )

    # ── escalation terms + action (stated > generated > library default) ──────
    gen_terms = cf.get("escalation_terms")
    if isinstance(gen_terms, (list, tuple)) and any(str(t).strip() for t in gen_terms):
        escalation_terms = _join_terms([sanitize_profile_text(str(t)) for t in gen_terms if str(t).strip()])
    else:
        escalation_terms = _join_terms(library.get("escalation_terms") or [])

    escalation_action = _clean_field(cf.get("escalation_action"))
    if not escalation_action:
        lead_escalation = prof.get("escalation_preferences")
        escalation_action = (
            sanitize_profile_text(str(lead_escalation))
            if _is_filled(lead_escalation)
            else library.get("default_escalation", "")
        )

    # ── customization (deterministic, profile only) ───────────────────────────
    customizations = prof.get("desired_customizations")
    customization_content = (
        f"They asked specifically for the following: {sanitize_profile_text(str(customizations))}"
        if _is_filled(customizations)
        else ""
    )

    # ── primary purpose (frames the line) ─────────────────────────────────────
    primary_problem = prof.get("primary_problem")
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

    # ── business_brief slot: KB-referral notice with docs, inline brief without ─
    brief_text = (business_brief or "").strip()
    if has_documents:
        brief_block = (
            "Detailed operating documentation for this business is available to you during the call. "
            "When a caller asks about services, procedures, prices, hours, or policies, use it for the "
            "authoritative answer rather than guessing."
        )
    elif brief_text:
        brief_block = (
            "Here is what their own operating documentation says about how they work. "
            "Treat it as authoritative:\n\n"
            f"{brief_text}"
        )
    else:
        brief_block = ""

    variables = {
        "business_name": sanitized_company,
        "industry": sanitized_industry,
        "hours_note": hours_note,
        "address_note": address_note,
        "industry_stakes": library.get("business_stakes", ""),
        "greeting_line": greeting_line,
        "business_context": business_context,
        "business_brief": brief_block,
        "primary_purpose": primary_purpose,
        "escalation_terms": escalation_terms,
        "escalation_action": escalation_action,
        "customization_content": customization_content,
    }

    # Invariant sections are always emitted. Variable sections drop out only when
    # their slot genuinely has nothing (an empty customization ask, a lead with no
    # escalation info at all). knowledge_base_directive is gated on documents.
    has_content = {
        "opening_and_purpose": True,
        "patience_and_turn_taking": True,
        "general_role_and_tone": True,
        "business_context": True,
        "primary_purpose_and_scenarios": True,
        "data_capture_policy": True,
        "escalation_rules": bool(escalation_terms and escalation_action),
        "follow_up_and_clarification_rules": True,
        "customization_notes": bool(customization_content),
        "kb_discipline": True,
        "knowledge_base_directive": has_documents,
        "restrictions": True,
        "closing_behavior": True,
    }

    parts = []
    for name in SECTION_ORDER:
        if not has_content.get(name):
            continue
        body = sections.get(name)
        if body is None:
            logging.getLogger(__name__).warning(
                f"Prompt template is missing section '{name}' listed in SECTION_ORDER"
            )
            continue
        parts.append(_render_section(body, variables))

    compiled = "\n\n".join(parts) + "\n"

    # Lint is advisory here: the deterministic path cannot drift, but a duplicate
    # rule reintroduced by a template edit should surface loudly in the logs.
    try:
        violations = lint_compiled_prompt(compiled, has_documents=has_documents)
        if violations:
            logging.getLogger(__name__).warning(
                "Compiled prompt lint violations: %s", "; ".join(violations)
            )
    except Exception:
        logging.getLogger(__name__).debug("Prompt lint skipped due to error", exc_info=True)

    return compiled


#: Vapi built-in voices offered to the client. Male maps to Elliot per product
#: decision; female uses Naina.
VOICE_CONFIGS = {
    "male": {"voiceId": "Elliot", "speed": 1.0},
    "female": {"voiceId": "Naina", "speed": 1.0}
}
DEFAULT_CONFIG = {"voiceId": "Naina", "speed": 1.0}


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
            from app.storage import download_document
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
            # Reuses pre-summarized brief from DB if available.
            doc_statement = select(Document).where(Document.lead_id == db_lead_id)
            docs = session.exec(doc_statement).all()

            business_brief = ""
            if profile_db and profile_db.business_brief:
                business_brief = profile_db.business_brief
                logger.info(
                    "Reusing pre-summarized business brief from database",
                    extra={"extra_data": {"lead_id": lead_id, "brief_chars": len(business_brief)}},
                )

            sanitized_text = ""
            file_ids = []
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
                    business_brief = ""
                elif not business_brief:
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
                    # Persist the generated brief to DB for future reference
                    if profile_db:
                        profile_db.business_brief = business_brief
                        profile_db.updated_at = datetime.utcnow()
                        session.add(profile_db)
                        session.commit()
                        logger.info(
                            "Persisted new business brief to database",
                            extra={"extra_data": {"lead_id": lead_id, "brief_chars": len(business_brief)}},
                        )

            # ── Stage 2: assemble the prompt (hybrid: template + LLM block) ───
            # The LLM writes only the company-specific block from everything we
            # gathered; the behaviour sections stay vetted template text and
            # bracket it. On any generation failure the block is "" and
            # compile_lead_prompt falls back to deterministic company sections,
            # so provisioning never breaks on a degraded generator.
            _set_stage(session, lead, AgentStatus.building_profile, logger)

            from app.models import ClarificationMessage
            from app.prompt_generator import generate_company_content_fields

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
            # has_documents is True when uploaded documents passed sanitisation
            # and will be sent to the Vapi Knowledge Base. This flag tells
            # compile_lead_prompt to emit the KB directive section instead of
            # embedding the brief, and tells the generator to keep business_context
            # high-level rather than quoting document specifics.
            has_documents = bool(sanitized_text)

            content_fields = generate_company_content_fields(
                lead.company_name,
                lead.industry,
                profile_data,
                business_brief=business_brief,
                conversation_history=conversation_history,
                library=library,
                voice_gender=getattr(lead, "voice_gender", None),
                lead_id=str(lead_id),
                has_documents=has_documents,
            )
            if content_fields:
                logger.info(
                    "Company content fields generated by LLM",
                    extra={"extra_data": {"lead_id": lead_id, "fields": list(content_fields.keys())}},
                )
            else:
                logger.warning(
                    "Company content fields empty — falling back to deterministic slots",
                    extra={"extra_data": {"lead_id": lead_id}},
                )

            rendered_prompt = compile_lead_prompt(
                lead.company_name,
                lead.industry,
                profile_data,
                business_brief=business_brief,
                content_fields=content_fields,
                has_documents=has_documents,
            )
            lead.rendered_prompt = rendered_prompt

            # ── Knowledge base upload (RAW original files, not extracted text) ─
            # Gated by the same conditions as the brief: consent given and the
            # combined extracted text was not injection-flagged (sanitized_text
            # truthy). But instead of sending flattened text, each document's
            # ORIGINAL uploaded file is fetched byte-for-byte from Supabase and
            # uploaded to Vapi so Vapi indexes the real PDF/TXT. Every uploaded
            # document is attached, not just the first.
            if sanitized_text:
                for doc_obj in docs:
                    fname = getattr(doc_obj, "file_name", None)
                    if not fname and doc_obj.file_url:
                        base = os.path.basename(doc_obj.file_url)
                        fname = base.split("_", 1)[1] if "_" in base and len(base.split("_", 1)[0]) == 36 else base
                    primary_filename = fname or "document.txt"
                    content_type = _document_content_type(primary_filename)

                    raw_bytes = download_document(doc_obj.file_url) if doc_obj.file_url else None

                    if raw_bytes:
                        # Preferred path: the original file was persisted to Supabase
                        # Storage, so send it to Vapi byte-for-byte with its true type.
                        upload_bytes = raw_bytes
                        upload_filename = primary_filename
                        upload_content_type = content_type
                        source = "raw file"
                    else:
                        # Fallback path: Supabase Storage is unavailable (e.g. the
                        # service key is a dummy/mock, so the original file was never
                        # actually stored and can't be downloaded). Rather than drop
                        # the document from the assistant's knowledge base entirely,
                        # upload the extracted text as a .txt so the KB is still
                        # populated. The per-document text is re-sanitized here so the
                        # prompt-injection guard stays in force on this path too.
                        doc_text = (doc_obj.extracted_text or "").strip()
                        clean_text, was_flagged, _match_count, _patterns = (
                            sanitize_document_text(doc_text) if doc_text else ("", False, 0, [])
                        )
                        if not clean_text or was_flagged:
                            logger.warning(
                                f"Could not fetch raw bytes for document '{primary_filename}' and no usable "
                                f"extracted text to fall back to — skipping its KB upload",
                                extra={"extra_data": {"lead_id": lead_id, "filename": primary_filename, "file_url": doc_obj.file_url, "text_flagged": was_flagged}},
                            )
                            continue
                        upload_bytes = clean_text.encode("utf-8")
                        # We're sending text, not the original file, so name it .txt
                        # and label it text/plain to match what's actually uploaded.
                        upload_filename = primary_filename.rsplit(".", 1)[0] + ".txt"
                        upload_content_type = "text/plain"
                        source = "extracted-text fallback (Supabase Storage unavailable)"

                    file_id = upload_to_knowledge_base(
                        upload_bytes,
                        filename=upload_filename,
                        content_type=upload_content_type,
                        lead_id=str(lead_id),
                    )
                    if file_id:
                        file_ids.append(file_id)
                        logger.info(
                            f"Document sent to Vapi Files library via {source}. file_id: {file_id}, filename: {upload_filename}, content_type: {upload_content_type}, bytes: {len(upload_bytes)}",
                            extra={"extra_data": {"lead_id": lead_id, "file_id": file_id, "filename": upload_filename, "content_type": upload_content_type, "source": source}},
                        )

            # ── Stage 3: provision the voice agent ────────────────────────────
            _set_stage(session, lead, AgentStatus.provisioning, logger)
            assistant_name = f"Convoa AI - {lead.company_name}"[:40]
            assistant_id = _call_vapi_create_assistant(
                assistant_name,
                rendered_prompt,
                file_ids=file_ids,
                first_message=compile_first_message(lead.company_name),
                voice_config=resolve_voice_config(getattr(lead, "voice_gender", None)),
            )

            lead.assistant_id = assistant_id
            lead.agent_status = AgentStatus.active
            session.add(lead)
            session.commit()
            logger.info(f"Vapi assistant provisioned successfully. assistant_id: {assistant_id}, file_ids: {file_ids}", extra={"extra_data": {"lead_id": lead_id, "assistant_id": assistant_id, "file_ids": file_ids}})

            # Fallback/verification attach call if any files were uploaded
            if file_ids:
                try:
                    attached = attach_knowledge_base(assistant_id, file_ids, prompt=rendered_prompt)
                    if attached:
                        logger.info(f"Knowledge Base attached to Vapi assistant successfully. assistant_id: {assistant_id}, file_ids: {file_ids}", extra={"extra_data": {"lead_id": lead_id, "assistant_id": assistant_id, "file_ids": file_ids}})
                    else:
                        logger.warning(f"KB attach update call returned False for assistant_id: {assistant_id}", extra={"extra_data": {"lead_id": lead_id, "assistant_id": assistant_id, "file_ids": file_ids}})
                except Exception as attach_err:
                    logger.warning(f"Non-blocking error during fallback KB attach: {attach_err}", extra={"extra_data": {"lead_id": lead_id, "assistant_id": assistant_id, "file_ids": file_ids}})
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

