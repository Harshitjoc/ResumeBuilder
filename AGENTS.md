# AGENTS.md

## Status

MVP scaffolded and building. Frontend (React/Vite/Tailwind/Zustand) and backend (FastAPI/SimplerLLM) both compile; resume builder, job analysis, customization, verification queue, and PDF export flows are wired end-to-end. Supabase schema written but not deployed.

## What This Is

AI-powered resume builder. Users bring their own LLM API keys. Key features: resume creation, job-tailored customization with verification queue, Chrome extension for auto-fill on job boards.

## Tech Stack (Current)

- **Frontend:** React + Vite 8, Tailwind CSS v4 (via `@tailwindcss/vite`, no config file), Zustand (persist), react-router-dom, react-hook-form, lucide-react, react-to-print
- **Backend:** Python FastAPI, uvicorn, pydantic v2, python-dotenv, SimplerLLM wrapper
- **DB:** Supabase (PostgreSQL free tier) — schema in `database/schema.sql`; persistence not yet wired
- **LLM:** SimplerLLM (multi-provider: OpenAI, Anthropic, Gemini, Ollama)
- **Browser automation:** Browser-Use for form auto-fill (deferred, Phase 5)
- **Extension:** Chrome extension via Plasmo (deferred, Phase 5)
- **Deploy:** Vercel (frontend), Railway (backend), Supabase (DB)

## SimplerLLM Gotchas (verified)

- PyPI package is **`simplerllm==0.3.7`** — NOT `simpler-llm` (that name doesn't exist). Import module is `SimplerLLM` (capitalized).
- Dependency tree is heavy (moviepy, cohere, newspaper3k, scipy, etc.).
- API: `from SimplerLLM.language import LLM, LLMProvider`. Factory: `LLM.create(provider=LLMProvider.X, model_name=..., api_key=...)`. Provider enum: OPENAI/GEMINI/ANTHROPIC/OLLAMA.
- Generation: `llm.generate_response(prompt=..., system_prompt=..., max_tokens=..., json_mode=False)`. Returns text (str) or dict. Base `LLM` is abstract — always go through `LLM.create()`.
- Frontend sends `apiKey` `provider` strings: `openai`, `anthropic`, `google` (maps to GEMINI), `ollama`. Ollama uses the `apiKey` field as base URL and no key.

## Project Structure

```
resume-builder/
├── frontend/          # React + Vite + Tailwind + Zustand (browser-local MVP)
├── backend/           # FastAPI + SimplerLLM
│   └── app/
│       ├── main.py          # app factory, CORS, router registration
│       ├── config.py        # env-driven settings
│       ├── routers/llm.py   # 4 POST endpoints (contract below)
│       └── services/        # llm.py (SimplerLLM wrapper), prompts.py (authenticity rules)
├── extension/         # Chrome extension (Plasmo) — future
├── database/          # schema.sql (Supabase, RLS policies)
```

Backend routes: `/api/health`, `POST /api/llm/generate-summary {resume, apiKeys}`, `/api/llm/parse-job {jobText, apiKeys}`, `/api/llm/analyze-compatibility {resume, job, apiKeys}`, `/api/llm/customize-resume {resume, job, compatibility, apiKeys}`. `apiKeys` = `{provider, apiKey?, model?}`.

## Critical Design Constraint

**Authenticity over optimization.** The AI must NEVER invent experiences, skills, dates, or metrics. All customizations go through a verification queue. This is non-negotiable per the spec (see `Resume_Builder_Platform_Spec.md` Part 3). The rules are encoded in `backend/app/services/prompts.py` — do not weaken them.

## Reference Docs

| File | Purpose |
|------|---------|
| `Resume_Builder_Platform_Spec.md` | Full product spec, data models, AI prompts, verification rules |
| `Resume_Builder_FREE_STACK.md` | Free tech stack, SimplerLLM/Browser-Use integration, deployment |
| `QUICK_START_IMPLEMENTATION.md` | Copy-paste code: prompts, LLM service, extension, API key manager |
| `FINAL_SUMMARY_ROADMAP.md` | 6-phase implementation roadmap (11 weeks) |
| `VISUAL_QUICK_REFERENCE.md` | Quick lookup for structure, commands, services |

## Commands

```bash
# Backend (from backend/)
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000   # Windows
source .venv/bin/activate && uvicorn app.main:app --reload --port 8000  # macOS/Linux

# Frontend (from frontend/)
npm run dev     # dev server on 5173, proxies /api -> :8000
npm run build   # type-check (tsc -b) + bundle
```

## When Building

1. Start with Phase 1 from the roadmap (infra setup: Supabase, Railway, Vercel)
2. Use `QUICK_START_IMPLEMENTATION.md` code as starting points — it's production-ready
3. Run database schema from `database/schema.sql` (per `Resume_Builder_FREE_STACK.md` Part 5.3)
4. LLM integration uses SimplerLLM — never call provider APIs directly
5. API keys live in browser localStorage, never persisted/server-side
6. Use `LLM.create()` for all provider construction; parse real provider strings from frontend (`google` → GEMINI)
7. Keep prompts encoding the authenticity constraint intact
8. After changes: `npm run build` in frontend, import-check in backend