"""Pulls the native call report from Vapi and stores it on a CallRecord.

Runs as a FastAPI background task after the frontend reports that a browser call
ended (handing us the Vapi call id). Vapi needs a few seconds after a call ends
to finalize the recording, transcript and summary, so this polls GET /call/{id}
until the report is ready, then persists Vapi's own data — recording URL,
transcript, summary, ended reason, cost and timing.

No public webhook URL is required: this is an outbound call to the Vapi API using
the same VAPI_API_KEY the provisioning path already uses.
"""
import os
import json
import time
import uuid
import logging
import urllib.request
import urllib.error
from datetime import datetime
from typing import Optional

from sqlmodel import Session

from app.db import engine
from app.models import CallRecord

logger = logging.getLogger("app.vapi_calls")

VAPI_CALL_URL = "https://api.vapi.ai/call/{call_id}"

# How long to wait for Vapi to finish processing the report before giving up.
_MAX_ATTEMPTS = 20
_POLL_INTERVAL_S = 3


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value or not isinstance(value, str):
        return None
    try:
        # Vapi returns ISO-8601 with a trailing Z.
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _messages_to_turns(messages) -> list[dict]:
    """Maps Vapi's message list into our [{role, text}] transcript shape."""
    turns: list[dict] = []
    for m in messages or []:
        role = m.get("role")
        if role in ("bot", "assistant"):
            role = "assistant"
        elif role == "user":
            role = "user"
        else:
            # skip system / tool / function messages
            continue
        text = (m.get("message") or m.get("content") or "")
        text = str(text).strip()
        if text:
            turns.append({"role": role, "text": text[:4000]})
    return turns


def _fetch_call(call_id: str, api_key: str) -> Optional[dict]:
    req = urllib.request.Request(
        VAPI_CALL_URL.format(call_id=call_id),
        headers={
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8") if e.fp else str(e)
        logger.warning(f"Vapi GET /call/{call_id} returned HTTP {e.code}: {body}")
        return None
    except (urllib.error.URLError, TimeoutError) as e:
        logger.warning(f"Vapi GET /call/{call_id} network error: {e}")
        return None


def _apply_report(rec: CallRecord, data: dict) -> None:
    """Copies the fields we keep from a finished Vapi call report onto the row."""
    artifact = data.get("artifact") or {}
    analysis = data.get("analysis") or {}

    recording_url = (
        data.get("recordingUrl")
        or data.get("stereoRecordingUrl")
        or artifact.get("recordingUrl")
        or artifact.get("stereoRecordingUrl")
    )

    messages = data.get("messages") or artifact.get("messages") or []
    turns = _messages_to_turns(messages)
    # Fall back to the flat transcript string if no structured messages came back.
    if not turns:
        transcript_str = data.get("transcript") or artifact.get("transcript")
        if transcript_str:
            turns = [{"role": "assistant", "text": str(transcript_str)[:8000]}]

    summary = analysis.get("summary") or data.get("summary")

    started = _parse_iso(data.get("startedAt"))
    ended = _parse_iso(data.get("endedAt"))
    duration = 0
    if started and ended:
        duration = max(0, int((ended - started).total_seconds()))

    rec.recording_url = recording_url or rec.recording_url
    rec.transcript = json.dumps(turns) if turns else rec.transcript
    rec.turn_count = len(turns) if turns else rec.turn_count
    rec.summary = (summary.strip() if isinstance(summary, str) else None) or rec.summary
    rec.ended_reason = data.get("endedReason") or rec.ended_reason
    if isinstance(data.get("cost"), (int, float)):
        rec.cost = float(data["cost"])
    if started:
        rec.started_at = started
    if ended:
        rec.ended_at = ended
    if duration:
        rec.duration_seconds = duration


def fetch_vapi_call_task(call_record_id: str) -> None:
    """Polls Vapi for the finished report and stores it on the CallRecord."""
    api_key = os.getenv("VAPI_API_KEY", "")
    if not api_key or api_key.startswith(("dummy", "mock")):
        logger.info("fetch_vapi_call_task: no real VAPI_API_KEY — skipping native fetch")
        return

    try:
        rec_uuid = uuid.UUID(call_record_id)
    except (ValueError, AttributeError):
        logger.warning(f"fetch_vapi_call_task: bad call_record_id {call_record_id!r}")
        return

    with Session(engine) as session:
        rec = session.get(CallRecord, rec_uuid)
        if not rec or not rec.vapi_call_id:
            return
        vapi_call_id = rec.vapi_call_id

    last_data: Optional[dict] = None
    for attempt in range(_MAX_ATTEMPTS):
        data = _fetch_call(vapi_call_id, api_key)
        if data:
            last_data = data
            if data.get("status") == "ended" or data.get("endedAt"):
                # Call is finished. The summary/analysis can lag the recording by a
                # few seconds, so if it's missing, poll a little longer for it.
                analysis = data.get("analysis") or {}
                if analysis.get("summary") or attempt >= 3:
                    break
        time.sleep(_POLL_INTERVAL_S)

    with Session(engine) as session:
        rec = session.get(CallRecord, rec_uuid)
        if not rec:
            return
        if last_data:
            _apply_report(rec, last_data)
            rec.status = "completed"
            logger.info(
                f"[{call_record_id}] native Vapi report stored "
                f"(recording={'yes' if rec.recording_url else 'no'}, turns={rec.turn_count})"
            )
        else:
            rec.status = "failed"
            logger.warning(f"[{call_record_id}] could not fetch Vapi call {vapi_call_id}")
        session.add(rec)
        session.commit()
