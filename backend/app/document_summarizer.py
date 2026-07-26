"""Distils an uploaded SOP/process document into a business context brief.

WHY THIS FILE EXISTS
--------------------
Document text used to reach the Vapi prompt only indirectly, and only after two
compounding truncations: sanitize_document_text() cut at 5000 chars per document,
then extract_profile cut the combined text again at 6000. A 23k-char SOP lost
~79% of itself — including anything stated near the end, which in real operations
manuals is usually where the policies live ("cancellations need 24 hours notice",
"after-hours calls go to the on-call tech").

This module replaces that truncation with map-reduce summarization, so document
LENGTH IS NEVER A LIMITING FACTOR:

    short document  ->  one summarization call
    long document   ->  chunk -> summarize each chunk -> reduce to one brief

The output is a single prose `business_context_brief` describing what the business
does, how it currently operates, and any explicitly procedural rules. That brief
is fed to compile_lead_prompt() directly, independent of whether the clarification
Q&A managed to fill in the 5 structured profile fields.

WHERE THIS SITS IN THE PIPELINE
-------------------------------
This is its own explicit stage. compile_lead_prompt() must remain deterministic
template assembly with no LLM calls inside it (see its docstring), so all
generation happens here, before assembly.

SAFETY
------
This module never sees content that failed the existing gates. Callers run
sanitize_document_text() first and skip documents that were flagged for prompt
injection, and skip everything when ai_processing_consent is False. Nothing here
relaxes either gate. The brief it produces is descriptive prose about a business —
it is injected into a clearly-labelled context section of the prompt, never as
instructions to the agent.
"""

import logging
import time
from typing import List, Optional

from pydantic import BaseModel, Field

from app.llm_client import call_structured_llm

logger = logging.getLogger(__name__)

#: Chars per chunk when a document needs splitting. Sized against the provider's
#: tokens-per-minute budget, not just context length: 10k-char chunks (~2.5k
#: tokens) fired back-to-back exhausted a 12k TPM limit partway through a long
#: document and the rate-limited chunk was dropped, losing its content.
CHUNK_CHARS = 6_000

#: Documents at or below this go through one direct call — no chunking, no reduce
#: pass. Keeps the common case (a 2-page SOP) fast and avoids needless complexity.
SINGLE_CALL_LIMIT = 8_000

#: Overlap between adjacent chunks so a rule split across a boundary is still seen
#: whole by at least one chunk.
CHUNK_OVERLAP = 400

#: Pause between chunk calls, to stay inside the provider's tokens-per-minute
#: budget. Deliberately traded against speed: a long document may take a couple of
#: minutes, which is acceptable; losing a chunk is not.
INTER_CHUNK_DELAY = 4.0


class ChunkSummary(BaseModel):
    """Structured intermediate for one chunk of a long document."""

    what_the_business_does: str = Field(
        default="", description="Services, products or operations described in this excerpt."
    )
    how_they_operate: str = Field(
        default="", description="How work/calls are actually handled day to day in this excerpt."
    )
    procedures: List[str] = Field(
        default_factory=list,
        description="Explicit step-by-step procedures stated in this excerpt.",
    )
    policies: List[str] = Field(
        default_factory=list,
        description="Explicit rules/policies, e.g. notice periods, fees, escalation rules.",
    )


class BusinessBrief(BaseModel):
    """Final reduced output: the prose brief injected into the prompt."""

    brief: str = Field(
        default="",
        description="Cohesive prose brief describing the business, its operations and its rules.",
    )


_CHUNK_PROMPT = """You are analysing one excerpt from {company_name}'s operating documentation.
They are a business in the {industry} sector.

This is EXCERPT {index} OF {total}. It may begin or end mid-section — that is expected.
Extract only what is actually stated in this excerpt. Do not infer, invent, or
generalise from industry knowledge. If a category has nothing in this excerpt,
return an empty string or empty list for it.

EXCERPT:
---
{chunk}
---

Return a valid JSON object with exactly these keys:
- "what_the_business_does": string — services/products/operations named here.
- "how_they_operate": string — how calls, bookings or work are actually handled here.
- "procedures": array of strings — explicit step-by-step procedures stated here.
- "policies": array of strings — explicit rules stated here (notice periods, fees,
  hours, escalation rules, who to contact for what). Quote the substance precisely;
  these are the details that matter most.
"""


