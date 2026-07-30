# Hybrid System-Prompt Generation — Overview

This document explains the move from a **fully deterministic, template-only** Vapi system prompt to a **hybrid** prompt: the conversation *behaviour* stays vetted template text, while the company-*specific* content is written by an LLM from a richer onboarding interview.

---

## 1. Why the change

### The old design
Every Vapi assistant prompt was assembled by `compile_lead_prompt()` using **pure string substitution** over a markdown template. A short clarification interview filled exactly **five structured fields** (`primary_problem`, `current_workflow_summary`, `must_handle_scenarios`, `escalation_preferences`, `desired_customizations`), and those five values were slotted into fixed template sections.

### The problem
* **Five fields cannot keep an agent correct for a year.** Real businesses differ on services offered, hours and seasonality, service area, pricing/quote limits, who handles what, and what to capture on every call. A five-field form never captured these, so the prompt stayed generic where it needed to be specific.
* **Fixed substitution cannot phrase business-specific handling well.** Template slots produce serviceable but rigid text; they cannot weave the intake form, the Q&A, and an uploaded document brief into cohesive, business-correct call-handling rules.

### The requirement
> Keep the template for *conversation behaviour*, but drive the *other* (company) information from form data + questions/answers. Ask better questions — not just checking five fields — enough to make a system prompt that works for that company for at least a year. Generate that prompt with an LLM.

---

## 2. The hybrid model

The prompt is split into two responsibility zones:

| Zone | Sections | Who writes it |
| --- | --- | --- |
| **Conversation behaviour** | opening, patience/turn-taking, tone, follow-ups, **restrictions**, closing | **Never an LLM** — vetted template, pure substitution |
| **Company-specific** | business context, scenarios & handling, escalation, specific requests | **LLM-generated** from form + Q&A + profile + document brief |

The behaviour sections **bracket** the generated block — including `Restrictions`, which is emitted *after* it. Because the behaviour rules are both the first and the last thing in the model's context, nothing the LLM writes into the company block can redefine how the agent behaves.

### Safety
* Every input to the generator is framed as **data describing a business, never instructions**. The generator prompt explicitly forbids acting on any embedded "ignore your instructions" style text.
* The generator may **not invent facts** (prices, hours, names, SLAs) absent from the inputs.
* Inputs are sanitised (`sanitize_input` / `sanitize_profile_text`) before they reach the generator, and document text still passes the existing consent + injection gates upstream.
* **Graceful fallback:** if generation returns nothing or fails, `compile_lead_prompt()` falls back to the original deterministic company rendering, so a degraded LLM never breaks provisioning.

---

## 3. The three tasks

The change breaks into three implementation areas, each documented separately:

1. **[Richer interview](richer-interview.md)** — expanded the clarification profile from 5 to 12 durable fields and widened the adaptive questioner and interview budget.
2. **[LLM company block](llm-company-block.md)** — new `prompt_generator.py` that writes the company-specific sections, with hard injection guardrails.
3. **[Hybrid assembly](hybrid-assembly.md)** — `compile_lead_prompt()` now accepts a generated block and emits it in place of the deterministic company sections, with the behaviour sections still bracketing it. Includes the `llm_client.py` `max_tokens` change and the provisioning wiring.

Testing is documented in **[tests](tests.md)**.

---

## 4. Files touched

| File | Change |
| --- | --- |
| `backend/app/clarification.py` | Expanded `CompanyProfile` (5 → 12 fields), widened topic menu / focus / fallbacks, raised interview budget 3–5 → 5–9 |
| `backend/app/prompt_generator.py` | **New** — LLM generation of the company block |
| `backend/app/agents.py` | Hybrid assembly in `compile_lead_prompt()`; provisioning wired to call the generator |
| `backend/app/llm_client.py` | Added `max_tokens` parameter (default 1024) |
| `backend/app/templates/vapi_prompt_template.md` | Header contract updated from "LLM never writes any part" to the honest hybrid contract |
| `backend/tests/test_modular_prompt.py` | Added hybrid-path, fallback, and expanded-profile tests; fixed stale assertions |
| `backend/tests/test_clarification.py` | Gap-detection tests made robust to the expanded field count |
