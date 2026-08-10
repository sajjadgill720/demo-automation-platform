# Clarification Chat Workflow

The **Clarification Chat** is a stateful, multi-turn interview graph powered by **LangGraph** and checkpointed with **PostgresSaver**. It is designed to run scoping interviews (asking 5 to 9 questions) to fill out a 12-field structured `CompanyProfile` for prospective clients before provisioning a live Vapi voice agent.

Below is a detailed walkthrough of the workflow, state transitions, and optimization decisions.

---

## State Diagram (LangGraph)

```mermaid
stateDiagram-v2
    [*] --> parse_documents : start_clarification()
    parse_documents --> extract_profile
    extract_profile --> detect_gaps
    
    state route_after_gaps <<choice>>
    detect_gaps --> route_after_gaps
    
    route_after_gaps --> summarize_documents : "First pass & documents exist"
    route_after_gaps --> generate_question : "Gaps remain & within question budget"
    route_after_gaps --> ask_final_question : "Budget met or no gaps left"
    route_after_gaps --> finalize : "Final question answered"
    
    summarize_documents --> route_after_summarize
    state route_after_summarize <<choice>>
    route_after_summarize --> generate_question : "Gaps remain & within budget"
    route_after_summarize --> ask_final_question : "Budget met"
    route_after_summarize --> finalize : "Final question answered"

    generate_question --> await_answer : "Saves question to state"
    ask_final_question --> await_answer : "Saves catch-all question to state"
    
    state await_answer {
        note right of await_answer: Graph Interrupt & Checkpoint\n(Pauses HTTP request)
    }
    
    await_answer --> ingest_answer : "submit_clarification_answer()"
    
    state route_after_ingest <<choice>>
    ingest_answer --> route_after_ingest
    route_after_ingest --> await_answer : "Meta-response (Clarification requested)"
    route_after_ingest --> merge_answer : "Direct answer received"
    
    merge_answer --> detect_gaps : "Recalculates missing fields"
    
    finalize --> [*]
```

---

## Detailed Step-by-Step Workflow

### 1. Ingestion & Graph Initialization (`start_clarification`)
When a user begins the clarification phase:
- An initial `ClarificationState` is created. It contains metadata (`company_name`, `industry`, `form_problem`), an empty conversation history, and tracking variables (`questions_asked = 0`, `asked_fields = []`).
- The graph is executed with a unique `thread_id` (bound to `lead_id`), enabling **PostgresSaver** to checkpoint the graph state.

### 2. Document Processing & Ingestion (`parse_documents`)
- If the lead has uploaded SOP/process documents and given consent, the text is extracted.
- A **prompt injection check** is run (`sanitize_document_text`). If flagged, the document content is ignored to protect LLM context windows and prompt integrity.

### 3. Initial Profile Extraction (`extract_profile`)
- **Performance Optimization (Fast-Path Bypass)**: If no documents were uploaded and no chat history exists, this node immediately initializes a blank profile with the `primary_problem` set to the intake form's description, bypassing the LLM call and saving 12–15 seconds of connection latency.
- Otherwise, it passes the full text of documents and history to the LLM (`EXTRACTION_PROMPT`) to populate a structured `CompanyProfile` JSON.

### 4. Gap Detection (`detect_gaps`)
- Compares the `CompanyProfile` against the 12 target fields (e.g., `services_and_offerings`, `hours_and_availability`, `escalation_preferences`, `pricing_and_quote_policy`).
- Fields that are empty or marked `"UNKNOWN"` are added to `missing_fields`.

### 5. Conditional Routing (`route_after_gaps`)
- **Document Summarization Check**: On the first pass, if raw documents exist, the graph routes to `summarize_documents` to distil a brief *before* asking questions.
- **Scoping Check**: Routes to `generate_question` if:
  - The number of questions asked is under `MAX_QUESTIONS` (9).
  - AND there are remaining unasked gaps OR the interview hasn't met `MIN_QUESTIONS` (5).
- **Catch-All Check**: Routes to `ask_final_question` if the budget is met but the final catch-all wasn't asked.
- **Completion Check**: Routes to `finalize` once the final question has been answered.

### 6. Document Summarization (`summarize_documents`)
- Runs a map-reduce summarization on the raw documents to build a compact `business_brief`.
- **Reasoning**: This brief provides the question-generation and prompt-compilation modules with distilled context, saving tokens and keeping prompt context windows highly focused.

### 7. Question Generation (`generate_question`)
- **Contextual Greeting**: On the first turn, it prepends a deterministic, personalized intro summarizing what is already known.
- **Target Selection**: Chooses the highest-priority missing field that hasn't been targeted yet (tracked in `asked_fields` to prevent repetitive questioning even if LLM extraction fails).
- **LLM Scoping**: Prompts the LLM to generate one situation-grounded question (e.g., *"If someone calls at 9 PM with an emergency..."*) and 2-4 short recommended answers.
- **Failures & Fallbacks**: If the LLM call fails (e.g., Groq rate limits), the graph falls back to a deterministic, field-specific question and options from a library instead of failing or stalling the conversation.

### 8. The State Interrupt (`await_answer`)
- The node triggers `interrupt()`, returning the question and options to the API caller.
- The thread checkpoints in the database and suspends execution, freeing up server memory and resources.
- The web app displays the question and quick-selection chips to the lead.

### 9. Resuming & Ingestion (`ingest_answer`)
- Once the user clicks an option or writes a custom reply, the API resumes the graph (`submit_clarification_answer`).
- **Response Triage**: An LLM classifies the response:
  - **Direct Answer**: Routes to `merge_answer`.
  - **Meta-Response** (e.g., *"Why are you asking this?"* or *"What do you mean?"*): The assistant answers the user's meta-question, re-appends the pending question, and routes directly back to `await_answer` (preventing a wasted turn/gap advancement).

### 10. Incremental Profile Merging (`merge_answer`)
- **Reasoning**: In early iterations, the graph ran a full profile extraction on the entire conversation history on every turn. As the history grew, this became extremely slow and expensive.
- **Solution**: The `merge_answer` node runs a cheap, targeted LLM call (`MERGE_ANSWER_PROMPT`) matching the *current* profile + *only the latest* Q&A exchange to update the fields. It ensures safety by refusing to downgrade already known information.
- Once merged, it loops back to `detect_gaps` to re-triage missing fields.

### 11. Final Catch-All (`ask_final_question`)
- Poses a final question: *"Is there anything else... that we haven't covered yet?"* to catch miscellaneous customizations.
- Pauses one last time in `await_answer` to wait for user confirmation.

### 12. Finalization (`finalize`)
- Marks the profile status as `completed` in the database, serializes the profile, and ends graph execution.
- This completion flags the background task to begin compiling the deterministic Vapi system prompt and provisioning the agent.
