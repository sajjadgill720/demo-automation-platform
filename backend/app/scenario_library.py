"""Vetted, human-written scenario library for Convoa voice agents.

WHY THIS FILE EXISTS
--------------------
Two consumers need to know "what does a real caller to this kind of business
actually ask for, and what should happen next":

  1. compile_lead_prompt() — when a lead skipped clarification or left gaps, the
     rendered Vapi system prompt still needs concrete, industry-correct call
     handling instead of "answer questions about {industry} helpfully".
  2. generate_question() in clarification.py — the question-generation LLM writes
     sharper questions when it can see what a real deployment in this industry
     has to cover, and it must NOT ask about things this library already answers.

EDITING RULES (important — read before changing entries)
-------------------------------------------------------
* Everything here is HUMAN-WRITTEN and reviewed. Nothing in this file is ever
  produced by an LLM at runtime. That is the whole point: it is the vetted half
  of the prompt, so a model can never talk the agent into new behavior.
* `caller_scenarios` entries are (trigger, action) pairs and must stay written as
  explicit if-this-then-that. "Handle emergencies well" is not an action.
  "Offer the first available emergency slot, then text the on-call tech" is.
* `default_escalation` is the documented fallback used ONLY when the lead never
  told us their real escalation preference. Keep it conservative: take a message
  and promise a callback. Never invent a phone number, a person, or an SLA.
* Keep actions demo-safe. The agent is running a demo line, so it must never
  claim to have actually dispatched a truck, charged a card, or booked into a
  real calendar.
"""

import json
import logging
import os
from typing import Any, Dict, List, Optional

logger = logging.getLogger("app.scenario_library")

# ── Canonical industry entries ────────────────────────────────────────────────
# `aliases` are matched case-insensitively as substrings against the free-text
# industry string the lead typed, so "HVAC & Climate Control" and "hvac services"
# both resolve to the hvac entry.
#
# `specificity` breaks ties when a lead's industry string matches more than one
# entry. Higher wins. It exists because leads write things like
# "Dental & Healthcare", which matches both `dental` and the `healthcare`
# umbrella; without it, longest-alias-wins would hand a dental practice the
# generic medical playbook. Give an umbrella category 1 and a specific trade 2.

