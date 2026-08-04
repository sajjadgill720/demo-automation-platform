from contextlib import asynccontextmanager
import asyncio
import json
import uuid
import logging
import urllib.request
import urllib.error
import io
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, File, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timedelta
from pypdf import PdfReader

# SlowAPI imports
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)

from app.logging_config import setup_logging
# Initialize structured JSON logging
setup_logging()

logger = logging.getLogger(__name__)

from app.db import init_db, get_session
from app.config import CORS_ORIGINS
from app.models import (
    DiscoveryResponse,
    VoiceAgent,
    Lead,
    AgentStatus,
    Document,
    CompanyProfileDB,
    DemoFeedback,
    FeedbackRating,
    CallRecord
)
from app.vapi_calls import fetch_vapi_call_task
from app.agents import (
    compile_agent_prompt, 
    provision_vapi_assistant,
    compile_lead_prompt,
    provision_vapi_assistant_task,
    delete_vapi_assistant
)
from app.qualifier import QualifyRequest, QualificationResult, qualify_lead_internal
from app.clarification import (
    start_clarification,
    submit_clarification_answer,
    skip_remaining_questions,
    get_clarification_status,
    close_checkpointer_pool,
    ClarificationStatus,
    ClarificationAnswer
)


# ── Periodic cleanup: delete Vapi assistants older than 6 hours ──

AGENT_TTL_HOURS = 6
CLEANUP_INTERVAL_SECONDS = 15 * 60  # sweep every 15 minutes


