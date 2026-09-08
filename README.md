# Resume Builder

AI-powered resume builder with job-tailored customization and a verification queue. Users bring their own LLM API keys (OpenAI, Anthropic, Gemini, or local Ollama).

**Authenticity over optimization:** the AI never invents experiences, skills, dates, or metrics. Every customization goes through a user-approval verification queue.

## Structure

```
frontend/    React + Vite + Tailwind CSS + Zustand
backend/     FastAPI + SimplerLLM (multi-provider LLM)
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
2. **Job Analysis** — add your LLM key, paste a job description, and the backend parses it and scores compatibility against your resume.
3. **Customize** — the AI proposes job-specific changes.
4. **Verification Queue** — approve, reject, or edit each change before it touches your resume.
5. **Preview / Print / PDF** — render the final resume and print to PDF.

## API keys & privacy

API keys are stored in browser localStorage and sent only to the LLM provider (via the backend proxy). They are never persisted, logged, or stored by the backend.

## Database (optional)

For MVP the resume lives in the browser. To enable persistence, create a Supabase project, run `database/schema.sql` in the SQL editor, and set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in `frontend/.env.local` and `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` in `backend/.env`.

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