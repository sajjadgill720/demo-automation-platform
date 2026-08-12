import os
import sys
import json
from fastapi.testclient import TestClient

# Adjust path to find backend modules
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.main import app
from app.config import TURNSTILE_SECRET_KEY

# Set up test client
client = TestClient(app)

print("\n--- Running CAPTCHA Verification Tests ---")

def test_captcha_success():
    print("Testing CAPTCHA verification success (using mock test token)...")
    payload = {
        "company_name": "Test Captcha Corp",
        "contact_name": "Test User",
        "contact_email": "test@captchacorp.com",
        "contact_phone": "+923001234567",
        "industry": "dental",
        "problem_text": "Need a receptionist.",
        "voice_gender": "female",
        "captcha_token": "any-mock-token-for-local-testing"
    }
    
    # We expect this to pass because TURNSTILE_SECRET_KEY is the test secret key 
    # and verify_captcha will return True.
    response = client.post("/api/demo-request", json=payload)
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 201
    print("  PASS: Success request passed verification.")

def test_captcha_failure():
    print("Testing CAPTCHA verification failure (with invalid secret key)...")
    
    # Temporarily override secret key to non-test key to force real verification failure
    import app.main
    original_key = app.main.TURNSTILE_SECRET_KEY
    app.main.TURNSTILE_SECRET_KEY = "invalid-secret-key-forcing-failure"
    
    payload = {
        "company_name": "Test Captcha Corp",
        "contact_name": "Test User",
        "contact_email": "test@captchacorp.com",
        "contact_phone": "+923001234567",
        "industry": "dental",
        "problem_text": "Need a receptionist.",
        "voice_gender": "female",
        "captcha_token": "some-invalid-token"
    }
    
    try:
        response = client.post("/api/demo-request", json=payload)
        print(f"Status Code: {response.status_code}")
        # Real verification to Cloudflare with an invalid secret key will return success=false
        # which raises HTTPException 400.
        assert response.status_code == 400
        print(f"Response Detail: {response.json().get('detail')}")
        assert "CAPTCHA verification failed" in response.json().get("detail", "")
        print("  PASS: Invalid token rejected correctly.")
    finally:
        # Restore key
        app.main.TURNSTILE_SECRET_KEY = original_key

if __name__ == "__main__":
    try:
        test_captcha_success()
        test_captcha_failure()
        print("\n==== All CAPTCHA tests passed successfully! ====")
        sys.exit(0)
    except AssertionError as e:
        print(f"\n[FAIL] Test assertion failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Unexpected error during test run: {e}")
        sys.exit(1)
