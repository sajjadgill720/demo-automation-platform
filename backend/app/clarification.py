import os
import json
import logging
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
from app.utils import sanitize_input, sanitize_document_text
from app.qualifier import qualify_lead_internal
from app.agents import provision_vapi_assistant_task

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
    conversation_history: List[dict] = Field(default_factory=list)
    profile: Optional[dict] = None
    missing_fields: List[str] = Field(default_factory=list)


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


# ── Prompts ──

EXTRACTION_PROMPT = """You are Convoa's profile ingestion analyzer.
You are analyzing a potential B2B customer request for Convoa (our voice-AI front-desk receptionist).
Company: "{company_name}"
Industry: "{industry}"

SOP / Process Documents Text:
---
{documents_text}
---

Clarification Conversation History:
{conversation_text}

Your task is to analyze the documents and the conversation history to extract a structured profile for this company.
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

QUESTION_PROMPT = """You are Convoa AI Advisor, a world-class AI Solutions Consultant creating custom voice agents for enterprise businesses.
Target Company: {company_name}
Industry: {industry}

Current Known Profile:
{profile_json}

The following profile fields are still missing/unknown:
{missing_fields_list}

Conversation history so far:
{conversation_text}

Your goal is to generate the NEXT single question to ask the customer to help fill in ONE of the missing fields.
Rules:
1. Speak in a friendly, helpful, expert tone as Convoa AI Advisor.
2. Ask about exactly ONE missing field at a time.
3. Make the question contextual and highly relevant to {company_name} in the {industry} industry.
4. Avoid administrative questions (like business hours or email address unless missing).
5. Frame it conversationally (e.g. "What's the main reason you're looking at an AI agent for this?", "Walk me through what happens today when a customer calls...", "Are there situations where you'd always want a human to take over?").
6. Generate 2 to 4 short, realistic recommended answer options (1-5 words each) that the user could click to instantly respond.

