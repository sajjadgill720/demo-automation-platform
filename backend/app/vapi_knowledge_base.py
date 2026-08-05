import os
import json
import uuid
import time
import hashlib
import logging
import urllib.request
import urllib.error
from typing import Optional

logger = logging.getLogger(__name__)

VAPI_API_KEY = os.getenv("VAPI_API_KEY", "")


import re

def sanitize_filename(filename: str, lead_id: str = "") -> str:
    """Sanitizes filename for Vapi file upload, handling path separators and special characters."""
    if not filename:
        return f"doc_{lead_id[:8]}.txt" if lead_id else "document.txt"
    clean_name = os.path.basename(filename)
    clean_name = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', clean_name)
    if not clean_name or clean_name.startswith('.'):
        clean_name = f"doc_{lead_id[:8]}.txt" if lead_id else "document.txt"
    return clean_name


def upload_to_knowledge_base(
    file_bytes: bytes,
    filename: str,
    content_type: str,
    lead_id: str,
) -> Optional[str]:
    """Uploads the original, unmodified document file to Vapi's file / Knowledge Base endpoint.

    Sends the RAW uploaded bytes (PDF or .txt, byte-identical to what the user
    uploaded) as a proper multipart file part, preserving the original filename
    and its real content type (`application/pdf` / `text/plain`) — Vapi does its
    own extraction/indexing, so we must not pre-flatten the file to text.

    Uses POST https://api.vapi.ai/file with multipart/form-data.
    Includes timeout (10s) and 1 retry on transient failures (5xx, timeouts).
    Returns the file/KB ID on success, or None on failure without raising exceptions.
    """
    if not file_bytes:
        logger.warning("Empty file bytes provided for KB upload", extra={"extra_data": {"lead_id": lead_id}})
        return None

    sanitized_name = sanitize_filename(filename, lead_id)
    part_content_type = content_type or "application/octet-stream"

    vapi_key = os.getenv("VAPI_API_KEY", "")
    if not vapi_key or vapi_key.startswith("dummy") or vapi_key.startswith("mock"):
        hash_object = hashlib.md5(file_bytes)
        mock_kb_id = f"vapi_kb_mock_{hash_object.hexdigest()[:8]}"
        logger.info(
            "Simulating successful KB upload (mock API key)",
            extra={"extra_data": {"lead_id": lead_id, "kb_id": mock_kb_id, "filename": sanitized_name}},
        )
        return mock_kb_id

    url = "https://api.vapi.ai/file"
    boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
    headers = {
        "Authorization": f"Bearer {vapi_key}",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }

    # Build the multipart body as bytes so the raw file is transmitted verbatim.
    # Only the surrounding boundary/headers are text; the file part itself is the
    # untouched upload, sent with its true Content-Type.
    preamble = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{sanitized_name}"\r\n'
        f"Content-Type: {part_content_type}\r\n\r\n"
    ).encode("utf-8")
    epilogue = f"\r\n--{boundary}--\r\n".encode("utf-8")
    body = preamble + file_bytes + epilogue

    req = urllib.request.Request(url, data=body, headers=headers, method="POST")

    attempts = 2
    for attempt in range(attempts):
        try:
            logger.info(
                f"Uploading document '{sanitized_name}' to Vapi Knowledge Base. Attempt {attempt + 1}/{attempts}",
                extra={"extra_data": {"lead_id": lead_id, "filename": sanitized_name}},
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                kb_id = res_data.get("id")
                logger.info(
                    f"Vapi KB upload successful. file_id: {kb_id}, filename: {sanitized_name}",
                    extra={"extra_data": {"lead_id": lead_id, "file_id": kb_id, "filename": sanitized_name}},
                )
                return kb_id
        except urllib.error.HTTPError as e:
            status_code = e.code
            err_body = e.read().decode("utf-8") if e.fp else str(e)
            logger.warning(
                f"Vapi KB upload returned HTTP {status_code} on attempt {attempt + 1}: {err_body}",
                extra={"extra_data": {"lead_id": lead_id, "status_code": status_code}},
            )
            # Retry only on transient 5xx server errors
            if status_code >= 500 and attempt < attempts - 1:
                time.sleep(1)
                continue
            # Persistent 4xx or retries exhausted
            logger.error(
                "Vapi KB upload failed persistently",
                extra={"extra_data": {"lead_id": lead_id, "status_code": status_code, "reason": err_body}},
            )
            return None
        except (urllib.error.URLError, TimeoutError) as e:
            logger.warning(
                f"Network error/timeout on Vapi KB upload attempt {attempt + 1}: {e}",
                extra={"extra_data": {"lead_id": lead_id}},
            )
            if attempt < attempts - 1:
                time.sleep(1)
                continue
            logger.error(
                "Vapi KB upload failed persistently due to network error/timeout",
                extra={"extra_data": {"lead_id": lead_id, "reason": str(e)}},
            )
            return None
        except Exception as e:
            logger.error(
                "Unexpected error during Vapi KB upload",
                extra={"extra_data": {"lead_id": lead_id, "reason": str(e)}},
                exc_info=True,
            )
            return None

    return None


def attach_knowledge_base(assistant_id: str, kb_ids, prompt: Optional[str] = None) -> bool:
    """Attaches one or more existing Knowledge Base / file entries to an assistant.

    `kb_ids` accepts either a single file id (str) or a list of file ids; all of
    them are attached together under the assistant's knowledgeBase.fileIds.

    Uses PATCH https://api.vapi.ai/assistant/{assistant_id}.
    Includes timeout (10s) and 1 retry on transient failures (5xx, timeouts).
    Preserves system prompt messages array if prompt is provided.
    Returns True on success, False on failure without raising exceptions.
    """
    file_ids = [kb_ids] if isinstance(kb_ids, str) else [k for k in (kb_ids or []) if k]
    if not assistant_id or not file_ids:
        logger.warning(
            "Empty assistant_id or kb_ids provided for attachment",
            extra={"extra_data": {"assistant_id": assistant_id, "kb_ids": file_ids}},
        )
        return False

    vapi_key = os.getenv("VAPI_API_KEY", "")
    if (
        not vapi_key
        or vapi_key.startswith("dummy")
        or vapi_key.startswith("mock")
        or assistant_id.startswith("vapi_ast_mock_")
        or any(k.startswith("vapi_kb_mock_") for k in file_ids)
    ):
        logger.info(
            "Simulating successful KB attachment to assistant (mock mode)",
            extra={"extra_data": {"assistant_id": assistant_id, "kb_ids": file_ids}},
        )
        return True

    url = f"https://api.vapi.ai/assistant/{assistant_id}"
    model_obj = {
        "provider": "openai",
        "model": "gpt-4o",
        "knowledgeBase": {
            "provider": "canonical",
            "fileIds": file_ids
        }
    }
    if prompt:
        model_obj["messages"] = [{"role": "system", "content": prompt}]

    payload = {"model": model_obj}

    headers = {
        "Authorization": f"Bearer {vapi_key}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }
    req_body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=req_body, headers=headers, method="PATCH")

    attempts = 2
    for attempt in range(attempts):
        try:
            logger.info(
                f"Attaching KB to Vapi assistant. Attempt {attempt + 1}/{attempts}",
                extra={"extra_data": {"assistant_id": assistant_id, "kb_ids": file_ids}},
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                logger.info(
                    "Vapi KB successfully attached to assistant",
                    extra={"extra_data": {"assistant_id": assistant_id, "kb_ids": file_ids}},
                )
                return True
        except urllib.error.HTTPError as e:
            status_code = e.code
            err_body = e.read().decode("utf-8") if e.fp else str(e)
            logger.warning(
                f"Vapi KB attach returned HTTP {status_code} on attempt {attempt + 1}: {err_body}",
                extra={"extra_data": {"assistant_id": assistant_id, "kb_ids": file_ids, "status_code": status_code}},
            )
            if status_code >= 500 and attempt < attempts - 1:
                time.sleep(1)
                continue
            logger.error(
                "Vapi KB attach failed persistently",
                extra={"extra_data": {"assistant_id": assistant_id, "kb_ids": file_ids, "status_code": status_code, "reason": err_body}},
            )
            return False
        except (urllib.error.URLError, TimeoutError) as e:
            logger.warning(
                f"Network error/timeout on Vapi KB attach attempt {attempt + 1}: {e}",
                extra={"extra_data": {"assistant_id": assistant_id, "kb_ids": file_ids}},
            )
            if attempt < attempts - 1:
                time.sleep(1)
                continue
            logger.error(
                "Vapi KB attach failed persistently due to network error/timeout",
                extra={"extra_data": {"assistant_id": assistant_id, "kb_ids": file_ids, "reason": str(e)}},
            )
            return False
        except Exception as e:
            logger.error(
                "Unexpected error during Vapi KB attach",
                extra={"extra_data": {"assistant_id": assistant_id, "kb_ids": file_ids, "reason": str(e)}},
                exc_info=True,
            )
            return False

    return False
