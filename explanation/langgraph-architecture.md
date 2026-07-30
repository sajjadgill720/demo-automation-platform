# LangGraph Solution Scoping Architecture

This reference guide documents the state machine, checkpointing model, interruptions, and conversation constraints implemented inside the DataQuartz solution scoping module (`clarification.py`).

---

## 1. Thread Checkpointing & Persistent State
### PostgresSaver Integration
To pause and resume conversations spanning multiple client sessions, LangGraph compiles workflows with a Postgres persistence checkpointer:
```python
workflow = StateGraph(ClarificationState)
...
# PostgreSQL state checkpointer storing threads by lead_id
compiled_graph = workflow.compile(checkpointer=PostgresSaver(conn_pool))
```
Every lead onboarding process is isolated as its own thread, utilizing `lead_id` as the unique `thread_id`.

---

## 2. In-Place Interrupts and State Safety
### The Challenge
A LangGraph node that triggers side effects (like updating database logs, invoking API prompts, or incrementing counters) will re-execute *entirely* from the top if the graph resumes from that same node. Placing `interrupt()` calls in a node with side-effects causes double execution when the graph wakes up.

### The Solution (Side-Effect Separation)
We separated the question generation logic from the pause logic:
1. **Node 1: `generate_question_node`:** Calls the LLM to write the query, saves it to database history, modifies state variables, and updates the question count. This node returns without pausing.
2. **Node 2: `await_answer_node`:** Contains **no side effects** and executes the interrupt:
   ```python
   @timed_node("await_answer")
   def await_answer_node(state: ClarificationState) -> ClarificationState:
       question_text = state.get("pending_question") or ""
       recommendations = state.get("pending_recommendations") or []
       is_final = bool(state.get("pending_is_final"))

       # Pause here. When resumed, LangGraph replays this node from the top.
       resume_val = interrupt({
           "question": question_text,
           "recommendations": recommendations,
           "is_final": is_final,
       })

       # Extracted user reply is returned into state, advancing the cursor
       return {
           **state,
           "temp_resume": resume_val,
       }
   ```

---

## 3. Question Budget and Asked Guardrails
### Prevent Loop-Scoping (`asked_fields`)
If the profile extraction LLM fails to structure a field (e.g. `escalation_preferences`) because a user gives a short response, a naive scoping agent would repeatedly ask about that same field on every turn. 
* **Fix:** The moment a question targeting a specific field is generated, that field is appended to `asked_fields` inside the graph state. It is immediately blocked from being chosen again.

### Bounding the Conversation
To prevent long interviews, we enforce a strict bounds check in the router:
```python
def route_after_gaps(state: ClarificationState):
    questions_asked = state.get("questions_asked") or 0
    missing = state.get("missing_fields") or []
    asked_fields = state.get("asked_fields") or []
    
    # Exclude fields we already generated questions for
    remaining_fields = [f for f in missing if f not in asked_fields]

    if questions_asked < MAX_QUESTIONS and (remaining_fields or questions_asked < MIN_QUESTIONS):
        return "generate_question"
    if not state.get("final_question_asked"):
        return "ask_final_question"
    return "finalize"
```

---

## 4. Meta-Responses vs Deferrals
Users sometimes respond to scoping questions with side queries (meta-responses) or choose to delegate the decision (deferrals).

### Meta-Responses
* **Scenario:** The agent asks: *"How do you want to handle emergency calls?"* and the user responds: *"Can you give me an example of what others do?"*
* **Handling:** The system routes the response through a classification LLM. If marked as `is_direct_answer = False`, the router skips profile extraction, returns a helpful explanation + re-asks the original question, and immediately cycles back to `await_answer`:
  ```python
  def route_after_ingest(state: ClarificationState):
      if state.get("last_response_was_meta"):
          return "await_answer" # Skip extract_profile
      return "extract_profile"
  ```

### Deferral Responses
* **Scenario:** User responds: *"I don't know, use your best judgment."*
* **Handling:** The classification model identifies this as a valid answer. It is sent to the extractor, which fills the field with a sensible industry playbook preset.
