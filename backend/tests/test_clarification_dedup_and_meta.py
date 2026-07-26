"""Regression tests for the clarification chat fixes.

Covers, against the real DB and LLM:
  1. a question is written exactly once per turn (no duplicate rendering)
  2. per-turn latency breakdown
  3. a meta-response ("can you give me an example?") is answered and the
     original question is re-asked instead of the flow advancing
  4. a deferring answer ("I don't know, use your best judgment") still counts
     as a real answer and the flow advances
"""
import sys
import os
import uuid
import time
import logging

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlmodel import Session, select
from app.db import engine, init_db
from app.models import Lead, ClarificationMessage, AgentStatus
from app.clarification import (
    start_clarification,
    submit_clarification_answer,
    get_clarification_status,
    _NODE_EXEC_COUNTS,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s | %(message)s", stream=sys.stdout)
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

PASSED = 0
FAILED = 0


def log_result(name: str, passed: bool, detail: str = ""):
    global PASSED, FAILED
    if passed:
        print(f"  [PASS]: {name} {detail}")
        PASSED += 1
    else:
        print(f"  [FAIL]: {name} {detail}")
        FAILED += 1


def create_test_lead(company_name: str, industry: str) -> str:
    init_db()
    with Session(engine) as session:
        lead = Lead(
            company_name=company_name,
            contact_name="Test Runner",
            contact_email="tests@example.com",
            contact_phone="+15550100",
            industry=industry,
            rendered_prompt="placeholder",
            ai_processing_consent=True,
            agent_status=AgentStatus.pending,
        )
        session.add(lead)
        session.commit()
        session.refresh(lead)
        return str(lead.id)


def db_messages(lead_id: str):
    with Session(engine) as session:
        return [
            (m.role.value, m.content)
            for m in session.exec(
                select(ClarificationMessage)
                .where(ClarificationMessage.lead_id == uuid.UUID(lead_id))
                .order_by(ClarificationMessage.created_at.asc())
            ).all()
        ]


def print_history(lead_id: str, label: str):
    rows = db_messages(lead_id)
    print(f"\n  --- conversation_history {label} ({len(rows)} messages) ---")
    for i, (role, content) in enumerate(rows):
        print(f"    [{i}] {role:9s} :: {content[:120]}")
    return rows


def exact_duplicates(rows):
    seen = {}
    for role, content in rows:
        seen[(role, content)] = seen.get((role, content), 0) + 1
    return {k: v for k, v in seen.items() if v > 1}


def test_no_duplicate_question_rendering():
    """Test 1: each question is persisted exactly once per turn."""
    print("\n--- Test 1: No Duplicate Question Rendering ---")
    lead_id = create_test_lead("Northwind HVAC", "HVAC Services")

    status = start_clarification(lead_id)
    rows = print_history(lead_id, "after start")
    assistant_after_start = [c for r, c in rows if r == "assistant"]

    status = submit_clarification_answer(lead_id, "After-hours emergencies go straight to the on-call manager.")
    rows = print_history(lead_id, "after 1 answer")
    dupes = exact_duplicates(rows)
    assistant_rows = [c for r, c in rows if r == "assistant"]

    counts = {k[1]: v for k, v in _NODE_EXEC_COUNTS.items() if k[0] == lead_id}
    print(f"    node exec counts: {counts}")

    ok = (
        len(assistant_after_start) == 1
        and len(dupes) == 0
        and len(assistant_rows) == 2
        and counts.get("generate_question", 0) == 2
    )
    log_result(
        "One question rendered per turn, no duplicates",
        ok,
        f"— assistant rows: {len(assistant_rows)} (expect 2), exact dupes: {len(dupes)}, "
        f"generate_question ran {counts.get('generate_question')}x for 2 questions (expect 2)",
    )
    return lead_id


def test_latency_breakdown():
    """Test 2: measure a start + one full answer cycle."""
    print("\n--- Test 2: Latency Breakdown ---")
    lead_id = create_test_lead("Summit Dental Group", "Dental & Healthcare")

    t0 = time.perf_counter()
    start_clarification(lead_id)
    t_start = (time.perf_counter() - t0) * 1000

    t0 = time.perf_counter()
    submit_clarification_answer(lead_id, "We book urgent patients into the next morning emergency slot.")
    t_cycle = (time.perf_counter() - t0) * 1000

    t0 = time.perf_counter()
    get_clarification_status(lead_id)
    t_status = (time.perf_counter() - t0) * 1000

    print(f"    start_clarification        : {t_start:8.0f} ms")
    print(f"    one answer cycle           : {t_cycle:8.0f} ms")
    print(f"    get_clarification_status   : {t_status:8.0f} ms")
    log_result(
        "Answer cycle completes under 8s",
        t_cycle < 8000,
        f"— one answer cycle: {t_cycle:.0f} ms",
    )


def test_meta_response_is_answered_and_question_reasked():
    """Test 3: 'can you give me an example?' gets a real example + a re-ask."""
    print("\n--- Test 3: Meta-Response Handling ---")
    lead_id = create_test_lead("Ironclad Roofing", "Roofing & Construction")

    status = start_clarification(lead_id)
    original_question = status.current_question
    print(f"    original question: {original_question!r}")
    rows_before = db_messages(lead_id)

    status_after = submit_clarification_answer(lead_id, "Can you give me an example?")
    rows_after = print_history(lead_id, "after meta-response")

    new_rows = rows_after[len(rows_before):]
    assistant_replies = [c for r, c in new_rows if r == "assistant"]

    question_unchanged = status_after.current_question == original_question
    got_helpful_reply = any(c != original_question and len(c) > 30 for c in assistant_replies)
    reasked = any(c == original_question for c in assistant_replies)
    did_not_advance = question_unchanged

    print(f"    question after meta-response: {status_after.current_question!r}")
    print(f"    helpful reply present: {got_helpful_reply} | re-asked: {reasked} | advanced: {not did_not_advance}")

    log_result(
        "Meta-response answered and original question re-asked without advancing",
        got_helpful_reply and reasked and did_not_advance,
        f"— helpful_reply={got_helpful_reply}, re_asked={reasked}, question_unchanged={question_unchanged}",
    )

    # And a real answer after the meta-response must still advance the flow.
    status_next = submit_clarification_answer(lead_id, "We dispatch a crew same day for active leaks.")
    advanced = status_next.current_question != original_question
    log_result(
        "Real answer after a meta-response still advances the flow",
        advanced,
        f"— next question: {(status_next.current_question or '')[:80]!r}",
    )
    return lead_id


def test_deferring_answer_treated_as_valid():
    """Test 4: 'I don't know, use your best judgment' is a valid answer."""
    print("\n--- Test 4: Deferring Answer Is A Valid Answer ---")
    lead_id = create_test_lead("Cascade Plumbing", "Plumbing Services")

    status = start_clarification(lead_id)
    original_question = status.current_question
    print(f"    original question: {original_question!r}")
    rows_before = db_messages(lead_id)

    status_after = submit_clarification_answer(lead_id, "I don't know, use your best judgment.")
    rows_after = print_history(lead_id, "after deferring answer")

    new_rows = rows_after[len(rows_before):]
    reasked_same = any(r == "assistant" and c == original_question for r, c in new_rows)
    advanced = status_after.current_question != original_question

    print(f"    question after deferral: {status_after.current_question!r}")
    log_result(
        "Deferral treated as a real answer and flow advances",
        advanced and not reasked_same,
        f"— advanced={advanced}, original_question_re_asked={reasked_same}",
    )


def run_all_tests():
    print("=" * 64)
    print("   CLARIFICATION DEDUP / LATENCY / META-RESPONSE TEST SUITE")
    print("=" * 64)
    test_no_duplicate_question_rendering()
    test_latency_breakdown()
    test_meta_response_is_answered_and_question_reasked()
    test_deferring_answer_treated_as_valid()

    print("\n" + "=" * 64)
    print(f"SUMMARY: {PASSED} Passed, {FAILED} Failed")
    print("=" * 64)
    if FAILED > 0:
        sys.exit(1)


if __name__ == "__main__":
    run_all_tests()
