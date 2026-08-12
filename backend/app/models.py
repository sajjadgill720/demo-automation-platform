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
    llm_model: str = "gpt-4.1"
    voice_provider: str = "playht"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AgentStatus(str, Enum):
    pending = "pending"
    # Real intermediate provisioning stages. Each is set at an actual transition
    # point in provision_vapi_assistant_task — none is a timed/simulated step.
    # Added because generation now genuinely takes 1-2+ minutes (document
    # map-reduce summarization + profile extraction + assembly + Vapi call), and
    # a single indeterminate spinner for that long reads as broken.
    summarizing_documents = "summarizing_documents"
    building_profile = "building_profile"
    provisioning = "provisioning"
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
    # The problem statement the lead typed on the intake form. Stored so the
    # clarification chat can open with it and so profile extraction never re-asks
    # about a pain point the lead already described.
    problem_statement: Optional[str] = Field(default=None, nullable=True)
    # Which Vapi voice the client picked: "male" (Elliot) or "female" (Naina).
    voice_gender: Optional[str] = Field(default="female", max_length=16, nullable=True)
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
    file_name: Optional[str] = Field(default=None, nullable=True)
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
    business_brief: Optional[str] = Field(default=None, nullable=True)  # Persistent business brief
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ClarificationMessage(SQLModel, table=True):
    __tablename__ = "clarification_messages"
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    lead_id: uuid.UUID = Field(foreign_key="leads.id")
    role: MessageRole
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)





class FeedbackRating(str, Enum):
    positive = "positive"
    negative = "negative"


class DemoFeedback(SQLModel, table=True):
    """Client feedback submitted from the demo preview.

    Shown back to the client on their own preview (so they can see what they
    sent) and listed for the internal team. Previously the preview's feedback
    form only set local React state and showed a toast — nothing was stored, so
    no feedback ever reached anyone.
    """
    __tablename__ = "demo_feedback"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    lead_id: uuid.UUID = Field(foreign_key="leads.id", index=True)
    rating: FeedbackRating
    comment: Optional[str] = Field(default=None, nullable=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CallRecord(SQLModel, table=True):
    """A single conversation the client (or anyone) had with a provisioned agent.

    The native Vapi call report is the source of truth. When a browser demo call
    ends, the frontend sends us the Vapi `call.id`; a background task then pulls
    the call from Vapi's API (GET /call/{id}) and stores Vapi's own recording URL,
    transcript, summary and outcome. `status` tracks that fetch: "processing"
    while we wait for Vapi to finish the report, then "completed" (or "failed").
    """
    __tablename__ = "call_records"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    lead_id: uuid.UUID = Field(foreign_key="leads.id", index=True)
    # Vapi's own identifier for the call — the key we pull the native report with.
    vapi_call_id: Optional[str] = Field(default=None, max_length=255, index=True, nullable=True)
    assistant_id: Optional[str] = Field(default=None, max_length=255, nullable=True)
    started_at: Optional[datetime] = Field(default=None, nullable=True)
    ended_at: Optional[datetime] = Field(default=None, nullable=True)
    duration_seconds: int = Field(default=0)
    turn_count: int = Field(default=0)
    # Vapi's transcript, stored as a JSON string of [{"role", "text"}] turns.
    transcript: Optional[str] = Field(default=None, nullable=True)
    # Vapi's own end-of-call summary.
    summary: Optional[str] = Field(default=None, nullable=True)
    # URL to Vapi's audio recording of the call.
    recording_url: Optional[str] = Field(default=None, nullable=True)
    ended_reason: Optional[str] = Field(default=None, max_length=255, nullable=True)
    cost: Optional[float] = Field(default=None, nullable=True)
    # processing | completed | failed — state of the native-report fetch.
    status: str = Field(default="processing", max_length=32)
    created_at: datetime = Field(default_factory=datetime.utcnow)
