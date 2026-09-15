# Phase 1 — Application DNA + Consent-First Autofill + the Rejection Loop

**Status:** Approved ("ok go ahead") · **Date:** 2026-09-13 · **Spec:** one per phase, sequenced after the Phase 0 Honesty Engine.

## North Star

Every application is a *living record of what you sent, to whom, with which
evidence — and what it taught you.* Camouflage, not guesswork. The tool learns
from rejection instead of letting it evaporate, and the Chrome extension never
touches a form without your explicit consent.

Phase 1 stacks three connected features:

1. **Application DNA** — a per-application snapshot of the resume variant sent,
   its ATS/Genuine scores, and a keyword-vs-resume coverage ledger.
2. **The Rejection Loop** — when an application is marked rejected, surface the
   DNA's gaps as concrete next steps: add keywords to the master resume, draft
   a proof-backed bullet, run gap-focused interview prep. Cross-application
   patterns ("missing in 3 of your last rejected applications").
3. **Consent-First Autofill** — the extension previews exactly which fields it
   will fill and requires a tap before writing anything (default mode). Fill
   events deep-link into the tracker with the variant they used.

Design invariants inherited from earlier phases: **authenticity-first** (nothing
invented; every metric stays evidence-gated), **privacy-first** (BYOK, no
server-side LLM keys; client wipe on sign-out), **free core / Pro extras**.
Application DNA + rejection loop are **Free** (they make the honest product
stickier); consent-first autofill is also Free (it is a UX quality + trust
feature, not a monetization lever). Pro keeps unlimited quota and the heavy
LLM features this phase composes on top of.

---

## 1. Application DNA

### 1.1 Data model

Extend the local `ApplicationRecord` (`frontend/src/types/resume.ts`):

```ts
export interface KeywordEntry {
  keyword: string
  inResume: boolean            // present in the resume variant at fill time
  addedByCustomization: boolean // introduced via an approved verification change
  inVault: boolean             // evidence exists for this keyword
  source: 'required' | 'preferred' | 'ats'
}

export interface ApplicationRecord {   // existing fields unchanged
  id: string; jobTitle: string; company: string; status: ApplicationStatus
  appliedAt: string; jobUrl: string; notes: string
  resumeVariant?: ResumeData            // NEW: exact resume sent
  atsScore?: number | null              // NEW: overall_score at fill time
  genuineScore?: number | null          // NEW: honesty_score of the variant
  keywordLedger?: KeywordEntry[]        // NEW: coverage ledger
  keywordGaps?: string[]                // NEW: quick-reference list of misses
  jobSource?: 'customize' | 'tracker-form' | 'extension'
}
```

Supabase `public.applications` gains JSONB columns (migration applied to the
live project `nknhmztsshosmunfpbip` at implementation time):

```sql
alter table public.applications
  add column if not exists resume_variant jsonb,
  add column if not exists ats_snapshot jsonb,
  add column if not exists keyword_ledger jsonb,
  add column if not exists genuine_score int;
```

`cloudSync.ts` hydration reads these back into the store; write-through stores
them. Nothing else in the existing push/hydrate shape changes.

### 1.2 Derivation of the ledger (pure helper, both worlds share the shape)

`frontend/src/services/applicationDna.ts` + a backend twin
`backend/app/services/knowledge.py`:

- Inputs: `currentResume`, `pendingChanges` (post-review), `JobAnalysis`,
  optional `AtsCheck`, `evidence[]`, `confirmedClaims`.
- Build the **variant** = `resume` with approved/edited changes applied
  (reuse the exact mapping logic in `store.applyApprovedChanges`, lifted into a
  shared pure function so JobsPage and VerificationPage agree).
- `genuineScore` = `computeGenuineScore({ resume: variant, evidence, confirmedClaims })`.
- Ledger rows: iterate `analysis.requiredSkills` (source `required`),
  `analysis.preferredSkills` (source `preferred`), plus keywords from
  `ats.keyword_notes`/`action_items` (source `ats`). For each:
  - `inResume` = token match in variant (skills, bullets, summary).
  - `addedByCustomization` = a pending change (approved/edited) introduced it.
  - `inVault` = `evidenceSupports(keyword, evidence)`.
- `keywordGaps` = sorted `[keyword, source]` where `!inResume`.

### 1.3 Capture points

| Where | When | Captures |
|---|---|---|
| JobsPage `handleTrackApplication` | after customization exists | variant (changes applied) + `analysis` + ATS result if any + ledger |
| ApplicationsPage "Add application" | form submit | master resume snapshot + empty ledger (self-entered roles have no analysis) |
| Extension fill (below) | consent shown | master resume snapshot + `jobSource: 'extension'`, deep-link carries title/url |
| VerificationPage "Continue to preview" | click | writes `pendingVariant` into the store so the tracker attach happens on next track |

