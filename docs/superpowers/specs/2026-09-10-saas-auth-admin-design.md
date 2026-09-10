# Resume Builder — SaaS Auth, Roles, Admin/User Panels & Security: Design

Date: 2026-09-10
Status: Approved (approach: RLS-first hybrid + backend-gated privileged paths)

## 1. Goal

Turn the current browser-local MVP into an industry-grade multi-tenant SaaS:

- Real authentication & authorization (no spoofable identity headers).
- Admin and user panels.
- Every existing cloud feature actually working end-to-end (DB wired, no silent no-ops).
- Anonymous "try then convert" flow: guests build + save to cloud anonymously, then sign up and keep/download their data.
- Industry-standard security for the chosen stack.

## 2. Non-Goals (v1)

- OAuth (Google/GitHub) and magic-link/SMS login — turnkey add-ons later.
- Server-side PDF generation (PDF is client-rendered; gating is a business rule, documented as soft).
- Payment gateways (Razorpay/Stripe) — still manual UPI-UTR; `PLAN_MODE` seam preserved for future PSPs.
- Multi-tenancy beyond user-owned rows; team/collaboration.
- Realtime subscriptions beyond what RLS naturally permits.

## 3. Architecture (Approach A + C hardening)

**RLS-first hybrid**:

- Frontend (supabase-js, user JWT + anon key) performs its own CRUD on user-owned rows; Postgres RLS is the authorization layer for that data.
- FastAPI backend (service-role key) owns privileged surface — LLM calls, quota metering, Pro entitlements, payments/UTR, share-link badge generation, file-level ATS, background jobs, admin. Every `/api/*` route verifies the Supabase JWT; headers like `X-Client-Key`/`X-User-Id` are never trusted for identity in Supabase mode.
- Sensitive structures (usage_logs, admin_audit_log, system_settings, plan_requests decisions) are backend/service-role only; RLS double as backstop.

## 4. Identity & Sessions (Supabase Auth)

- Email + password primary; anonymous sign-ins enabled (Free tier supports both).
- Anonymous bootstrap: `signInAnonymously()` on first visit, protected by invisible Cloudflare Turnstile; IP rate-limit default 30/hr retained.
- Email confirmation ON for permanent accounts; manual identity linking ON.
- Guest → account conversion keeps the same `auth.users` id (`updateUser({email, password})` + OTP confirm; existing-email path: sign in + backend reassigns anonymous rows — Supabase `a_id` pattern).
- Sessions: client auto-refresh; access token ~30 min; server validates `exp`/`aud`; idle timeout in session store; sign-out clears local cache.
- Identity always sourced from the verified JWT claims (`sub`, `is_anonymous`). Roles in `profiles.role` (`user`/`admin`/`banned`).

## 5. Data Model & RLS (migrations)

Baseline tables already exist in `database/schema.sql`: profiles, resumes, job_postings, resume_versions, verification_queue, applications, analysis_reports, evidence, shares, plan_requests, usage_logs. Work is additive + policy rewrite:

