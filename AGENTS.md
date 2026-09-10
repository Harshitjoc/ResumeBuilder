# AGENTS.md

## Status

"Next-level" iteration built and green. Frontend and backend compile; all flows wrapped end-to-end: resume builder, import + analysis, job analysis, verification queue, History & Reports, PDF export, **persona-aware AI (recent-grad / working-professional / career-switcher)**, **triple-layer ATS check**, **cover letters + interview prep**, **application tracker (Kanban + funnel stats)**, **shareable resume links with score badge**, and **Evidence Vault (user-confirmed claims)**. Backend gains `extract.py` (deterministic contact/evidence extraction + confidence) and 3 new LLM endpoints with lenient output coercion. Extension now auto-fills LinkedIn, Indeed, **Workday, Greenhouse, and Lever** with tagged multi-resume storage. Frontend build + 21 backend tests pass. Supabase schema (incl. `evidence` + `shares` + persona column) written but not deployed.

## What This Is

AI-powered resume builder. Users bring their own LLM API keys. Key features: resume creation, job-tailored customization with verification queue, ATS checking, cover letters/interview prep, application tracking, Chrome extension for auto-fill on 5 job boards. Product adapts to the user's chosen target persona while keeping authenticity-first guardrails intact.

## Tech Stack (Current)

- **Frontend:** React + Vite 8, Tailwind CSS v4 (via `@tailwindcss/vite`, no config file), Zustand (persist), react-router-dom, react-hook-form, lucide-react, react-to-print
- **Backend:** Python FastAPI, uvicorn, pydantic v2, python-dotenv, SimplerLLM wrapper
- **DB:** Supabase (PostgreSQL free tier) — schema in `database/schema.sql` (`resumes`, `job_postings`, `resume_versions`, `verification_queue`, `applications`, `analysis_reports`, `evidence`, `shares`, `profiles.target_user`) with RLS
- **LLM:** SimplerLLM (multi-provider: OpenAI, Anthropic, Gemini, Ollama)
- **Browser automation:** Browser-Use for form auto-fill (deferred, Phase 5)
- **Extension:** Chrome extension via Plasmo (auto-fill: LinkedIn, Indeed, Workday, Greenhouse, Lever; tagged resume picker; track-application quick action)
- **Deploy:** Vercel (frontend, `vercel.json`), Railway (backend, `railway.json`), Supabase (DB)

## SimplerLLM Gotchas (verified)

- PyPI package is **`simplerllm==0.3.7`** — NOT `simpler-llm` (that name doesn't exist). Import module is `SimplerLLM` (capitalized).
- Dependency tree is heavy (moviepy, cohere, newspaper3k, scipy, etc.).
- API: `from SimplerLLM.language import LLM, LLMProvider`. Factory: `LLM.create(provider=LLMProvider.X, model_name=..., api_key=...)`. Provider enum: OPENAI/GEMINI/ANTHROPIC/OLLAMA.
- Generation: `llm.generate_response(prompt=..., system_prompt=..., max_tokens=..., json_mode=False)`. Returns text (str) or dict. Base `LLM` is abstract — always go through `LLM.create()`.
- Frontend sends `apiKey` `provider` strings: `openai`, `anthropic`, `google` (maps to GEMINI), `ollama`. Ollama uses the `apiKey` field as base URL and no key.

## Persona-Aware LLM Requests

Every `/api/llm/*` endpoint accepts an optional `targetUser` (`recent-grad` | `working-professional` | `career-switcher`; invalid/missing → defaults to `working-professional`). It is threaded into every prompt builder in `backend/app/services/prompts.py` via `target_user=`; persona guidance is ADDITIVE and must never weaken the authenticity RULES blocks. `career-switcher` deliberately gets the strongest verification caveat (highest fabrication-risk group per research). Frontend sends `targetUser ?? undefined` from the store's `targetUser` (set via `PersonaPicker` in the header/Home).

## Project Structure

```
resume-builder/
├── frontend/          # React + Vite + Tailwind + Zustand (browser-local MVP + Supabase sync)
├── backend/           # FastAPI + SimplerLLM
│   ├── app/
│   │   ├── main.py          # app factory, CORS, router registration
│   │   ├── config.py        # env-driven settings
│   │   ├── routers/llm.py   # 9 POST endpoints (contract below), lenient output coercion
│   │   └── services/        # llm.py (SimplerLLM wrapper), prompts.py (authenticity rules, persona-aware), extract.py (deterministic contact/evidence extraction)
│   └── tests/              # test_llm_routes.py + test_new_routes.py (in-process smoke tests, real Ollama or error-only)
├── extension/         # Chrome extension (Plasmo) — auto-fill MVP for LinkedIn/Indeed
├── database/          # schema.sql (Supabase, RLS policies)
```

Supabase persistence: `frontend/src/services/supabase.ts` (typed client + helpers) and `frontend/src/components/AuthWidget.tsx` (sign in/up/out in Layout header). When `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are absent every helper no-ops and the app is browser-local only. Backend `SUPABASE_URL`/`SUPABASE_SERVICE_KEY`/`CORS_ORIGINS` in `backend/.env`. Deploy: `frontend/vercel.json` (SPA rewrite), `backend/railway.json` (Nixpacks + `uvicorn ... --port $PORT`).

Backend routes: `/api/health`, `POST /api/llm/generate-summary {resume, apiKeys}`, `/api/llm/parse-job {jobText, apiKeys}`, `/api/llm/analyze-compatibility {resume, job, apiKeys}`, `/api/llm/customize-resume {resume, job, compatibility, apiKeys}`, `/api/llm/parse-resume {resumeText, apiKeys}` (→ `{parsed, evidence[], contactConfidence{}}`), `/api/llm/analyze-resume {resume, apiKeys}`, `/api/llm/ats-check {resume, job?, apiKeys}` (→ `{check: {overall_score, keyword_notes, structure_notes, formatting_notes, missing_headers, parseability_notes, contact_present, action_items}}`), `/api/llm/generate-cover-letter {resume, job, apiKeys}` (→ `{letter}`), `/api/llm/generate-interview-prep {resume, job, apiKeys}` (→ `{prep: {likely_questions, company_research, talking_points, questions_to_ask}}`). All accept optional `targetUser`. `apiKeys` = `{provider, apiKey?, model?}`. `customize-resume` changes each carry `confidence` + `is_authentic` (coerced server-side).

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