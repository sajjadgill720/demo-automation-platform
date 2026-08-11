"""Unit tests for app/prompt_lint — offline, no LLM, no DB."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.agents import compile_lead_prompt
from app.prompt_lint import (
    lint_compiled_prompt,
    lint_generated_fields,
    validate_identity,
    INVARIANT_RULE_SENTINELS,
)

ok = fail = 0
def check(name, cond, detail=""):
    global ok, fail
    if cond:
        ok += 1; print(f"  PASS  {name}")
    else:
        fail += 1; print(f"  FAIL  {name} {detail}")

print("\n--- a real compiled prompt is clean ---")
clean = compile_lead_prompt("Riverside Plumbing", "Plumbing Services")
check("clean prompt has no violations", lint_compiled_prompt(clean) == [], lint_compiled_prompt(clean))

print("\n--- duplicated invariant rule is caught ---")
# Restate the commitment-limits sentinel a second time → must be flagged.
dupe = clean + "\n\nDo not make commitments the business has not authorised (again).\n"
viol = lint_compiled_prompt(dupe)
check("duplicate rule flagged", any("commitment_limits" in v for v in viol), viol)

print("\n--- missing invariant rule is caught ---")
missing = clean.replace("## Ending the call", "## Wrapping up")
viol = lint_compiled_prompt(missing)
check("missing rule flagged", any("closing" in v for v in viol), viol)

print("\n--- conditional KB rule: expected only with docs ---")
docs = compile_lead_prompt("Acme Dental", "Dental", has_documents=True)
check("kb_retrieval clean with docs", lint_compiled_prompt(docs, has_documents=True) == [])
check("kb_retrieval flagged if claimed-but-absent",
      any("kb_retrieval" in v for v in lint_compiled_prompt(clean, has_documents=True)))

print("\n--- leaked-phrase detection on generated fields ---")
bad = {
    "greeting_line": "Hello",
    "business_context": "We answer from our knowledge base and, according to our records, we are great.",
    "escalation_terms": ["a flood"],
    "escalation_action": "Let me check the database.",
}
lv = lint_generated_fields(bad)
check("knowledge base leak flagged", any("knowledge base" in v for v in lv), lv)
check("according to leak flagged", any("according to" in v for v in lv))
check("records leak flagged", any("our records" in v for v in lv))
check("let me check leak flagged", any("let me check" in v for v in lv))
check("database leak flagged", any("database" in v for v in lv))

good = {
    "greeting_line": "Thanks for calling Acme, how can I help?",
    "business_context": "Acme is a two-van plumbing team. Most callers have an urgent leak.",
    "escalation_terms": ["an active flood"],
    "escalation_action": "Take the address and mobile number and pass it to the on-call plumber.",
}
check("clean generated fields pass", lint_generated_fields(good) == [], lint_generated_fields(good))

print("\n--- identity validation ---")
check("intake name present passes", validate_identity(clean, "Riverside Plumbing") == [])
check("missing intake name flagged", any("missing" in v for v in validate_identity(clean, "Totally Different Co")))
conflict = clean + "\n\nActually, Bright Smile operates in a different sector.\n"
check("second 'operates in' flagged", any("operates in" in v for v in validate_identity(conflict, "Riverside Plumbing")))

print("\n--- every sentinel resolves in a real prompt ---")
for rid, sent in INVARIANT_RULE_SENTINELS.items():
    check(f"sentinel present once: {rid}", clean.count(sent) == 1, f"count={clean.count(sent)}")

print(f"\n==== {ok} passed, {fail} failed ====")
sys.exit(1 if fail else 0)
