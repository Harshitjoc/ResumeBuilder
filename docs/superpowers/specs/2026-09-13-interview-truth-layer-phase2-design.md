# Phase 2 — Interview Truth Layer + Recruiter Share View + ATS Shadow-Parse

**Status:** Proposed · **Date:** 2026-09-13 · **Spec:** one per phase, sequenced after Phase 1 (Application DNA).

## North Star

The tool must never present a claim louder than the proof behind it — and it
should tell you exactly *which* proof the other side will weigh. Phase 2
finishes the three loops Phase 1 opened:

1. **Interview Truth Layer** — interview prep stops being generic. Every
   talking point is *claim-linked*: `proof-backed` when the Evidence Vault or
   verification queue covers it, `in-resume` otherwise, and `needs-research`
   when the resume only gestures at a topic. No invented competence.
2. **Recruiter Share View** — the hosted share link gains a "view as recruiter"
   mode: the same resume without the score chrome, plus a *deterministic*
   checklist of what a recruiter's ATS would trip on. Candidate can hand out a
   `?view=recruiter` link on purpose.
3. **ATS Shadow-Parse** — a Free, offline, no-quota, deterministic ATS read of
   the structured resume, returning the exact same `check` shape as the LLM
   triple-layer endpoint. Instant feedback everywhere (builder, import, jobs,
   tracker) without spending the daily LLM budget. The deep Pro check stays.

Design invariants inherited: **authenticity-first**, **privacy-first** (BYOK,
no server-side keys), **free core / Pro extras**. The shadow-parse, the
recruiter checklist and claim-*linked* prep are **Free** (deterministic /
low-risk by construction); the deep LLM triple-layer ATS and the *generated*
prep pack remain **Pro** (they consume your own keys and quota). This phase
adds **no new LLM endpoints** — the truth layer deepens `generate-interview-prep`
with two optional payload fields and a richer, still-leniently-coerced output.

---

## 1. ATS Shadow-Parse

### 1.1 What it is

A deterministic function that audits a **structured `ResumeData`** (optionally
with a structured job / `JobAnalysis`) and returns the exact `check` shape used
by `POST /api/llm/ats-check`:

```ts
{
  overall_score: number,
  keyword_notes: string[],
  structure_notes: string[],
  formatting_notes: string[],
  missing_headers: string[],
  parseability_notes: string[],
  contact_present: boolean,
  action_items: string[]
}
```

Rules, not vibes — every note and score delta traces to an observable property
of the resume JSON. It is honest *by heuristic*: labeled everywhere as
**"Heuristic ATS read (offline)"**, never presented as the deep check.

### 1.2 Two owners, one shape

- `backend/app/services/shadow.py` → `shadow_check(resume, job=None) -> dict`.
- `frontend/src/services/shadowAts.ts` → TS twin (`shadowCheck`, `shadowLedger`),
  so the browser-local product works with **no backend round-trip**.

Both reuse the keyword machinery from Phase 1 (`knowledge.py` /
`applicationDna.ts`): `keyword_gaps`, `keyword_section_hint`, `_KNOWN_SKILLS`.

### 1.3 Deterministic rubric

Base `100`. Subtractions (each clamped, floor 0, ceiling 100):

| Check | Delta | Note source |
|---|---|---|
| `contact.email` / phone / linkedin / github all empty | −15 | `contact_present=false`, parseability note |
| Standard section absent (summary, experience, education, skills as *data*) | −5 each via `missing_headers` | structure note |
| `experience` empty / `projects` empty (no work content) | −8 | structure note |
| `professionalSummary` short (< 30 chars) | −4 | structure note |
| `skills` empty | −5 | structure note |
| ≥ 40% of experience bullets have no digit (`\d`) and < 60 chars | −6 | formatting note "unquantified bullets" |
| Any all-caps word in bullets (simulated parse risk) | −3 | formatting note |
| `job.requiredSkills` provided and `keyword_gaps` non-empty | −2 per gap, cap −20 | keyword_notes + action_items |

