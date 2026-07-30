# Task 3 — Hybrid Prompt Assembly & Wiring

**Files:** `backend/app/agents.py`, `backend/app/llm_client.py`, `backend/app/templates/vapi_prompt_template.md`

This task connects the generated company block (Task 2) to the vetted template so that one coherent prompt comes out, and wires the generator into the provisioning pipeline.

---

## 1. `compile_lead_prompt()` — the hybrid switch

`compile_lead_prompt()` gained one optional argument:

```python
def compile_lead_prompt(company_name, industry, profile=None,
                        business_brief="", company_context_block=None) -> str
```

### Two paths, one function

* **Block provided (normal path).** The generated block is emitted **verbatim** in place of the four deterministic company sections, at the position of the first company section in `SECTION_ORDER`. The deterministic company rendering is skipped entirely — there is no double section.
* **Block empty / `None` (fallback path).** The four company sections render deterministically from the profile + scenario library, exactly as the original code did. This path is byte-for-byte unchanged, so a generation failure yields a complete, correct prompt.

### `COMPANY_SECTIONS`

A new set names the four sections the generated block replaces:

```python
COMPANY_SECTIONS = {
    "business_context",
    "primary_purpose_and_scenarios",
    "escalation_rules",
    "customization_notes",
}
```

Everything *not* in this set is conversation-behaviour template text. The emission loop walks `SECTION_ORDER`; when it reaches a company section and a block is present, it emits the block once (on the first such section) and skips the rest.

### Why behaviour still wins

`SECTION_ORDER` places the behaviour sections both **before** the company zone (opening, patience, tone) and **after** it (follow-ups, **restrictions**, closing). The generated block is sandwiched between them, so:

```
# AI Receptionist — <Company>
## Patience and turn-taking (critical)
## How you speak / What you must never do
<<< LLM-GENERATED COMPANY BLOCK >>>
## Asking follow-up questions
## Restrictions          ← deterministic, emitted AFTER the block
## Ending the call
```

`Restrictions` being the second-to-last section means the vetted behavioural constraints are among the most recent context the model reads, so generated content cannot override them.

---

## 2. `llm_client.py` — `max_tokens`

`call_structured_llm()` and `_call_groq_structured()` gained a `max_tokens` parameter (**default 1024**, preserving existing behaviour for every current caller). The company-block generator passes **2048** because its output is far longer than the short structured extractions the rest of the codebase makes.

---

## 3. Provisioning wiring

`provision_vapi_assistant_task()` (Stage 2) now, before assembling the prompt:

1. Loads the full clarification transcript from `ClarificationMessage` for the lead.
2. Looks up the industry playbook.
3. Calls `generate_company_context_block(...)` with the profile, document brief, transcript, library, and voice.
4. Passes the result into `compile_lead_prompt(..., company_context_block=...)`.

Both branches are logged: a successful generation logs the block size; an empty result logs a warning that the deterministic fallback is being used. The document-summarisation, knowledge-base upload, and Vapi provisioning stages around it are unchanged.

`ClarificationMessage` is queried **directly in `agents.py`** rather than importing from `clarification.py`, because `clarification.py` already imports `provision_vapi_assistant_task` from `agents.py` — reusing its history helper would create a circular import.

---

## 4. Template contract update

The header of `vapi_prompt_template.md` previously promised:

> An LLM never writes any part of this file, and never writes any part of the rendered output.

That is no longer true, so the header was rewritten to state the **honest hybrid contract**:

* The **conversation-behaviour** sections are never LLM-written — they stay deterministic template text.
* The **company-specific** sections are normally replaced at render time by the LLM-generated block; the deterministic versions in the file are the **fallback**.
* A note that a new company section must be added to `COMPANY_SECTIONS` as well as `SECTION_ORDER`.
