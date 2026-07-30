# Tests — Hybrid Prompt & Richer Interview

This document covers the test changes and verification for the hybrid-prompt work. All checks run **offline** (no live LLM, no database) except where noted, and pass.

**Result:** `37 passed, 0 failed` in `test_modular_prompt.py`, plus the DB-free clarification unit tests green.

---

## 1. `test_modular_prompt.py` — prompt composition

Pure template assembly, so it runs with no LLM and no DB. It is the guard against a template edit silently dropping a section or a regression in the hybrid switch.

### Pre-existing coverage (still passing)
* No-profile path stays complete and usable (no unrendered `{{ }}`, correct sections, substantial length).
* Profile-informed path injects each field without truncation.
* Dict (jsonb-shape) profile accepted; `UNKNOWN` fields omitted; empty scenario list omitted.
* Determinism: identical output across repeated calls (fallback path).
* Injection defence: injection keywords and angle brackets stripped from profile fields.

### Two stale assertions fixed
The template had been rewritten previously but two checks were never updated — they failed independent of this change (confirmed against `HEAD`):

| Check | Old (stale) | New (matches template) |
| --- | --- | --- |
| core identity | `"You are Convoa"` | `"powered by Convoa"` |
| scenario section | `"How to handle the calls"` | `"how to handle the calls"` |

### New coverage added

**Hybrid path — generated block replaces company sections**
* Generated block emitted verbatim.
* Behaviour sections still present (patience, restrictions, closing).
* **Ordering invariant:** `## Restrictions` appears *after* the generated block — proving behaviour brackets and outranks generated content.
* No deterministic company text (`conservative default`) leaks in alongside the block.
* No unrendered placeholders.

**Hybrid fallback — empty/None block**
* Empty block falls back to the deterministic company sections.
* Fallback output is **identical** to calling with no block argument at all (guards the fallback from diverging).

**Expanded profile**
* The 12-field `CompanyProfile` constructs.
* New fields default to `UNKNOWN` when omitted.

---

## 2. `test_clarification.py` — gap detection

The `detect_gaps_node` unit tests hardcoded the old **five-field** assumption and broke once the profile expanded. They were rewritten to be **robust to the field count** by building fixtures over `PROFILE_FIELDS` itself:

* **Empty profile:** asserts `len(missing) == len(PROFILE_FIELDS)` (now 12) instead of a literal `5`.
* **Partial profile:** fills every field except two, then asserts the missing set is *exactly* `{must_handle_scenarios, escalation_preferences}` — using a set comparison so it no longer depends on the total count.

The sanitisation and prompt-compilation unit tests in the same file were unaffected and pass.

---

## 3. End-to-end smoke test (manual)

A manual check exercised the full wiring with the LLM call monkeypatched to return a canned block (no network):

* `generate_company_context_block()` returns the block.
* `compile_lead_prompt()` embeds it and produces the expected section order:

```
# AI Receptionist — Acme HVAC
## Patience and turn-taking (critical)
## How you speak
## What you must never do
## The business you are answering for        ← generated block
## What this line is really for ...           ← generated block
## When to hand the call to a human           ← generated block
## Asking follow-up questions
## Restrictions                               ← after the block
## Ending the call
```

* Assertions confirmed: block text present, behaviour sections present, `## Restrictions` index > block index, no unrendered `{{ }}`.

---

## 4. Running the tests

```bash
cd backend
.venv/Scripts/python.exe tests/test_modular_prompt.py
```

The clarification gap-detection units are DB-free and can be invoked directly:

```bash
cd backend
.venv/Scripts/python.exe -c "import sys,os; sys.path.insert(0,'.'); import tests.test_clarification as t; t.test_extraction_and_gaps_unit(); t.test_sanitization_and_prompt_unit()"
```

The HTTP integration tests in `test_clarification.py` require a running server + database and are skipped automatically when the server is unreachable.