- Add `profiles.role text not null default 'user' check (role in ('user','admin','banned'))`; `updated_at` trigger.
- New tables: `admin_audit_log` (id, actor_user_id, action, target_type, target_id, before_data jsonb, after_data jsonb, reason, ip, created_at; client-denied), `system_settings` (key text pk, value jsonb, updated_at; client-denied).
- Security-definer helpers (single source of truth): `is_admin()`, `is_banned()`, `is_anonymous()`, `is_active()` (not banned), `can_create_share()` (non-anon + pro + not banned).
- Policy rewrite:
  - User-owned tables: `using (auth.uid() = user_id and not is_banned())` (anonymous owners allowed — they're `authenticated`).
  - Nested (resume_versions, verification_queue): parent-resume ownership, same guard.
  - `usage_logs`, `admin_audit_log`, `system_settings`: all client access denied (`false` policies); service role only.
  - `shares`: public read-by-slug (no auth) for hosted link; owner CRUD; insert/update gated by `can_create_share()`.
  - `plan_requests`: owner select/insert; updates/decisions via backend service role.
- Anonymous cleanup: `pg_cron` monthly job deleting anonymous `auth.users` inactive > 30 days (Supabase-documented SQL).

## 6. Backend Authorization

- New `get_user` dependency: parse `Authorization: Bearer`, verify HS256 with `SUPABASE_JWT_SECRET`, check `exp`/`aud='authenticated'`, return `{user_id, is_anonymous, role, claims}`.
- Dependency chain: `require_user` (non-anon), `require_admin` (profiles.role='admin' via service role), `require_pro` (valid plan, non-anon), `require_not_banned`.
- Quota metering keyed by `user_id + is_anonymous` in `usage_logs` (transactional unique key per day) when Supabase configured; `backend/data/*.json` file-store fallback when `SUPABASE_URL` absent (keeps local dev + existing tests green).
- Header fallback (`X-Client-Key`/`X-User-Id`) retained ONLY when Supabase is not configured; `ENABLE_ENTITLEMENTS` still respected.
- Admin router `/api/admin/*` (require_admin): users list/search/detail, plan grant/revoke/extend, ban/unban, delete, UTR approve/reject, settings read/write, KPIs, audit-log query. Every mutation writes `admin_audit_log`.
- Public endpoints only: `/api/health`, share `GET /{slug}`, `GET /{slug}/badge.svg`, `GET /api/payments/meta`.
- Admin bootstrap: env `ADMIN_EMAIL` — startup service-role upsert of profile role=admin.

## 7. Guest Conversion & Download Gating

- Guests' cloud writes are real rows under their anonymous uid; claim = same-uid link on conversion.
- PDF download/export: blocked for anonymous sessions (modal prompts conversion); enabled for any authenticated non-anon user (free tier). Soft gate (client-side PDF), documented.

## 8. Frontend

- `supabase.ts` → real auth client; store gains `session` slice (user, isAnon, role, plan, loading, idle) via `onAuthStateChange`.
- Route guards: public `/login` vs app routes; `/admin` requires role=admin (server double-checks).
- Cloud sync helpers per entity (resumes, versions, queue, applications, evidence, reports) using user JWT + RLS; local-first Zustand is a mirror when signed in; no-op local fallback only when Supabase env absent.
- `Gate` reworked on verified plan; download gating + conversion modal; account page `/account`; admin panel `/admin` (tabs below).
- Extension deep-links unchanged.

## 9. Panels

**Admin `/admin` (tabs):**
- Overview: KPIs — signups/day, anon→user conversions, Pro conversions, LLM calls by day, top personas, storage.
- Users: search/sort table, detail drawer (plan, usage, last active), actions (plan/ban/delete) with audit trail.
- Payments: UTR queue + history, approve/reject with expiry length.
- Settings: editor for `system_settings` (UPI id/payee/amount, subscription months, free daily quota, feature flags).
- Audit log viewer.

**User `/account`:**
- Profile + persona; plan/membership + UTR history/invoices; API-key manager (browser-local); data export (JSON) + delete account; change password/security; sign out everywhere.

## 10. Feature-Tier Matrix (final)

- Guest (anon): build, import/analyze/verify (demo), persona, anonymous cloud save, 25 LLM/day. No download, no Pro, no shares, no tracker.
- Free (authenticated): guest features + PDF download, export, cloud history/reports/evidence, 25/day.
- Pro (12-mo, manual UTR): ATS incl. file upload, cover letters, interview prep, application tracker, hosted share links + score badge, background jobs, unlimited quota.
- Banned: all access blocked (RLS + API).

## 11. Security Hardening

- Verified JWT only (no identity headers in Supabase mode).
- Strict CORS allowlist (`CORS_ORIGINS`).
- Security headers middleware (HSTS, X-Frame-Options, nosniff).
- Per-IP rate limiting on public/anon-facing endpoints.
- Turnstile on anon sign-in + sign-up (captcha token forwarded to Supabase).
- Strong-password policy (min length configurable, default 10) applied client + server.
- Size caps: JSON payload caps on LLM routes; 10 MB file cap on `/api/ats/file`; file type allowlist.
- Pydantic validation everywhere; parameterized queries (no raw SQL interpolation).
- Secrets only in backend `.env` (service key, `SUPABASE_JWT_SECRET`, `ADMIN_TOKEN`); Vite env only anon key + URL.
- Repo secret scan; adversarial IDOR tests.

## 12. Migrations & Setup

- `database/migrations/0001_baseline.sql` (as-is baseline), `0002_roles_audit_settings.sql`, `0003_rls_rewrite.sql`, `0004_anonymous_cleanup.sql`.
- Apply via Supabase SQL editor or `psql`. Dashboard toggles doc: enable anonymous sign-ins, confirm email, manual linking, Turnstile, copy JWT secret + anon/service keys.
- Env both sides + `.env.example` updated. Deploy: Railway backend, Vercel frontend, `CORS_ORIGINS` set.
- User-supplied prerequisites: Project URL, anon key, service-role key, JWT secret, ADMIN_EMAIL, CORS domain.

## 13. Testing & Verification

- Backend pytest: JWT fixture (HS256 test signing with test secret), auth/authorization suites (~40 new): 401 no token, anonymous vs user, banned, admin-only, IDOR attempts; quota-by-user; admin/audit; share/badge public; existing 42 tests stay green via header fallback.
- RLS: SQL policy-assertion script asserting cross-user isolation and client-denial on protected tables (run in SQL editor / CI).
- Frontend: minimal vitest for session store + gate/download logic; typecheck + build + oxlint stay.
- E2E browser sweep: guest build → anon save → sign-up claim → download → upgrade UTR → admin approve → Pro gates open → share link.

## 14. Delivery Phases

1. **Auth + infra:** migrations, backend JWT deps + admin seed + audit service, frontend session store + guards + anon bootstrap + profile sync.
2. **Cloud sync + conversion:** sync all entities, download gate, conversion modal, cleanup job.
3. **Panels + entitlements cutover:** admin panel, `/account`, quota-by-user (header trust retired in Supabase mode).
4. **Hardening + launch:** rate limit/captcha/headers/size caps, secret scan, deploy runbook, E2E sweep, docs.

Each phase ends green (backend pytest + frontend build/lint) and diffs verified per subagent.

## 15. Open Items (user-provided before live wiring)

- Supabase Project URL, anon/publishable key, service-role key, JWT secret.
- `ADMIN_EMAIL`.
- CORS origin / production domain.
- Whether to enable Google/magic-link now (default: no).