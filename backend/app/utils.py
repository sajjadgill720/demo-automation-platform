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


def sanitize_document_text(value: str, threshold: int = 2) -> tuple[str, bool, int, list[str]]:
    """Sanitizes document text to prevent prompt injection and restrict length (max 5000 chars).

    Returns:
        (sanitized_text, was_flagged, match_count, matched_pattern_names)
    """
    if not value:
        return "", False, 0, []

    # Cap length at 5000 characters for document/SOP content
    value = value[:5000]

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

