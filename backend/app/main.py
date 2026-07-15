from contextlib import asynccontextmanager
import uuid
import logging
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

from app.logging_config import setup_logging
# Initialize structured JSON logging
setup_logging()

logger = logging.getLogger(__name__)

from app.db import init_db, get_session
from app.config import CORS_ORIGINS
from app.models import DiscoveryResponse, VoiceAgent, Lead, AgentStatus
from app.agents import (
    compile_agent_prompt, 
    provision_vapi_assistant,
    compile_lead_prompt,
    provision_vapi_assistant_task,
    delete_vapi_assistant
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


@app.post("/api/demo-request", response_model=LeadResponse, status_code=201)
def create_demo_request(
    payload: DemoRequestCreate,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session)
):
    """Creates a new demo request lead, renders their prompt template,
    and schedules Vapi assistant provisioning in the background.
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
    
    # Enqueue background task to provision the Vapi assistant
    # NOTE: BackgroundTasks does not persist across a server restart and has no retry queue of its own.
    # Acceptable for this MVP scope. When this graduates toward the full roadmap, this needs to move
    # to Celery + Redis for durability — do not let this quietly stay as BackgroundTasks once real traffic depends on it.
    background_tasks.add_task(provision_vapi_assistant_task, str(lead.id))
    
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


