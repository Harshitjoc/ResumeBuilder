# Resume Builder

AI-powered resume builder with job-tailored customization and a verification queue. Users bring their own LLM API keys (OpenAI, Anthropic, Gemini, or local Ollama).

**Authenticity over optimization:** the AI never invents experiences, skills, dates, or metrics. Every customization goes through a user-approval verification queue.

## Structure

```
frontend/    React + Vite + Tailwind CSS + Zustand
backend/     FastAPI + SimplerLLM (multi-provider LLM)
extension/   Chrome extension (Plasmo) - job-board auto-fill MVP
database/    Supabase PostgreSQL schema (optional for MVP)
```

## Prerequisites

- Node.js 20+
- Python 3.10+
- An LLM API key (OpenAI / Anthropic / Gemini) or [Ollama](https://ollama.ai) running locally

## Quick start

### Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api/*` to `http://localhost:8000`.

## Using the app

1. **Resume Builder** — fill in contact, summary, skills, experience, education, projects, certifications; pick Classic or Modern template; live preview updates as you type.
2. **Import** — paste resume text or upload a PDF/DOCX/TXT; the AI parses it into editable, verified fields, then scores your resume (ATS/impact/structure).
3. **Job Analysis** — add your LLM key, paste a job description, and the backend parses it and scores compatibility against your resume.
4. **Customize** — the AI proposes job-specific changes.
5. **Verification Queue** — approve, reject, or edit each change before it touches your resume. Each change shows a confidence badge, and approved/edited changes can be promoted to your **Evidence Vault**.
6. **History & Reports** — every resume analysis, job-fit report, verification review, and resume snapshot is listed here (browser-local by default; synced to Supabase when signed in). Click any item to reopen the full report, or "Load into resume builder" to restore that resume version.
7. **Target persona** — choose *recent grad*, *working professional*, or *career switcher* anywhere from the header. The AI adapts every prompt to your stage (career-switchers get the strongest verification guardrails).
8. **ATS check** — run a triple-layer ATS audit (keywords, structure/headers, formatting/parseability, contact integrity) on your resume with or without a job posted, and get an actionable 0–100 score.
9. **Cover letter + interview prep** — generate an authentic cover letter and interview talking points from the same resume + job analysis (copy or download the letter).
10. **Application tracker** — track saves → applied → interview → offer → rejected as a Kanban board with funnel stats (total, interview %, offer %).
11. **Shareable resume link** — one click makes a public shareable link with an ATS score badge.
12. **Preview / Print / PDF** — render the final resume and print to PDF.

## API keys & privacy

API keys are stored in browser localStorage and sent only to the LLM provider (via the backend proxy). They are never persisted, logged, or stored by the backend.

## Database & Supabase setup

The app runs browser-local by default (Zustand persist + localStorage), so History & Reports works with no account. To enable cloud persistence and cross-device history sync:

1. Create a free project at [supabase.com](https://supabase.com) (save the DB password).
2. In the project dashboard open **SQL Editor**, paste the entire `database/schema.sql`, and **Run**. This creates `profiles`, `resumes`, `job_postings`, `resume_versions`, `verification_queue`, `applications`, and `analysis_reports`, all protected by Row-Level Security.
3. **Auth → Providers** — confirm Email auth is enabled (it is by default). Optionally disable "Confirm email" for faster testing.
4. **Project Settings → API** — copy the Project URL and the anon public key.
5. Add to `frontend/.env.local`:
   ```
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   ```
6. Restart `npm run dev`. A sign-in widget appears in the header. When signed in:
   - the builder auto-saves your resume,
   - job postings and verification actions are recorded,
   - every analysis/verification report is mirrored to `analysis_reports` and visible on the History page from any device.

RLS means writes/reads require a signed-in user; without the env vars (or while signed out) every helper no-ops and the app is fully browser-local. The schema also includes a `target_user` persona column on `profiles`, an `evidence` claims vault, and a `shares` table (public read by slug for share links + score badges).

## Chrome extension

`extension/` is a Plasmo project (Chrome MV3) that auto-fills job-application forms on **LinkedIn, Indeed, Workday, Greenhouse, and Lever** from an imported resume. The popup stores multiple tagged resumes (choose which is "active"), and a "Track this application in the app" button opens the Application Tracker prefilled.

```bash
cd extension
npm install
npm run build          # outputs build/chrome-mv3-prod/
```

Load the unpacked extension at `chrome://extensions` (Developer mode → Load unpacked → `extension/build/chrome-mv3-prod`). Open the popup and paste a resume JSON (exported from the builder's store); then click "Fill current job form" on a job page. It fills email, phone, first/last name, LinkedIn URL, and education best-effort, and highlights what it filled.

## Deployment

- **Frontend → Vercel:** configure the repo's `frontend/` directory as the root project (build `npm run build`, output `dist`, SPA rewrite already in `frontend/vercel.json`). Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as env vars.
- **Backend → Railway:** `backend/railway.json` is already configured — start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Set `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` (optional) and `CORS_ORIGINS` to your deployed frontend URL.

## Testing

The backend ships an in-process smoke test (no server process needed). With Ollama running it exercises the real LLM flow; otherwise it runs the error paths:

```bash
cd backend
.venv\Scripts\python tests\test_llm_routes.py     # Windows  (LLM smoke + error paths)
.venv\Scripts\python tests\test_new_routes.py     # Windows  (ATS/cover-letter/prep + extract helpers)
python tests/test_llm_routes.py                    # macOS/Linux
```

## Reference docs

The repo root contains the original planning documents:
- `Resume_Builder_Platform_Spec.md` — full product spec, data models, AI prompts, verification rules
- `Resume_Builder_FREE_STACK.md` — free tech stack, SimplerLLM/Browser-Use integration, deployment
- `QUICK_START_IMPLEMENTATION.md` — copy-paste code
- `FINAL_SUMMARY_ROADMAP.md` — 6-phase roadmap
- `VISUAL_QUICK_REFERENCE.md` — quick lookup

## Notes / gotchas

- The PyPI package is **`simplerllm`** (import `SimplerLLM`) — the docs reference `simpler-llm`, which does not exist. Its dependency tree is heavy.
- `SimplerLLM.language.llm.LLM.create()` is the factory; use `provider=LLMProvider.{OPENAI|ANTHROPIC|GEMINI|OLLAMA}`.