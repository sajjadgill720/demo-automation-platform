# Convoa Demo Automation Pipeline - Workspace

This repository contains the backend and frontend components for the Convoa Demo Automation Platform.

For detailed system designs, data schemas, security filtering, and logging standards, see [architecture.md](file:///c:/Users/Sajjad%20Ur%20Rehman/Downloads/dq_demo/architecture.md).

---

## Workspace Structure
* **`backend/`**: FastAPI python subservice for managing SQLModel schemas, Alembic migrations, prompt compile templates, and Vapi voice assistant creations/deletions.
* **`frontend/`**: React web application tracking pipeline dashboard metrics and active voice agent statuses.

---

## Backend Subservice Setup

### 1. Environment Setup
Create a `.env` file under the `backend/` directory (you can use `.env.example` as a reference):
```env
PORT=8000
HOST=0.0.0.0

# Supabase Postgres connection string (required for migrations and database operations)
DATABASE_URL=postgresql://postgres.xxxxxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require

# Vapi API private key (leave blank or use dummy/mock value for mock simulations)
VAPI_API_KEY=your_vapi_private_key
```

### 2. Install Backend Dependencies
Ensure you are inside the `backend` directory, activate your virtual environment, and run:
```bash
cd backend
pip install -r requirements.txt
```

### 3. Apply Database Migrations (Supabase)
Database schemas must be created or updated using Alembic migrations against your Supabase connection.

Inside the `backend/` directory:
```bash
# 1. Generate the initial schema migration
alembic revision --autogenerate -m "initial_schema"

# 2. Review the generated version script in backend/migrations/versions/

# 3. Apply the schema directly to your Supabase PostgreSQL instance
alembic upgrade head
```

### 4. Running the Backend Server
Start the Uvicorn FastAPI server:
```bash
uvicorn app.main:app --reload
```
You can access the interactive Swagger documentation and test schemas at `http://localhost:8000/docs`.

---

## Testing & Verifying Endpoints

### 1. Register a Lead (Triggers Provisioning)
This registers the lead parameters, validates inputs, sanitizes prompt injections, enqueues background provisioning, and returns the lead ID immediately.
```bash
curl -X POST http://localhost:8000/api/demo-request \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Acme Widgets",
    "contact_name": "Jane Doe",
    "contact_email": "jane@acme.com",
    "contact_phone": "+15550199",
    "industry": "Manufacturing"
  }'
```
**Expected Response**:
```json
{
  "id": "generated-uuid-string",
  "company_name": "Acme Widgets",
  "contact_name": "Jane Doe",
  "contact_email": "jane@acme.com",
  "contact_phone": "+15550199",
  "industry": "Manufacturing",
  "agent_status": "pending",
  "assistant_id": null,
  "failure_reason": null,
  "created_at": "2026-07-14T11:27:46Z",
  "updated_at": "2026-07-14T11:27:46Z"
}
```

### 2. Poll Lead Status
Retrieves current database record to track state transitions.
```bash
curl -X GET http://localhost:8000/api/demo-request/{lead_id}
```
**Expected Response (when active)**:
```json
{
  "id": "{lead_id}",
  "company_name": "Acme Widgets",
  "contact_name": "Jane Doe",
  "contact_email": "jane@acme.com",
  "contact_phone": "+15550199",
  "industry": "Manufacturing",
  "agent_status": "active",
  "assistant_id": "vapi_assistant_id_here",
  "failure_reason": null,
  "created_at": "2026-07-14T11:27:46Z",
  "updated_at": "2026-07-14T11:27:48Z"
}
```

### 3. End Session (Triggers Deletion)
Calls the delete endpoint on Vapi's API for the assistant, and updates DB status.
```bash
curl -X POST http://localhost:8000/api/demo-request/{lead_id}/end-session
```
**Expected Response**:
```json
{
  "message": "Demo session ended successfully",
  "agent_status": "completed"
}
```
---

## Frontend Web Setup (Optional Reference)
To run the front-office dashboard console:
```bash
cd frontend
npm install  # or bun install
npm run dev  # or bun run dev
```
The frontend UI will run at `http://localhost:5173`.