Return your question and answer recommendations as a valid JSON object matching the requested schema.
"""

class GeneratedQuestion(BaseModel):
    question: str = Field(description="The friendly, conversational next question to ask the user as Convoa AI Advisor.")
    recommendations: List[str] = Field(default_factory=list, description="2 to 4 recommended answer options for the user to select from.")


# ── Helpers ──

def get_postgres_conn_str() -> str:
    from app.config import DATABASE_URL
    conn_str = DATABASE_URL.replace("postgresql+psycopg2://", "postgresql://")
    conn_str = conn_str.split("?")[0]
    return conn_str


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


def extract_profile_node(state: ClarificationState) -> ClarificationState:
    lead_id_str = state.get("lead_id")
    company = state.get("company_name", "")
    industry = state.get("industry", "")
    docs_text = state.get("documents_text", "")
    history = state.get("conversation_history", [])

    logger.info(f"[{lead_id_str}] extract_profile node started")

    prompt = EXTRACTION_PROMPT.format(
        company_name=company,
        industry=industry,
        documents_text=docs_text[:6000] if docs_text else "None",
        conversation_text=compile_conversation(history)
    )

    try:
        res = call_structured_llm(prompt, CompanyProfile, retry_on_failure=True)
        extracted_dict = res.model_dump()
    except Exception as e:
        logger.error(f"[{lead_id_str}] Profile extraction failed: {e}", exc_info=True)
        extracted_dict = state.get("extracted_profile") or {}

    return {
        **state,
        "extracted_profile": extracted_dict
    }


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


def generate_question_node(state: ClarificationState) -> ClarificationState:
    lead_id_str = state.get("lead_id")
    company = state.get("company_name", "")
    industry = state.get("industry", "")
    profile = state.get("extracted_profile") or {}
    missing = state.get("missing_fields", [])
    history = state.get("conversation_history", [])

    logger.info(f"[{lead_id_str}] generate_question node started")

    prompt = QUESTION_PROMPT.format(
        company_name=company,
        industry=industry,
        profile_json=json.dumps(profile, indent=2),
        missing_fields_list=", ".join(missing),
        conversation_text=compile_conversation(history)
    )

    recommendations = []
    try:
        res = call_structured_llm(prompt, GeneratedQuestion, retry_on_failure=True)
        question_text = res.question
        recommendations = res.recommendations or []
    except Exception as e:
        logger.error(f"[{lead_id_str}] Failed to generate question: {e} — using fallback question", exc_info=True)
        question_text = "Could you tell us more about what calls you want Convoa to handle and what happens when they need to be escalated?"
        recommendations = ["After-hours appointment calls", "Emergency dispatch escalations", "General client inquiries & FAQs"]

    if not recommendations:
        if "crm_or_tools" in missing:
            recommendations = ["Salesforce & HubSpot", "Google Sheets & Email", "Custom API", "No CRM system"]
        elif "operating_hours" in missing:
            recommendations = ["24/7 Coverage", "After-hours & Weekends", "9 AM - 5 PM M-F"]
        elif "escalation_contacts" in missing:
            recommendations = ["SMS link to duty manager", "Live transfer to on-call phone", "Email digest notification"]
        else:
            recommendations = ["Standard automated handling", "Custom escalation rules", "Full CRM sync"]

    updated_history = list(history)
    
    is_duplicate = False
    if updated_history and updated_history[-1].get("role") == "assistant":
        is_duplicate = True
        logger.info(f"[{lead_id_str}] Last message in history is already assistant. Avoiding duplicate DB append.")

    if not is_duplicate:
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
    else:
        with Session(engine) as session:
            statement = select(CompanyProfileDB).where(CompanyProfileDB.lead_id == uuid.UUID(lead_id_str))
            profile_db = session.exec(statement).first()
            if profile_db:
                profile_db.status = ProfileStatus.awaiting_user
                profile_db.updated_at = datetime.utcnow()
                session.add(profile_db)
                session.commit()

    logger.info(f"[{lead_id_str}] Pausing graph with interrupt question: {question_text}")

    resume_val = interrupt({"question": question_text, "recommendations": recommendations})

    return {
        **state,
        "conversation_history": updated_history,
        "temp_resume": resume_val
    }


def ingest_answer_node(state: ClarificationState) -> ClarificationState:
    lead_id_str = state.get("lead_id")
    history = state.get("conversation_history", [])
    resume_val = state.get("temp_resume") or {}
    user_answer = resume_val.get("answer", "")
    
    sanitized_answer = sanitize_input(user_answer)
    updated_history = list(history)
    updated_history.append({"role": "user", "content": sanitized_answer})

    with Session(engine) as session:
        msg = ClarificationMessage(
            lead_id=uuid.UUID(lead_id_str),
            role=MessageRole.user,
            content=sanitized_answer
        )
        session.add(msg)
        session.commit()

    return {
        **state,
        "conversation_history": updated_history,
        "status": "in_progress",
        "temp_resume": None
    }


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
            # Assumed logic for finalizing lead status
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
workflow.add_node("ingest_answer", ingest_answer_node)
workflow.add_node("finalize", finalize_node)

workflow.set_entry_point("parse_documents")

workflow.add_edge("parse_documents", "extract_profile")
workflow.add_edge("extract_profile", "detect_gaps")

def route_after_gaps(state: ClarificationState):
    missing = state.get("missing_fields", [])
    if not missing:
        return "finalize"
    return "generate_question"

workflow.add_conditional_edges("detect_gaps", route_after_gaps)
workflow.add_edge("generate_question", "ingest_answer")
workflow.add_edge("ingest_answer", "extract_profile")
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
        "temp_resume": None
    }
    
    config = {"configurable": {"thread_id": lead_id}}
    conn_str = get_postgres_conn_str()
    with PostgresSaver.from_conn_string(conn_str) as checkpointer:
        checkpointer.setup()
        graph = workflow.compile(checkpointer=checkpointer)
        graph.invoke(initial_state, config=config)
        
    return get_clarification_status(lead_id)


def submit_clarification_answer(lead_id: str, answer: str) -> ClarificationStatus:
    config = {"configurable": {"thread_id": lead_id}}
    conn_str = get_postgres_conn_str()
    with PostgresSaver.from_conn_string(conn_str) as checkpointer:
        checkpointer.setup()
        graph = workflow.compile(checkpointer=checkpointer)
        graph.invoke(Command(resume={"answer": answer}), config=config)
        
    return get_clarification_status(lead_id)


def skip_remaining_questions(lead_id: str) -> ClarificationStatus:
    lead_id_uuid = uuid.UUID(lead_id)
    with Session(engine) as session:
        statement = select(CompanyProfileDB).where(CompanyProfileDB.lead_id == lead_id_uuid)
        profile_db = session.exec(statement).first()
        if not profile_db:
            profile_db = CompanyProfileDB(
                lead_id=lead_id_uuid,
                status=ProfileStatus.completed,
                profile=None,
                missing_fields=json.dumps([])
            )
            session.add(profile_db)
        else:
            profile_db.status = ProfileStatus.completed
            profile_db.missing_fields = json.dumps([])
            profile_db.updated_at = datetime.utcnow()
            session.add(profile_db)
        session.commit()

    return get_clarification_status(lead_id)


def get_clarification_status(lead_id: str) -> ClarificationStatus:
    lead_id_uuid = uuid.UUID(lead_id)
    config = {"configurable": {"thread_id": lead_id}}
    conn_str = get_postgres_conn_str()
    with PostgresSaver.from_conn_string(conn_str) as checkpointer:
        checkpointer.setup()
        graph = workflow.compile(checkpointer=checkpointer)
        state_snap = graph.get_state(config)
        
    values = state_snap.values if state_snap else {}
    current_question = None
    recommendations = None
    if state_snap and state_snap.next:
        if state_snap.tasks and state_snap.tasks[0].interrupts:
            curr_interrupt = state_snap.tasks[0].interrupts[0]
            val = getattr(curr_interrupt, 'value', None) or curr_interrupt
            if isinstance(val, dict):
                current_question = val.get("question")
                recommendations = val.get("recommendations")
                
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

    return ClarificationStatus(
        lead_id=lead_id,
        status=db_status,
        current_question=current_question,
        recommendations=recommendations,
        conversation_history=history,
        profile=extracted,
        missing_fields=missing
    )