SCENARIO_LIBRARY: Dict[str, Dict[str, Any]] = {
    "hvac": {
        "specificity": 2,
        "display_name": "HVAC & climate control",
        "aliases": ["hvac", "climate control", "heating", "air conditioning", "furnace"],
        "business_stakes": (
            "HVAC demand is weather-driven and time-critical. A no-heat call in winter or a "
            "no-cool call in a heatwave is an emergency to the caller, and they will phone the "
            "next company on the list within minutes if nobody picks up."
        ),
        "caller_scenarios": [
            ("a caller says their system has stopped working entirely (no heat, no cool)",
             "treat it as urgent: confirm the property address, ask whether anyone in the home is "
             "elderly, very young, or medically vulnerable, and offer the earliest emergency slot "
             "before offering a routine appointment"),
            ("a caller asks for a price or a quote over the phone",
             "explain that exact pricing depends on the unit and the fault, give the diagnostic "
             "visit fee only if it is in the provided business information, and never invent a number"),
            ("a caller wants routine maintenance or a seasonal tune-up",
             "treat it as non-urgent, collect their preferred day and time window, and confirm the "
             "property address"),
            ("a caller is chasing a technician who has not arrived",
             "apologise, take the job details, and escalate rather than guessing at an arrival time"),
            ("a caller reports a gas smell, a burning smell, or a carbon monoxide alarm",
             "tell them to leave the property and call their gas emergency line or 911 immediately, "
             "then end the call — never book this as an appointment"),
        ],
        "default_escalation": (
            "Take the caller's name, callback number, property address, and a short description of "
            "the fault, then tell them the on-call team will call back. Do not promise a specific "
            "arrival time."
        ),
        "escalation_terms": [
            "a complete loss of heating or cooling",
            "a gas smell, a burning smell, or a carbon-monoxide alarm",
        ],
        "common_questions": [
            "Do you charge a diagnostic or call-out fee?",
            "How soon can someone get here?",
            "Do you service my brand of unit?",
            "Is the repair covered under my warranty?",
        ],
    },
    "dental": {
        "specificity": 2,
        "display_name": "dental practice",
        "aliases": ["dental", "dentist", "orthodont", "oral"],
        "business_stakes": (
            "Dental calls split sharply between routine scheduling and genuine pain. Mishandling a "
            "pain call is both a clinical and a reputational risk, and most practices lose new-patient "
            "revenue to whoever answers the phone first."
        ),
        "caller_scenarios": [
            ("a caller describes severe pain, swelling, bleeding, or a knocked-out tooth",
             "treat it as an urgent clinical call: take their name and callback number first, then "
             "follow the practice's emergency instruction — do not offer routine scheduling advice"),
            ("a new patient asks whether the practice is taking new patients",
             "confirm warmly, collect name, phone, email, and the reason for the visit, and explain "
             "what happens next"),
            ("a caller asks whether their insurance is accepted",
             "only name plans that appear in the provided business information; otherwise take their "
             "insurer's name and confirm that the office will verify coverage and call back"),
            ("a caller wants to reschedule or cancel an appointment",
             "collect the patient name and the existing appointment day, and confirm the change will "
             "be passed to the front desk"),
            ("a caller asks for clinical advice such as whether they need a root canal",
             "decline politely, explain that a dentist has to assess it, and offer to book them in"),
        ],
        "default_escalation": (
            "Take the patient's name, callback number, and a short description of the problem, and "
            "tell them the practice will call back. For anything involving significant pain or "
            "swelling, say clearly that the message will be passed on as urgent."
        ),
        "escalation_terms": [
            "severe pain, swelling, or bleeding",
            "a knocked-out tooth",
        ],
        "common_questions": [
            "Do you take my insurance?",
            "Are you accepting new patients?",
            "How much is a cleaning or a check-up?",
            "Can I be seen today?",
        ],
    },
    "healthcare": {
        "specificity": 1,
        "display_name": "healthcare / medical practice",
        "aliases": ["healthcare", "health care", "medical", "clinic", "physician", "doctor", "wellness"],
        "business_stakes": (
            "Medical front desks are the first filter between a worried caller and clinical staff. "
            "The agent has to be genuinely useful on scheduling while staying firmly out of anything "
            "that resembles medical advice or a privacy breach."
        ),
        "caller_scenarios": [
            ("a caller describes symptoms that sound like an emergency (chest pain, breathing "
             "difficulty, severe bleeding, stroke signs)",
             "tell them to hang up and call 911 or go to the nearest emergency room immediately, and "
             "do not attempt to book an appointment"),
            ("a caller asks for medical advice or for test results",
             "explain that clinical staff have to handle that, take their name and callback number, "
             "and pass the message on — never speculate and never read back any record"),
            ("a caller wants to book, move, or cancel an appointment",
             "collect patient name, callback number, and preferred timing, and confirm what happens next"),
            ("a caller asks about billing or what they owe",
             "take their name and number and route it to the billing team rather than quoting figures"),
            ("a caller asks for someone else's information",
             "politely decline and explain that patient information can only be discussed with the "
             "patient or an authorised contact"),
        ],
        "default_escalation": (
            "Take the caller's name, callback number, and reason for calling, and tell them a member "
            "of staff will return the call. Flag anything clinical as urgent rather than triaging it."
        ),
        "escalation_terms": [
            "chest pain, breathing difficulty, severe bleeding, or signs of a stroke",
        ],
        "common_questions": [
            "Can I get an appointment this week?",
            "Do you accept my insurance?",
            "Are my test results back?",
            "What are your opening hours?",
        ],
    },
    "legal": {
        "specificity": 2,
        "display_name": "legal services",
        "aliases": ["legal", "law", "attorney", "solicitor", "lawyer", "litigation", "paralegal"],
        "business_stakes": (
            "Law firms win or lose matters on intake speed, but every inbound call is also a conflicts "
            "and privilege risk. The agent's job is to capture the matter cleanly and hand it to a "
            "human — never to advise, and never to imply the firm has taken the case on."
        ),
        "caller_scenarios": [
            ("a prospective client describes their situation and asks what they should do",
             "listen, capture the facts, and explain clearly that an attorney has to review it before "
             "any advice can be given — do not offer any legal opinion, however obvious it seems"),
            ("a caller asks whether the firm will take their case",
             "explain that intake has to run a conflicts check first, then collect their name, contact "
             "details, the other parties involved, and a short description of the matter"),
            ("a caller mentions a filing deadline, a court date, or a statute of limitations",
             "treat it as time-critical, capture the exact date, and escalate immediately rather than "
             "scheduling a routine callback"),
            ("a caller asks what representation will cost",
             "give only the consultation fee structure present in the provided business information, "
             "and otherwise explain that fees depend on the matter and will be confirmed by the firm"),
            ("an existing client calls asking for an update on their matter",
             "confirm their name and matter, then take a message for their attorney rather than "
             "discussing any case detail"),
        ],
        "default_escalation": (
            "Capture the caller's name, callback number, the names of any other parties involved, and "
            "a short factual summary of the matter, then confirm that the intake team will follow up. "
            "Escalate anything with a stated deadline as urgent."
        ),
        "escalation_terms": [
            "a filing deadline, a court date, or a statute of limitations",
        ],
        "common_questions": [
            "Do you handle this type of case?",
            "What do you charge for a consultation?",
            "How long will my case take?",
            "Can I speak to my attorney?",
        ],
    },
    "logistics": {
        "specificity": 2,
        "display_name": "logistics, freight & transport",
        "aliases": ["logistics", "freight", "transport", "trucking", "shipping", "supply chain",
                    "courier", "haulage", "delivery", "fleet"],
        "business_stakes": (
            "Freight phones carry a constant mix of tracking chases, rate shopping, and live problems "
            "on the road. Most of the volume is repetitive status-checking that never needs a human, "
            "but the exceptions — a detained driver, a damaged load — need one immediately."
        ),
        "caller_scenarios": [
            ("a caller asks where their shipment is",
             "collect the load, order, or reference number and their callback details, and confirm "
             "that dispatch will come back with the status — do not guess at a location or an ETA"),
            ("a caller asks for a rate or a quote on a lane",
             "capture the origin, destination, approximate weight, equipment type, and pickup date, "
             "then confirm that a rep will follow up with pricing"),
            ("a driver or a customer reports a breakdown, an accident, or a detained trailer",
             "treat it as urgent, capture the load number and location, and escalate immediately "
             "rather than taking a routine message"),
            ("a caller reports damaged or missing freight",
             "capture the load reference, the delivery date, and a short description of the damage, "
             "and route it as a claim rather than trying to resolve it"),
            ("a caller wants to book a pickup",
             "collect pickup address, delivery address, requested date, and commodity, and confirm "
             "that dispatch will validate and confirm the booking"),
        ],
        "default_escalation": (
            "Take the caller's name, callback number, and any load or reference number, then confirm "
            "dispatch will return the call. Escalate anything involving a stopped, damaged, or "
            "detained load straight away rather than queuing it."
        ),
        "escalation_terms": [
            "a breakdown, an accident, or a detained trailer",
            "damaged or missing freight",
        ],
        "common_questions": [
            "Where is my load right now?",
            "What would you charge for this lane?",
            "When will it be delivered?",
            "Do you have capacity this week?",
        ],
    },
    "plumbing": {
        "specificity": 2,
        "display_name": "plumbing services",
        "aliases": ["plumb", "drain", "sewer", "leak detection"],
        "business_stakes": (
            "Plumbing calls are dominated by water actively causing damage. The caller's tolerance for "
            "hold music is close to zero, and the difference between a booked job and a lost one is "
            "usually who answered first."
        ),
        "caller_scenarios": [
            ("a caller reports an active leak, a burst pipe, or flooding",
             "treat it as an emergency: tell them how to shut off the water at the main if they have "
             "not already, confirm the address, and offer the earliest emergency slot"),
            ("a caller reports a blocked drain or a backed-up toilet",
             "establish whether it is the only bathroom in the property, and prioritise accordingly"),
            ("a caller reports no hot water",
             "treat it as same-day but not emergency unless the property has vulnerable occupants"),
            ("a caller asks for a price over the phone",
             "give only the call-out fee if it appears in the provided business information, and "
             "explain that the final cost depends on what the plumber finds"),
            ("a caller reports a gas smell",
             "tell them to leave the property and call the gas emergency line immediately, then end "
             "the call — never book this as a job"),
        ],
        "default_escalation": (
            "Take the caller's name, callback number, property address, and what is happening, then "
            "confirm the on-call plumber will call back. Do not promise an arrival window."
        ),
        "escalation_terms": [
            "an active leak, a burst pipe, or flooding",
            "a gas smell",
        ],
        "common_questions": [
            "How fast can someone come out?",
            "What is your call-out charge?",
            "Do you work weekends?",
            "Do you handle emergencies overnight?",
        ],
    },
    "roofing": {
        "specificity": 2,
        "display_name": "roofing & construction",
        "aliases": ["roof", "construction", "contractor", "builder", "remodel", "restoration"],
        "business_stakes": (
            "Roofing splits between storm-driven emergency work and long-lead replacement projects. "
            "Storm surges produce call volume no front desk can absorb, and insurance work needs "
            "specific details captured correctly the first time."
        ),
        "caller_scenarios": [
            ("a caller reports an active leak or storm damage",
             "treat it as urgent, confirm the property address, ask whether water is currently coming "
             "into the property, and capture it for emergency tarping or inspection"),
            ("a caller is filing or has filed an insurance claim",
             "capture the insurer's name, the claim number if they have one, and the date of loss, "
             "and confirm someone will call to arrange the inspection"),
            ("a caller wants a quote for a replacement roof",
             "treat it as a scheduled estimate: collect the address, property type, approximate age "
             "of the roof, and preferred times for an estimator to visit"),
            ("a caller asks for a price over the phone",
             "explain that roofs have to be inspected before a real number can be given, and offer "
             "to book the free estimate if the provided business information says one is offered"),
            ("a caller asks whether the company is licensed and insured",
             "confirm only what appears in the provided business information, and offer to have the "
             "office send documentation"),
        ],
        "default_escalation": (
            "Take the caller's name, callback number, property address, and whether there is active "
            "water entry, then confirm a callback. Escalate active leaks ahead of estimate requests."
        ),
        "escalation_terms": [
            "active water entry into the property, or storm damage",
        ],
        "common_questions": [
            "Can you come out and look at it?",
            "Do you work with my insurance company?",
            "How much does a new roof cost?",
            "How long will the job take?",
        ],
    },
    "real_estate": {
        "specificity": 2,
        "display_name": "real estate",
        "aliases": ["real estate", "realty", "property management", "lettings", "brokerage", "realtor"],
        "business_stakes": (
            "Real estate leads go cold in minutes — a buyer calling about a listing is usually calling "
            "about several. Property management lines carry a completely different load: tenant "
            "maintenance issues that have to be triaged for habitability risk."
        ),
        "caller_scenarios": [
            ("a caller is asking about a specific listing",
             "capture which property, their name, phone, email, and whether they are pre-approved or "
             "paying cash, and confirm an agent will call straight back"),
            ("a caller wants to book a viewing",
             "collect the property, their preferred days and times, and their contact details, and "
             "confirm the agent will confirm the slot"),
            ("a seller asks what their property is worth",
             "capture the address and their contact details and book a valuation — never estimate a "
             "value on the call"),
            ("a tenant reports a maintenance problem",
             "establish whether it affects heat, water, power, or security; treat those as urgent and "
             "everything else as a routine work order with address and description captured"),
            ("a caller asks whether pets or subletting are allowed at a property",
             "answer only from the provided business information, and otherwise take a message"),
        ],
        "default_escalation": (
            "Take the caller's name, callback number, the property address or listing reference, and "
            "the reason for the call, then confirm an agent will follow up. Treat loss of heat, water, "
            "power, or security as urgent."
        ),
        "escalation_terms": [
            "a tenant losing heat, water, power, or security",
        ],
        "common_questions": [
            "Is this property still available?",
            "Can I arrange a viewing?",
            "What is the asking price or rent?",
            "When can maintenance come out?",
        ],
    },
}