async def _cleanup_expired_agents():
    """Runs in the background on a fixed interval. Deletes Vapi assistants
    whose leads were created more than AGENT_TTL_HOURS ago and still have an
    assistant_id, regardless of agent_status. This replaces the old event-based
    deletion that happened on end-session."""
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
        try:
            cutoff = datetime.utcnow() - timedelta(hours=AGENT_TTL_HOURS)
            with Session(engine) as session:
                statement = select(Lead).where(
                    Lead.assistant_id.isnot(None),  # type: ignore[union-attr]
                    Lead.created_at < cutoff,
                )
                expired_leads = session.exec(statement).all()

                if not expired_leads:
                    continue

                logger.info(f"Agent cleanup: found {len(expired_leads)} expired agent(s) to delete")

                for lead in expired_leads:
                    try:
                        delete_vapi_assistant(lead.assistant_id)
                        logger.info(
                            f"Agent cleanup: deleted Vapi assistant {lead.assistant_id}",
                            extra={"extra_data": {"lead_id": str(lead.id)}},
                        )
                    except Exception:
                        logger.error(
                            f"Agent cleanup: failed to delete Vapi assistant {lead.assistant_id}",
                            exc_info=True,
                            extra={"extra_data": {"lead_id": str(lead.id)}},
                        )

                    lead.assistant_id = None
                    lead.agent_status = AgentStatus.completed
                    lead.updated_at = datetime.utcnow()
                    session.add(lead)

                session.commit()
        except Exception:
            logger.error("Agent cleanup: unhandled error in sweep", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables and compile schemas automatically on start
    init_db()
    # Launch the periodic agent-expiry sweeper
    cleanup_task = asyncio.create_task(_cleanup_expired_agents())
    yield
    cleanup_task.cancel()
    close_checkpointer_pool()

app = FastAPI(
    title="DataQuartz API",
    description="Backend API Service for the DataQuartz Platform",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SlowAPI rate limiter setup
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

class DiscoveryCreate(BaseModel):
    company_name: str
    contact_email: str
    missed_calls_per_week: int
    average_booking_value: float
    calendar_system: str
    booking_requirements: str
    escalation_path: str
    integration_destination: str

class DemoRequestCreate(BaseModel):
    company_name: str
    contact_name: str
    contact_email: EmailStr
    contact_phone: str
    industry: str
    problem_text: Optional[str] = None
    voice_gender: Optional[str] = None

class LeadResponse(BaseModel):
    id: uuid.UUID
    company_name: str
    contact_name: str
    contact_email: str
    contact_phone: str
    industry: str
    problem_statement: Optional[str] = None
    voice_gender: Optional[str] = None
    agent_status: AgentStatus
    assistant_id: Optional[str] = None
    failure_reason: Optional[str] = None
    qualified: Optional[bool] = None
    qualification_confidence: Optional[float] = None
    qualification_reasoning: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

@app.get("/")
def read_root():
    return {"status": "healthy", "service": "DataQuartz API"}

class FeedbackCreate(BaseModel):
    rating: FeedbackRating
    comment: Optional[str] = None


class FeedbackResponse(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    rating: FeedbackRating
    comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FeedbackWithLead(FeedbackResponse):
    """Feedback joined with the company it came from, for the internal list."""
    company_name: str
    industry: str


@app.post("/api/demo-request/{lead_id}/feedback", response_model=FeedbackResponse, status_code=201)
def create_feedback(
    lead_id: uuid.UUID,
    payload: FeedbackCreate,
    session: Session = Depends(get_session),
):
    """Stores feedback submitted by the client from their demo preview."""
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Stored verbatim apart from a length cap and control-character strip.
    #
    # Deliberately NOT run through the injection sanitizers: this text is only ever
    # rendered as text (React escapes it) and is never fed into a prompt, so keyword
    # stripping buys no safety here while actively corrupting what the client wrote —
    # "the agent ignored my instructions" came back as "the agent ignored my ".
    # If this text is ever piped into an LLM prompt, sanitize at that call site.
    comment = None
    if payload.comment:
        cleaned = "".join(ch for ch in payload.comment if ch == "\n" or ch >= " ")
        comment = cleaned.strip()[:2000] or None

    entry = DemoFeedback(lead_id=lead_id, rating=payload.rating, comment=comment)
    session.add(entry)
    session.commit()
    session.refresh(entry)
    logger.info(
        "Demo feedback received",
        extra={"extra_data": {"lead_id": str(lead_id), "rating": payload.rating.value}},
    )
    return entry


@app.get("/api/demo-request/{lead_id}/feedback", response_model=list[FeedbackResponse])
def list_feedback_for_lead(lead_id: uuid.UUID, session: Session = Depends(get_session)):
    """Feedback for one lead — used by the client's own preview to show them
    what they already submitted."""
    statement = (
        select(DemoFeedback)
        .where(DemoFeedback.lead_id == lead_id)
        .order_by(DemoFeedback.created_at.desc())
    )
    return session.exec(statement).all()


@app.get("/api/feedback", response_model=list[FeedbackWithLead])
def list_all_feedback(
    limit: int = 100,
    rating: Optional[FeedbackRating] = None,
    session: Session = Depends(get_session),
):
    """All client feedback, newest first, for the internal team view."""
    statement = (
        select(DemoFeedback, Lead)
        .join(Lead, Lead.id == DemoFeedback.lead_id)
        .order_by(DemoFeedback.created_at.desc())
    )
    if rating is not None:
        statement = statement.where(DemoFeedback.rating == rating)
    statement = statement.limit(max(1, min(limit, 500)))

    return [
        FeedbackWithLead(
            id=fb.id,
            lead_id=fb.lead_id,
            rating=fb.rating,
            comment=fb.comment,
            created_at=fb.created_at,
            company_name=lead.company_name,
            industry=lead.industry,
        )
        for fb, lead in session.exec(statement).all()
    ]


# ── Call records (conversations with a provisioned agent) ──

class TranscriptTurn(BaseModel):
    role: str  # "assistant" | "user"
    text: str


class CallRecordCreate(BaseModel):
    # Vapi's own call id — the key we pull the native report with. Required.
    vapi_call_id: str
    assistant_id: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None


class CallRecordResponse(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    vapi_call_id: Optional[str] = None
    assistant_id: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_seconds: int
    turn_count: int
    transcript: list[TranscriptTurn]
    summary: Optional[str] = None
    recording_url: Optional[str] = None
    ended_reason: Optional[str] = None
    cost: Optional[float] = None
    status: str
    created_at: datetime


class CallRecordWithLead(CallRecordResponse):
    """A call joined with the company it belongs to, for the internal list."""
    company_name: str
    industry: str


def _call_to_response(rec: CallRecord) -> CallRecordResponse:
    """Builds the API shape from a row, decoding the JSON transcript column."""
    turns: list[TranscriptTurn] = []
    if rec.transcript:
        try:
            for t in json.loads(rec.transcript):
                turns.append(TranscriptTurn(role=t.get("role", "user"), text=t.get("text", "")))
        except (json.JSONDecodeError, TypeError, AttributeError):
            pass
    return CallRecordResponse(
        id=rec.id,
        lead_id=rec.lead_id,
        vapi_call_id=rec.vapi_call_id,
        assistant_id=rec.assistant_id,
        started_at=rec.started_at,
        ended_at=rec.ended_at,
        duration_seconds=rec.duration_seconds,
        turn_count=rec.turn_count,
        transcript=turns,
        summary=rec.summary,
        recording_url=rec.recording_url,
        ended_reason=rec.ended_reason,
        cost=rec.cost,
        status=rec.status,
        created_at=rec.created_at,
    )


@app.post("/api/demo-request/{lead_id}/calls", response_model=CallRecordResponse, status_code=201)
def create_call_record(
    lead_id: uuid.UUID,
    payload: CallRecordCreate,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    """Registers a finished conversation with the lead's provisioned agent.

    Posted by the demo preview when a browser call ends, carrying Vapi's call id.
    We store a "processing" row immediately and kick a background task that pulls
    the native report (recording, transcript, summary) from Vapi's API — so the
    stored data is Vapi's own, not a client-side reconstruction.
    """
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead request not found")

    vapi_call_id = (payload.vapi_call_id or "").strip()
    if not vapi_call_id:
        raise HTTPException(status_code=400, detail="vapi_call_id is required")

    # One record per Vapi call — a retry (StrictMode double-fire, network retry)
    # returns the existing row instead of creating a duplicate.
    existing = session.exec(
        select(CallRecord).where(CallRecord.vapi_call_id == vapi_call_id)
    ).first()
    if existing:
        return _call_to_response(existing)

    rec = CallRecord(
        lead_id=lead_id,
        vapi_call_id=vapi_call_id,
        assistant_id=payload.assistant_id,
        started_at=payload.started_at,
        ended_at=payload.ended_at,
        status="processing",
    )
    session.add(rec)
    session.commit()
    session.refresh(rec)

    background_tasks.add_task(fetch_vapi_call_task, str(rec.id))

    logger.info(
        "Call record registered",
        extra={"extra_data": {"lead_id": str(lead_id), "call_id": str(rec.id), "vapi_call_id": vapi_call_id}},
    )
    return _call_to_response(rec)


@app.get("/api/demo-request/{lead_id}/calls", response_model=list[CallRecordResponse])
def list_calls_for_lead(lead_id: uuid.UUID, session: Session = Depends(get_session)):
    """Every call recorded for one lead, newest first — used by the lead drawer."""
    statement = (
        select(CallRecord)
        .where(CallRecord.lead_id == lead_id)
        .order_by(CallRecord.created_at.desc())
    )
    return [_call_to_response(r) for r in session.exec(statement).all()]


@app.get("/api/calls", response_model=list[CallRecordWithLead])
def list_all_calls(limit: int = 100, session: Session = Depends(get_session)):
    """All calls, newest first, joined with their company — for the team view."""
    statement = (
        select(CallRecord, Lead)
        .join(Lead, Lead.id == CallRecord.lead_id)
        .order_by(CallRecord.created_at.desc())
        .limit(max(1, min(limit, 500)))
    )
    out: list[CallRecordWithLead] = []
    for rec, lead in session.exec(statement).all():
        base = _call_to_response(rec)
        out.append(
            CallRecordWithLead(
                **base.model_dump(),
                company_name=lead.company_name,
                industry=lead.industry,
            )
        )
    return out


@app.get("/api/leads", response_model=list[LeadResponse])
def list_leads(
    limit: int = 50,
    status: Optional[AgentStatus] = None,
    session: Session = Depends(get_session),
):
    """Lists leads, newest first, for the internal dashboard and active-demos views.

    Added because those pages previously rendered hardcoded mock rows — there was
    no endpoint that returned real leads. `status` filters by agent_status so the
    active-demos view can request just the live ones.
    """
    statement = select(Lead).order_by(Lead.created_at.desc())
    if status is not None:
        statement = statement.where(Lead.agent_status == status)
    statement = statement.limit(max(1, min(limit, 200)))
    return session.exec(statement).all()

@app.post("/api/discovery", response_model=DiscoveryResponse)
def create_discovery_response(payload: DiscoveryCreate, session: Session = Depends(get_session)):
    # Monthly leakage calculation: (missed_calls_per_week * 4.34) * average_booking_value * 25% booking rate
    monthly_leakage = (payload.missed_calls_per_week * 4.34) * payload.average_booking_value * 0.25
    
    db_response = DiscoveryResponse(
        company_name=payload.company_name,
        contact_email=payload.contact_email,
        missed_calls_per_week=payload.missed_calls_per_week,
        average_booking_value=payload.average_booking_value,
        calculated_monthly_leakage=round(monthly_leakage, 2),
        calendar_system=payload.calendar_system,
        booking_requirements=payload.booking_requirements,
        escalation_path=payload.escalation_path,
        integration_destination=payload.integration_destination
    )
    session.add(db_response)
    session.commit()
    session.refresh(db_response)
    return db_response

@app.get("/api/discovery", response_model=list[DiscoveryResponse])
def get_discovery_responses(session: Session = Depends(get_session)):
    statement = select(DiscoveryResponse).order_by(DiscoveryResponse.created_at.desc())
    results = session.exec(statement).all()
    return results


@app.post("/api/agents/provision/{discovery_id}", response_model=VoiceAgent)
async def provision_agent(discovery_id: int, session: Session = Depends(get_session)):
    # 1. Fetch discovery layout from DB
    discovery = session.get(DiscoveryResponse, discovery_id)
    if not discovery:
        raise HTTPException(status_code=404, detail="Discovery response layout not found")
    
    # 2. Check if an agent is already provisioned for this layout
    statement = select(VoiceAgent).where(VoiceAgent.discovery_id == discovery_id)
    existing_agent = session.exec(statement).first()
    if existing_agent:
        return existing_agent
    
    # 3. Compile prompt
    prompt = compile_agent_prompt(discovery)
    
    # 4. Provision agent
    vapi_res = await provision_vapi_assistant(discovery.company_name, prompt)
    
    # 5. Save VoiceAgent to DB
    agent = VoiceAgent(
        id=vapi_res["id"],
        company_name=discovery.company_name,
        discovery_id=discovery_id,
        system_prompt=prompt
    )
    session.add(agent)
    session.commit()
    session.refresh(agent)
    return agent


@app.get("/api/agents", response_model=list[VoiceAgent])
def get_agents(session: Session = Depends(get_session)):
    statement = select(VoiceAgent).order_by(VoiceAgent.created_at.desc())
    results = session.exec(statement).all()
    return results


@app.post("/api/qualify", response_model=QualificationResult)
def qualify_lead(payload: QualifyRequest):
    """Exposes the internal lead qualification LangGraph workflow.
    
    Exposed for backward compatibility and integration testing.
    """
    return qualify_lead_internal(payload.company_name, payload.industry)


@app.post("/api/demo-request", response_model=LeadResponse, status_code=201)
def create_demo_request(
    payload: DemoRequestCreate,
    session: Session = Depends(get_session)
):
    """Creates a new demo request lead, renders their prompt template,
    and returns lead_id immediately. Ingestion/clarification runs next.
    """
    logger.info(
        "Received demo request",
        extra={"extra_data": {"company_name": payload.company_name, "contact_email": payload.contact_email}}
    )
    
    # Render and compile the template (includes sanitization)
    rendered_prompt = compile_lead_prompt(payload.company_name, payload.industry)

    problem = payload.problem_text.strip() if payload.problem_text else None

    # Qualify at intake so obvious junk / off-target submissions are filtered here,
    # before the lead enters the clarification chat and provisioning. An unqualified
    # lead is created as `skipped`; the frontend routes it straight to the "not
    # qualified" screen instead of /upload. The qualifier FAILS OPEN (see
    # qualifier.py) — a missing key or LLM error yields qualified=True — so a real
    # lead is never blocked by a qualification outage. Provisioning trusts this
    # stored result and does not re-run qualification.
    qualification = qualify_lead_internal(payload.company_name, payload.industry)

    lead = Lead(
        company_name=payload.company_name,
        contact_name=payload.contact_name,
        contact_email=payload.contact_email,
        contact_phone=payload.contact_phone,
        industry=payload.industry,
        problem_statement=problem or None,
        voice_gender=(payload.voice_gender or "female").strip().lower(),
        rendered_prompt=rendered_prompt,
        agent_status=AgentStatus.pending if qualification.qualified else AgentStatus.skipped,
        qualified=qualification.qualified,
        qualification_confidence=qualification.confidence,
        qualification_reasoning=qualification.reasoning,
    )

    session.add(lead)
    session.commit()
    session.refresh(lead)

    logger.info(
        "Saved lead to database",
        extra={"extra_data": {
            "lead_id": str(lead.id),
            "qualified": qualification.qualified,
            "agent_status": lead.agent_status.value,
        }},
    )
    return lead


@app.get("/api/demo-request/{lead_id}", response_model=LeadResponse)
def get_demo_request(lead_id: uuid.UUID, session: Session = Depends(get_session)):
    """Fetches a lead record by ID to poll status during background provisioning."""
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead request not found")
    return lead


@app.delete("/api/demo-request/{lead_id}/agent", response_model=LeadResponse)
def delete_lead_agent(lead_id: uuid.UUID, session: Session = Depends(get_session)):
    """Internal: tears down a lead's provisioned Vapi assistant, keeping the lead.

    Distinct from end-session (which the client demo flow uses): this is the
    internal team's "delete agent" action. It deletes the Vapi assistant to free
    the resource, then clears assistant_id and marks the lead completed so it
    drops out of the provisioned-agent list. The lead record and its profile,
    feedback and conversation history are all retained for reference.
    """
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    if lead.assistant_id:
        try:
            delete_vapi_assistant(lead.assistant_id)
        except Exception:
            # Non-blocking: if the remote delete fails we still clear our side so
            # the agent leaves the list rather than getting stuck as undeletable.
            logger.error(
                f"Failed to delete Vapi assistant {lead.assistant_id} during agent delete",
                exc_info=True,
                extra={"extra_data": {"lead_id": str(lead_id)}},
            )

    lead.assistant_id = None
    lead.agent_status = AgentStatus.completed
    lead.updated_at = datetime.utcnow()
    session.add(lead)
    session.commit()
    session.refresh(lead)
    logger.info("Agent deleted (lead retained)", extra={"extra_data": {"lead_id": str(lead_id)}})
    return lead


@app.post("/api/demo-request/{lead_id}/end-session")
def end_demo_session(lead_id: uuid.UUID, session: Session = Depends(get_session)):
    """Marks the demo session as completed without deleting the Vapi assistant.

    The assistant stays alive so the user can call back during the demo window.
    A background cleanup task (_cleanup_expired_agents) automatically deletes
    assistants that are older than AGENT_TTL_HOURS (6 hours).
    """
    logger.info("Received request to end demo session", extra={"extra_data": {"lead_id": str(lead_id)}})
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead request not found")

    lead.agent_status = AgentStatus.completed
    lead.updated_at = datetime.utcnow()
    session.add(lead)
    session.commit()
    session.refresh(lead)

    logger.info("Demo session ended successfully (agent retained for TTL cleanup)", extra={"extra_data": {"lead_id": str(lead_id)}})
    return {"message": "Demo session ended successfully", "agent_status": lead.agent_status}


# ── Document Parsing and Clarification API Endpoints ──

def extract_text_from_file(file_bytes: bytes, file_name: str) -> str:
    """Extracts plain text from file bytes (supports txt and pdf)."""
    ext = file_name.split(".")[-1].lower()
    
    if ext == "txt":
        try:
            return file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                return file_bytes.decode("latin-1")
            except Exception:
                return ""
                
    elif ext == "pdf":
        try:
            pdf = PdfReader(io.BytesIO(file_bytes))
            text_parts = []
            for page in pdf.pages:
                text_parts.append(page.extract_text() or "")
            return "\n".join(text_parts)
        except Exception as e:
            logger.error(f"Error extracting PDF text: {e}", exc_info=True)
            return ""
            
    else:
        try:
            return file_bytes.decode("utf-8", errors="ignore")
        except Exception:
            return ""


@app.post("/api/clarification/{lead_id}/documents", response_model=dict)
@limiter.limit("5/minute")
async def upload_clarification_documents(
    lead_id: uuid.UUID,
    request: Request,
    file: UploadFile = File(...),
    session: Session = Depends(get_session)
):
    """Multipart upload to ingest a document for a lead, storing in Supabase."""
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead request not found")
        
    max_size = 10 * 1024 * 1024
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(status_code=400, detail="File too large. Max size is 10MB.")
        
    allowed_types = ["application/pdf", "text/plain"]
    if file.content_type not in allowed_types and not file.filename.endswith((".pdf", ".txt")):
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF and TXT files are allowed.")
        
    extracted_text = extract_text_from_file(content, file.filename)
    
    from app.storage import upload_document
    unique_path = f"leads/{lead_id}/{uuid.uuid4()}_{file.filename}"
    file_url = upload_document("clarifications", unique_path, content, file.content_type or "application/octet-stream")
    
    db_doc = Document(
        lead_id=lead_id,
        file_name=file.filename,
        file_url=file_url,
        file_type=file.filename.split(".")[-1],
        file_size_bytes=len(content),
        extracted_text=extracted_text
    )
    session.add(db_doc)
    session.commit()
    session.refresh(db_doc)
    
    logger.info(f"[{lead_id}] Uploaded and parsed document {file.filename}")
    return {
        "message": "Document uploaded and parsed successfully",
        "document_id": str(db_doc.id),
        "file_url": file_url,
        "extracted_text_preview": extracted_text[:200] if extracted_text else ""
    }


class ConsentPayload(BaseModel):
    ai_processing_consent: bool


@app.post("/api/clarification/{lead_id}/consent", response_model=dict)
def set_lead_consent(
    lead_id: uuid.UUID,
    payload: ConsentPayload,
    session: Session = Depends(get_session)
):
    """Sets AI processing consent for a lead and records timestamp."""
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead request not found")

    lead.ai_processing_consent = payload.ai_processing_consent
    lead.consent_recorded_at = datetime.utcnow()
    lead.updated_at = datetime.utcnow()
    session.add(lead)
    session.commit()
    session.refresh(lead)

    logger.info(f"[{lead_id}] AI processing consent updated: consent={lead.ai_processing_consent} at {lead.consent_recorded_at}")
    return {
        "message": "Consent recorded successfully",
        "lead_id": str(lead.id),
        "ai_processing_consent": lead.ai_processing_consent,
        "consent_recorded_at": lead.consent_recorded_at.isoformat() if lead.consent_recorded_at else None
    }


@app.post("/api/clarification/{lead_id}/start", response_model=ClarificationStatus)
def start_lead_clarification(
    lead_id: uuid.UUID, 
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session)
):
    """Invokes the LangGraph clarification workflow for the lead."""
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead request not found")
    try:
        status = start_clarification(str(lead_id))
        if status.status == "completed":
            background_tasks.add_task(provision_vapi_assistant_task, str(lead_id))
        return status
    except Exception as e:
        logger.error(f"[{lead_id}] Error starting clarification: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/clarification/{lead_id}/respond", response_model=ClarificationStatus)
@limiter.limit("20/minute")
def respond_lead_clarification(
    lead_id: uuid.UUID,
    payload: ClarificationAnswer,
    request: Request,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session)
):
    """Submits a chat response from the user to continue the clarification graph loop."""
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead request not found")
    try:
        status = submit_clarification_answer(str(lead_id), payload.answer)
        if status.status == "completed":
            background_tasks.add_task(provision_vapi_assistant_task, str(lead_id))
        return status
    except Exception as e:
        logger.error(f"[{lead_id}] Error submitting clarification response: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/clarification/{lead_id}/skip-remaining", response_model=ClarificationStatus)
def skip_lead_clarification(
    lead_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session)
):
    """Skips the remaining questions to immediately qualify/disqualify the lead with existing profile."""
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead request not found")
    try:
        status = skip_remaining_questions(str(lead_id))
        if status.status == "completed":
            background_tasks.add_task(provision_vapi_assistant_task, str(lead_id))
        return status
    except Exception as e:
        logger.error(f"[{lead_id}] Error skipping clarification: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/clarification/{lead_id}", response_model=ClarificationStatus)
def get_lead_clarification(lead_id: uuid.UUID, session: Session = Depends(get_session)):
    """Fetches the current status and profile extraction info for the lead."""
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead request not found")
    try:
        return get_clarification_status(str(lead_id))
    except Exception as e:
        logger.error(f"[{lead_id}] Error getting clarification status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))



