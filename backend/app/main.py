from contextlib import asynccontextmanager
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
from datetime import datetime
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
    CompanyProfileDB
)
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
    ClarificationStatus,
    ClarificationAnswer
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables and compile schemas automatically on start
    init_db()
    yield

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

class LeadResponse(BaseModel):
    id: uuid.UUID
    company_name: str
    contact_name: str
    contact_email: str
    contact_phone: str
    industry: str
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

@app.get("/api/demos")
def get_demos():
    # Placeholder: returning an empty list to satisfy requirements
    return []

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
    
    lead = Lead(
        company_name=payload.company_name,
        contact_name=payload.contact_name,
        contact_email=payload.contact_email,
        contact_phone=payload.contact_phone,
        industry=payload.industry,
        rendered_prompt=rendered_prompt,
        agent_status=AgentStatus.pending
    )
    
    session.add(lead)
    session.commit()
    session.refresh(lead)
    
    logger.info("Saved lead to database", extra={"extra_data": {"lead_id": str(lead.id)}})
    return lead


@app.get("/api/demo-request/{lead_id}", response_model=LeadResponse)
def get_demo_request(lead_id: uuid.UUID, session: Session = Depends(get_session)):
    """Fetches a lead record by ID to poll status during background provisioning."""
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead request not found")
    return lead


@app.post("/api/demo-request/{lead_id}/end-session")
def end_demo_session(lead_id: uuid.UUID, session: Session = Depends(get_session)):
    """Deletes the Vapi assistant for the lead and marks status as completed."""
    logger.info("Received request to end demo session", extra={"extra_data": {"lead_id": str(lead_id)}})
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead request not found")
        
    if lead.assistant_id:
        try:
            delete_vapi_assistant(lead.assistant_id)
        except Exception as e:
            # Wrap in try/except so persistent failures/network glitches do not crash the request
            # We log the error but proceed with database status update to avoid orphaned state in DB
            logger.error(
                f"Failed to delete Vapi assistant {lead.assistant_id} during end-session",
                exc_info=True,
                extra={"extra_data": {"lead_id": str(lead_id)}}
            )
            
    lead.agent_status = AgentStatus.completed
    lead.updated_at = datetime.utcnow()
    session.add(lead)
    session.commit()
    session.refresh(lead)
    
    # TODO: scheduled cleanup job to delete Vapi assistants older than
    # N hours with agent_status still "active" and no end-session call.
    # This is a known gap to prevent orphaned assistants.
    
    logger.info("Demo session ended successfully", extra={"extra_data": {"lead_id": str(lead_id)}})
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