# The generic entry is deliberately NOT a stub. Leads type free-text industries and
# many will never match an alias, so this has to stand on its own as a complete,
# usable set of instructions for a general business reception line.
GENERIC_ENTRY: Dict[str, Any] = {
    "display_name": "general business reception",
    "aliases": [],
    "business_stakes": (
        "Every missed call is a missed opportunity, and most inbound calls fall into a small number "
        "of repeatable shapes: someone wants to buy, someone already bought and needs help, or "
        "someone needs a specific person."
    ),
    "caller_scenarios": [
        ("a caller is asking about the company's services or pricing",
         "answer from the provided business information only, and where it does not cover the "
         "question, take their details and confirm someone will follow up"),
        ("a caller asks for a specific person or department",
         "take their name, number, and the reason for the call, and confirm the message will be "
         "passed on"),
        ("an existing customer is calling with a problem or complaint",
         "acknowledge the problem, capture what happened and any order or account reference, and "
         "confirm it is being escalated — do not promise a refund, credit, or resolution"),
        ("a caller wants to book an appointment or a callback",
         "collect their name, contact number, and preferred times, and confirm the next step"),
        ("a caller asks something the provided business information does not cover",
         "say plainly that you want to get them an accurate answer, take their details, and confirm "
         "a callback rather than guessing"),
    ],
    "default_escalation": (
        "Take the caller's name, callback number, and the reason for the call, then confirm that the "
        "team will get back to them. Do not commit to a specific time unless the business information "
        "provides one."
    ),
    "escalation_terms": [
        "anything the caller clearly presents as an emergency or as urgent",
    ],
    "common_questions": [
        "What services do you offer?",
        "How much does it cost?",
        "What are your hours?",
        "Can I speak to someone about my account?",
    ],
}