`action_items`: static, sourced from the specific failed checks (e.g. *"Add an
email/phone to the contact header"*, *"Quantify 2-3 experience bullets with
numbers"*, *"Name ${gap} where the resume genuinely supports it — attach
evidence first"*). Action items reuse the honest gap copy from Phase 1 for
keyword misses.

With no job, the shadow is a structure + parseability + quantification audit
(no keyword deltas). With a job, it also emits a **`keywordLedger`**
(`KeywordEntry[]`, same shape as Phase 1) so the shadow can seed an application's
DNA snapshot even when no LLM analysis was run.

### 1.4 Endpoint + gating

`POST /api/ats/shadow` `{resume, job?}` → `{check, keywordLedger?, heuristic: true}`.
**Free, not quota-metered, no API keys required** (the router dependency
`_check_quota` is NOT applied — the handler is deterministic and costs nothing;
`X-Client-Key` still accepted for identity, not counted). Shares the
`_coerce_ats_check` schema so `check` renders through the existing ATS UI.

Test: 5-6 cases in `backend/tests/test_shadow.py` (contact missing, missing
section, unquantified bullets, job required-gap ledger, no-job shape, score
clamping).

### 1.5 Where it surfaces (Free)

| Surface | Behavior |
|---|---|
| `BuilderPage` | Live mini chip in the header: `Heuristic ATS · 74` refreshes on every edit (throttled) |
| `ImportPage` post-parse | Small shadow fragment next to the honesty score |
| `JobsPage` | "Offline ATS (heuristic)" panel next to the LLM check; when both exist, a one-line diff note ("LLM check agrees on structure, adds keyword nuance") |
| `HistoryPage` report header | Recorded shadow score at report time |
| `ApplicationsPage` | On hydrate, apps without `atsScore` get a shadow score computed from `resumeVariant`/master resume — DNA strips always populate |

---

## 2. Interview Truth Layer (claim-linked prep)

### 2.1 Payload

`GenerateInterviewPrepRequest` gains two optional fields (same lenient
validation style as `focusKeywords`):

```ts
evidence?: Array<{ id: string; category: string; text: string; source: string }>
confirmedClaims?: Array<{ id: string; text: string; verdict: string; evidenceId?: string }>
```

### 2.2 Output shape (backwards-compatible, lenient)

`prep` keeps its four arrays, but `talking_points` and `likely_questions`
items may be **strings or objects**:

```ts
interface PrepPoint {
  text: string
  section?: string             // summary | experience | projects | education | certifications
  claimId?: string             // when traceable to a resume line
  status: 'proof-backed' | 'in-resume' | 'needs-research'
  proof?: string               // evidence text when status = proof-backed
}
```

`_coerce_interview_prep` upgrades: string items → `{ text, status: 'in-resume' }`; object items coerce `status` to one of the three (default `in-resume`); arrays flatten as today. The endpoint returns `{ prep, truthSummary?: { proofBacked, inResume, needsResearch } }` computed from the coerced items (deterministic, server-side).

### 2.3 Prompt (additive to Phase 1 focus block, never weakens guardrails)

`interview_prep_prompt` gains a **truth block** after the focus block:

- A `claim_index` — deterministic list from `knowledge.py`:
  `claim_index(resume, evidence, confirmed)` → `[{ id, section, text, verdict, evidenceText?, supported: bool }]`
  (reuses `evidence_supports`, `claims_from_resume` from `extract.py`).
- Instruction: talking points/questions may **only** assert competence the
  claim index supports; `proof-backed` for claims with evidence text attached,
  `in-resume` for plain resume lines, and for topics the resume merely names
  use `needs-research` with a research suggestion — never invent.

### 2.4 UI

- Prep renderer (`PracticeButton`/prep page) shows a colored status chip per
  point: green `proof-backed` (opens the Evidence Vault on tap), blue
  `in-resume`, amber `needs-research`.
- The `PracticeButton` from Phase 1 already sends `focusKeywords` from the
  gap ledger; it now also sends the app's vault `evidence` + `confirmedClaims`
  so rejected-role prep lands on *provable* stories first.
- `truthSummary` renders as one line: *"3 proof-backed · 4 in-resume ·
  1 needs research"*.

### 2.5 Tests

`test_new_routes`/`test_llm_routes` additions: string-item coercion, object-item
coercion with bad `status`, `claim_index` subset rules (a claim with matching
evidence is `proof-backed`; verdict `ai-drafted` is never `proof-backed`).

---

## 3. Recruiter Share View

### 3.1 Behavior

`SharePage` gains a prominent **"View as recruiter"** toggle, and the route
accepts `?view=recruiter` so the candidate can send a purpose-built link
(copy button: *"copy recruiter link"*). Recruiter mode:

- Hides score badges / proof buttons / brand strip (the shield-chrome a
  candidate would not want pinned to themselves in a hiring context).
- Renders the resume exactly as the recruiter would open it (same
  `<ResumePreview>`, print-friendly).
- Adds a collapsible **"What an ATS would flag"** panel — the deterministic
  **recruiter checklist** from the shadow-parse + knowledge helpers, phrased
  recruiter-side ("Mixed role dates", "No contact email visible").
- A subtle one-line flag on the resume when quantitative bullets carry no
  proof *in the current share snapshot* — shown only to the candidate in this
  view, never injected into the resume itself.

The `?view=recruiter` variant honors `print:hidden` so printing the recruiter
view yields a clean resume page.

### 3.2 Deterministic checklist (Free, client-side)

`frontend/src/services/shadowAts.ts` gains `recruiterChecklist(resume)` →
`{ title, hint, severity: 'error'|'warning'|'ok' }[]`. Sources:
contact completeness, section presence, bullet quantification share,
summary length, education presence, skills count, date consistency in
experience (no more than `{startDate} > {endDate}` where both parse).

### 3.3 Backend

No schema change. `POST /api/shares` already stores `atsScore`; optionally
accept `heuristicAts` (`bool`) and persist it alongside so the recruiter view
can label the score origin. File-store and Supabase paths both updated
idempotently (`shares` table gains `heuristic_ats boolean default false` via
`0009_share_recruiter_view.sql`).

---

## 4. Backend helpers + tests

New/changed for Phase 2:

- `backend/app/services/shadow.py` — **new**: `shadow_check()`, rubric helpers.
- `backend/app/services/knowledge.py` — add `claim_index()` (shared with truth
  prep + recruiter checklist).
- `backend/app/routers/ats.py` — **new** `POST /shadow` (Free, no quota).
- `backend/app/routers/llm.py` — prep request `evidence` + `confirmedClaims`; `_coerce_interview_prep` object/string upgrade; response gains `truthSummary`.
- `backend/app/routers/shares.py` — optional `heuristicAts` on create/get.
- `backend/app/services/prompts.py` — prep truth block (additive).
- `database/migrations/0009_share_recruiter_view.sql` — shares `heuristic_ats` (idempotent), mirrored in `schema.sql` + `_apply_all.sql`.
- Tests: `backend/tests/test_shadow.py` (new), `test_knowledge.py` (+claim_index), `test_new_routes.py` (+prep coercion), `test_llm_routes.py` (+shadow endpoint shape).

Backend suite target `101 → 112+`; frontend `npm run build` green; seeded
browser QA of recruiter view + truth chips (agent-browser pattern from Phase 1).

---

## 5. Files

| Area | File | Change |
|---|---|---|
| Backend | `backend/app/services/shadow.py` | **new** — deterministic shadow ATS |
| Backend | `backend/app/services/knowledge.py` | `claim_index()` |
| Backend | `backend/app/routers/ats.py` | `POST /shadow` (Free) |
| Backend | `backend/app/routers/llm.py` | prep payload + coercion + `truthSummary` |
| Backend | `backend/app/routers/shares.py` | `heuristicAts` |
| Backend | `backend/app/services/prompts.py` | prep truth block |
| Backend | `backend/tests/test_shadow.py` | **new** tests |
| Backend | `backend/tests/test_knowledge.py` | +claim_index tests |
| Backend | `backend/tests/test_new_routes.py` | +prep coercion tests |
| Frontend | `frontend/src/services/shadowAts.ts` | **new** — TS twin + `recruiterChecklist` |
| Frontend | `frontend/src/pages/SharePage.tsx` | recruiter view toggle + `?view=recruiter` |
| Frontend | `frontend/src/pages/BuilderPage.tsx` | live heuristic chip |
| Frontend | `frontend/src/pages/ImportPage.tsx` | shadow fragment post-parse |
| Frontend | `frontend/src/pages/JobsPage.tsx` | offline ATS panel + diff note |
| Frontend | `frontend/src/pages/HistoryPage.tsx` | report shadow score |
| Frontend | `frontend/src/pages/ApplicationsPage.tsx` / `cloudSync.ts` | shadow snapshot for DNA; `ats_snapshot` read/write |
| Frontend | `frontend/src/services/llm.ts` | prep payload fields; fetchShare view param |
| DB | `database/schema.sql`, `migrations/0009_share_recruiter_view.sql`, `_apply_all.sql` | shares `heuristic_ats` |

---

## 6. Acceptance criteria

1. **Shadow-parse:** on the builder, a live heuristic ATS chip updates as the
   resume edits (no API key needed, no daily quota consumed; backend suite
   green). `POST /api/ats/shadow` returns the exact `check` shape with
   `heuristic: true`; Free tier clients are not 429'd on it.
2. **Shadow → DNA:** an application tracked without an LLM analysis still gets
   a heuristic `atsScore` + `keywordLedger` stored in its DNA; `HistoryPage`
   reports carry the shadow score at report time.
3. **Truth layer:** `generate-interview-prep` with `evidence`/`confirmedClaims`
   returns `talking_points` that are strings *or* `{ text, status, proof? }`;
   `truthSummary` splits proof-backed/in-resume/needs-research; the prompt
   never turns an unrelated resume section into a proof-backed claim; the
   authenticity RULES blocks are unchanged, only additive blocks added.
4. **Recruiter view:** `/share/<slug>?view=recruiter` renders resume-only,
   hides score chips + proof browser + brand strip, shows the ATS-flag panel,
   prints clean; the toggle works from the public share page. `heuristic_ats`
   survives create/get (file + Supabase paths).
5. **Honesty:** every heuristic value is labeled *heuristic/offline*; no new
   fabrication surface; `claim_index` never marks an `ai-drafted` verdict as
   proof-backed.
6. **Regression:** all Phase 0/1 behavior intact (verification gate, DNA ,
   rejection loop, consent-first fill). Backend `101 → 112+` tests pass;
   frontend `tsc -b` green; seeded browser QA of the recruiter view + truth
   chips.

## 7. Out of scope (later phases)

- Phase 3: encrypted backup bundle, freshness-decay loop, referral via Genuine
  badges, WhatsApp share deep-links.
- Extension autofill history syncing to the cloud (still deferred).
- Head-to-head A/B compare of two variants (deferred).