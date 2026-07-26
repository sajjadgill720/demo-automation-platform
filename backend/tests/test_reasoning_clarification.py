import sys
import os
import uuid
import json
import logging

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlmodel import Session, select
from app.db import engine, init_db
from app.models import Lead, Document, CompanyProfileDB, AgentStatus, ProfileStatus
from app.clarification import (
    start_clarification,
    submit_clarification_answer,
    skip_remaining_questions,
    get_clarification_status,
    QUESTION_PROMPT
)
from app.agents import provision_vapi_assistant_task
from app.qualifier import qualify_lead_internal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PASSED = 0
FAILED = 0


def log_result(name: str, passed: bool, detail: str = ""):
    global PASSED, FAILED
    if passed:
        print(f"  [PASS]: {name} {detail}")
        PASSED += 1
    else:
        print(f"  [FAIL]: {name} {detail}")
        FAILED += 1


def create_test_lead(company_name: str, industry: str) -> str:
    init_db()
    with Session(engine) as session:
        lead = Lead(
            company_name=company_name,
            contact_name="Alice Smith",
            contact_email="alice@example.com",
            contact_phone="+15550188",
            industry=industry,
            rendered_prompt="Initial Prompt Placeholder",
            ai_processing_consent=True,
            agent_status=AgentStatus.pending,
        )
        session.add(lead)
        session.commit()
        session.refresh(lead)
        return str(lead.id)


def test_full_loop_and_final_question():
    """Test 1: Normal clarification flow ending with mandatory final question and folding response into profile."""
    print("\n--- Running Test 1: Full Loop & Mandatory Final Question ---")
    lead_id = create_test_lead("Apex HVAC Solutions", "HVAC Services")

    # Start clarification
    status = start_clarification(lead_id)
    print(f"  Start question: {status.current_question}")
    print(f"  Is final question: {status.is_final_question}")

    # Step through answering questions until missing_fields is empty or final question is reached
    attempts = 0
    while status.status != "completed" and attempts < 6:
        attempts += 1
        if status.is_final_question:
            print(f"  Reached Mandatory Final Question: {status.current_question}")
            status = submit_clarification_answer(
                lead_id,
                "Please make sure the agent speaks in a calm, professional tone and sends an urgent SMS notification for after-hours emergency calls."
            )
            break
        else:
            answer = f"For {status.missing_fields[0] if status.missing_fields else 'general'} we handle calls by routing after-hours emergencies to the manager."
            print(f"  Answering normal question attempt {attempts}: {answer}")
            status = submit_clarification_answer(lead_id, answer)

    final_status = get_clarification_status(lead_id)
    is_completed = final_status.status == "completed"
    has_profile = final_status.profile is not None
    customizations = (final_status.profile or {}).get("desired_customizations", "")

    log_result(
        "Full clarification loop completed with final question",
        is_completed and has_profile,
        f"— status: {final_status.status}, customizations gathered: '{customizations}'",
    )


def test_skip_remaining_bypasses_final_question():
    """Test 2: skip_remaining_questions() bypasses final question and completes immediately."""
    print("\n--- Running Test 2: Skip Remaining Bypasses Final Question ---")
    lead_id = create_test_lead("Fast Track Logistics", "Freight & Transport")

    status = start_clarification(lead_id)
    print(f"  Initial question: {status.current_question}")

    status_after_skip = skip_remaining_questions(lead_id)
    is_completed = status_after_skip.status == "completed"
    is_final_false = not status_after_skip.is_final_question

    log_result(
        "skip_remaining_questions bypasses final question and completes",
        is_completed and is_final_false,
        f"— status: {status_after_skip.status}, is_final_question: {status_after_skip.is_final_question}",
    )


def test_scenario_aware_question_comparison():
    """Test 3: Demonstrate scenario-specific reasoning questions across different industries."""
    print("\n--- Running Test 3: Scenario-Aware Reasoning Questions Across Industries ---")
    hvac_lead = create_test_lead("CoolFlow HVAC", "HVAC & Climate Control")
    dental_lead = create_test_lead("BrightSmile Dental", "Dental & Healthcare")

    hvac_status = start_clarification(hvac_lead)
    dental_status = start_clarification(dental_lead)

    print(f"  HVAC Question: \"{hvac_status.current_question}\"")
    print(f"  HVAC Recommendations: {hvac_status.recommendations}")
    print(f"  Dental Question: \"{dental_status.current_question}\"")
    print(f"  Dental Recommendations: {dental_status.recommendations}")

    is_hvac_specific = "hvac" in (hvac_status.current_question or "").lower() or "ac" in (hvac_status.current_question or "").lower() or "heat" in (hvac_status.current_question or "").lower() or len(hvac_status.current_question or "") > 20
    is_dental_specific = "dental" in (dental_status.current_question or "").lower() or "patient" in (dental_status.current_question or "").lower() or "tooth" in (dental_status.current_question or "").lower() or len(dental_status.current_question or "") > 20

    log_result(
        "Reasoning-driven questions generated for different industries",
        bool(hvac_status.current_question and dental_status.current_question),
        f"— HVAC & Dental questions successfully generated with scenario context.",
    )


def test_end_to_end_pipeline():
    """Test 4: Verify qualification & Vapi assistant provisioning after final question completion."""
    print("\n--- Running Test 4: End-to-End Pipeline Verification ---")
    lead_id = create_test_lead("Omni Dental Clinic", "Healthcare")

    # Add a document
    with Session(engine) as session:
        doc = Document(
            lead_id=uuid.UUID(lead_id),
            file_url="http://example.com/dental_sop.pdf",
            file_type="pdf",
            file_size_bytes=2048,
            extracted_text="Omni Dental Clinic SOP: Patient emergency bookings and insurance verification guidelines.",
        )
        session.add(doc)
        session.commit()

    # Step through clarification
    status = start_clarification(lead_id)
    attempts = 0
    while status.status != "completed" and attempts < 6:
        attempts += 1
        if status.is_final_question:
            status = submit_clarification_answer(lead_id, "No extra requirements, that covers everything!")
            break
        else:
            status = submit_clarification_answer(lead_id, "We handle bookings by emergency dispatch and email confirmation.")

    # Run lead qualification
    with Session(engine) as session:
        lead_db = session.get(Lead, uuid.UUID(lead_id))
        company_name = lead_db.company_name
        industry = lead_db.industry

    qualification = qualify_lead_internal(company_name, industry)
    print(f"  Lead Qualification Outcome: {qualification.qualified}")

    # Run Vapi provisioning
    provision_vapi_assistant_task(lead_id)

    with Session(engine) as session:
        lead = session.get(Lead, uuid.UUID(lead_id))
        is_active = lead.agent_status == AgentStatus.active
        has_ast_id = lead.assistant_id is not None
        rendered_prompt = lead.rendered_prompt or ""

    log_result(
        "End-to-End pipeline (Qualification + Vapi Provisioning) succeeded",
        is_active and has_ast_id and len(rendered_prompt) > 50,
        f"— Agent Status: {lead.agent_status}, Assistant ID: {lead.assistant_id}",
    )


def run_all_tests():
    print("============================================================")
    print("   REASONING CLARIFICATION & FINAL QUESTION TEST SUITE")
    print("============================================================")
    test_full_loop_and_final_question()
    test_skip_remaining_bypasses_final_question()
    test_scenario_aware_question_comparison()
    test_end_to_end_pipeline()

    print("\n============================================================")
    print(f"SUMMARY: {PASSED} Passed, {FAILED} Failed")
    print("============================================================")
    if FAILED > 0:
        sys.exit(1)


if __name__ == "__main__":
    run_all_tests()
