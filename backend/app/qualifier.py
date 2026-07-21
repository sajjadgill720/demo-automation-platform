"""
Lead Qualification Module using LangGraph
=========================================
Performs input check via hard filters node, then passes to LLM node.
Uses Groq LLM model to qualify leads. Fail-open by default if Groq fails or API key is not present.
"""

import os
import json
import logging
import urllib.request
import urllib.error
from typing import TypedDict, Optional
from pydantic import BaseModel, Field, ValidationError
from langgraph.graph import StateGraph, END

logger = logging.getLogger("app.qualifier")

# ── Pydantic Models ──

class QualifyRequest(BaseModel):
    company_name: str
    industry: str


class QualificationResult(BaseModel):
    qualified: bool
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str


# ── Constants ──

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """You are a B2B lead qualification analyst for a logistics/supply-chain voice-AI platform called DataQuartz.

Your job is to evaluate whether a prospective company is a genuine B2B lead worth provisioning a demo voice agent for.

Evaluate based on:
1. Is the company name a real or plausible business name? (not random characters or test data)
2. Is the industry relevant to B2B services? (logistics, trucking, freight, supply chain, warehousing, transportation, fleet management, and similar industries are ideal; other legitimate B2B industries are acceptable)
3. Does the combination of company name + industry suggest a genuine business inquiry?

Return your assessment as a JSON object with exactly these fields:
- "qualified": boolean (true if the lead appears legitimate)
- "confidence": float between 0.0 and 1.0
- "reasoning": string explaining your decision in one sentence

Examples of UNQUALIFIED leads:
- company_name: "asdfasdf", industry: "none" → not a real company
- company_name: "test", industry: "test" → test submission
- company_name: "xxx", industry: "aaa" → gibberish

Examples of QUALIFIED leads:
- company_name: "Amazon Logistics", industry: "Logistics" → legitimate B2B
- company_name: "Blue Ridge Trucking", industry: "Transportation" → legitimate B2B
- company_name: "Smith & Sons HVAC", industry: "Field Services" → legitimate B2B"""


# ── LangGraph State Definition ──

class QualificationState(TypedDict):
    # Inputs
    company_name: str
    industry: str
    profile: Optional[dict]
    
    # Final Output fields
    qualified: Optional[bool]
    confidence: Optional[float]
    reasoning: Optional[str]


# Helper function to call Groq API
def _call_groq(messages: list[dict], api_key: str) -> dict:
    """
    Call Groq /v1/chat/completions with JSON response format using urllib.
    Returns the parsed JSON content from the assistant message.
    """
    payload = json.dumps({
        "model": GROQ_MODEL,
        "messages": messages,
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
        "max_tokens": 256,
    }).encode("utf-8")

    req = urllib.request.Request(
        GROQ_API_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=15) as resp:
        body = json.loads(resp.read().decode("utf-8"))

    content = body["choices"][0]["message"]["content"]
    return json.loads(content)


# ── LangGraph Nodes ──

def hard_filters_node(state: QualificationState) -> QualificationState:
    """Check hard filter criteria. Empty or blank company or industry disqualifies."""
    company = state.get("company_name", "").strip()
    industry = state.get("industry", "").strip()
    
    logger.info(f"Running hard filters for company: '{company}', industry: '{industry}'")
    
    if not company or not industry:
        return {
            **state,
            "qualified": False,
            "confidence": 1.0,
            "reasoning": "incomplete submission data",
        }
        
    return state


def llm_qualification_node(state: QualificationState) -> QualificationState:
    """Run the structured LLM qualification flow with Groq API call, handling retries and fallback."""
    company = state.get("company_name", "").strip()
    industry = state.get("industry", "").strip()
    
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        logger.warning("GROQ_API_KEY not set — failing open")
        return {
            **state,
            "qualified": True,
            "confidence": 1.0,
            "reasoning": "qualification check failed, defaulting to proceed",
        }
        
    profile = state.get("profile")
    if profile:
        user_content = (
            f"Evaluate this lead:\n"
            f'company_name: "{company}"\n'
            f'industry: "{industry}"\n'
            f'primary_problem: "{profile.get("primary_problem", "UNKNOWN")}"\n'
            f'must_handle_scenarios: {profile.get("must_handle_scenarios", [])}\n'
            f'desired_customizations: "{profile.get("desired_customizations", "UNKNOWN")}"'
        )
    else:
        user_content = f'Evaluate this lead:\ncompany_name: "{company}"\nindustry: "{industry}"'

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": user_content,
        },
    ]

    # Attempt 1
    try:
        raw = _call_groq(messages, api_key)
        res = QualificationResult(**raw)
        return {
            **state,
            "qualified": res.qualified,
            "confidence": res.confidence,
            "reasoning": res.reasoning,
        }
    except (ValidationError, json.JSONDecodeError, KeyError, TypeError) as e:
        logger.warning(f"First LLM attempt failed validation: {e} — retrying", exc_info=True)
        # Attempt 2 (retry once with feedback)
        try:
            messages.append({
                "role": "assistant",
                "content": json.dumps(raw) if 'raw' in locals() else "{}",
            })
            messages.append({
                "role": "user",
                "content": (
                    f"Your previous response was invalid: {e}. "
                    "Please respond with a valid JSON object containing exactly: "
                    '"qualified" (bool), "confidence" (float 0-1), "reasoning" (string).'
                ),
            })
            raw = _call_groq(messages, api_key)
            res = QualificationResult(**raw)
            return {
                **state,
                "qualified": res.qualified,
                "confidence": res.confidence,
                "reasoning": res.reasoning,
            }
        except Exception as e2:
            logger.error("Second LLM attempt also failed: %s — failing open", e2, exc_info=True)
            return {
                **state,
                "qualified": True,
                "confidence": 1.0,
                "reasoning": "qualification check failed, defaulting to proceed",
            }
    except Exception as e:
        logger.error("Groq API call failed: %s — failing open", e, exc_info=True)
        return {
            **state,
            "qualified": True,
            "confidence": 1.0,
            "reasoning": "qualification check failed, defaulting to proceed",
        }


# ── LangGraph Routing ──

def route_after_filters(state: QualificationState):
    """Router function to check if lead was disqualified by hard filters."""
    if state.get("qualified") is False:
        return END
    return "llm_qualification"


# ── Assemble and Compile the Graph ──

workflow = StateGraph(QualificationState)

# Add Nodes
workflow.add_node("hard_filters", hard_filters_node)
workflow.add_node("llm_qualification", llm_qualification_node)

# Set Entry Point and Edges
workflow.set_entry_point("hard_filters")
workflow.add_conditional_edges("hard_filters", route_after_filters)
workflow.add_edge("llm_qualification", END)

compiled_graph = workflow.compile()


# ── Exported API Functions ──

def qualify_lead_internal(company_name: str, industry: str, profile: Optional[BaseModel] = None) -> QualificationResult:
    """
    Main external function that executes the LangGraph lead qualification workflow.
    """
    initial_state = {
        "company_name": company_name,
        "industry": industry,
        "profile": profile.dict() if profile else None,
        "qualified": None,
        "confidence": None,
        "reasoning": None,
    }
    
    result_state = compiled_graph.invoke(initial_state)
    
    return QualificationResult(
        qualified=result_state["qualified"],
        confidence=result_state["confidence"],
        reasoning=result_state["reasoning"],
    )