def lookup_industry(industry: Optional[str]) -> Dict[str, Any]:
    """Resolves a free-text industry string to a library entry.

    Deterministic and case-insensitive. Falls back to GENERIC_ENTRY, which is a
    complete entry rather than a placeholder, so callers never have to handle a
    "not found" case. The returned dict always carries a `matched` key recording
    whether a real industry match happened, so callers can tell a genuine HVAC
    match apart from the generic fallback.
    """
    if not industry or not str(industry).strip():
        return {**GENERIC_ENTRY, "key": "generic", "matched": False}

    haystack = str(industry).strip().lower()

    # Exact key match first so an explicit "hvac" always wins over alias scanning.
    if haystack in SCENARIO_LIBRARY:
        return {**SCENARIO_LIBRARY[haystack], "key": haystack, "matched": True}

    # Most specific entry wins, then longest alias. Specificity is checked first so
    # "Dental & Healthcare" resolves to the dental playbook rather than the general
    # healthcare one; alias length then settles ties within the same specificity.
    best_key = None
    best_rank = (-1, -1)  # (specificity, alias length)
    for key, entry in SCENARIO_LIBRARY.items():
        for alias in entry["aliases"]:
            if alias in haystack:
                rank = (entry.get("specificity", 1), len(alias))
                if rank > best_rank:
                    best_key = key
                    best_rank = rank

    if best_key:
        return {**SCENARIO_LIBRARY[best_key], "key": best_key, "matched": True}

    return {**GENERIC_ENTRY, "key": "generic", "matched": False}


