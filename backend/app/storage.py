import os
import logging
import urllib.request
import urllib.error

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

    url = f"{supabase_url}/storage/v1/object/{bucket}/{path}"
    
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
        
        # Build the public URL
        public_url = f"{supabase_url}/storage/v1/object/public/{bucket}/{path}"
        logger.info(f"Document uploaded successfully. Public URL: {public_url}")
        return public_url

    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8") if e.fp else str(e)
        logger.error(f"Supabase upload HTTP error: {e.code} — {err_body} — failing open with empty file URL", exc_info=True)
        return ""
    except Exception as e:
        logger.error(f"Supabase upload connection error: {e} — failing open with empty file URL", exc_info=True)
        return ""
