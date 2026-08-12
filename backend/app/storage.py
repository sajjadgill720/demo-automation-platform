import os
import logging
import urllib.request
import urllib.error
import urllib.parse
from typing import Optional

logger = logging.getLogger("app.storage")

def upload_document(bucket: str, path: str, file_bytes: bytes, content_type: str) -> str:
    """Uploads file bytes to Supabase Storage and returns its public URL.
    
    If Supabase is not configured or the upload fails, it fails open, logging the error
    and returning an empty string (or fallback local URL for mock envs).
    """
    supabase_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
    env = os.getenv("ENVIRONMENT", "development").lower()

    if not supabase_url or not service_key or service_key.startswith("dummy") or service_key.startswith("mock"):
        if env == "production":
            logger.error("Supabase Storage credentials missing or unconfigured in PRODUCTION environment — upload failed")
            return ""
        logger.warning("Supabase URL or Service Key not configured or using dummy values — failing open with simulated URL (dev environment)")
        # Return a deterministic mock URL for testing in non-production environments
        sim_url = f"{supabase_url or 'http://localhost'}/storage/v1/object/public/{bucket}/{path}"
        return sim_url

    # URL-encode path components while preserving directory slashes (/) to support spaces/special chars in filenames.
    quoted_path = urllib.parse.quote(path, safe='/')
    quoted_bucket = urllib.parse.quote(bucket)
    url = f"{supabase_url}/storage/v1/object/{quoted_bucket}/{quoted_path}"
    
    req = urllib.request.Request(
        url,
        data=file_bytes,
        headers={
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
            "Content-Type": content_type
        },
        method="POST"
    )

    try:
        logger.info(f"Uploading file of size {len(file_bytes)} bytes to {url}")
        with urllib.request.urlopen(req, timeout=15) as resp:
            # Response is JSON, e.g. {"Key": "bucket/path"}
            resp_body = resp.read().decode("utf-8")
            logger.info(f"Supabase upload response: {resp_body}")
        
        # Build the public URL (URL-encoded)
        public_url = f"{supabase_url}/storage/v1/object/public/{quoted_bucket}/{quoted_path}"
        logger.info(f"Document uploaded successfully. Public URL: {public_url}")
        return public_url

    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8") if e.fp else str(e)
        logger.error(f"Supabase upload HTTP error: {e.code} — {err_body} — failing open with empty file URL", exc_info=True)
        return ""
    except Exception as e:
        logger.error(f"Supabase upload connection error: {e} — failing open with empty file URL", exc_info=True)
        return ""


def download_document(file_url: str) -> Optional[bytes]:
    """Downloads the raw, unmodified bytes of a previously uploaded document.

    Takes the stored `file_url` (the public URL returned by `upload_document`,
    of the form `{SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}`),
    derives the object's `{bucket}/{path}`, and fetches it via the authenticated
    Storage endpoint using the service key (so it works for private buckets too).

    Fails open: returns None if Supabase is unconfigured (dev/mock, where nothing
    was actually stored) or on any download error, so callers can degrade
    gracefully rather than crash.
    """
    if not file_url:
        return None

    supabase_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()

    if not supabase_url or not service_key or service_key.startswith("dummy") or service_key.startswith("mock"):
        logger.warning("Supabase not configured — cannot download raw document bytes (dev/mock)")
        return None

    # Derive "{bucket}/{path}" from the stored URL. Both the public
    # (".../object/public/{bucket}/{path}") and the authenticated
    # (".../object/{bucket}/{path}") shapes are handled.
    marker = "/storage/v1/object/"
    idx = file_url.find(marker)
    if idx == -1:
        logger.error(f"Unrecognized storage URL, cannot download: {file_url}")
        return None
    object_ref = file_url[idx + len(marker):]
    if object_ref.startswith("public/"):
        object_ref = object_ref[len("public/"):]

    # Unquote first to handle already-encoded URLs, then quote once preserving slashes.
    unquoted_ref = urllib.parse.unquote(object_ref)
    quoted_object_ref = urllib.parse.quote(unquoted_ref, safe='/')
    download_url = f"{supabase_url}/storage/v1/object/{quoted_object_ref}"
    req = urllib.request.Request(
        download_url,
        headers={
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
        },
        method="GET",
    )

    try:
        logger.info(f"Downloading raw document bytes from {download_url}")
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
        logger.info(f"Downloaded {len(data)} bytes for {object_ref}")
        return data
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8") if e.fp else str(e)
        logger.error(f"Supabase download HTTP error: {e.code} — {err_body}", exc_info=True)
        return None
    except Exception as e:
        logger.error(f"Supabase download connection error: {e}", exc_info=True)
        return None
