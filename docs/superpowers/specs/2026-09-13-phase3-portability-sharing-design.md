# Phase 3 — Portfolio-grade trust, portability and sharing

Status: **spec** · Date: 2026-09-13 · Owner: implementation backlog (next)

Four features that extend the truth-layer foundation: **encrypted local backup**
(data portability, zero backend), a **freshness-decay loop** (keep evidence and
applications honest over time), **referral attribution on share links**
(reuse the hosted share infra, consent-first), and **WhatsApp sharing** for
the badge/score pages (the primary sharing channel in the target 20-58 Indian
professional demographic).

Design intent: Phase 3 strengthens the "verification-first" moat by making
proof *portable* (backup), proof *current* (freshness), proof *recommendable*
(referral), and proof *shareable* (WhatsApp). Every new surface is labeled,
deterministic, and never weakens the authenticity guardrails.

---

## Feature 3.1 — Encrypted local backup bundle

**Why.** Everything lives in browser localStorage + optional Supabase. A user
loses that localStorage and their career narrative (with evidence) is gone.
Encryption-first backup gives a portable, restorable truth layer without any
server-side storage of user data (fits the "your keys, your data" positioning).

**Behavior (Frontend-only, Free).**
- A "Backup & security" card on the `/backup` page (new route, reachable from
  the header/settings menu) with three actions:
  1. **Export backup** → prompts for a passphrase → derives a key via
     WebCrypto `PBKDF2` (SHA-256, 150,000 iterations, random 16-byte salt) →
     encrypts the full store snapshot with `AES-GCM` → downloads
     `resume-builder-backup-YYYY-MM-DD.json` containing
     `{ v: 1, alg: "AES-256-GCM", saltB64, ivB64, kdf: "PBKDF2-SHA256:150000", dataB64, fetchedAt }`.
  2. **Restore backup** → file picker validates the envelope shape + version,
     asks for the passphrase, decrypts, and offers a **two-list merge**
     ("Replace everything" vs "Keep newest per kind" — email/date-ordered
     de-dupe on applications/shares/reports by id) before applying via existing
     store setters.
  3. **Export unlocked JSON** (no passphrase) as an escape hatch for manual
     moves (clearly labeled "not encrypted — path the file with care").
- Snapshot payload = `{ resume, apiKeysMetadata (provider/model, NO secrets),
  pendingChanges, evidence, confirmedClaims, applications, shares, reports,
  customTemplates, plan, targetUser, version: stateVersion }`. Api keys are
  intentionally EXCLUDED in full (exported only as provider/model metadata) —
  restoring never resurrects key material.
- Guardrails: min passphrase length 8 enforced (copy explains why); restore
  performs a checksum of decrypted payload before touching the store; wrong
  passphrase surfaces a clear error without partial state changes.

**Acceptance.**
- Export→Restore round-trip on the seeded store reproduces applications,
  evidence, DNA, shares and reports byte-for-byte (except uids kept as-is).
- Critical-path test: **wrong passphrase fails decrypt with no state change**;
  correct passphrase after a fresh Reset restores everything.
- No backend route, no new dependencies (WebCrypto is built in).

## Feature 3.2 — Freshness-decay loop

**Why.** A Genuine score is only as good as the evidence supporting it. Old
claims (two-year-old projects) and zombie applications (rejected months ago
with no next move) quietly degrade the trust conversation. A deterministic,
labeled "freshness flag" keeps the loop alive without a single LLM call.

**Behavior.**
- New helper `freshness.ts` (frontend, deterministic, mirrors nothing on backend):
  - `evidenceFreshness(evidence[], now) → { stale: string[], aging: string[], fresh: number }`
    — evidence older than **365 days** → `stale`; 180–365 → `aging`; otherwise `fresh`
    (uses `evidence.createdAt ?? evidence.id` date-hint; claims without dates default `fresh`).
  - `applicationDecay(applications[], now) → Array<{ appId, days, stage }>`
    — applied/interview/offer apps untouched; a **`saved`** app older than 7 days,
    or any non-terminal app with **no status change in 45 days**, flips to
    `stage: 'cooldown'`; rejected apps older than 60 days flip to `stage: 'archive'`.
  - `claimFreshnessDescription(claim, evidence) → string` for tooltips.
