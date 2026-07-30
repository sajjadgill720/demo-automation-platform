# Task 1 — Richer Onboarding Interview

**File:** `backend/app/clarification.py`

The clarification chat is the LangGraph interview that scopes a business before its demo agent is built. This task widened it from a five-field checklist into a genuine discovery capable of gathering enough to keep a prompt correct for a year or more.

---

## 1. The Challenge

The old `CompanyProfile` had **five fields**, and the interview was capped at **3–5 questions**. That is enough to sound tailored on a single demo call, but not enough to keep an agent correct over time:

* It never asked what the business actually *sells* — so the agent could not recognise a service a caller named.
* It never asked *hours*, *seasonality*, *service area*, or *pricing limits* — the facts that most often make an agent say something wrong.
* It never captured *who handles what* or *what to collect on every call* — the operational spine of a receptionist.

---

## 2. The Solution

### Expanded profile (5 → 12 fields)

`CompanyProfile` now carries the durable dimensions of a business. The **original five field names are preserved** so the deterministic fallback in `agents.py` and existing tests keep working; the seven new fields feed the LLM prompt generator.

| Field | Captures |
| --- | --- |
| `primary_problem` *(original)* | The pain point that brought them to Convoa |
| `services_and_offerings` **(new)** | What they actually sell or do |
| `must_handle_scenarios` *(original)* | Call types the agent must get right |
| `current_workflow_summary` *(original)* | How calls are handled today |
| `hours_and_availability` **(new)** | Hours, after-hours, seasonal/peak patterns |
| `escalation_preferences` *(original)* | When/how to hand a call to a human |
| `data_to_capture` **(new)** | What to collect every call, and where it lands |
| `key_people_and_roles` **(new)** | Who handles what; who to route to |
| `pricing_and_quote_policy` **(new)** | What may be quoted vs never promised |
| `top_caller_questions` **(new)** | Most-asked questions + correct answers |
| `service_area_and_locations` **(new)** | Where they operate |
| `desired_customizations` *(original)* | Tone, brand voice, and hard boundaries |

`PROFILE_FIELDS` is **ordered by how much each gap changes agent behaviour**, so the interview spends its earliest questions on the highest-value unknowns.

### Widened adaptive questioner

The question-writing LLM was already adaptive (it picks the most valuable *unknown* each turn rather than marching through a form). It was extended to the new surface area:

* **`TOPIC_MENU`** — added services, hours/seasonality, service area, pricing limits, and top-question rows so the writer can reach for them.
* **`_FIELD_FOCUS`** — a human-readable focus phrase per new field, used to steer (not force) the next question toward a still-missing gap without sounding like a form.
* **`EXTRACTION_PROMPT`** — now enumerates all 12 fields with flat-value guidance and an explicit *"never invent hours, prices, names, or locations that do not appear in the inputs"* rule.
* **`_FALLBACK_QUESTIONS` / `_fallback_recommendations`** — a natural fallback question and a distinct set of click-chips for each new field, used only when the LLM call fails, so a degraded run still walks through the new gaps instead of looping.

### Raised interview budget

```
MIN_QUESTIONS: 3 → 5
MAX_QUESTIONS: 5 → 9
```

`MIN` guarantees breadth even when fields fill quickly; `MAX` keeps the interview bounded so it always ends at a reasonable length even when many fields remain unknown. Between the two, the graph keeps asking only while a still-unasked gap remains (`route_after_gaps`).

---

## 3. What did *not* change

* The LangGraph node structure, the meta-response classifier, the intro line, and the checkpointer are untouched.
* The `finalize` / skip paths and the API interface functions behave exactly as before.
* Extraction still fast-paths (no LLM call) when there are no documents and no conversation yet.
