"""Compile-time lint for the Vapi system prompt.

WHY THIS FILE EXISTS
--------------------
The prompt is built as two layers (see app/agents.py compile_lead_prompt and
app/templates/vapi_prompt_template.md): invariant behaviour blocks that own each
rule exactly once, and per-business variable slots — some of which a constrained
LLM fills (app/prompt_generator.py). This module enforces the invariants that a
human review used to have to catch by eye:

  * lint_compiled_prompt — each invariant rule appears EXACTLY once in the final
    prompt (no rule restated across sections), and no two non-adjacent paragraphs
    share suspiciously high n-gram overlap.
  * lint_generated_fields — an LLM content field never leaks invariant-layer
    language ("knowledge base", "according to", "let me check", …), which would
    mean the model started writing structure/behaviour instead of business content.
  * validate_identity — the compiled prompt carries the intake business name and
    does not assert a second, conflicting identity from a generated field.

Everything here is pure string analysis: no LLM, no DB, no network — safe to call
on every compile and cheap enough to run in tests.
"""

import re
from typing import List

# Each invariant rule owns one distinctive sentinel that must appear EXACTLY once
# in a compiled prompt. If a template edit restates a rule in a second section its
# sentinel count rises and the lint fails. Keep each sentinel a verbatim substring
# of exactly one section in vapi_prompt_template.md.
INVARIANT_RULE_SENTINELS = {
    "opening": "You are the AI voice receptionist answering live calls",
    "turn_taking": "Wait for silence.",
    "speech_style": "Say numbers and times the way a person would speak them",
    "data_capture": "capture their name, a callback number, and a one-line description",
    "follow_up": "## Asking follow-up questions",
    "kb_discipline": "Answer only from information you were actually given",
    "never_invent": "Never invent information.",
    "commitment_limits": "Do not make commitments the business has not authorised",
    "sensitive_data": "Do not collect sensitive data",
    "closing": "## Ending the call",
}

# Emitted only when documents are attached to the Vapi Knowledge Base: expect
# exactly once when has_documents, and never otherwise.
CONDITIONAL_RULE_SENTINELS = {
    "kb_retrieval": "Knowledge Base authority and retrieval",
}

# Phrases that belong to the invariant layer and must NEVER appear inside an
# LLM-generated content field. Their presence means the model wrote structure or a
# KB-citation/narration instruction rather than plain business content.
LEAKED_INVARIANT_PHRASES = [
    "knowledge base",
    "according to",
    "let me check",
    "database",
    "our records",
]

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def lint_compiled_prompt(prompt: str, has_documents: bool = False) -> List[str]:
    """Returns a list of violation messages (empty means the prompt is clean)."""
    violations: List[str] = []

    for rule_id, sentinel in INVARIANT_RULE_SENTINELS.items():
        count = prompt.count(sentinel)
        if count != 1:
            violations.append(f"invariant rule '{rule_id}' appears {count}x (expected 1)")

    for rule_id, sentinel in CONDITIONAL_RULE_SENTINELS.items():
        expected = 1 if has_documents else 0
        count = prompt.count(sentinel)
        if count != expected:
            violations.append(
                f"conditional rule '{rule_id}' appears {count}x (expected {expected})"
            )

    violations.extend(_duplicate_paragraph_violations(prompt))
    return violations


def lint_generated_fields(fields: dict) -> List[str]:
    """Rejects generated content that leaked invariant-layer language.

    `fields` maps a field name to a string or a list of strings (e.g.
    escalation_terms). Returns violation messages; empty means safe to merge.
    """
    violations: List[str] = []
    for key, value in (fields or {}).items():
        items = value if isinstance(value, (list, tuple)) else [value]
        for item in items:
            low = str(item or "").lower()
            for phrase in LEAKED_INVARIANT_PHRASES:
                if phrase in low:
                    violations.append(
                        f"generated field '{key}' leaked invariant phrase '{phrase}'"
                    )
    return violations


def validate_identity(prompt: str, company_name: str) -> List[str]:
    """Asserts the compiled prompt's identity is the intake name, stated once."""
    violations: List[str] = []
    name = (company_name or "").strip()
    if name and name not in prompt:
        violations.append(f"identity: intake business name '{name}' missing from compiled prompt")
    # The code-owned identity line reads "<name> operates in <industry>" exactly
    # once. A second occurrence means a generated field asserted its own identity —
    # the class of drift that split "Smile Bright" (intake) from "Bright Smile" (KB).
    if prompt.count("operates in") > 1:
        violations.append(
            "identity: multiple 'operates in' clauses — a generated field may assert a conflicting identity"
        )
    return violations


def _ngrams(tokens: List[str], n: int = 5):
    return {tuple(tokens[i : i + n]) for i in range(len(tokens) - n + 1)}


def _duplicate_paragraph_violations(
    prompt: str, threshold: float = 0.6, min_tokens: int = 25
) -> List[str]:
    """Flags non-adjacent paragraphs with high 5-gram Jaccard overlap.

    A smell detector for a rule accidentally restated in different words. Only
    substantial paragraphs (>= min_tokens) are compared, and only non-adjacent
    pairs, so ordinary neighbouring prose never trips it.
    """
    paras = [p.strip() for p in re.split(r"\n\s*\n", prompt) if p.strip()]
    grams = []
    for para in paras:
        toks = _TOKEN_RE.findall(para.lower())
        grams.append(_ngrams(toks) if len(toks) >= min_tokens else None)

    out: List[str] = []
    for i in range(len(paras)):
        for j in range(i + 2, len(paras)):  # non-adjacent pairs only
            gi, gj = grams[i], grams[j]
            if not gi or not gj:
                continue
            inter = len(gi & gj)
            if not inter:
                continue
            union = len(gi | gj)
            jac = inter / union if union else 0.0
            if jac >= threshold:
                out.append(f"paragraphs {i} and {j} share high 5-gram overlap ({jac:.2f})")
    return out