- Surfaces (all heuristic-labeled, additive only):
  - **Evidence Vault** (Builder + Verification Queue): a small chip on stale
    items — `stale proof · add a recent update` — with an inline "newer version?"
    affordance that copies the stale text into the "add evidence" draft.
  - **Applications page**: `cooldown` apps get a one-line nudge replacing the
    "No DNA" placeholder when present — `45+ days without a move — update status
    or close the loop.` plus a `Mark archived` action (sets `status: 'archived'`
    if that status exists, else keeps `rejected` and adds `decayed: true` flag).
  - **History & Reports**: rows whose snapshot is older than 365 days get a
    muted `stale snapshot` tag.
- Writes are bounded: the ONLY mutation is the optional `Mark archived` action
  (one toggle per card), everything else is computed on render. No quota use.

**Acceptance.**
- Unit tests in `frontend` (or a `backend/tests` mirror if the repr is shared)
  for the three helpers with fixed `now`; `cooldown` _not_ applied to `rejected`
  (that's archive stage) and never auto-flipping status.
- No new backend route.

## Feature 3.3 — Referral via share links (consent-first)

**Why.** The best acquisition channel is a shared score badge. Phase 2 made
shares shareable; Phase 3 adds deterministic attribution so we can later
reward referrals without a payments integration.

**Behavior.**
- `createShare` accepts optional `ref` (the sharer's `rb-client-key` published
  to `/share` links as `?ref=<clientKey>`). Hosted path: the `/share` creation
  payload gains `ref`; backend stores `referrer_key` on `shares` (nullable,
  0009-style idempotent migration; **no RLS/cost change**; file-store keeps it
  in the JSON envelope).
- Landing behavior: `/share/<slug>?ref=<key>` renders a subtle
  `type="button"` strip under the badge — `Recommended via a Genuine badge — built with
  verification-first tooling.` (no claim of coupon/incentive yet). The ref key
  is echoed to `localStorage.rb-referrer` (one-time, consent-light) for later
  phases. `ref` is only ever a share att l but actual monetization mechanics
  stay out of scope.
- The existing share page remains exactly as-is when `ref` absent.

**Acceptance.**
- `POST /api/shares` with `ref` persists it (Supabase + file); `GET /share`
  returns it; referral strip renders only with `?ref`, and strips the QR/recipient
  area unchanged otherwise. Tests cover ref persistence + strip presence logic.

## Feature 3.4 — WhatsApp share

**Why.** `wa.me` deep links are ubiquitous among the target audience and cost
nothing to implement.

**Behavior.**
- On the SharePage (candidate view) and on the post-share success state in the
  Builder, add a green `Share on WhatsApp` button → opens
  `https://wa.me/?text=<encoded "My verified resume + ATS score: {url} {badge label}">`
  in a new tab. Respect existing `heuristic` labeling: if `heuristicAts` then
  the text uses `ATS (offline estimate)` wording.
- No server involvement, no analytics.

**Acceptance.**
- Button renders only when a share URL exists; wa.me URL is correctly encoded
  (URL-encoded text, `+`/spaces handled); heuristic wording respected.

---

## Backend changes (cumulative for 3.3 + 3.4)

| Item | Location |
|---|---|
| `shares.ref` column | `database/schema.sql`, new `00010_share_referral.sql` (idempotent), `_apply_all.sql` |
| `ShareCreate.ref` / persisted / returned | `backend/app/routers/shares.py` |
| superset tests | `backend/tests/test_entitlements.py` (+1 ref-persist case), `test_new_routes.py` |

## Frontend changes (cumulative)

| Item | Location |
|---|---|
| Backup page + crypto + merge helpers | `frontend/src/pages/BackupPage.tsx`, `frontend/src/services/backup.ts` |
| Freshness helpers + chips | `frontend/src/services/freshness.ts`, Builder/Apps/Verification/History edits |
| Referral strip + wa.me | `frontend/src/pages/SharePage.tsx`, `frontend/src/services/llm.ts` |
| Nav entry | `frontend/src/App.tsx` (route), Layout header menu |

## Test plan
- Backend: 116 → ~118 (ref persist + badge treat `ref`/heuristic; small).
- Frontend: `tsc -b` + vite build; seeded QA: backup round-trip on the current
  seed corpus, wrong-passphrase failure, cooldown label with a seeded stale app,
  referral strip on `/share/x?ref=y`, wa.me href decode check.

## Definition of done
- All four features implemented, labeled where heuristic, no new LLM calls,
  backend suite green, frontend build green, seeded browser QA passed.