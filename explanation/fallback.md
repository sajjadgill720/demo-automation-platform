# LLM Failure Handling and Fallback Architecture

This reference guide documents the strategies, retries, and fallback behaviors engineered to keep the DataQuartz platform stable when remote LLM APIs experience rate limits, invalid formats, or network outages.

---

## 1. The Fail-Open Fallback Strategy
### The Challenge
If a user submits their business name and industry, they are evaluated by an LLM (`qualifier.py`) to qualify their lead before provisioning a phone number. If the LLM provider (Groq) is down, rate-limited, or if the API key is missing, a standard error would prevent the user from completing the onboarding wizard.

### The Solution
We implemented a **Fail-Open Fallback** mechanism. Lead qualification is treated as a non-blocking optimization helper. If the remote service fails, we default to approving the user so their onboarding is not interrupted:
```python
try:
    # Attempt lead qualification via LLM
    raw = _call_groq(messages, api_key)
    res = QualificationResult(**raw)
    return {
        **state,
        "qualified": res.qualified,
        "confidence": res.confidence,
        "reasoning": res.reasoning,
    }
except Exception as e:
    # Intercept failures, log the exception for monitoring, and proceed
    logger.error("Groq API call failed: %s — failing open", e, exc_info=True)
    return {
        **state,
        "qualified": True,
        "confidence": 1.0,
        "reasoning": "qualification check failed, defaulting to proceed",
    }
```

---

## 2. Structured JSON Validation & Retry Loop
### The Challenge
LLM models returning JSON occasionally violate structured schemas by leaving out fields, wrapping values in markdown blocks (e.g. ` ```json `), or returning invalid JSON formats entirely. This breaks Pydantic parsing.

### The Solution (Single-turn Feedback Loop)
In `qualifier.py`, we implement a targeted retry attempt that feeds the formatting error message *back* to the LLM model to request corrections:

1. **Attempt 1:** Request structured JSON from Groq.
2. **Catch Parsing Errors:** If validation checks raise `ValidationError`, `JSONDecodeError`, or standard `KeyError`/`TypeError` exceptions, trigger the retry block:
   ```python
   except (ValidationError, json.JSONDecodeError, KeyError, TypeError) as e:
       logger.warning(f"First LLM attempt failed validation: {e} — retrying", exc_info=True)
       try:
           # Append historical context
           messages.append({
               "role": "assistant",
               "content": json.dumps(raw) if 'raw' in locals() else "{}",
           })
           # Inject error diagnostics
           messages.append({
               "role": "user",
               "content": (
                   f"Your previous response was invalid: {e}. "
                   "Please respond with a valid JSON object containing exactly: "
                   '"qualified" (bool), "confidence" (float 0-1), "reasoning" (string).'
               ),
           })
           # Re-attempt request
           raw = _call_groq(messages, api_key)
           res = QualificationResult(**raw)
           ...
       except Exception as e2:
           # Second attempt failed — fall open gracefully
           logger.error("Second LLM attempt also failed: %s — failing open", e2, exc_info=True)
           return { ... }
   ```
3. **Fail-Open Fallback:** If the corrected turn fails, default to qualifying the lead to maintain user conversion rates.
