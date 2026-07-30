# Latency Optimization and Performance Reference

This reference guide documents the techniques and design patterns implemented across the DataQuartz platform to minimize per-turn response latency in conversational AI interfaces.

---

## 1. timed_node Profiling Decorator
To isolate and address slow execution steps, every node in our LangGraph workflow is wrapped in a custom `@timed_node` decorator:
```python
import time
import logging

logger = logging.getLogger("app.clarification")

def timed_node(node_name: str):
    """Measures node execution time and logs trace metrics."""
    def decorator(fn):
        def wrapper(state: "ClarificationState"):
            lead_id_str = state.get("lead_id")
            t0 = time.perf_counter()
            logger.info(f"NODE_START node={node_name} lead_id={lead_id_str}")
            interrupted = False
            try:
                return fn(state)
            except BaseException as e:
                # Mark if the run paused on a GraphInterrupt
                interrupted = type(e).__name__ == "GraphInterrupt"
                raise
            finally:
                dur_ms = (time.perf_counter() - t0) * 1000
                logger.info(
                    f"NODE_END node={node_name} lead_id={lead_id_str} "
                    f"duration_ms={dur_ms:.1f} paused_on_interrupt={interrupted}"
                )
        wrapper.__name__ = getattr(fn, "__name__", node_name)
        return wrapper
    return decorator
```
These log metrics are aggregated in testing workflows (e.g. `test_clarification_dedup_and_meta.py`) to verify that the complete user response turn completes in under $8\text{ seconds}$ (averaging $1.2\text{s} - 3.5\text{s}$ under load).

---

## 2. Asynchronous Background Threads
Certain operations require external network requests to third-party endpoints (e.g. creating telephone routes, ordering voice nodes, or compiling Vapi templates). If executed inside the HTTP request loop, these operations introduce blocking latency that degrades user experience.

### Implementation
We offload provisioning and compilation tasks to a **daemon background thread** immediately after the final scoping questions are completed, returning control back to the UI:
```python
import threading
from app.agents import provision_vapi_assistant_task

# Triggers telephone setup asynchronously without blocking the API response
threading.Thread(
    target=provision_vapi_assistant_task,
    args=(lead_id_str, company_name, voice_gender, prompt_text, default_scenario_rules),
    daemon=True
).start()
```

---

## 3. High-Throughput Model Selection and Configurations
### Model Selection
Instead of calling slower frontier models (e.g. GPT-4) for routine classifications and field extractions, we utilize **Groq API endpoints** targeting the `llama-3.3-70b-versatile` model. 

### Configuration Details
1. **JSON Output Modes:**
   We enforce strict structured JSON modes (`"response_format": {"type": "json_object"}`) and supply low temperature values ($0.1$) to prevent token hallucination and minimize parsing retries.
2. **Token Budgets:**
   We keep maximum generation limits low (`max_tokens=256` for qualification classification and `max_tokens=1024` for question builders) to reduce first-token-to-response generation times.

---

## 4. State Caching and Input Sanitization
Parsing raw files (PDFs, DOCX, etc.) is computationally intensive. 
* **Caching Strategy:** File content is parsed **once** inside the entry node `parse_documents_node`. The extracted clean text is saved directly into the Postgres checkpointer database state under `"documents_text"`. 
* Subsequent gap detections, profile extractions, and question generation runs query this cached string instead of parsing raw buffers repeatedly.
* Input strings are sanitized by trimming excess whitespace and stripping empty carriage returns to keep token payloads small.
