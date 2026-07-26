import re

def sanitize_input(value: str) -> str:
    """Sanitizes user input to prevent prompt injection and restrict length (max 100 chars)."""
    if not value:
        return ""
    # Cap length at 100 characters to prevent buffer/context stuffing
    value = value[:100]
    # Strip brackets, braces, and angle brackets
    value = re.sub(r'[{}[\]<>]', '', value)
    # Strip common prompt injection keywords (case-insensitive)
    injection_keywords = [
        r"ignore\s+previous", r"system\s+prompt", r"instruction", 
        r"override", r"you\s+are\s+now", r"bypass", r"developer\s+mode",
        r"system:", r"human:", r"user:", r"assistant:"
    ]
    for pattern in injection_keywords:
        value = re.sub(pattern, "", value, flags=re.IGNORECASE)
    # Remove excessive whitespaces/newlines
    value = " ".join(value.split())
    return value

def sanitize_profile_text(value: str, max_len: int = 400) -> str:
    """Sanitizes free-text CompanyProfile fields for injection into the Vapi prompt.

    Same injection defenses as sanitize_input, but with a cap sized for prose.
    sanitize_input's 100-char limit exists for short identifiers like company name
    and industry; applying it to a profile field silently truncates mid-sentence
    (e.g. an escalation rule ending "...and book firs"), which produces a prompt
    instructing the agent to follow a half-written policy.
    """
    if not value:
        return ""
    value = str(value)[:max_len]
    value = re.sub(r'[{}[\]<>]', '', value)
    for pattern in INJECTION_PATTERNS.values():
        value = re.sub(pattern, "", value, flags=re.IGNORECASE)
    return " ".join(value.split())


INJECTION_PATTERNS = {
    "ignore_previous": r"ignore\s+previous",
    "system_prompt": r"system\s+prompt",
    "instruction": r"instruction",
    "override": r"override",
    "you_are_now": r"you\s+are\s+now",
    "bypass": r"bypass",
    "developer_mode": r"developer\s+mode",
    "system_tag": r"system:",
    "human_tag": r"human:",
    "user_tag": r"user:",
    "assistant_tag": r"assistant:",
}


#: Absolute upper bound on document text we will process at all. This is a sanity
#: guard against a pathological upload, NOT a content budget — anything under it
#: is summarized in full by app/document_summarizer.py rather than cut.
DOCUMENT_HARD_LIMIT = 400_000


def sanitize_document_text(
    value: str, threshold: int = 2, max_len: int = DOCUMENT_HARD_LIMIT
) -> tuple[str, bool, int, list[str]]:
    """Sanitizes document text for prompt injection, without destroying content.

    `max_len` previously defaulted to 5000, which silently discarded the tail of
    any real SOP — a 23k-char document lost 79% of itself, including policies
    stated near the end, with no warning. Length handling now belongs to the
    summarizer (map-reduce over the whole document); this function's job is the
    injection gate only, so the default bound is a sanity limit rather than a
    content budget. Callers that genuinely need a short excerpt pass max_len
    explicitly.

    Returns:
        (sanitized_text, was_flagged, match_count, matched_pattern_names)
    """
    if not value:
        return "", False, 0, []

    value = value[:max_len]

    matched_pattern_names = []
    total_matches = 0

    for name, pattern in INJECTION_PATTERNS.items():
        matches = len(re.findall(pattern, value, flags=re.IGNORECASE))
        if matches > 0:
            matched_pattern_names.append(name)
            total_matches += matches

    # If matches >= threshold (default 2), reject document text entirely
    if total_matches >= threshold:
        return "", True, total_matches, matched_pattern_names

    # If below threshold, strip brackets/braces and single matched keyword if present
    cleaned_value = re.sub(r'[{}[\]<>]', '', value)
    for pattern in INJECTION_PATTERNS.values():
        cleaned_value = re.sub(pattern, "", cleaned_value, flags=re.IGNORECASE)

    cleaned_value = " ".join(cleaned_value.split())
    return cleaned_value, False, total_matches, matched_pattern_names

