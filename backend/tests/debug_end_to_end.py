import os
import sys
import uuid
import datetime
from sqlmodel import Session, select

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.db import engine
from app.models import Lead, Document, CompanyProfileDB
from app.clarification import (
    start_clarification,
    get_clarification_status,
    skip_remaining_questions
)
from app.storage import upload_document

def run_diagnostic():
    print("=" * 70)
    print("  END-TO-END DIAGNOSTIC TRACE — CLARIFICATION FLOW")
    print("=" * 70)

    # 1. Create a Test Lead
    lead_id = uuid.uuid4()
    lead_id_str = str(lead_id)
    company_name = "Diagnostic Freight Corp"
    industry = "Logistics"

    print(f"\n--- STEP 1 & 2: CREATE LEAD & CHECK CONSENT IN DB ---")
    from app.agents import compile_lead_prompt
    with Session(engine) as session:
        lead = Lead(
            id=lead_id,
            company_name=company_name,
            contact_name="Alice Tester",
            contact_email="alice@diagnosticfreight.com",
            contact_phone="+15551234",
            industry=industry,
            rendered_prompt=compile_lead_prompt(company_name, industry),
            ai_processing_consent=False  # default state
        )
        session.add(lead)
        session.commit()
        session.refresh(lead)

    print(f"Created Lead ID: {lead_id_str}")
    print(f"  [DB CHECKPOINT STEP 2]: ai_processing_consent = {lead.ai_processing_consent}")
    print(f"  [DB CHECKPOINT STEP 2]: consent_recorded_at   = {lead.consent_recorded_at}")

    # 2. Upload Document (Simulating document upload endpoint)
    print(f"\n--- STEP 3: UPLOAD DOCUMENT & CHECK PARSED TEXT IN DB ---")
    sop_content = (
        "DIAGNOSTIC FREIGHT SOP:\n"
        "We are losing container tracking calls after 7 PM on weekdays.\n"
        "Current workflow: Manual paper log book with next-day phone callback.\n"
        "Must handle: Container status check, expediting hot loads, driver dispatch.\n"
        "Escalation: Forward urgent calls to lead dispatcher John at +15559988.\n"
        "Tone: Professional, urgent, and precise."
    )
    
    file_bytes = sop_content.encode("utf-8")
    file_url = upload_document(lead_id_str, "diagnostic_sop.txt", file_bytes, "text/plain")

    with Session(engine) as session:
        doc = Document(
            id=uuid.uuid4(),
            lead_id=lead_id,
            file_url=file_url,
            file_type="text/plain",
            file_size_bytes=len(file_bytes),
            extracted_text=sop_content,
            uploaded_at=datetime.datetime.utcnow()
        )
        session.add(doc)
        session.commit()

    with Session(engine) as session:
        statement = select(Document).where(Document.lead_id == lead_id)
        saved_docs = session.exec(statement).all()
        print(f"Document Upload Result: URL = {file_url}")
        print(f"  [DB CHECKPOINT STEP 3]: Count of docs found in DB = {len(saved_docs)}")
        for d in saved_docs:
            print(f"  [DB CHECKPOINT STEP 3]: doc_id = {d.id}")
            print(f"  [DB CHECKPOINT STEP 3]: extracted_text length = {len(d.extracted_text or '')}")
            print(f"  [DB CHECKPOINT STEP 3]: extracted_text snippet:\n'{d.extracted_text[:120]}...'")

    # 3. Simulate User Toggling Consent = True (POST /api/clarification/{lead_id}/consent)
    print(f"\n--- STEP 2b: UPDATE CONSENT TO TRUE & VERIFY PERSISTENCE ---")
    with Session(engine) as session:
        lead = session.get(Lead, lead_id)
        lead.ai_processing_consent = True
        lead.consent_recorded_at = datetime.datetime.utcnow()
        session.add(lead)
        session.commit()
        session.refresh(lead)

        print(f"  [DB CHECKPOINT STEP 2 AFTER UPDATE]: ai_processing_consent = {lead.ai_processing_consent}")
        print(f"  [DB CHECKPOINT STEP 2 AFTER UPDATE]: consent_recorded_at   = {lead.consent_recorded_at}")

    # 4. Trigger start_clarification (Executes parse_documents_node -> extract_profile_node)
    print(f"\n--- STEP 4 & 6: RUN START_CLARIFICATION & TRACE RUNTIME LOGS ---")
    status = start_clarification(lead_id_str)
    
    print(f"\n  [RUNTIME CHECKPOINT]: Clarification status after start:")
    print(f"    status           = {status.status}")
    print(f"    current_question = {status.current_question}")
    print(f"    missing_fields   = {status.missing_fields}")
    print(f"    extracted profile= {status.profile}")

if __name__ == "__main__":
    run_diagnostic()
