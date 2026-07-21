"""
test_qualifier.py — Automated test script for the Lead Qualifier Module.

Usage:
    1. Start the main app:
       cd backend && python -m uvicorn app.main:app --port 8000
    2. Run this test script from backend folder:
       python tests/test_qualifier.py
"""

import json
import os
import sys
import urllib.request
import urllib.error
from dotenv import load_dotenv

# Load env variables (checking parent directory for .env if run from tests folder)
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
else:
    load_dotenv()

PORT = os.getenv("PORT", "8000")
BASE_URL = f"http://localhost:{PORT}"

PASSED = 0
FAILED = 0


def test(name: str, payload: dict, expect_qualified: bool | None = None, expect_field: str | None = None, expect_value=None):
    """Run a single test against POST /api/qualify."""
    global PASSED, FAILED
    print(f"\n{'='*60}")
    print(f"TEST: {name}")
    print(f"  Payload: {json.dumps(payload)}")

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{BASE_URL}/api/qualify",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))

        print(f"  Response: {json.dumps(result, indent=2)}")

        # Check expected qualification outcome
        if expect_qualified is not None:
            if result.get("qualified") == expect_qualified:
                print(f"  [PASS]: qualified={result['qualified']} (expected {expect_qualified})")
                PASSED += 1
            else:
                print(f"  [FAIL]: qualified={result.get('qualified')} (expected {expect_qualified})")
                FAILED += 1
        elif expect_field and expect_value is not None:
            if result.get(expect_field) == expect_value:
                print(f"  [PASS]: {expect_field}={result[expect_field]}")
                PASSED += 1
            else:
                print(f"  [FAIL]: {expect_field}={result.get(expect_field)} (expected {expect_value})")
                FAILED += 1
        else:
            print(f"  [PASS]: Got valid response")
            PASSED += 1

        # Validate response schema
        for field in ("qualified", "confidence", "reasoning"):
            if field not in result:
                print(f"  [WARN]: Missing field '{field}' in response")

        if "confidence" in result:
            conf = result["confidence"]
            if not (0.0 <= conf <= 1.0):
                print(f"  [WARN]: confidence={conf} is out of [0.0, 1.0] range")

    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8") if e.fp else ""
        print(f"  [FAIL]: HTTP {e.code} — {body}")
        FAILED += 1
    except urllib.error.URLError as e:
        print(f"  [FAIL]: Could not connect to {BASE_URL} — {e.reason}")
        print(f"  Make sure the main service is running on port {PORT}")
        FAILED += 1
    except Exception as e:
        print(f"  [FAIL]: {type(e).__name__}: {e}")
        FAILED += 1


def test_health():
    """Test GET / health check endpoint."""
    global PASSED, FAILED
    print(f"\n{'='*60}")
    print(f"TEST: Health Check (GET /)")

    try:
        req = urllib.request.Request(f"{BASE_URL}/", method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        if result.get("status") == "healthy":
            print(f"  [PASS]: {result}")
            PASSED += 1
        else:
            print(f"  [FAIL]: Unexpected response: {result}")
            FAILED += 1
    except Exception as e:
        print(f"  [FAIL]: {type(e).__name__}: {e}")
        FAILED += 1


def main():
    print("=" * 60)
    print("  LEAD QUALIFIER LangGraph — TEST SUITE")
    print("=" * 60)

    # ── Health Check ──
    test_health()

    # ── Hard Filter Tests ──
    test(
        "Hard Filter: Empty company_name",
        {"company_name": "", "industry": "Logistics"},
        expect_qualified=False,
    )

    test(
        "Hard Filter: Whitespace-only company_name",
        {"company_name": "   ", "industry": "Logistics"},
        expect_qualified=False,
    )

    test(
        "Hard Filter: Empty industry",
        {"company_name": "Acme Corp", "industry": ""},
        expect_qualified=False,
    )

    test(
        "Hard Filter: Whitespace-only industry",
        {"company_name": "Acme Corp", "industry": "  "},
        expect_qualified=False,
    )

    # ── LLM Tests (require GROQ_API_KEY) ──
    print(f"\n{'='*60}")
    print("  LLM-BASED TESTS (require GROQ_API_KEY to be set)")
    print("  If key is missing, these will fail-open (qualified=True)")
    print("=" * 60)

    test(
        "Bogus Data: Random characters",
        {"company_name": "sdfhsdfh", "industry": "none"},
        expect_qualified=False,
    )

    test(
        "Bogus Data: Test submission",
        {"company_name": "test", "industry": "test"},
        expect_qualified=False,
    )

    test(
        "Legitimate B2B: Amazon Logistics",
        {"company_name": "Amazon Logistics", "industry": "Logistics"},
        expect_qualified=True,
    )

    test(
        "Legitimate B2B: Blue Ridge Trucking",
        {"company_name": "Blue Ridge Trucking", "industry": "Transportation"},
        expect_qualified=True,
    )

    test(
        "Legitimate B2B: Smith & Sons HVAC",
        {"company_name": "Smith & Sons HVAC", "industry": "Field Services"},
        expect_qualified=True,
    )

    # ── Summary ──
    print(f"\n{'='*60}")
    print(f"  RESULTS: {PASSED} passed, {FAILED} failed, {PASSED + FAILED} total")
    print("=" * 60)

    sys.exit(1 if FAILED > 0 else 0)


if __name__ == "__main__":
    main()