_REDUCE_PROMPT = """You are writing an operations brief about {company_name}, a business in the {industry} sector.

Below are structured notes taken from consecutive sections of their operating
documentation. Combine them into ONE cohesive brief.

NOTES FROM THE DOCUMENT:
---
{notes}
---

Write flowing prose, not a bullet dump. Cover, in this order and only where the
notes actually support it:
1. What this business does and who calls them.
2. How they currently handle calls and work day to day.
3. Every explicit procedure and policy found — notice periods, fees, operating
   hours, escalation rules, who handles what. Be specific and keep the real
   numbers and names. These are the details a receptionist would need to answer
   correctly, so do not generalise them away.

Rules:
- Use ONLY what appears in the notes. Never add industry assumptions or invent
  details that are not there.
- Preserve specifics exactly (times, fees, names, thresholds).
- Do not repeat the same policy twice, even if several sections mentioned it.
- Aim for 200-450 words. Prefer completeness of policies over brevity.
- Write in third person about the business ("They operate...", "Cancellations require...").

Return a valid JSON object with exactly one key:
- "brief": string — the finished prose brief.
"""


_DIRECT_PROMPT = """You are writing an operations brief about {company_name}, a business in the {industry} sector,
based on their operating documentation below.

DOCUMENT:
---
{document}
---

Write flowing prose, not a bullet dump. Cover, in this order and only where the
document actually supports it:
1. What this business does and who calls them.
2. How they currently handle calls and work day to day.
3. Every explicit procedure and policy stated — notice periods, fees, operating
   hours, escalation rules, who handles what. Be specific and keep the real
   numbers and names. These are the details a receptionist would need to answer
   correctly, so do not generalise them away.

Rules:
- Use ONLY what appears in the document. Never add industry assumptions or invent
  details that are not there.
- Preserve specifics exactly (times, fees, names, thresholds).
- Aim for 200-450 words. Prefer completeness of policies over brevity.
- Write in third person about the business ("They operate...", "Cancellations require...").

Return a valid JSON object with exactly one key:
- "brief": string — the finished prose brief.
"""


def _chunk_text(text: str, size: int = CHUNK_CHARS, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """Splits text into overlapping chunks, preferring paragraph boundaries.

    Breaking on a blank line keeps procedures and policies intact rather than
    slicing a rule in half; the overlap covers the cases where no clean boundary
    exists near the cut point.
    """
    if len(text) <= size:
        return [text]

    chunks: List[str] = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))

        if end < len(text):
            # Prefer a paragraph break in the last 20% of the window.
            window_start = start + int(size * 0.8)
            para = text.rfind("\n\n", window_start, end)
            if para != -1:
                end = para
            else:
                nl = text.rfind("\n", window_start, end)
                if nl != -1:
                    end = nl

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= len(text):
            break
        start = max(end - overlap, start + 1)

    return chunks


def _notes_to_text(summaries: List[ChunkSummary]) -> str:
    """Flattens chunk summaries into the reduce prompt's input."""
    blocks = []
    for i, s in enumerate(summaries, 1):
        parts = [f"[Section {i}]"]
        if s.what_the_business_does.strip():
            parts.append(f"What they do: {s.what_the_business_does.strip()}")
        if s.how_they_operate.strip():
            parts.append(f"How they operate: {s.how_they_operate.strip()}")
        if s.procedures:
            parts.append("Procedures:\n" + "\n".join(f"  - {p}" for p in s.procedures if p.strip()))
        if s.policies:
            parts.append("Policies:\n" + "\n".join(f"  - {p}" for p in s.policies if p.strip()))
        if len(parts) > 1:
            blocks.append("\n".join(parts))
    return "\n\n".join(blocks)


def _is_rate_limit(err: Exception) -> bool:
    """True when an exception is a provider rate-limit rejection."""
    text = f"{err}".lower()
    return "429" in text or "rate limit" in text or "rate_limit" in text