The store gains `pendingVariant?: { resume, analysis, ats? }` (transient, not
persisted) so the last tailored version sticks to the application captured
right after customization.

### 1.4 Presentation (ApplicationsPage)

Each application card (collapsed) shows a thin "DNA" strip:

```
Acme — Senior Frontend          status: Applied (1w)   [ATS 84] [Genuine 100]
Keywords: 9/14 covered · gaps: kubernetes, graphql     [See what happened]
```

Expanded panel, **"What I sent"**:
- Keyword ledger table: keyword | in resume | added by AI | in vault | source.
- Resume variant preview (reuses `ResumePreview`, read-only) with the
  exact score badges (ATS + Genuine) at fill time.
- "Stats" chips: ATS score at application, Genuine score of the variant.

---

## 2. The Rejection Loop

### 2.1 Trigger

Safe anytime; surfaced prominently when `status === 'rejected'`. Each rejected
application that has DNA renders a **"What happened + next move"** panel above
its DNA expander.

### 2.2 What it shows (ranked by leverage, all honest)

1. **Gap list** — the ledger's `keywordGaps`, each with:
   - "Add to master resume" → appends to `resume.skills` **with provenance**
     (only if the skill is a real skill term; otherwise suggests the natural
     section via a `keyword → section` hint table in `applicationDna.ts`).
   - "Back it with evidence" → opens the Evidence Vault affordance to record
     proof (Phase 0 vault; adding here makes gaps actionable instead of risky to
     claim).
   - "Practice it" → pushes the keyword into a gap-focused interview prep run.
2. **Cross-application pattern** — computed across all `applications` with
   ledger data: *"kubernetes was missing in 3 of your last 5 rejected roles"*.
   Pure function, offline, no AI.
3. **Gap-focused interview prep** — `generate-interview-prep` gains an optional
   `focusKeywords?: string[]` body field; the prompt (additive to the existing
   authenticity guardrails) builds `likely_questions`/`talking_points` around
   those keywords using **only the candidate's own resume + vault**. No new
   fabrication surface.
4. **Re-use as template** — saves the rejected variant as a
   `SavedTemplate` ("Acme — Senior Frontend (rejected)") so a similar future
   role starts from the version that already had the closest keyword coverage.

### 2.3 The "why this helps" copy

Small static helper copy per gap (in `applicationDna.ts`, no LLM): e.g. missing
`graphql` → *"The job asked for GraphQL on 14 lines. Adding the term without a
project that uses it risks a fabricated claim — attach evidence first."* This
keeps the honesty gate (Phase 0) as the governor of the loop.

### 2.4 UI placement

`ApplicationsPage` (rejected panel) + a compact hint inside `HistoryPage`'s
verification reports is out of scope; keep Phase 1 to the tracker + prep.

---

## 3. Consent-First Autofill (extension)

### 3.1 Behavior change in `extension/contents/autofill.ts`

Current code writes instantly on `FILL_RESUME` message and on a 2s debounced
`MutationObserver`. New flow:

1. Detect candidate fields (existing `matchField`/`collectFieldAttributes`
   machinery). Build the **proposed map**: `{ fieldLabel, key, value }[]`.
   No writing.
2. Render a floating **preview panel** (shadow DOM, top-right, dismissible):
   - "Resume: <tag> · will fill **5** fields" — each field one row
     (`label → value`).
   - Buttons: **Fill [n] fields** · **Skip** · **Always for this site**
     (persisted host setting `autofill: 'ask' | 'always'`, default `ask`).
   - Footnote: *"Nothing is written until you tap Fill. Preview is local —
     no data leaves this page."*
3. On **Fill**: run the existing `setNativeValue` + `highlight` only for the
   confirmed map; record `chrome.storage.local.autofill.log` entry
   `{ host, url, title, filledAt, fieldCount, resumeTag, status }`.
4. On **Skip**: nothing written, log `status: 'skipped'`.
5. `FILL_RESUME` message now opens the preview panel instead of filling.
6. "Always for this site" → same preview superseded with a slim persistent
   banner (still one visible confirm per page load).

The `MutationObserver` debounce changes from *fill on DOM settle* to *offer
preview when a form matures* — first offer per URL, no re-offer while a panel is
open.

### 3.2 Popup (`popup.tsx`)

- Autofill mode toggle (Ask each time / Always fill — resolves per host).
- "Open tracker" deep-link to the app.
- Last-fill log (last 10, local storage, cleared with sign-out data).
- Existing resume import/sync unchanged.

### 3.3 Post-fill tracking deep-link

