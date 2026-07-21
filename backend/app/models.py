from typing import Optional
from datetime import datetime
from enum import Enum
import uuid
from sqlmodel import SQLModel, Field

class Company(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    domain: str
    industry: Optional[str] = None
    country: Optional[str] = None
    email: Optional[str] = None
    summary: Optional[str] = None
    confidence: float = 0.85
    logo_color: Optional[str] = None
    logo_initials: Optional[str] = None

class DemoJob(SQLModel, table=True):
    id: str = Field(primary_key=True)
    product: str
    status: str
    research_status: str
    agent_status: str
    created_at: str
    expires_at: str
    views: int = 0
    calls: int = 0
    meeting_booked: bool = False

class DiscoveryResponse(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    company_name: str
    contact_email: str
    
    # Block 1: Revenue Leakage Inputs
    missed_calls_per_week: int
    average_booking_value: float
    calculated_monthly_leakage: float
    
    # Block 2: Booking System Integration
    calendar_system: str
    booking_requirements: str
    
    # Block 3: Escalation & Flow
    escalation_path: str
    integration_destination: str
    
    created_at: datetime = Field(default_factory=datetime.utcnow)


class VoiceAgent(SQLModel, table=True):
    id: str = Field(primary_key=True)  # Vapi assistant_id or mock ID
    company_name: str
    discovery_id: int
    system_prompt: str
    llm_model: str = "gpt-4o"
    voice_provider: str = "playht"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AgentStatus(str, Enum):
    pending = "pending"
    active = "active"
    completed = "completed"
    failed = "failed"
    skipped = "skipped"  # Used when lead is unqualified and Vapi provisioning is bypassed


class Lead(SQLModel, table=True):
    __tablename__ = "leads"
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    company_name: str = Field(max_length=255)
    contact_name: str = Field(max_length=255)
    contact_email: str = Field(max_length=255)
    contact_phone: str = Field(max_length=50)
    industry: str = Field(max_length=255)
    rendered_prompt: str
    assistant_id: Optional[str] = Field(default=None, max_length=255, nullable=True)
    agent_status: AgentStatus = Field(default=AgentStatus.pending)
    failure_reason: Optional[str] = Field(default=None, nullable=True)
    qualified: Optional[bool] = Field(default=None, nullable=True)
    qualification_confidence: Optional[float] = Field(default=None, nullable=True)
    qualification_reasoning: Optional[str] = Field(default=None, nullable=True)
    ai_processing_consent: bool = Field(default=False)
    consent_recorded_at: Optional[datetime] = Field(default=None, nullable=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ProfileStatus(str, Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    awaiting_user = "awaiting_user"
    completed = "completed"


class MessageRole(str, Enum):
    assistant = "assistant"
    user = "user"


class Document(SQLModel, table=True):
    __tablename__ = "documents"
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    lead_id: uuid.UUID = Field(foreign_key="leads.id")
    file_url: str
    file_type: str = Field(max_length=50)
    file_size_bytes: int
    extracted_text: Optional[str] = Field(default=None, nullable=True)
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)


class CompanyProfileDB(SQLModel, table=True):
    __tablename__ = "company_profile"
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    lead_id: uuid.UUID = Field(foreign_key="leads.id", unique=True)
    profile: Optional[str] = Field(default=None, nullable=True)  # JSON string
    status: ProfileStatus = Field(default=ProfileStatus.not_started)
    missing_fields: Optional[str] = Field(default=None, nullable=True)  # JSON string
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ClarificationMessage(SQLModel, table=True):
    __tablename__ = "clarification_messages"
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    lead_id: uuid.UUID = Field(foreign_key="leads.id")
    role: MessageRole
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)



