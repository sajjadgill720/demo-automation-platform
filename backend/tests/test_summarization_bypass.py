import sys
import os
import uuid
import logging
from unittest.mock import patch, MagicMock

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlmodel import Session, select
from app.db import engine, init_db
from app.models import Lead, Document, AgentStatus, CompanyProfileDB
from app.agents import provision_vapi_assistant_task

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_summarization_bypass():
    init_db()
    with Session(engine) as session:
        # Create lead
        lead = Lead(
            company_name="Bypass Test Corp",
            contact_name="Tester",
            contact_email="tester@example.com",
            contact_phone="+15559999",
            industry="Testing Services",
            rendered_prompt="placeholder",
            ai_processing_consent=True,
            agent_status=AgentStatus.pending,
        )
        session.add(lead)
        session.commit()
        session.refresh(lead)
        lead_id = lead.id

        # Add document
        doc = Document(
            lead_id=lead_id,
            file_url="http://example.com/test.pdf",
            file_type="pdf",
            file_size_bytes=1024,
            extracted_text="Some document text that needs summarizing.",
        )
        session.add(doc)

        # Add Company Profile DB record
        profile = CompanyProfileDB(
            lead_id=lead_id,
            profile=None,
            status="in_progress",
            missing_fields=None,
            business_brief=None,
        )
        session.add(profile)
        session.commit()

    # Case 1: First run with no business_brief in DB.
    # It must call summarize_documents and then save it to the database.
    mock_brief = "This is a mock summarized business brief."
    with patch("app.document_summarizer.summarize_documents", return_value=mock_brief) as mock_summarize, \
         patch("app.vapi_knowledge_base.upload_to_knowledge_base", return_value="vapi_kb_123") as mock_upload, \
         patch("app.vapi_knowledge_base.attach_knowledge_base", return_value=True) as mock_attach, \
         patch("app.storage.download_document", return_value=b"%PDF-1.4 raw bytes") as mock_download, \
         patch("app.agents._call_vapi_create_assistant", return_value="vapi_ast_123") as mock_create_ast, \
         patch("app.prompt_generator.generate_company_content_fields", return_value={}) as mock_gen_block:

        provision_vapi_assistant_task(str(lead_id))

        # Verification 1
        mock_summarize.assert_called_once()
        with Session(engine) as session:
            profile_db = session.exec(
                select(CompanyProfileDB).where(CompanyProfileDB.lead_id == lead_id)
            ).first()
            assert profile_db is not None
            assert profile_db.business_brief == mock_brief
            print("[PASS] Case 1: Summarized and saved to DB successfully.")

    # Reset lead status for Case 2
    with Session(engine) as session:
        lead = session.get(Lead, lead_id)
        lead.agent_status = AgentStatus.pending
        session.add(lead)
        session.commit()

    # Case 2: Second run. Business brief is already in DB.
    # It must NOT call summarize_documents, but still succeed using the DB brief.
    with patch("app.document_summarizer.summarize_documents") as mock_summarize, \
         patch("app.vapi_knowledge_base.upload_to_knowledge_base", return_value="vapi_kb_123") as mock_upload, \
         patch("app.vapi_knowledge_base.attach_knowledge_base", return_value=True) as mock_attach, \
         patch("app.storage.download_document", return_value=b"%PDF-1.4") as mock_download, \
         patch("app.agents._call_vapi_create_assistant", return_value="vapi_ast_456") as mock_create_ast, \
         patch("app.prompt_generator.generate_company_content_fields", return_value={}) as mock_gen_block:

        provision_vapi_assistant_task(str(lead_id))

        # Verification 2
        mock_summarize.assert_not_called()
        with Session(engine) as session:
            updated_lead = session.get(Lead, lead_id)
            assert updated_lead.agent_status == AgentStatus.active
            assert updated_lead.assistant_id == "vapi_ast_456"
            print("[PASS] Case 2: Bypassed summarize_documents successfully using DB brief.")

if __name__ == "__main__":
    test_summarization_bypass()
    print("ALL TESTS PASSED!")
