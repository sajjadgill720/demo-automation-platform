import os
import json
import urllib.request
import urllib.error
import re
import time
import hashlib
import logging
import uuid
from sqlmodel import Session
from app.db import engine
from app.models import DiscoveryResponse, Lead, AgentStatus

VAPI_API_KEY = os.getenv("VAPI_API_KEY", "")

def compile_agent_prompt(discovery: DiscoveryResponse) -> str:
    """Compiles a highly tailored system prompt for a Vapi Voice Receptionist"""
    company = discovery.company_name
    requirements = discovery.booking_requirements.replace(",", ", ") if discovery.booking_requirements else "name, phone"
    calendar = discovery.calendar_system.replace("_", " ").upper()
    escalation = discovery.escalation_path.replace("_", " ").upper()
    destination = discovery.integration_destination.replace("_", " ").upper()

    prompt = (
        f"You are Convoa, an elite AI Front-Desk Receptionist custom-built for {company}.\n\n"
        f"Your objective is to answer inbound calls professionally, answer client questions, and book appointments. "
        f"Keep your responses short, conversational, and direct (under 2 sentences per turn).\n\n"
        f"STEP 1 - Greet callers politely on behalf of {company} and ask how you can help them.\n"
        f"STEP 2 - When booking a meeting, you MUST gather the following customer details: [{requirements}]. "
        f"Do not ask for all details at once; ask for them one-by-one.\n"
        f"STEP 3 - Once details are collected, schedule the meeting inside the {calendar} integration pipeline.\n"
        f"STEP 4 - Confirm the booking and inform the caller that their details will sync to their {destination}.\n\n"
        f"ESCALATION ROUTING RULES:\n"
        f"If the client has an emergency, asks to speak to a manager, or requests a human transfer, follow this path: {escalation}."
    )
    return prompt

async def provision_vapi_assistant(company_name: str, prompt: str) -> dict:
    """Provisions a real Vapi assistant if VAPI_API_KEY is defined, or falls back to an intelligent mock.
    
    This is the legacy wrapper used by the discovery provisioning endpoint.
    """
    logger = logging.getLogger(__name__)
    try:
        assistant_id = _call_vapi_create_assistant(f"Convoa AI - {company_name}", prompt)
        provider = "mocked" if assistant_id.startswith("vapi_ast_mock_") else "vapi"
        status = "provisioned"
        return {
            "id": assistant_id,
            "name": f"Convoa AI - {company_name}",
            "model": "gpt-4o",
            "voice": "playht/susan",
            "prompt": prompt,
            "status": status,
            "provider": provider
        }
    except Exception as e:
        logger.warning(f"Failed to communicate with Vapi API in legacy call: {e}")
        # Fall back to mock so development does not block on network failure
        mock_id = f"vapi_ast_err_{int(time.time())}"
        return {
            "id": mock_id,
            "name": f"Convoa AI - {company_name} (Fallback)",
            "model": "gpt-4o",
            "voice": "playht/susan",
            "prompt": prompt,
            "status": "failed_real_provisioning_fallback_mock",
            "provider": "mocked"
        }


class VapiAPIError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(f"Vapi API HTTP {status_code}: {message}")