def _summarize_chunk(prompt: str, tag: str, index: int, total: int) -> Optional[ChunkSummary]:
    """Summarizes one chunk, retrying through rate limits.

    Requirement: document length must never cost us content. A dropped chunk is
    content loss just as surely as truncation is, so a rate-limited chunk is
    retried with backoff rather than skipped. Generation is allowed to take
    longer here — correctness of the brief matters more than speed.
    """
    delays = [6, 12, 24, 40]
    last_err: Optional[Exception] = None

    for attempt in range(len(delays) + 1):
        try:
            return call_structured_llm(prompt, ChunkSummary, retry_on_failure=True)
        except Exception as e:
            last_err = e
            if attempt >= len(delays):
                break
            wait = delays[attempt]
            if _is_rate_limit(e):
                logger.info(
                    f"{tag}  chunk {index}/{total} rate-limited, waiting {wait}s "
                    f"(attempt {attempt + 1}/{len(delays) + 1})"
                )
            else:
                logger.warning(
                    f"{tag}  chunk {index}/{total} failed ({e}), retrying in {wait}s "
                    f"(attempt {attempt + 1}/{len(delays) + 1})"
                )
            time.sleep(wait)

    logger.error(f"{tag}  chunk {index}/{total} EXHAUSTED retries, content lost: {last_err}")
    return None


def summarize_documents(
    text: str,
    company_name: str,
    industry: str,
    lead_id: Optional[str] = None,
) -> str:
    """Distils sanitized document text into a prose business context brief.

    Returns "" when there is nothing usable, so callers can simply omit the
    section. Never raises on LLM failure — a missing brief degrades the prompt
    but must not fail provisioning.

    The caller is responsible for having already applied consent and injection
    gates; this function assumes `text` is safe, sanitized content.
    """
    text = (text or "").strip()
    if not text:
        return ""

    tag = f"[{lead_id}] " if lead_id else ""
    t0 = time.perf_counter()

    try:
        # ── Short document: one call, no chunking ─────────────────────────────
        if len(text) <= SINGLE_CALL_LIMIT:
            logger.info(f"{tag}summarize_documents: direct path, {len(text)} chars")
            result = call_structured_llm(
                _DIRECT_PROMPT.format(
                    company_name=company_name, industry=industry, document=text
                ),
                BusinessBrief,
                retry_on_failure=True,
            )
            brief = (result.brief or "").strip()
            logger.info(
                f"{tag}summarize_documents done: direct, in={len(text)} out={len(brief)} "
                f"duration_ms={(time.perf_counter() - t0) * 1000:.0f}"
            )
            return brief

        # ── Long document: map -> reduce ──────────────────────────────────────
        chunks = _chunk_text(text)
        logger.info(
            f"{tag}summarize_documents: map-reduce path, {len(text)} chars -> {len(chunks)} chunks"
        )

        summaries: List[ChunkSummary] = []
        failed_chunks = 0
        for i, chunk in enumerate(chunks, 1):
            result = _summarize_chunk(
                _CHUNK_PROMPT.format(
                    company_name=company_name,
                    industry=industry,
                    index=i,
                    total=len(chunks),
                    chunk=chunk,
                ),
                tag,
                i,
                len(chunks),
            )
            if result is None:
                failed_chunks += 1
            else:
                summaries.append(result)
                logger.info(f"{tag}  chunk {i}/{len(chunks)} summarized ({len(chunk)} chars)")

            # Pace against the provider's per-minute token budget so later chunks
            # are not starved by earlier ones.
            if i < len(chunks):
                time.sleep(INTER_CHUNK_DELAY)

        if failed_chunks:
            # Surfaced loudly rather than silently tolerated: this is the one path
            # where a long document can still lose content.
            logger.error(
                f"{tag}summarize_documents: {failed_chunks}/{len(chunks)} chunks could not be "
                f"summarized; the brief is INCOMPLETE for this document"
            )

        if not summaries:
            logger.error(f"{tag}summarize_documents: every chunk failed")
            return ""

        notes = _notes_to_text(summaries)
        if not notes.strip():
            logger.warning(f"{tag}summarize_documents: chunks produced no usable notes")
            return ""

        reduced = call_structured_llm(
            _REDUCE_PROMPT.format(
                company_name=company_name, industry=industry, notes=notes
            ),
            BusinessBrief,
            retry_on_failure=True,
        )
        brief = (reduced.brief or "").strip()
        logger.info(
            f"{tag}summarize_documents done: map-reduce, in={len(text)} chunks={len(chunks)} "
            f"summarized={len(summaries)} out={len(brief)} "
            f"duration_ms={(time.perf_counter() - t0) * 1000:.0f}"
        )
        return brief

    except Exception as e:
        logger.error(f"{tag}summarize_documents failed: {e}", exc_info=True)
        return ""