On Fill, if a job title can be scraped (best effort `document.title`),
`chrome.tabs.update({ url: APP_ORIGIN + '/applications?title=...&url=...&resumeTag=...' })`
to the user-set app origin (stored in the popup), only when the user opted into
"track fills". The app's existing query-param intake creates/extends the
application record; if logged in and synced, it carries the master resume
snapshot as the variant (`jobSource: 'extension'`).

### 3.4 Backend touch (small)

- `llm.py generate-interview-prep` accepts `focusKeywords?: string[]`
  (validated list; prompt builder threads them with persona + guardrails).
- Optional `POST /api/ext/fill-log` (Pro-only, optional at implementation) to
  sync fill history — **deferred**; local-only log ships first to keep scope
  tight.
- No new schema beyond the applications columns.

---

## 4. Backend helpers + tests

New for Phase 1:

- `backend/app/services/knowledge.py` — `derive_keyword_ledger()`,
  `gap_patterns(applications)` (cross-app trend), `keyword_section_hint()`.
  Pure, deterministic, no LLM.
- `backend/app/routers/llm.py` — `focusKeywords` on interview-prep request.
- Tests `backend/tests/test_knowledge.py`:
  - ledger derivation marks `requiredSkills` vs `preferredSkills` vs `ats`.
  - `addedByCustomization` true only when a change introduced the keyword.
  - `gap_patterns` counts correctly across records.
  - focus-keyword validation (bad types → 422; absent → old behavior).

Frontend: `npm run build` stays green; add focused unit checks for
`applicationDna` pure functions if the repo's test runner permits (note: repo
has no frontend test runner today — QA via build + seeded browser).

---

## 5. Files

| Area | File | Change |
|---|---|---|
| Types | `frontend/src/types/resume.ts` | `KeywordEntry`, `ApplicationRecord` additions |
| Store | `frontend/src/store/appStore.ts` | `pendingVariant`, persist inclusions |
| Logic | `frontend/src/services/applicationDna.ts` | **new** — variant build, ledger, gap patterns, section hints |
| Sync | `frontend/src/services/cloudSync.ts` | hydrate/push new application columns |
| Page | `frontend/src/pages/ApplicationsPage.tsx` | DNA strip + "What happened" panel |
| Page | `frontend/src/pages/JobsPage.tsx` | attach DNA on track; pass lock to prep |
| Page | `frontend/src/pages/VerificationPage.tsx` | write `pendingVariant` on continue |
| Free | `frontend/src/services/llm.ts` | `generateInterviewPrep` focus param |
| Backend | `backend/app/services/knowledge.py` | **new** pure ledger/pattern helpers |
| Backend | `backend/app/routers/llm.py` | `focusKeywords` field + prompt thread |
| Backend | `backend/app/services/prompts.py` | interview-prep focus additive block |
| Backend | `backend/tests/test_knowledge.py` | **new** tests |
| DB | `database/schema.sql` | applications JSONB columns |
| Ext | `extension/contents/autofill.ts` | consent-first preview panel + log |
| Ext | `extension/popup.tsx` | mode toggle + log + tracker link |

---

## 6. Acceptance criteria

1. After customizing a job and clicking **Track application**, the new
   application shows `ATS score`, `Genuine score`, keyword coverage (e.g.
   `9/14`), and a gap list derived from its own analysis — no re-analysis.
2. Marking it **rejected** shows the "What happened" panel: gaps with
   add-to-master / back-with-evidence / practice actions, plus the
   cross-application "missing in N of your last M rejected roles" line.
3. **Add to master resume** only ever adds *real skill terms* (via the section
   hint table) and never fabricates metrics; **Back it with evidence** feeds the
   Phase 0 vault; **Practice it** runs interview prep focused on the gaps.
4. Extension in default mode **previews** (n fields, list) and writes nothing
   until **Fill [n] fields** is tapped; **Always for this site** changes the
   per-host behavior; every Fill/Skip is logged locally.
5. Extension fill deep-links to the tracker with the variant attached
   (`jobSource: 'extension'`).
6. Schema migration applied to live Supabase; `96 → 100+` backend tests pass;
   frontend `tsc -b` green.
7. **Manual QA (Chrome, flagged):** consent-first preview on one supported board
   (Indeed), fill + track round-trip — needs a real Chrome session; automated
   parts (build + seeded browser QA of the DNA/rejection UI) run without it.

## 7. Out of scope (later phases)

- Phase 2: interview **truth layer** (claim-specific prep) + "view as
  recruiter" share mode + ATS shadow-parse.
- Syncing extension fill history to the cloud (Phase 2 if wanted).
- A/B compare two variants head-to-head (Phase 2/3).