def _call_vapi_create_assistant(name: str, prompt: str) -> str:
    """Creates a Vapi assistant using the API.
    
    Includes mock fallback if key is missing/mock, and retry logic on transient errors.
    Returns the assistant_id.
    """
    logger = logging.getLogger(__name__)
    vapi_key = os.getenv("VAPI_API_KEY", "")
    if not vapi_key or vapi_key.startswith("dummy") or vapi_key.startswith("mock"):
        # Simulated Provisioning Pipeline Response using a custom string hash
        hash_object = hashlib.md5(name.encode('utf-8'))
        return f"vapi_ast_mock_{hash_object.hexdigest()[:8]}"

    url = "https://api.vapi.ai/assistant"
    payload = {
        "name": name,
        "transcriber": {
            "provider": "deepgram",
            "model": "nova-2",
            "language": "en-US"
        },
        "model": {
            "provider": "openai",
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "system",
                    "content": prompt
                }
            ]
        },
        "voice": {
            "provider": "vapi",
            "voiceId": "Emma"
        }
    }
    
    headers = {
        "Authorization": f"Bearer {vapi_key}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    req_body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=req_body, headers=headers, method="POST")
    
    attempts = 2
    for attempt in range(attempts):
        try:
            logger.info(f"Sending Vapi assistant creation request. Attempt {attempt + 1}/{attempts}")
            with urllib.request.urlopen(req, timeout=10) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                return res_data["id"]
        except urllib.error.HTTPError as e:
            status_code = e.code
            err_body = e.read().decode("utf-8") if e.fp else str(e)
            logger.warning(f"Vapi API returned HTTP {status_code} on attempt {attempt + 1}: {err_body}")
            
            # Retry on transient 5xx
            if status_code >= 500 and attempt < attempts - 1:
                time.sleep(1)
                continue
            raise VapiAPIError(status_code, err_body)
        except (urllib.error.URLError, TimeoutError) as e:
            logger.warning(f"Network error/timeout on attempt {attempt + 1}: {e}")
            if attempt < attempts - 1:
                time.sleep(1)
                continue
            raise e


from typing import Optional, Union, Any
from app.utils import sanitize_input


def compile_lead_prompt(company_name: str, industry: str, profile: Optional[Union[dict, Any]] = None) -> str:
    """Reads the static, version-controlled markdown template and renders it after sanitization.

    If profile is provided and contains non-UNKNOWN fields, injects a structured
    Client-Specific Profile Context section into the rendered prompt.
    """
    sanitized_company = sanitize_input(company_name)
    sanitized_industry = sanitize_input(industry)

    # Load template from file
    template_path = os.path.join(os.path.dirname(__file__), "templates", "vapi_prompt_template.md")
    with open(template_path, "r", encoding="utf-8") as f:
        template_content = f.read()

    # Build profile context if available
    profile_lines = []
    if profile:
        prof_dict = profile.dict() if hasattr(profile, "dict") else (profile if isinstance(profile, dict) else {})

        prob = prof_dict.get("primary_problem")
        if prob and prob != "UNKNOWN":
            profile_lines.append(f"- **Primary Problem**: {prob}")

        wf = prof_dict.get("current_workflow_summary")
        if wf and wf != "UNKNOWN":
            profile_lines.append(f"- **Current Workflow**: {wf}")

        scenarios = prof_dict.get("must_handle_scenarios")
        if scenarios and isinstance(scenarios, list) and len(scenarios) > 0:
            profile_lines.append(f"- **Must-Handle Scenarios**: {', '.join(scenarios)}")

        esc = prof_dict.get("escalation_preferences")
        if esc and esc != "UNKNOWN":
            profile_lines.append(f"- **Escalation Preference**: {esc}")

        cust = prof_dict.get("desired_customizations")
        if cust and cust != "UNKNOWN":
            profile_lines.append(f"- **Desired Customizations**: {cust}")

    if profile_lines:
        profile_block = "\n\n## Client-Specific Profile Context:\n" + "\n".join(profile_lines)
    else:
        profile_block = ""

    # Render prompt
    rendered = template_content.replace("{{company_name}}", sanitized_company)
    rendered = rendered.replace("{{industry}}", sanitized_industry)
    rendered = rendered.replace("{{profile_context}}", profile_block)
    return rendered


def provision_vapi_assistant_task(lead_id: str):
    """Background task to provision a Vapi AI assistant for the given lead."""
    logger = logging.getLogger(__name__)
    logger.info("Starting background Vapi provisioning task", extra={"extra_data": {"lead_id": lead_id}})
    
    with Session(engine) as session:
        db_lead_id = uuid.UUID(lead_id) if isinstance(lead_id, str) else lead_id
        lead = session.get(Lead, db_lead_id)
        if not lead:
            logger.error("Lead not found for provisioning", extra={"extra_data": {"lead_id": lead_id}})
            return
            
        try:
            # Recompile prompt using the finalized company profile
            from app.models import CompanyProfileDB
            from sqlmodel import select
            import json
            
            statement = select(CompanyProfileDB).where(CompanyProfileDB.lead_id == db_lead_id)
            profile_db = session.exec(statement).first()
            
            profile_data = None
            if profile_db and profile_db.profile:
                try:
                    profile_data = json.loads(profile_db.profile)
                except Exception:
                    pass
            
            rendered_prompt = compile_lead_prompt(lead.company_name, lead.industry, profile_data)
            lead.rendered_prompt = rendered_prompt
            
            assistant_id = _call_vapi_create_assistant(f"Convoa AI - {lead.company_name}", rendered_prompt)
            
            lead.assistant_id = assistant_id
            lead.agent_status = AgentStatus.active
            session.add(lead)
            session.commit()
            logger.info("Vapi assistant provisioned successfully", extra={"extra_data": {"lead_id": lead_id, "assistant_id": assistant_id}})
        except VapiAPIError as e:
            lead.agent_status = AgentStatus.failed
            lead.failure_reason = str(e)
            session.add(lead)
            session.commit()
            logger.error("Vapi assistant provisioning failed persistently (HTTP error)", extra={"extra_data": {"lead_id": lead_id, "status_code": e.status_code}})
        except Exception as e:
            lead.agent_status = AgentStatus.failed
            lead.failure_reason = f"Provisioning error: {str(e)}"
            session.add(lead)
            session.commit()
            logger.error("Vapi assistant provisioning failed persistently", extra={"extra_data": {"lead_id": lead_id}}, exc_info=True)


def delete_vapi_assistant(assistant_id: str) -> None:
    """Synchronous deletion of Vapi assistant.
    
    Implements retries on transient errors and fails immediately on persistent errors.
    """
    logger = logging.getLogger(__name__)
    logger.info("Starting Vapi assistant deletion", extra={"extra_data": {"assistant_id": assistant_id}})
    
    if not assistant_id:
        logger.warning("Empty assistant_id provided for deletion")
        return
        
    if assistant_id.startswith("vapi_ast_mock_"):
        logger.info("Simulating successful deletion of mock assistant", extra={"extra_data": {"assistant_id": assistant_id}})
        return
        
    vapi_key = os.getenv("VAPI_API_KEY", "")
    if not vapi_key:
        logger.warning("No VAPI_API_KEY configured. Skipping deletion.")
        return
        
    url = f"https://api.vapi.ai/assistant/{assistant_id}"
    headers = {
        "Authorization": f"Bearer {vapi_key}",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    req = urllib.request.Request(url, headers=headers, method="DELETE")
    
    attempts = 2
    for attempt in range(attempts):
        try:
            logger.info(f"Attempting Vapi assistant deletion. Attempt {attempt + 1}/{attempts}", extra={"extra_data": {"assistant_id": assistant_id}})
            with urllib.request.urlopen(req, timeout=10) as response:
                logger.info("Vapi assistant deleted successfully", extra={"extra_data": {"assistant_id": assistant_id}})
                return
        except urllib.error.HTTPError as e:
            status_code = e.code
            err_body = e.read().decode("utf-8") if e.fp else str(e)
            logger.warning(f"Vapi API delete returned HTTP {status_code} on attempt {attempt + 1}", extra={"extra_data": {"assistant_id": assistant_id, "response": err_body}})
            
            # Retry once on 5xx transient failures
            if status_code >= 500 and attempt < attempts - 1:
                time.sleep(1)
                continue
            
            # Persistent 4xx or retries exhausted
            logger.error("Vapi assistant deletion failed persistently", extra={"extra_data": {"assistant_id": assistant_id, "status_code": status_code}})
            raise e
        except (urllib.error.URLError, TimeoutError) as e:
            logger.warning(f"Network error/timeout on delete attempt {attempt + 1}: {e}", extra={"extra_data": {"assistant_id": assistant_id}})
            if attempt < attempts - 1:
                time.sleep(1)
                continue
            
            logger.error("Vapi assistant deletion failed persistently due to network error", extra={"extra_data": {"assistant_id": assistant_id}})
            raise e