def format_scenarios_as_rules(entry: Dict[str, Any], limit: Optional[int] = None) -> List[str]:
    """Renders (trigger, action) pairs as explicit if-this-then-that lines."""
    scenarios = entry.get("caller_scenarios") or []
    if limit is not None:
        scenarios = scenarios[:limit]
    return [f"If {trigger}, {action}." for trigger, action in scenarios]


# ── Generated (LLM-enriched) industry entries ─────────────────────────────────
#
# WHY: an unknown industry falls back to GENERIC_ENTRY. That keeps the agent
# safe, but the compiled prompt then talks about "a general business reception
# line" instead of, say, "a veterinary clinic", which makes the demo feel
# untailored for any industry we have not hand-written.
#
# WHAT THIS DOES: for an unknown industry we make a ONE-TIME LLM call to fill in
# the *informational* fields only — display_name, business_stakes,
# common_questions — and cache the result so the same industry never calls the
# model again. The CONVERSATION BEHAVIOUR (caller_scenarios, default_escalation)
# is deliberately left as the vetted generic default: a model never gets to
# invent how the agent handles a call, including emergencies. That boundary is
# the whole point of the hand-written library above.
#
# WHERE IT IS STORED: generated entries are written to generated_scenarios.json
# — a DATA file next to this module, not this source file. The source stays
# 100% human-written and reviewable; the generated cache is separate, clearly
# marked with "source": "generated", and NEVER overrides a hand-vetted key.

