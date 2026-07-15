# Walkthrough - Convoa Demo Automation Subservice MVP

This document summarizes the changes, design decisions, and database setup completed today for the Convoa Demo Automation Backend Subservice.

---

## 1. Goal Achieved
Designed and built a secure, resilient, and non-redundant backend subservice that automates the lifecycle of personalized Vapi AI voice agents for demo requests. When a lead requests a demo, the pipeline registers the lead, compiles a custom-branded voice assistant system prompt, provisions the agent asynchronously, and deletes the agent automatically when the session ends.

---

## 2. Technical Accomplishments

### Database & Schema Migration
- **Lead Model (`leads` table)**: Added a SQLModel database schema in `backend/app/models.py` including `company_name`, `contact_name`, `contact_email`, `contact_phone`, `industry`, `rendered_prompt` (for auditing), `assistant_id`, and `agent_status` (pending, active, completed, failed) along with timestamp tracking.
- **Alembic Migrations Framework**: Initialized Alembic migrations in the `backend/` folder and configured `migrations/env.py` to dynamically load `DATABASE_URL` from the configuration environment and auto-detect models via `SQLModel.metadata`.
- **SQLite Inspection**: Inspected the local SQLite database (`database.db`) to ensure no production or legacy tables were affected or lost.

### Prompt Sanitization & Security
- **Injection Defense**: Implemented input sanitization in `app/agents.py` to protect the LLM system prompt against prompt-injection. It restricts input fields to 100 characters and strips meta-characters (such as braces `{}`, brackets `[]`, angle brackets `<>`) and common instructions override commands (like "ignore previous instructions").
- **Static Template Persona**: Created a version-controlled markdown prompt template `backend/app/templates/vapi_prompt_template.md` defining the voice agent's receptionist persona, behavior, and formatting.

### Resilient API Integration (Vapi)
- **Eliminated Code Redundancy**: Unified all assistant creation requests under a single helper `_call_vapi_create_assistant` in `app/agents.py`, serving both the legacy discovery flow and the new demo request flow.
- **Transient-Only Retry Policy**: Configured Vapi API calls to retry once on transient network/timeout errors or HTTP 5xx responses. It fails immediately without retrying on persistent errors (HTTP 4xx, e.g. invalid credentials or malformed payloads) and records a descriptive `failure_reason` in the database without crashing the application.

### FastAPI Endpoints
- **`POST /api/demo-request`**: Validates payloads with Pydantic (`EmailStr` checks), sanitizes inputs, renders the template, inserts a new lead as `pending`, enqueues a background task, and returns `lead_id` immediately. Added documentation warnings to upgrade to Celery + Redis when moving beyond the MVP.
- **`GET /api/demo-request/{lead_id}`**: Enables polling of agent provisioning status.
- **`POST /api/demo-request/{lead_id}/end-session`**: Triggers Vapi assistant deletion and marks lead status as `completed`.
- **Fallback Simulation**: Configured the Vapi operations to mock creation/deletion if no API key is specified (or if dummy keys are used), permitting frictionless local development.

### Structured Logging
- **Production Logs**: Created `app/logging_config.py` defining a custom `JSONFormatter` to print single-line JSON log logs. Enabled extra contextual data passing (like `lead_id` and `assistant_id`) to simplify cloud log monitoring and dashboard integrations.

---

## 3. Next Steps (Pending Configuration)
1. Configure `DATABASE_URL` (Supabase PostgreSQL string) and `VAPI_API_KEY` inside `backend/.env`.
2. Generate migration script: `.venv\Scripts\alembic revision --autogenerate -m "initial_schema"`
3. Apply migration to Supabase: `.venv\Scripts\alembic upgrade head`
4. Run live functional and error-path validation.
