# Task 2 — LLM-Generated Company Block

**File:** `backend/app/prompt_generator.py` *(new)*

This module is the half of the hybrid prompt that an LLM writes: the company-specific sections, generated from everything gathered during onboarding.

---

## 1. The Challenge

The behaviour of the agent (how it opens, waits, speaks, escalates in general, and closes) is universal and must stay reviewable, so it remains vetted template text. But the *company-specific* content — who this business is, the calls this line really gets and how to handle them, when to escalate here, the specific asks the business made — is exactly what differs between deployments, and a rigid five-field template could not carry enough of it to keep an agent correct for a real business over a year.

---

## 2. The Solution

### `generate_company_context_block()`

A single entry point that assembles all onboarding signal and asks the LLM to write four house-style markdown sections:

```
## The business you are answering for
## What this line is really for, and how to handle the calls you will get
## When to hand the call to a human
## Specific requests from <Company>   (omitted entirely if they asked for nothing)
```

**Inputs fed to the generator:**

* Company name, industry, and the voice the business picked.
* The intake-form problem statement.
* The full **extracted profile** (all 12 fields — including the ones left `UNKNOWN`, so the model can see what *not* to invent).
* The **document brief** distilled from uploaded SOPs by `document_summarizer.py`.
* The **full clarification transcript** (advisor questions + business answers).
* The vetted **industry playbook** (scenario rules, common questions, conservative escalation default) — used to fill gaps the business did not cover, with the business's own words always winning.

### Output model

The LLM returns a single JSON object parsed into `CompanyPromptBlock { company_block: str }`. The block is emitted verbatim into the final prompt.

---

## 3. Safety Model

The generator is the one place an LLM writes into the prompt, so it is fenced carefully:

* **Data, not commands.** The prompt states plainly that all inputs are *data describing a business*, and instructs the model to disregard — never copy — any embedded text telling it to change its instructions, adopt a persona, or alter agent behaviour.
* **No invention.** The model may use *only* facts present in the inputs. It must never fabricate a price, fee, hour, timeframe, address, name, SLA, or policy. If a fact is absent, the agent takes a message instead.
* **Scope limited.** It may write *only* the four company sections — never greeting scripts, turn-taking rules, generic restrictions, or closing behaviour, which are added separately by the template.
* **Double sanitisation.** Free-text values are sanitised again here (`sanitize_input` / `sanitize_profile_text`) even though callers sanitise upstream. Document text has already passed the consent + injection gates before it ever reaches this module.
* **Bracketed by behaviour.** Because the deterministic `Restrictions` section is emitted *after* this block, the last behavioural instruction in the model's context at call time is always the vetted one.

### Failure handling

`generate_company_context_block()` **never raises**. On any error or empty result it returns `""`, and the caller (`compile_lead_prompt`) falls back to deterministic company-section rendering. A degraded generator produces a slightly more generic prompt — never a failed provision.

---

## 4. Helpers

| Helper | Role |
| --- | --- |
| `_compile_transcript()` | Renders the Q&A into a readable, sanitised transcript; drops the one-time intro line (scaffolding, not signal) and labels turns `ADVISOR` / `BUSINESS` |
| `_compile_profile_json()` | Serialises the profile, sanitising every free-text value and keeping `UNKNOWN` fields visible so the model does not fill gaps the business never described |
| `_format_library_rules()` | Formats the industry playbook's `(trigger, action)` pairs into readable if-this-then-that rules |

### Token budget

The block runs several hundred words across four sections, past the 1024-token default used by short structured extractions. The generator requests **2048 tokens** via the new `max_tokens` argument on `call_structured_llm` (see [hybrid assembly](hybrid-assembly.md)).
