import os
import json
import logging
import urllib.request
import urllib.error
import time
from typing import Type, TypeVar
from pydantic import BaseModel, ValidationError

logger = logging.getLogger("app.llm_client")

T = TypeVar("T", bound=BaseModel)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"

FIREWORKS_API_URL = "https://api.fireworks.ai/inference/v1/chat/completions"
#: Overridable so a model swap needs no code change. Defaults to the model the
#: inference layer was cut over to.
FIREWORKS_MODEL = os.getenv("FIREWORKS_MODEL", "accounts/fireworks/models/minimax-m3")

def call_structured_llm(
    prompt: str,
    schema: Type[T],
    retry_on_failure: bool = True,
    max_tokens: int = 1024,
) -> T:
    """Dispatches a prompt to the configured LLM provider and parses structured JSON output into schema.

    Tries up to 2 times on transient failures (5xx, rate limits, timeouts) only.
    Validation errors are raised immediately for caller correction.

    max_tokens caps the completion length. The default (1024) suits the short
    structured extractions most callers make; longer generations — e.g. the
    company-context prompt block — pass a higher value.

    PROVIDER SELECTION
    ------------------
    Fireworks is the primary inference layer; Groq is the fallback. With no
    explicit override the call goes to Fireworks whenever FIREWORKS_API_KEY is
    set, and on ANY Fireworks failure (transient error, or malformed/invalid
    output that the retries could not fix) it transparently falls back to Groq if
    GROQ_API_KEY is available — so a Fireworks outage degrades to Groq rather than
    failing the caller. Set LLM_PROVIDER=groq (or =fireworks) to pin one provider
    and disable the fallback; if neither key is set the Groq path raises as before.
    """
    provider = os.getenv("LLM_PROVIDER", "").lower().strip()
    fireworks_key = os.getenv("FIREWORKS_API_KEY")
    groq_key = os.getenv("GROQ_API_KEY")

    # Explicit pin: honour it exactly, no cross-provider fallback.
    if provider == "groq":
        return _call_groq_structured(prompt, schema, retry_on_failure, max_tokens)
    if provider == "fireworks":
        return _call_fireworks_structured(prompt, schema, retry_on_failure, max_tokens)

    # Default: Fireworks primary, Groq fallback.
    if fireworks_key:
        try:
            return _call_fireworks_structured(prompt, schema, retry_on_failure, max_tokens)
        except Exception as e:
            if groq_key:
                logger.warning(f"Fireworks call failed ({e}) — falling back to Groq")
                return _call_groq_structured(prompt, schema, retry_on_failure, max_tokens)
            raise

    # No Fireworks key configured: use Groq (unchanged legacy behaviour).
    return _call_groq_structured(prompt, schema, retry_on_failure, max_tokens)

def _call_fireworks_structured(
    prompt: str, schema: Type[T], retry_on_failure: bool, max_tokens: int = 1024
) -> T:
    """Fireworks equivalent of _call_groq_structured.

    Fireworks exposes an OpenAI-compatible chat/completions endpoint, so the
    request/response shape and the JSON-mode + validation handling mirror the Groq
    path exactly; only the URL, model and auth key differ. Kept as its own function
    (rather than parameterising the Groq one) so each provider's quirks can diverge
    without entangling the other.
    """
    api_key = os.getenv("FIREWORKS_API_KEY")
    if not api_key:
        raise ValueError("FIREWORKS_API_KEY environment variable is not set.")

    messages = [
        {
            "role": "user",
            "content": prompt
        }
    ]

    payload = json.dumps({
        "model": FIREWORKS_MODEL,
        "messages": messages,
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
        "max_tokens": max_tokens,
    }).encode("utf-8")

    req = urllib.request.Request(
        FIREWORKS_API_URL,
        data=payload,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        method="POST",
    )

    max_attempts = 2 if retry_on_failure else 1

    for attempt in range(max_attempts):
        try:
            logger.info(f"Calling Fireworks LLM API. Attempt {attempt + 1}/{max_attempts}")
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = json.loads(resp.read().decode("utf-8"))

            content_str = body["choices"][0]["message"]["content"]
            parsed_json = json.loads(content_str)
            return schema(**parsed_json)

        except ValidationError as e:
            # Raise validation errors immediately so calling nodes can implement feedback retries
            logger.error(f"LLM output validation error: {e}")
            raise e
        except json.JSONDecodeError as e:
            logger.error(f"LLM output JSON decode error: {e}")
            raise e
        except urllib.error.HTTPError as e:
            status_code = e.code
            err_body = e.read().decode("utf-8") if e.fp else str(e)
            logger.warning(f"Fireworks API returned HTTP {status_code} on attempt {attempt + 1}: {err_body}")

            is_transient = (status_code >= 500) or (status_code == 429)
            if is_transient and attempt < max_attempts - 1:
                time.sleep(1)
                continue
            raise e
        except (urllib.error.URLError, TimeoutError) as e:
            logger.warning(f"Network error/timeout on attempt {attempt + 1}: {e}")
            if attempt < max_attempts - 1:
                time.sleep(1)
                continue
            raise e


def _call_groq_structured(
    prompt: str, schema: Type[T], retry_on_failure: bool, max_tokens: int = 1024
) -> T:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable is not set.")

    messages = [
        {
            "role": "user",
            "content": prompt
        }
    ]

    payload = json.dumps({
        "model": GROQ_MODEL,
        "messages": messages,
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
        "max_tokens": max_tokens,
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

    max_attempts = 2 if retry_on_failure else 1
    
    for attempt in range(max_attempts):
        try:
            logger.info(f"Calling Groq LLM API. Attempt {attempt + 1}/{max_attempts}")
            with urllib.request.urlopen(req, timeout=15) as resp:
                body = json.loads(resp.read().decode("utf-8"))
            
            content_str = body["choices"][0]["message"]["content"]
            parsed_json = json.loads(content_str)
            return schema(**parsed_json)

        except ValidationError as e:
            # Raise validation errors immediately so calling nodes can implement feedback retries
            logger.error(f"LLM output validation error: {e}")
            raise e
        except json.JSONDecodeError as e:
            logger.error(f"LLM output JSON decode error: {e}")
            raise e
        except urllib.error.HTTPError as e:
            status_code = e.code
            err_body = e.read().decode("utf-8") if e.fp else str(e)
            logger.warning(f"Groq API returned HTTP {status_code} on attempt {attempt + 1}: {err_body}")
            
            is_transient = (status_code >= 500) or (status_code == 429)
            if is_transient and attempt < max_attempts - 1:
                time.sleep(1)
                continue
            raise e
        except (urllib.error.URLError, TimeoutError) as e:
            logger.warning(f"Network error/timeout on attempt {attempt + 1}: {e}")
            if attempt < max_attempts - 1:
                time.sleep(1)
                continue
            raise e