_GENERATED_PATH = os.path.join(os.path.dirname(__file__), "generated_scenarios.json")

# Captured before merging the generated cache, so we always know which keys are
# hand-vetted and must never be shadowed or overwritten by generated content.
_VETTED_KEYS = frozenset(SCENARIO_LIBRARY.keys())


def _load_generated_into_library() -> None:
    """Merges the on-disk generated cache into SCENARIO_LIBRARY at import time.

    Vetted keys always win: a generated entry is skipped if a hand-written entry
    with the same key exists. Any read/parse problem is non-fatal — the library
    simply runs with its vetted entries only.
    """
    try:
        with open(_GENERATED_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        return
    except (json.JSONDecodeError, OSError) as e:
        logger.warning("Could not load generated scenarios (%s): %s", _GENERATED_PATH, e)
        return

    if not isinstance(data, dict):
        return
    for key, entry in data.items():
        if key in _VETTED_KEYS or not isinstance(entry, dict):
            continue
        SCENARIO_LIBRARY[key] = entry


def _build_generated_entry(industry_key: str, info: Dict[str, Any]) -> Dict[str, Any]:
    """Assembles a library entry from LLM-generated INFO, keeping the vetted
    generic CONVERSATION BEHAVIOUR (caller_scenarios + default_escalation)."""
    aliases: List[str] = [industry_key]
    for a in info.get("aliases") or []:
        a = str(a).strip().lower()
        if a and a not in aliases:
            aliases.append(a)

    questions = [str(q).strip() for q in (info.get("common_questions") or []) if str(q).strip()][:6]

    return {
        # Same rank as an umbrella category, so a more specific hand-vetted trade
        # alias still wins a tie rather than being hijacked by generated aliases.
        "specificity": 1,
        "source": "generated",
        "display_name": (str(info.get("display_name") or industry_key).strip() or industry_key),
        "aliases": aliases,
        "business_stakes": (str(info.get("business_stakes") or "").strip()
                            or GENERIC_ENTRY["business_stakes"]),
        # Conversation behaviour is intentionally the vetted generic default —
        # never generated. This is the line the model is not allowed to cross.
        "caller_scenarios": list(GENERIC_ENTRY["caller_scenarios"]),
        "default_escalation": GENERIC_ENTRY["default_escalation"],
        "escalation_terms": list(GENERIC_ENTRY["escalation_terms"]),
        "common_questions": questions or list(GENERIC_ENTRY["common_questions"]),
    }


def _generate_industry_info(industry: str) -> Dict[str, Any]:
    """One LLM call that returns INDUSTRY CONTEXT ONLY — never call handling.

    Imported lazily so this module stays import-safe (and network-free) for the
    tests and callers that only use the deterministic lookup_industry().
    """
    from pydantic import BaseModel
    from app.llm_client import call_structured_llm

    class GeneratedIndustryInfo(BaseModel):
        display_name: str
        business_stakes: str
        common_questions: List[str]
        aliases: List[str] = []

    prompt = (
        "You are enriching a phone-reception scenario library with INDUSTRY "
        "CONTEXT ONLY. A business signed up and typed this industry:\n"
        f'"{industry}"\n\n'
        "Return STRICT JSON with exactly these fields and nothing about how to "
        "handle calls:\n"
        '- "display_name": a short natural label for this kind of business '
        '(e.g. "veterinary clinic"), lowercase unless a proper noun.\n'
        '- "business_stakes": 1-2 descriptive sentences on why answering the '
        "phone matters for THIS industry and what a missed call costs them.\n"
        '- "common_questions": 3-5 realistic questions a caller to this business '
        "actually asks. Questions only, no answers.\n"
        '- "aliases": 2-5 lowercase keywords someone might type for this industry.\n\n'
        "Rules:\n"
        "- Do NOT include instructions, actions, escalation steps, or how the "
        "agent should respond. Information only.\n"
        "- No emergency handling, no medical/legal/financial advice, no invented "
        "phone numbers, prices, or promises.\n"
        "- If the industry is unclear or gibberish, describe a general business "
        "reception line.\n"
    )

    info = call_structured_llm(prompt, GeneratedIndustryInfo, max_tokens=600)
    return info.model_dump()


def _persist_generated(key: str, entry: Dict[str, Any]) -> None:
    """Adds a generated entry to the in-memory library and the on-disk cache.

    Vetted keys are never touched. The disk write is atomic (temp + replace) and
    best-effort: on a read-only or full filesystem it logs and keeps the entry in
    memory for this process, so a demo still benefits even if it can't persist.
    """
    if key in _VETTED_KEYS:
        return

    SCENARIO_LIBRARY[key] = entry  # available immediately, even if the write fails

    try:
        existing: Dict[str, Any] = {}
        try:
            with open(_GENERATED_PATH, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                if isinstance(loaded, dict):
                    existing = loaded
        except FileNotFoundError:
            existing = {}

        existing[key] = entry
        tmp = _GENERATED_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)
        os.replace(tmp, _GENERATED_PATH)
    except OSError as e:
        logger.warning("Could not persist generated scenario '%s' (in-memory only): %s", key, e)


def resolve_industry_entry(industry: Optional[str]) -> Dict[str, Any]:
    """Like lookup_industry(), but for an UNKNOWN industry it makes a one-time
    LLM call to enrich the entry with industry INFO, caches it, and returns it.

    The conversation behaviour stays the vetted generic default. On any failure
    (no API key, network error, blank industry) it returns exactly what
    lookup_industry() would, so every caller can treat it as a drop-in.
    """
    entry = lookup_industry(industry)
    if entry.get("matched"):
        return entry
    if not industry or not str(industry).strip():
        return entry

    key = str(industry).strip().lower()
    try:
        info = _generate_industry_info(str(industry).strip())
    except Exception as e:
        logger.warning("Industry enrichment failed for %r; using generic entry: %s", industry, e)
        return entry

    generated = _build_generated_entry(key, info)
    _persist_generated(key, generated)
    return {**generated, "key": key, "matched": True}


_load_generated_into_library()
