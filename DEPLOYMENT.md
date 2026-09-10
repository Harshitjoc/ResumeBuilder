# Deployment Runbook

End-to-end steps to take the SaaS build (Supabase Auth + Free/Pro via manual
UPI approval) from local to production.

## 0. Preflight (local)

```bash
python scripts/secret_scan.py                 # must print "No high-risk secrets found."
cd backend && .venv\Scripts\python -m pytest tests -q   # 69 passing
cd frontend && npm run build && npm run lint  # type-safe, oxlint clean
```

## 1. Supabase

1. Create a free project; note the URL, anon key, service-role key, JWT secret.
2. **Auth → Providers → Email**: enable, disable "Confirm email" if you want
   instant sign-in, enable **Anonymous sign-ins** (Settings → Auth), and enable
   **Turnstile** (Settings → Auth → Bot and Abuse) if you plan to guard the anon
   sign-up with Cloudflare (key pair lives in `.env`, see step 3).
3. Apply the schema and migrations with the SQL editor or CLI:

   ```bash
   supabase db push   # or paste database/schema.sql then database/migrations/*.sql in order
   ```

4. Seed the first admin: `INSERT INTO profiles (id, role) VALUES ('<ADMIN_USER_ID>', 'admin')`
   (or set `ADMIN_EMAIL` — backend seeds it on first startup).
5. Sanity-check RLS:

   ```sql
   select auth.uid() is not null;                                   -- must be true post-login
   -- as anon: expect zero rows from resumes / evidence / plan_requests
   ```

6. **Auth → URL Configuration**: set Site URL to the Vercel app and add the
   dev origin (`http://localhost:5180`) and prod origin to Additional Redirect URLs.

## 2. Backend (Railway)

| Env var | Value |
|---------|-------|
| `SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_SERVICE_KEY` | service-role key |
| `SUPABASE_JWT_SECRET` | JWT secret (used to validate user JWTs) |
| `MATCH_NEW_GUESTS` | `true` |
| `ADMIN_EMAIL` | your admin email |
| `ADMIN_TOKEN` | strong random value (used by `/admin` when Supabase is absent) |
| `PLAN_MODE` | `manual` |
| `ENABLE_ENTITLEMENTS` | `true` |
| `FREE_DAILY_LLM` | `25` |
| `SUBSCRIPTION_MONTHS` | `12` |
| `UPI_ID` / `UPI_PAYEE_NAME` / `UPI_PAYMENT_AMOUNT` / `UPI_CURRENCY` | `499` / `INR` |
| `CORS_ORIGINS` | comma-separated Vercel + localhost origins |
| `MAX_JSON_BYTES`, rate-limit overrides | optional (defaults sane) |

Deploy `backend/` via Nixpacks (`railway.json` already present). Behind Railway
proxy the rate limiter sees the proxy IP — acceptable for demo; move to
Cloudflare rate limiting or a Redis-based limiter before multi-node/HI traffic.

## 3. Frontend (Vercel)

| Env var | Value |
|---------|-------|
| `VITE_SUPABASE_URL` | `https://<project>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | anon key |
| `VITE_API_URL` | Railway backend URL (if not proxied by `vercel.json`) |
| `VITE_TURNSTILE_SITE_KEY` | optional — enabled only when set |

`frontend/vercel.json` already has the SPA rewrite. Redeploy on commit.

## 4. Post-deploy checks

1. `GET /api/health`
2. Anonymous sign-in → build a resume → share link loads with score badge.
3. Payment request with a fake UTR → pending → approve via `/admin` with the
   admin token → `/api/me` shows `plan: pro` → ATS file + cover letter + tracker unlock.
4. Sign out of anon, create account via email, delete the account in `/account`;
   verify RLS forbids orphan reads and the audit log records the deletion.

## 5. Ongoing

- Rotate `SUPABASE_SERVICE_KEY` and `ADMIN_TOKEN` before any repo/PR sharing.
- Never log `apiKey` from `apiKeys` payloads; the LLM layer already redacts.
- Run `python scripts/secret_scan.py` in CI (or use gitleaks) on every PR.