# Core System Features and Security Behaviors

This reference guide documents the custom utility functions, sanitization rules, map-reduce document summarization, and prompt compilation rules deployed inside the DataQuartz codebase.

---

## 1. Input Sanitization & Injection Defense
To secure the LLM interfaces from prompt injection and context stuffing, the backend implements progressive sanitization strategies.

### Short-Field Sanitization (`sanitize_input`)
Used for short user input fields (e.g. company names, industry inputs).
* **Length Limit:** Caps input at exactly $100\text{ characters}$ to prevent buffer/context stuffing.
* **Tag Strip:** Removes braces, brackets, and angle brackets (`{} [] <>`) to prevent breaking JSON formatting and XML tags.
* **Injection Keyword Removal:** Scans for and removes common system instructions case-insensitively (e.g. `ignore previous`, `system prompt`, `you are now`, etc.).
* **Whitespace Cleaning:** Collapses multiple spaces and tabs into a single space.

### Free-Text/Prose Sanitization (`sanitize_profile_text`)
Used for scoping conversation replies and custom requirements fields.
* **Length Limit:** Caps inputs at $400\text{ characters}$ (sized to accept a complete, detailed sentence without truncation).
* **Defenses:** Applies the same injection defenses and tag strips as `sanitize_input`.

---

## 2. Document Ingestion & Safe Parsing
### The Challenge
A naive text cleaner would strip out keywords or truncate the document at a low word limit, discarding critical business rules stated near the end of operations manuals (e.g. cancellation policies, emergency phone routes).

### The Ingestion Gate (`sanitize_document_text`)
1. **Length Limit:** Configures a safety cap at `DOCUMENT_HARD_LIMIT = 400,000` characters to prevent execution timeouts from massive uploads.
2. **Frequency Scans:** Counts the occurrences of prompt injection keywords.
3. **Threshold Gate:** If injection keywords appear $\ge 2$ times across the document, the upload is flagged, rejected entirely, and marked `was_flagged = True`.
4. **Clean Pass:** If the keyword count is below the threshold, tags are stripped, clean text is formatted, and processing continues.

---

## 3. Map-Reduce Document Summarizer
### The Challenge
Compounding limits in LLM contexts once truncated document text at 5,000 characters. Slicing documents this way caused crucial guidelines to be missed.

### The Solution (`document_summarizer.py`)
To process lengthy SOPs without truncation, we implemented a map-reduce chunking architecture:
* **Single Call Logic:** If the cleaned text is $\le 8,000$ characters, it bypasses chunking and summarizes directly in a single step for performance.
* **Chunking Pass:** If the text is larger, the summarizer splits it into $6,000$-character chunks with a $400$-character overlap (ensuring rules broken across boundaries are read whole in at least one pass).
* **Rate Limit Guard (`INTER_CHUNK_DELAY`):** Introduces a $4.0\text{ second}$ delay between chunk requests to avoid exhausting token-per-minute (TPM) limits on public API keys.
* **Reduce Pass:** Gathers all chunk summaries and condenses them into a unified, descriptive `business_context_brief` which is directly compiled into the system instructions.

---

## 4. Scenario Library Integration
### The Challenge
Generalist LLMs generate generic responses that do not follow realistic business procedures (e.g., routing plumbing emergencies vs routine cleaning calls).

### The Solution (`scenario_library.py`)
The platform hosts a predefined registry of vetted business verticals (e.g., HVAC, plumbing, dental, logistics). 
* When a vertical is matched during onboarding, the scenario module fetches a curated set of rules, routing presets, and instructions.
* These rules are compiled directly into the system template instructions as standard guidelines, ensuring the voice agent performs according to specific industry standards.
* If no industry matches, the system falls back to a generic setup template.
