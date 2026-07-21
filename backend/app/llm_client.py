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

def call_structured_llm(
    prompt: str,
    schema: Type[T],
    retry_on_failure: bool = True
) -> T:
    """Dispatches a prompt to the configured LLM provider and parses structured JSON output into schema.
    
    Tries up to 2 times on transient failures (5xx, rate limits, timeouts) only.
    Validation errors are raised immediately for caller correction.
    """
    provider = os.getenv("LLM_PROVIDER", "groq").lower().strip()
    
    if provider == "groq":
        return _call_groq_structured(prompt, schema, retry_on_failure)
    elif provider == "other_provider":
        # Confirm exact API endpoint, auth header format, and request/response shape before implementing — do not guess.
        raise NotImplementedError(
            "Confirm exact API endpoint, auth header format, and request/response "
            "shape before implementing — do not guess."
        )
    else:
        raise ValueError(f"Unknown LLM provider: {provider}")

def _call_groq_structured(prompt: str, schema: Type[T], retry_on_failure: bool) -> T:
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
        "max_tokens": 1024,
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
