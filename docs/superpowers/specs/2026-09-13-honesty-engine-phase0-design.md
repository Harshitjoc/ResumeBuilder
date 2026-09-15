# Phase 0 — Honesty Engine Design

Date: 2026-09-13
Status: Approved

## Goal

Make verifiable honesty a first-class product property: every claim a resume
makes gets a verdict, AI-generated content is structurally unable to invent
(evidence hard gate), and the product surfaces that honesty in analysis,
preview, and share links.

## Verdicts

- `verified` — claim text matches an Evidence Vault item (proof attached).
- `confirmed` — the user explicitly approved/edited it in the verification queue.
- `unverifiable` — quantitative/achievement claim with no matching proof
  (auto-flagged, e.g. "improved conversion by 23%").
- `ai-drafted` — a customized claim still pending human review (pre-approval).

## Components

### Backend

1. `app/services/extract.py`
   - `has_metric_claim(text) -> bool` — digit + metric keyword / `%` heuristic.
   - `evidence_supports(text, evidence) -> dict | None` — substring containment
     or content-token overlap ≥ 0.4.
   - `claims_from_resume(resume) -> list[{section, text}]`.
   - `verifiable_claims(resume, evidence) -> {total, verified, unverifiable,
     neutral, honesty_score, flagged:[{section,text,reason}]}`.
   - `apply_hard_gate(customizations, evidence) -> list` — forces any item whose
     `customized` contains an unsupported metric claim to `is_authentic: false`,
     `confidence: low`, `action: "blocked"`.

2. `app/services/prompts.py`
   - `customize_prompt` / `redesign_resume_prompt` gain `evidence=[]`; additive
     EVIDENCE LEDGER rule: build rephrased/new content from vault facts, never
     invent metrics, low confidence when proof is missing. Authenticity RULES
     blocks untouched.

3. `app/routers/llm.py`
   - `evidence: list[dict]` added to customize/redesign/analyze/ats requests.
   - Customize/redesign: run `apply_hard_gate` after normalisation.
   - `analyze-resume` → `{analysis, verifiability}`; `ats-check` → `{check, verifiability}`.

4. `app/routers/shares.py`
   - `ShareCreate.evidence`; store `evidence` snapshot in Supabase row
     (`evidence jsonb`, migration) + file fallback; returned by `GET /{slug}`.

5. `database/schema.sql` — `alter table public.shares add column if not exists evidence jsonb;`

### Frontend

1. `types/resume.ts` — `ClaimVerdict`, `VerifiabilityResult`, `VerificationChange`
   gains `evidenceId?`, `verdict?`, and `action` union gains `'blocked'`.
2. `store/appStore.ts` — `confirmedClaims: string[]`, `addConfirmedClaims`,
   `attachChangeEvidence(id, evidenceId)`; partialize + resetWorkspace.
3. `services/verifiability.ts` — pure `buildClaimLedger(resume, evidence,
   confirmedClaims)` + `computeGenuineScore(...)` mirroring backend math.
4. `services/llm.ts` — types for `verifiability`, send `evidence` on customize/
   analyze/ats, `createShare`/`fetchShare` carry evidence.
5. `components/GenuineScoreCard.tsx` — honesty score + flagged claims + expandable
   claim ledger with proof.
6. `components/TrustBadges.tsx` — compact verdict strip (`print:hidden`).
7. Pages: ImportPage (GeniuneScore after analyze), BuilderPage (ATS honesty chip),
   PreviewPage (TrustBadges above preview), VerificationPage (blocked items get
   an "attach evidence" picker; approve requires proof for blocked items),
   SharePage (TrustBadges + Claim ledger with proof-mode expand).
   Print stays clean (badges/ledger use `print:hidden`).

## Honesty score

`honesty_score = round(100 * proved / risky)` where `risky` = claims matching
`has_metric_claim` and `proved` = risky claims with matching evidence or in
`confirmedClaims`; `100` when no risky claims. Lower-scoring flags are listed
with suggested fixes.

## Schema migration (live Supabase)

`alter table public.shares add column if not exists evidence jsonb;`

## Verification

- Backend: `python -m pytest` (all suites green, incl. new `test_honesty.py`).
- Frontend: `npm run build`.
- Browser QA: analyze shows honesty score; customize with a metric claim and empty
  vault → blocked + attach-evidence UI; attach → approve; share page shows
  badges + expandable proof; print hides the strip.