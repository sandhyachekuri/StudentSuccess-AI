# StudentSuccess AI — Python FastAPI Backend Setup & Run Guide

This repository contains both the **React + TypeScript + Recharts** frontend and a modular **Python + FastAPI + Pydantic + Pandas + NumPy** backend located in the `/backend` directory.

---

## 1. Backend Module Architecture

| File | Responsibility |
| :--- | :--- |
| `backend/main.py` | FastAPI application factory, environment-aware CORS configuration (`ALLOWED_ORIGINS`, blocking `*` in production), and Uvicorn entry point. |
| `backend/models.py` | Pydantic v2 schemas for student input records, component scores, independent Academic and Placement risk assessments, segmentation, and CSV validation responses. Enforces 0–100 bounds on attendance/scores and 0–10 bounds on CGPA. |
| `backend/scoring.py` | Pandas & NumPy Student Success Score calculation engine using the exact weights: **Academic Performance (30%)**, **Attendance (20%)**, **Placement Readiness (25%)**, **LMS Activity (10%)**, and **Skills & Engagement (15%)**. |
| `backend/risk_rules.py` | Independent Academic Risk and Placement Risk rule evaluators, data-derived cohort segmentation, and rule-based intervention recommendations. |
| `backend/gemini_service.py` | Secure server-side Gemini AI integration using `python-dotenv`, `os.getenv("GEMINI_API_KEY")`, and the official `google-genai` Python SDK (`from google import genai`). Scrubs any key pattern from error logs. |
| `backend/sample_data.py` | Deterministic 56-student synthetic cohort matching the frontend dataset. |
| `backend/routes.py` | FastAPI `APIRouter` implementing `/health`, `/api/ai/status`, `/api/ai/recommendations`, `/api/students`, `/api/students/{student_id}`, `/api/analyze`, and `/api/upload-csv`. |
| `requirements.txt` | Pinned Python dependencies (`fastapi`, `uvicorn[standard]`, `pydantic`, `pandas`, `numpy`, `python-multipart`, `python-dotenv`, `google-genai`). |

---

## 2. Local Setup & Run Instructions

### Step 1: Create and Activate a Python Virtual Environment

```bash
python3 -m venv .venv
source .venv/bin/activate   # On Windows: .venv\Scripts\activate
```

### Step 2: Install Python Dependencies

```bash
pip install -r requirements.txt
```

### Step 3: Configure Environment Variables

Copy `.env.example` to `.env` (no secrets or external credentials are required to start):

```bash
cp .env.example .env
```

Key variables in `.env`:
- `GEMINI_API_KEY="MY_GEMINI_API_KEY"` (Backend-only: replace locally with your Gemini API key inside `.env`, which is ignored by Git)
- `VITE_API_BASE_URL="http://localhost:8000"`
- `APP_ENV="development"`
- `FASTAPI_HOST="0.0.0.0"`
- `FASTAPI_PORT="8000"`
- `ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173"`

### Step 4: Start the FastAPI Server

From the project root directory, run:

```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Once running:
- Interactive OpenAPI / Swagger UI: `http://localhost:8000/docs`
- Health Check Endpoint: `http://localhost:8000/health`
- Gemini AI Status Endpoint: `http://localhost:8000/api/ai/status`
- Student AI Recommendations Endpoint: `POST http://localhost:8000/api/ai/recommendations`

### Step 5: Connect the React Frontend

In a second terminal, start the React frontend on port 3000:

```bash
npm install
npm run dev
```

In the StudentSuccess AI sidebar or Methodology page, click **"Check FastAPI Health"** or **"GET /api/ai/status"** to verify live backend and Gemini AI status. When the FastAPI server is not running, the frontend automatically and honestly reports the backend as offline and uses the built-in local synthetic dataset.

---

## 3. Production Deployment & Secret Management (`GEMINI_API_KEY`)

1. **Never commit `.env` to Git**: `.gitignore` excludes `.env`, `.env.local`, and `.env.*` (while keeping `.env.example` with safe placeholders).
2. **Backend Hosting Platform Secrets**:
   - In your deployment platform (e.g., byteXL Nimbus, Google Cloud Run, Render, or Railway), open the service's **Environment Variables / Secrets** settings.
   - Add `GEMINI_API_KEY` as a secret environment variable on the **Python FastAPI backend service only**.
   - Set `APP_ENV="production"` and `ALLOWED_ORIGINS="https://your-production-frontend-domain.com"`.
3. **Frontend Hosting Configuration**:
   - Only configure `VITE_API_BASE_URL="https://your-deployed-fastapi-service.com"` on the frontend build. Never set `GEMINI_API_KEY` with a `VITE_` prefix.
