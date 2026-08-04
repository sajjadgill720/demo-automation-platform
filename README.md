# DataQuartz — Convoa Demo Generation Platform

> Automated, personalized demo generation for **Convoa**, an AI voice-receptionist
> product. A prospective business submits an intake form (optionally with an
> uploaded process document), answers a short AI-led clarification chat, and the
> system provisions a **personalized live Vapi voice agent** they can call in the
> browser — tailored to their company, industry, and stated needs. Built for
> **dataquartz's sales process**: it turns a cold lead into a working, on-brand
> voice demo with no manual prompt-writing per prospect.

This document reflects the codebase **as it actually exists** at the time of
writing. Where something is half-built, stubbed, or not wired in, it is marked as
such rather than described as finished. See [Known limitations](#known-limitations--open-items).

---

## Table of contents

- [Project overview](#project-overview)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Key architectural decisions](#key-architectural-decisions)
- [Database schema](#database-schema)
- [API reference](#api-reference)
- [Environment variables](#environment-variables)
- [Setup instructions](#setup-instructions)
- [Known limitations / open items](#known-limitations--open-items)
- [Testing](#testing)

---

## Project overview

Demoflow is the backend + frontend for generating **Convoa** voice-agent demos on
demand. Convoa is an AI front-desk receptionist; this platform is the machinery
that produces a *personalized* demo of it for each sales lead.

A lead fills in a short form (company, contact, industry, and a free-text problem
statement). They can optionally upload a process/SOP document and grant consent
for AI to process it. An AI "solutions advisor" then runs a brief clarification
chat (3–5 tailored questions) to fill in a structured profile of how the business
handles calls. From that profile, any uploaded document, and a vetted per-industry
scenario library, the system **deterministically compiles a Vapi system prompt**
and provisions a live Vapi assistant. The lead is handed to a demo-preview screen
where they can place a browser call to *their own* agent, then leave feedback. An
internal, password-gated portal lets the dataquartz team browse leads, provisioned
agents, recorded calls (with Vapi's native transcript/recording), and feedback.

---

## Architecture

### Overall shape: a modular monolith

This is a **modular monolith**, not a set of deployed microservices. There is one
FastAPI application (`backend/app/main.py`) and one TanStack Start frontend. The
backend is split into logically separate modules — clarification, qualifier,
document summarizer, scenario library, prompt compiler, Vapi client, storage — but
they run **in one process and call each other as ordinary Python functions**.
There are no inter-service network hops, no Docker Compose topology, no message
broker, and no per-module deployment unit.

**Why this shape:** it avoids premature operational complexity (no container
orchestration, no service mesh, no duplicated boilerplate or cross-service auth)
for a system at current team size and scale. The module boundaries are drawn where
they'd matter if the system ever *did* need to split — e.g. the LLM provider is
already behind `llm_client.py`, and the qualifier is already its own graph — so a
genuine future bottleneck can be extracted without a rewrite. That extraction is
deliberately deferred until a specific module actually becomes a bottleneck or
multiple people need independent deploy cycles.

### Primary data flow (the Lead pipeline)

This is the flow the product actually runs today. Steps that are **not fully
wired** are called out inline.

```
1. Lead submits intake form
   frontend /build-demo  →  POST /api/demo-request
   → runs qualification (qualify_lead_internal on company + industry)
   → creates a Lead (status = pending, or skipped if unqualified)
   → renders a SEED prompt (company + industry only, no profile yet)
   → an unqualified lead is skipped here: the frontend routes it to the
     "not qualified" screen instead of /upload
   → NOTE: does NOT enqueue provisioning here
                     │
                     ▼
2. Optional document upload + AI-processing consent
   frontend /upload
   → POST /api/clarification/{lead_id}/documents   (Supabase Storage + DB)
   → POST /api/clarification/{lead_id}/consent      (ai_processing_consent flag)
                     │
                     ▼
3. AI clarification chat  (LangGraph, interrupt/resume, Postgres-checkpointed)
   frontend /clarification
   → POST /api/clarification/{lead_id}/start
   → POST /api/clarification/{lead_id}/respond  (repeated, 3–5 questions)
   → POST /api/clarification/{lead_id}/skip-remaining  (optional early finish)
   Graph: parse_documents → extract_profile → detect_gaps
          → generate_question ⇄ await_answer (pauses across HTTP requests)
          → ask_final_question → finalize (writes CompanyProfile)
                     │  (on status == "completed")
                     ▼
4. Personalized Vapi agent provisioning  (FastAPI BackgroundTask)
   provision_vapi_assistant_task(lead_id):
     0. qualification gate      → trusts the intake-time qualification result;
                                  only re-runs qualify_lead_internal if a lead
                                  reached here without one. An unqualified lead →
                                  agent_status = skipped and the task returns
                                  before any Vapi work. Fails OPEN.
     a. summarizing_documents  → document_summarizer (map-reduce, if consented
                                  document passed the injection gate)
     b. building_profile       → compile_lead_prompt() assembles the Vapi prompt
                                  DETERMINISTICALLY from profile + brief + library
        (KB upload)            → sanitized doc text → Vapi Files
     c. provisioning           → Vapi assistant created (+ KB attached)
     → agent_status = active, assistant_id stored
                     │
                     ▼
5. Demo delivered to the client
   frontend /demo-preview
   → in-browser call via @vapi-ai/web using the lead's own assistant
   → on call end: POST /api/demo-request/{lead_id}/calls
                  → background fetch of Vapi's native call report
   → feedback: POST /api/demo-request/{lead_id}/feedback
   → POST /api/demo-request/{lead_id}/end-session (tears down the assistant)
```

**Qualification runs at intake.** The lead-qualification LangGraph (`qualifier.py`,
also exposed standalone at `POST /api/qualify`) runs inside `POST /api/demo-request`
on `company_name` + `industry`. It writes `qualified` /
`qualification_confidence` / `qualification_reasoning`, and an unqualified lead is
created as `AgentStatus.skipped` — the frontend then routes it to the "not
qualified" screen instead of clarification. Provisioning (Stage 0 of
`provision_vapi_assistant_task`) trusts this stored result and only re-runs the
qualifier if a lead somehow reaches it without one. It
[fails open](#known-limitations--open-items), so a qualification outage lets a
genuine lead through rather than blocking it.

**A second, legacy path exists** alongside the Lead pipeline: the
"discovery"/`VoiceAgent` endpoints (`/api/discovery`, `/api/agents/provision/...`)
using `compile_agent_prompt()`. It is functional but separate from, and not used
by, the main Lead flow described above.

---

## Tech stack

Only technologies actually present and used in the code are listed.

| Layer | Technology | Why (as reflected in the code) |
|---|---|---|
| Backend framework | **FastAPI** | Async HTTP, dependency injection for DB sessions, `BackgroundTasks` for provisioning and call-report fetching. |
| ORM / models | **SQLModel** (SQLAlchemy + Pydantic) | One class defines both the table and the (base) serialization shape. |
| Database | **PostgreSQL via Supabase** (managed) | Managed Postgres avoids self-hosting overhead (backups/patching/pooling). Same connection string used for dev and prod; a sqlite branch exists in `db.py` for local/test convenience. |
| Agent orchestration | **LangGraph** + **PostgresSaver** checkpointing | Used by the clarification module specifically because it needs multi-turn, pause/resume conversation whose state persists across separate HTTP requests. The qualifier also uses LangGraph but as a simple linear graph (no checkpointing). |
| LLM provider | **Groq** (`llama-3.3-70b-versatile`) | All LLM calls (question generation, response classification, profile extraction, document summarization, qualification). Abstracted behind `llm_client.py` so the provider can be swapped. |
| Voice agent platform | **Vapi** | Assistant creation/deletion, file (knowledge base) upload + attach, and native call-report retrieval. Frontend uses `@vapi-ai/web` for the in-browser call. |
| File storage | **Supabase Storage** | Uploaded SOP/process documents (REST API in `storage.py`). |
| PDF text extraction | **pypdf** | `extract_text_from_file()` in `main.py`. |
| Rate limiting | **SlowAPI** | On document upload (5/min) and clarification respond (20/min). |
| DB migrations | **Alembic** | Three revisions present — but see the [dual-schema caveat](#known-limitations--open-items). |
| Frontend framework | **TanStack Start** + **React 19** + **TanStack Router** | File-based routing (`src/routes`), server functions for auth and Slack notification. |
| Frontend build/runtime | **Vite 8**, **Bun** (lockfile present) | |
| UI | **Tailwind CSS v4**, **Radix UI**, **shadcn-style components**, **framer-motion**, **lucide-react**, **recharts** | |
| HTTP clients (backend → external) | Python stdlib **`urllib`** | Groq, Vapi, and Supabase are all called via `urllib` directly — no vendor SDKs on the backend. |

**Not present** (do not assume): no Redis, no Celery/task queue, no Docker, no
message broker, no vendor LLM SDK. Provisioning and call-report fetching use
FastAPI's in-process `BackgroundTasks`.

---

## Key architectural decisions

This is the most important section. Each decision below traces to specific code;
where reasoning is *documented in the code itself* it is noted, and where it is an
inference it is flagged in [Verification notes](#verification-notes).

### 1. Modular monolith over microservices
One FastAPI process, logically separated modules, no inter-service calls. Resolves
the tradeoff between clean separation and operational cost: you get module
boundaries (and the option to extract later) without paying for orchestration,
network hops, or duplicated boilerplate now. Revisit only when a module becomes a
real bottleneck or needs an independent deploy cycle.

### 2. Supabase-managed Postgres over self-hosted / Docker
`db.py` connects to a single `DATABASE_URL` (Supabase pooler in practice), with a
sqlite fallback branch for local runs. The tradeoff resolved: backups, patching,
and connection pooling are someone else's job, which is the right call for the
current team size. The same database serves dev and prod.

### 3. Deterministic prompt compilation — `compile_lead_prompt()` never calls an LLM
The final Vapi system prompt is assembled by `compile_lead_prompt()` in
`agents.py` using **pure conditional assembly + literal `{{variable}}`
substitution** against the vetted template in `templates/vapi_prompt_template.md`.
All *generation* (question generation, document summarization, profile extraction)
happens in **earlier** pipeline stages; only their already-generated, already-
sanitized output is dropped into the template.

The code states this as an explicit **"DETERMINISM CONTRACT"** (comment in
`agents.py`): *"no LLM call may ever be added to this path… the same inputs always
produce byte-identical output."* Why it matters: it guarantees that no
client-facing demo agent's behavior was authored unpredictably by an LLM at
runtime with no review step. The prompt a client's agent runs is always a
composition of reviewable, human-written template sections plus bounded,
sanitized variable values.

### 4. Vetted, human-written templates + variable injection — never freeform LLM system prompts
The Vapi prompt template (`vapi_prompt_template.md`) is human-written and section-
delimited; the scenario library (`scenario_library.py`) is human-curated
(trigger, action) pairs. Both files carry explicit editing rules stating that **an
LLM never writes any part of them**. Same principle as #3, applied to the content
itself: a lead's uploaded document or chat answers can *fill variables* but can
never *redefine agent behavior*.

### 5. Fail-open vs fail-safe — deliberately different per risk category
The codebase makes a conscious distinction:

- **Fail-open (proceed) where losing a legitimate lead is the worse outcome.**
  The qualifier (`qualifier.py`) defaults to `qualified: true, confidence: 1.0,
  reasoning: "qualification check failed, defaulting to proceed"` on missing
  `GROQ_API_KEY` or repeated LLM failure. The clarification response classifier
  (`ingest_answer_node`) also fails open — an unclassifiable answer is treated as
  a real answer so the conversation always advances. Documented reasoning: don't
  silently drop a real lead because of a transient technical failure.
- **Fail-safe (reject) where untrusted content would reach a third party.**
  `sanitize_document_text()` (`utils.py`) **rejects the document outright** when
  it detects ≥2 prompt-injection patterns, and the provisioning task then refuses
  to summarize or upload it. Documented reasoning (in `agents.py` /
  `document_summarizer.py`): untrusted content flowing into a third party (the
  Vapi agent / knowledge base) is a different risk category than an internal
  classifier having a bad day.

### 6. Consent gating for AI processing of uploaded documents — enforced server-side
`ai_processing_consent` is a column on `leads`, set via
`POST /api/clarification/{lead_id}/consent`. The gate is enforced **server-side in
the code paths that would touch document content**, not just as a frontend toggle:
- `parse_documents_node` (`clarification.py`) returns empty document text when
  `consent` is false.
- `provision_vapi_assistant_task` (`agents.py`) skips summarization/KB upload
  entirely when `ai_processing_consent` is false (logged as
  `"Document stage skipped: ai_processing_consent is False"`).
Enforced there because that is the choke point where document content would
otherwise be sent to Groq (summarization) or Vapi (knowledge base).

### 7. Scenario library — vetted, human-curated, with a real generic fallback
`scenario_library.py` contains eight curated industry entries (hvac, dental,
healthcare, legal, logistics, plumbing, roofing, real_estate) plus a
**complete** `GENERIC_ENTRY` for unmatched industries (the code comment
stresses it is *"deliberately NOT a stub"*). `lookup_industry()` resolves a
free-text industry string deterministically (exact key → specificity → longest
alias → generic). **LLM-assisted generation of new industry entries is NOT
implemented** — unmatched industries always fall back to `GENERIC_ENTRY`.

### 8. Scripted Vapi first message + explicit voice mapping
`_call_vapi_create_assistant` sets both `firstMessage` and
`firstMessageMode="assistant-speaks-first"`. Documented reasoning: without both,
Vapi lets the model improvise an opener from a large system prompt, which
sometimes produced calls that "connected to dead air." Voice is mapped explicitly
(`male → Elliot`, `female → Emma`, default Emma).

### 9. Native Vapi call report as source of truth
Rather than reconstructing a call client-side, `vapi_calls.py` polls Vapi's
`GET /call/{id}` after a call ends and stores Vapi's own recording URL,
transcript, summary, cost, and timing on `call_records`. Runs as an in-process
background task, so **no public webhook URL is required**.

### 10. Warm, pooled LangGraph checkpointer
`clarification.py` opens one `psycopg_pool.ConnectionPool` + `PostgresSaver` per
process and reuses it. Documented reasoning: opening a fresh connection and
re-running `checkpointer.setup()` per request cost ~1.5–3.4s against the remote DB.

---

## Database schema

Source of truth is `models.py` (`SQLModel.metadata.create_all`); Alembic covers a
subset (see caveat below). LangGraph additionally creates its own checkpoint
tables at runtime via `PostgresSaver.setup()`.

### `leads`  (`Lead`) — the central entity
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| company_name | str(255) | |
| contact_name | str(255) | |
| contact_email | str(255) | |
| contact_phone | str(50) | |
| industry | str(255) | |
| problem_statement | str? | Free-text problem from the intake form |
| voice_gender | str(16)? | `"male"`/`"female"`, default `female` |
| rendered_prompt | str | Seed prompt at creation, overwritten with the full prompt at provisioning |
| assistant_id | str(255)? | Vapi assistant id once provisioned |
| agent_status | enum `AgentStatus` | pending, summarizing_documents, building_profile, provisioning, active, completed, failed, skipped |
| failure_reason | str? | Set on provisioning failure |
| qualified | bool? | Set at Stage 0 of provisioning by `qualify_lead_internal` |
| qualification_confidence | float? | Set at Stage 0 of provisioning (0.0–1.0) |
| qualification_reasoning | str? | Set at Stage 0 of provisioning; shown on the pipeline "not qualified" screen |
| ai_processing_consent | bool | Default false |
| consent_recorded_at | datetime? | |
| created_at / updated_at | datetime | |

### `documents`  (`Document`)
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| lead_id | UUID | **FK → leads.id** |
| file_name | str? | |
| file_url | str | Supabase Storage public URL (or simulated in dev) |
| file_type | str(50) | |
| file_size_bytes | int | |
| extracted_text | str? | Text extracted at upload time |
| uploaded_at | datetime | |

### `company_profile`  (`CompanyProfileDB`)
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| lead_id | UUID | **FK → leads.id, UNIQUE** (one profile per lead) |
| profile | JSON/JSONB? | The extracted `CompanyProfile` (JSON) |
| status | enum `ProfileStatus` | not_started, in_progress, awaiting_user, completed |
| missing_fields | JSON/JSONB? | Fields still unknown |
| created_at / updated_at | datetime | |

### `clarification_messages`  (`ClarificationMessage`)
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| lead_id | UUID | **FK → leads.id** |
| role | enum `MessageRole` | assistant / user |
| content | str | |
| created_at | datetime | |

### `demo_feedback`  (`DemoFeedback`)
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| lead_id | UUID | **FK → leads.id**, indexed |
| rating | enum `FeedbackRating` | positive / negative |
| comment | str? | Length-capped, control-char stripped; **not** injection-sanitized (only ever rendered as escaped text) |
| created_at | datetime | |

### `call_records`  (`CallRecord`)
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| lead_id | UUID | **FK → leads.id**, indexed |
| vapi_call_id | str(255)? | Indexed; dedup key |
| assistant_id | str(255)? | |
| started_at / ended_at | datetime? | |
| duration_seconds | int | Default 0 |
| turn_count | int | Default 0 |
| transcript | str? | JSON string of `[{role, text}]` |
| summary | str? | Vapi's end-of-call summary |
| recording_url | str? | Vapi recording URL |
| ended_reason | str(255)? | |
| cost | float? | |
| status | str(32) | processing / completed / failed (native-report fetch state) |
| created_at | datetime | |

### Legacy / unused tables
- **`discoveryresponse`** (`DiscoveryResponse`) — id(int PK), company_name,
  contact_email, missed_calls_per_week, average_booking_value,
  calculated_monthly_leakage, calendar_system, booking_requirements,
  escalation_path, integration_destination, created_at. Used only by the legacy
  discovery endpoints.
- **`voiceagent`** (`VoiceAgent`) — id(str PK, Vapi assistant id), company_name,
  discovery_id(int), system_prompt, llm_model(`"gpt-4o"`),
  voice_provider(`"playht"`), created_at. Legacy discovery path. `discovery_id`
  is a plain int column, **not a declared FK**.
- **`company`** (`Company`) and **`demojob`** (`DemoJob`) — defined as tables but
  referenced by **no endpoint**. Effectively dead schema.

**Relationships:** `documents`, `company_profile`, `clarification_messages`,
`demo_feedback`, and `call_records` all FK to `leads.id`. `company_profile.lead_id`
is unique (1:1). The legacy `voiceagent.discovery_id` conceptually references
`discoveryresponse.id` but is not enforced as a foreign key.

---

## API reference

Base URL defaults to `http://localhost:8000`. All bodies are JSON unless noted.

### Health
- **GET `/`** → `{"status": "healthy", "service": "DataQuartz API"}`

### Demo requests (Lead lifecycle)
- **POST `/api/demo-request`** → `201 LeadResponse`
  Body: `{company_name, contact_name, contact_email (EmailStr), contact_phone,
  industry, problem_text?, voice_gender?}`. Creates a `Lead` (status `pending`)
  and renders a seed prompt. **Does not** start provisioning or qualification.
- **GET `/api/demo-request/{lead_id}`** → `LeadResponse` (404 if missing). Used to
  poll `agent_status` during background provisioning.
- **DELETE `/api/demo-request/{lead_id}/agent`** → `LeadResponse`. Internal team
  action: deletes the Vapi assistant, clears `assistant_id`, marks `completed`,
  keeps the lead. Remote delete failure is non-blocking (logged, local state still
  cleared).
- **POST `/api/demo-request/{lead_id}/end-session`** → `{message, agent_status}`.
  Client action: deletes the assistant, marks `completed`. Assistant-delete
  failure is caught and logged so it never crashes the request.

### Feedback
- **POST `/api/demo-request/{lead_id}/feedback`** → `201 FeedbackResponse`.
  Body: `{rating: "positive"|"negative", comment?}`. Comment is length-capped
  (2000) and control-char stripped, stored verbatim otherwise. 404 if lead missing.
- **GET `/api/demo-request/{lead_id}/feedback`** → `FeedbackResponse[]` (newest first).
- **GET `/api/feedback?limit=&rating=`** → `FeedbackWithLead[]` (joined with
  company/industry, newest first; limit clamped 1–500).

### Calls
- **POST `/api/demo-request/{lead_id}/calls`** → `201 CallRecordResponse`.
  Body: `{vapi_call_id (required), assistant_id?, started_at?, ended_at?}`. Stores
  a `processing` row and kicks a background task to fetch Vapi's native report.
  **Idempotent** by `vapi_call_id` (returns the existing row on retry). 400 if
  `vapi_call_id` blank; 404 if lead missing.
- **GET `/api/demo-request/{lead_id}/calls`** → `CallRecordResponse[]` (newest first).
- **GET `/api/calls?limit=`** → `CallRecordWithLead[]` (joined, newest first).

### Leads (internal views)
- **GET `/api/leads?limit=&status=`** → `LeadResponse[]` (newest first; optional
  `agent_status` filter; limit clamped 1–200).

### Qualification
- The qualifier graph runs as **Stage 0 of `provision_vapi_assistant_task`**, and
  its result is persisted to the lead (`qualified` / `qualification_confidence` /
  `qualification_reasoning`); an unqualified lead is set to `skipped` and skips
  provisioning.
- **POST `/api/qualify`** → `QualificationResult {qualified, confidence, reasoning}`.
  Body: `{company_name, industry}`. Runs the same qualifier graph on demand; this
  standalone endpoint does **not** persist its result (the pipeline path does).

### Clarification
- **POST `/api/clarification/{lead_id}/documents`** (multipart, `file=`) →
  `{message, document_id, file_url, extracted_text_preview}`. Rate-limited
  **5/min**. Rejects >10MB or non-pdf/txt. Extracts text, uploads to Supabase
  Storage bucket `clarifications`, stores a `Document`.
- **POST `/api/clarification/{lead_id}/consent`** → `{message, lead_id,
  ai_processing_consent, consent_recorded_at}`. Body: `{ai_processing_consent: bool}`.
- **POST `/api/clarification/{lead_id}/start`** → `ClarificationStatus`. Invokes
  the graph. If it returns `completed` (e.g. profile already complete), enqueues
  provisioning as a background task.
- **POST `/api/clarification/{lead_id}/respond`** → `ClarificationStatus`. Body:
  `{answer}`. Resumes the interrupted graph with the user's answer. Rate-limited
  **20/min**. Enqueues provisioning on `completed`.
- **POST `/api/clarification/{lead_id}/skip-remaining`** → `ClarificationStatus`.
  Finalizes the profile with whatever has been gathered and enqueues provisioning.
- **GET `/api/clarification/{lead_id}`** → `ClarificationStatus {lead_id, status,
  current_question?, recommendations?, conversation_history[], profile?,
  missing_fields[], is_final_question, final_question_answered}`.

All clarification endpoints 404 if the lead is missing and return 500 with the
error detail on unexpected graph errors.

### Legacy discovery / agents (separate path)
- **POST `/api/discovery`** → `DiscoveryResponse`. Computes
  `calculated_monthly_leakage = missed_calls_per_week × 4.34 × average_booking_value × 0.25`.
- **GET `/api/discovery`** → `DiscoveryResponse[]`.
- **POST `/api/agents/provision/{discovery_id}`** → `VoiceAgent`. Compiles a prompt
  via `compile_agent_prompt()` and provisions (or returns an existing) Vapi
  assistant for that discovery record. 404 if discovery not found.
- **GET `/api/agents`** → `VoiceAgent[]`.

#### Edge-case behavior worth knowing
- **Failed provisioning:** `provision_vapi_assistant_task` sets `agent_status =
  failed` and writes `failure_reason`; the frontend surfaces this via a
  `ProvisioningError`.
- **Declined consent:** document summarization and KB upload are skipped; the
  agent is still provisioned from profile + scenario library only.
- **Flagged document (prompt injection ≥2 hits):** the document is not summarized
  and not uploaded; provisioning continues without it (logged as a warning).
- **No/mock `VAPI_API_KEY`:** assistant creation returns a deterministic mock id
  (`vapi_ast_mock_…`); deletion and call-report fetch short-circuit for mocks.

---

## Environment variables

### Backend (read via `os.getenv` / `config.py`)
| Variable | Required? | Purpose |
|---|---|---|
| `DATABASE_URL` | **Required** | Postgres (Supabase) or sqlite URL. App raises on startup if unset. Password is auto URL-encoded. |
| `PORT` | Optional (default `8000`) | Server port. |
| `HOST` | Optional (default `0.0.0.0`) | Bind host. |
| `CORS_ORIGINS` | Optional (defaults to localhost:3000/5173/5174) | Comma-separated allowed origins. |
| `VAPI_API_KEY` | Optional | Vapi private key. If missing/`dummy…`/`mock…`, the app runs in mock mode (fake assistant/KB ids, no real calls). |
| `GROQ_API_KEY` | Situational | Required for real LLM work. Qualifier **fails open** without it; `llm_client` **raises** without it (so clarification/summarization need it). |
| `LLM_PROVIDER` | Optional (default `groq`) | `groq` works; `other_provider` is a stub that raises. |
| `SUPABASE_URL` | Optional (required for real uploads) | Supabase project URL. |
| `SUPABASE_SERVICE_KEY` | Optional (required for real uploads) | Supabase service-role key. Missing/dummy → simulated URL in dev, hard fail in prod. |
| `ENVIRONMENT` | Optional (default `development`) | `production` makes Supabase misconfiguration a hard failure. **Read in `storage.py` but missing from `.env.example`.** |

### Frontend
| Variable | Required? | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | Optional (default `http://localhost:8000`) | Backend base URL. |
| `VITE_VAPI_PUBLIC_KEY` | Required for live browser call | Vapi public key used by `@vapi-ai/web`. |
| `VITE_VAPI_ASSISTANT_ID` | Optional/legacy | Fallback assistant id (the flow uses the lead's own assistant). |
| `PORTAL_PASSWORD` | Optional (default `admin123`) | Password for the internal `/portal` gate. **Change for any real deployment.** |
| `SLACK_WEBHOOK_URL` | Optional | If set, `submitLead` posts a lead summary to Slack; otherwise it console-logs. |
| `NODE_ENV` | Optional | `production` sets the secure cookie flag. |

---

## Setup instructions

Written for someone who has never touched this project. Rough edges are flagged.

### Prerequisites
- Python 3.13 (the compiled artifacts are cpython-313)
- Node with **Bun** (a `bun.lock` is committed) — or npm/pnpm if you prefer
- A PostgreSQL database (Supabase or local). SQLite also works for the backend via
  `DATABASE_URL=sqlite:///./database.db`, but note the LangGraph clarification
  checkpointer is Postgres-specific and will not run on sqlite.

### 1. Clone
```bash
git clone <repo-url>
cd dq_demo
```

### 2. Backend
```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt
```
> **Rough edge:** `requirements.txt` pins `psycopg2-binary`, but the clarification
> module imports `psycopg_pool` and uses `langgraph-checkpoint-postgres`
> (psycopg3). These arrive transitively via `langgraph-checkpoint-postgres`; if you
> hit a `psycopg`/`psycopg_pool` import error, `pip install psycopg[binary] psycopg-pool`.

### 3. Configure `.env`
```bash
cp .env.example .env   # in backend/
```
Fill in at minimum `DATABASE_URL`. For real (non-mock) behavior also set
`GROQ_API_KEY`, `VAPI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`. Add
`ENVIRONMENT=development` explicitly (it is read by the code but absent from
`.env.example`).

### 4. Database schema
Two options — this is a known rough edge (they overlap):
- **Alembic (partial):** `alembic upgrade head`. Covers the initial tables,
  qualification columns, and clarification tables — **but not** `demo_feedback`,
  `call_records`, or the newer `leads` columns / enum values.
- **App bootstrap (fuller):** just start the app. `init_db()` runs
  `create_all()` **and** idempotent `ALTER`s that add the missing columns/enum
  values. In practice this is what makes a fresh DB fully usable today.

### 5. Run the backend
```bash
uvicorn app.main:app --reload --port 8000
```
(from `backend/`, venv active). Startup runs `init_db()`.

### 6. Frontend
```bash
cd ../frontend
bun install        # or: npm install
```
Create `frontend/.env` (a template is committed) with at least
`VITE_API_BASE_URL`, `VITE_VAPI_PUBLIC_KEY`, and `PORTAL_PASSWORD`.
```bash
bun run dev        # vite dev
```
Internal portal is at `/portal` (default password `admin123`). The public
demo wizard starts at `/build-demo`.

---

## Known limitations / open items

Honest list — this is the part that saves the next person the most time.

1. **Qualification uses company + industry only.** `qualify_lead_internal` runs at
   intake (`POST /api/demo-request`) and again defensively at provisioning if a
   lead arrives without a result, setting `AgentStatus.skipped` for unqualified
   leads. It judges on `company_name` + `industry` only — the clarification
   profile is captured later and is not fed back into qualification, so a lead
   that looks fine at intake is never re-evaluated against what it revealed in the
   chat.
2. **Second LLM provider is a stub.** `llm_client.py`'s `"other_provider"` branch
   raises `NotImplementedError`. Only Groq is implemented.
3. **No orphaned-assistant cleanup.** `end_demo_session` carries an explicit TODO:
   there is no scheduled job to delete Vapi assistants for demos that were never
   explicitly ended. Long-lived leftover assistants are possible.
4. **Scenario library has no LLM-assisted generation for new industries.** Only
   the eight curated entries + `GENERIC_ENTRY` fallback exist. Any industry that
   doesn't match an alias gets the generic playbook. (This is by design today, but
   it means new verticals need a human PR, not an automated path.)
5. **Dual schema management (Alembic vs `init_db`).** Alembic migrations and the
   hand-written `ALTER`s in `db.py` overlap and partially diverge; several
   tables/columns (`demo_feedback`, `call_records`, newer `leads` columns, newer
   `agentstatus` enum values) exist only via `create_all` + `init_db`, with no
   migration. Treat `models.py` + `init_db` as the real source of truth today.
6. **`requirements.txt` under-pins the Postgres driver stack** — see the setup
   rough edge above.
7. **Legacy discovery path coexists with the Lead flow.** `Company`, `DemoJob`,
   `DiscoveryResponse`, `VoiceAgent` + `/api/discovery` and `/api/agents/*` are a
   parallel, older mechanism. `Company` and `DemoJob` have no endpoints at all
   (dead schema). This is a candidate for removal once confirmed unused.
8. **Orphaned bytecode:** a `call_analysis` `.pyc` exists with no corresponding
   source file.
9. **Committed local artifacts:** `backend/database.db` and
   `backend/empty_temp.db` are checked in.
10. **`ENVIRONMENT` is undocumented** in `backend/.env.example` despite affecting
    production storage behavior.

---

## Testing

Tests live in `backend/tests/`. There is no configured test runner in
`requirements.txt` (no pytest pin), and several files read the running server's
`PORT`, so some are **integration-style** and expect a live backend + real/valid
keys rather than pure unit tests. Review each before running.

| File | Covers |
|---|---|
| `test_qualifier.py` | Lead qualification behavior (reads `PORT`; integration-style). |
| `test_clarification.py` | Clarification flow (reads `PORT`; integration-style). |
| `test_clarification_dedup_and_meta.py` | Question de-duplication and meta-response (question-back) handling in the clarification graph. |
| `test_reasoning_clarification.py` | Reasoning/behavior of the clarification question generation. |
| `test_modular_prompt.py` | The deterministic modular prompt composition (`compile_lead_prompt` + template sections). |
| `test_vapi_knowledge_base.py` | Vapi knowledge-base upload/attach helpers. |
| `debug_end_to_end.py` | An end-to-end debugging script, not a formal test. |

To run (after `pip install pytest`):
```bash
cd backend
pytest tests/ -v
```
For the integration-style files, start the backend first (`uvicorn app.main:app`)
and ensure the relevant keys are set, or expect network/auth failures.

---

## Verification notes

Per the request, every claim in [Key architectural decisions](#key-architectural-decisions)
that rests on **inference** rather than a direct code statement is flagged here:

- **Decisions #3, #4, #5, #6, #8, #9, #10** are backed by **explicit comments/
  docstrings in the code** (the determinism contract, the template/library editing
  rules, the fail-open/fail-safe reasoning, the consent-skip logs, the
  first-message rationale, the "native report is source of truth" docstring, the
  checkpointer timing note). These are confirmed, not inferred.
- **Decision #1 (modular monolith)** is an **inference** from the structure (one
  FastAPI app, in-process module calls, no Docker/broker). The *reasoning* is not
  written in the code; it is the standard justification for this shape. Correct me
  if the intent was different.
- **Decision #2 (Supabase over self-hosted)** is a **partial inference**: the code
  confirms a single managed `DATABASE_URL` with a sqlite fallback, but the
  "avoids backups/patching overhead" rationale is inferred, not documented.
- **Decision #7 (scenario library design)** — the "vetted/human-curated, generic
  fallback is complete not a stub" is documented in the file; the statement that
  **LLM-assisted generation is not implemented** is confirmed by its **absence**
  in the code (verified by search), which is an argument from absence rather than
  a positive statement.

If any inferred rationale misstates the original intent, flag it and I'll correct
the wording.
