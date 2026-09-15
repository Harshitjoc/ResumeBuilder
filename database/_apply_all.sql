-- apply order: schema.sql -> 0002 -> 0003 -> 0004 -> 0005 -> 0006 -> 0007
-- (0001_baseline.sql is a duplicate of schema.sql and is not applied separately.)
-- Paste this entire file into Supabase Dashboard -> SQL Editor -> Run.

-- ============ schema.sql ============
-- Resume Builder - Supabase schema
-- Run in Supabase SQL Editor (or: psql resume_builder < schema.sql)

-- UUID extension
create extension if not exists "uuid-ossp";

-- Users (profile data besides Supabase auth.users)
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text,
    experience_level text check (experience_level in ('entry','mid','senior','lead')),
    target_user text check (target_user in ('recent-grad','working-professional','career-switcher')),
    primary_role text,
    tech_stack jsonb default '[]'::jsonb,
    target_companies jsonb default '[]'::jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

alter table public.profiles add column if not exists target_user text
    check (target_user in ('recent-grad','working-professional','career-switcher'));

-- Paid plan entitlement (manual UPI-UTR approval flow; automatic PSP later)
alter table public.profiles add column if not exists plan text not null default 'free'
    check (plan in ('free','pro'));
alter table public.profiles add column if not exists plan_expires_at timestamptz;

-- Master resumes (base copies)
create table if not exists public.resumes (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    template_format text default 'classic' check (template_format in ('classic','modern','minimalist','ats-optimized')),
    content jsonb not null,
    version_number int default 1,
    is_master boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index if not exists idx_resumes_user_id on public.resumes (user_id);

-- Job postings
create table if not exists public.job_postings (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    raw_text text not null,
    parsed_data jsonb,
    compatibility_score int,
    source_url text,
    created_at timestamptz default now()
);

create index if not exists idx_job_postings_user_id on public.job_postings (user_id);

-- Customized resume versions (delta from a master resume for a specific job)
create table if not exists public.resume_versions (
    id uuid primary key default uuid_generate_v4(),
    base_resume_id uuid not null references public.resumes(id) on delete cascade,
    job_posting_id uuid references public.job_postings(id) on delete set null,
    customized_content jsonb not null,
    user_approved boolean default false,
    used_for_application boolean default false,
    application_date timestamptz,
    created_at timestamptz default now()
);

create index if not exists idx_resume_versions_base on public.resume_versions (base_resume_id);

-- Verification queue: every AI change requires user action
create table if not exists public.verification_queue (
    id uuid primary key default uuid_generate_v4(),
    resume_version_id uuid not null references public.resume_versions(id) on delete cascade,
    change_type text not null,
    original_content jsonb,
    proposed_content jsonb,
    reason_for_change text,
    user_action text default 'pending' check (user_action in ('pending','approved','rejected','edited')),
    action_timestamp timestamptz,
    notes text
);

create index if not exists idx_verification_queue_version on public.verification_queue (resume_version_id);

-- Application tracking
create table if not exists public.applications (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    resume_version_id uuid references public.resume_versions(id) on delete set null,
    job_url text,
    job_title text,
    company_name text,
status text default 'applied' check (status in ('saved','applied','pending','interview','offer','rejected')),
    applied_at timestamptz default now(),
    updated_at timestamptz default now(),
    resume_variant jsonb,
    ats_snapshot jsonb,
    keyword_ledger jsonb,
    genuine_score int
);

create index if not exists idx_applications_user_id on public.applications (user_id);

-- Row Level Security: users can only access their own data
alter table public.profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.job_postings enable row level security;
alter table public.resume_versions enable row level security;
alter table public.verification_queue enable row level security;
alter table public.applications enable row level security;

create policy "users select own profile" on public.profiles for select using (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);

create policy "users select own resumes" on public.resumes for select using (auth.uid() = user_id);
create policy "users insert own resumes" on public.resumes for insert with check (auth.uid() = user_id);
create policy "users update own resumes" on public.resumes for update using (auth.uid() = user_id);
create policy "users delete own resumes" on public.resumes for delete using (auth.uid() = user_id);

create policy "users select own job postings" on public.job_postings for select using (auth.uid() = user_id);
create policy "users insert own job postings" on public.job_postings for insert with check (auth.uid() = user_id);
create policy "users delete own job postings" on public.job_postings for delete using (auth.uid() = user_id);

create policy "users select own versions" on public.resume_versions for select using (exists (
    select 1 from public.resumes r where r.id = base_resume_id and r.user_id = auth.uid()
));
create policy "users insert own versions" on public.resume_versions for insert with check (exists (
    select 1 from public.resumes r where r.id = base_resume_id and r.user_id = auth.uid()
));

create policy "users select own queue" on public.verification_queue for select using (exists (
    select 1 from public.resume_versions v
    join public.resumes r on r.id = v.base_resume_id
    where v.id = resume_version_id and r.user_id = auth.uid()
));
create policy "users update own queue" on public.verification_queue for update using (exists (
    select 1 from public.resume_versions v
    join public.resumes r on r.id = v.base_resume_id
    where v.id = resume_version_id and r.user_id = auth.uid()
));

create policy "users select own applications" on public.applications for select using (auth.uid() = user_id);
create policy "users insert own applications" on public.applications for insert with check (auth.uid() = user_id);
create policy "users update own applications" on public.applications for update using (auth.uid() = user_id);

-- Analysis / report history (resume analyses, job-fit analyses, verification decisions, resume snapshots)
create table if not exists public.analysis_reports (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    kind text not null check (kind in ('resume-analysis','job-analysis','verification','resume-snapshot')),
    title text not null,
    score int,
    payload jsonb,
    resume_snapshot jsonb,
    job_snapshot jsonb,
    created_at timestamptz default now()
);

create index if not exists idx_analysis_reports_user_id on public.analysis_reports (user_id);

alter table public.analysis_reports enable row level security;

create policy "users select own reports" on public.analysis_reports for select using (auth.uid() = user_id);
create policy "users insert own reports" on public.analysis_reports for insert with check (auth.uid() = user_id);
create policy "users delete own reports" on public.analysis_reports for delete using (auth.uid() = user_id);

-- Evidence / claims vault: user-confirmed facts reused across resume versions
create table if not exists public.evidence (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    category text not null check (category in ('skill','achievement','metric','project','education','certification')),
    text text not null,
    confidence text not null default 'medium' check (confidence in ('high','medium','low')),
    source text not null default 'user' check (source in ('document','user','ai-suggestion')),
    created_at timestamptz default now()
);

create index if not exists idx_evidence_user_id on public.evidence (user_id);

alter table public.evidence enable row level security;

create policy "users select own evidence" on public.evidence for select using (auth.uid() = user_id);
create policy "users insert own evidence" on public.evidence for insert with check (auth.uid() = user_id);
create policy "users delete own evidence" on public.evidence for delete using (auth.uid() = user_id);

-- Shareable resume links + public score badges (monetization / PLG)
create table if not exists public.shares (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    slug text unique not null,
    name text not null,
    resume_snapshot jsonb not null,
    ats_score int check (ats_score between 0 and 100),
    created_at timestamptz default now()
);

create index if not exists idx_shares_user_id on public.shares (user_id);
create index if not exists idx_shares_slug on public.shares (slug);

-- Public reads on the row matching a share slug are allowed; writes are owner-only.
alter table public.shares enable row level security;

create policy "anyone can view a share by slug" on public.shares for select using (
    (select true)
);
create policy "users insert own shares" on public.shares for insert with check (auth.uid() = user_id);
create policy "users update own shares" on public.shares for update using (auth.uid() = user_id);
create policy "users delete own shares" on public.shares for delete using (auth.uid() = user_id);

-- Plan upgrade requests (manual UPI QR payment -> user enters UTR -> admin approves)
create table if not exists public.plan_requests (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete set null,
    client_key text not null,
    name text,
    email text,
    utr text not null unique,
    amount numeric,
    status text not null default 'pending' check (status in ('pending','approved','rejected')),
    created_at timestamptz default now(),
    decided_at timestamptz,
    decided_by text
);

create index if not exists idx_plan_requests_client_key on public.plan_requests (client_key);

alter table public.plan_requests enable row level security;

create policy "users select own plan requests" on public.plan_requests for select using (auth.uid() = user_id);
create policy "users insert own plan requests" on public.plan_requests for insert with check (auth.uid() = user_id);

-- Daily LLM proxy usage counters for free-tier metering
create table if not exists public.usage_logs (
    id bigserial primary key,
    identity_key text not null,
    day date not null default current_date,
    calls int not null default 0,
    updated_at timestamptz default now(),
    unique (identity_key, day)
);

alter table public.usage_logs enable row level security;
create policy "no direct client access to usage logs" on public.usage_logs for select using (false);
create policy "no direct client writes to usage logs" on public.usage_logs for insert with check (false);
create policy "no direct client updates to usage logs" on public.usage_logs for update using (false);

-- ============ 0002_auth_roles_and_audit.sql ============
-- 0002_auth_roles_and_audit.sql
-- Adds role-based access control primitives, admin audit logging, and
-- editable system settings. Requires 0001_baseline.sql.
--
-- Helper functions live in a non-exposed `private` schema. They are
-- SECURITY DEFINER (run as postgres/superuser) but every one of them
-- derives identity ONLY from auth.uid()/auth.jwt() — never from a client
-- header — and each reads only the current user's own profile row.
-- Execute is granted to anon/authenticated because RLS policy expressions
-- run with the querying role's privileges and must be able to call them.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- profiles.role (added first: 0002 helper functions reference this column)
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists role text not null default 'user'
    check (role in ('user','admin','banned'));

create index if not exists idx_profiles_role on public.profiles (role);

-- ---------------------------------------------------------------------------
-- Role / entitlement helpers (single source of truth for SQL-level checks)
-- ---------------------------------------------------------------------------

create or replace function private.pof_or_null()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select private.pof_or_null()) = 'admin', false);
$$;

create or replace function private.is_banned()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select private.pof_or_null()) = 'banned', false);
$$;

create or replace function private.is_anonymous()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

create or replace function private.is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    (select auth.uid()) is not null
    and not (select private.is_banned())
  );
$$;

-- Pro entitlement for the CURRENT user: profile says pro and not expired.
create or replace function private.plan_is_pro()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select (plan = 'pro' and (plan_expires_at is null or plan_expires_at > now()))
    from public.profiles
    where id = (select auth.uid())
  ), false);
$$;

-- Share links are a Pro, authenticated-user feature (see spec section 10).
create or replace function private.can_create_share()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    (select private.is_active())
    and not (select private.is_anonymous())
    and (select private.plan_is_pro())
  );
$$;

revoke execute on all functions in schema private from public;
grant execute on function private.pof_or_null() to authenticated, anon;
grant execute on function private.is_admin() to authenticated, anon;
grant execute on function private.is_banned() to authenticated, anon;
grant execute on function private.is_anonymous() to authenticated, anon;
grant execute on function private.is_active() to authenticated, anon;
grant execute on function private.plan_is_pro() to authenticated, anon;
grant execute on function private.can_create_share() to authenticated, anon;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
    for each row execute function private.set_updated_at();

drop trigger if exists resumes_set_updated_at on public.resumes;
create trigger resumes_set_updated_at before update on public.resumes
    for each row execute function private.set_updated_at();

drop trigger if exists applications_set_updated_at on public.applications;
create trigger applications_set_updated_at before update on public.applications
    for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- admin_audit_log — immutable trail of admin/privileged actions.
-- Clients can never read or write it; only the backend (service role) does.
-- ---------------------------------------------------------------------------

create table if not exists public.admin_audit_log (
    id bigserial primary key,
    actor_user_id uuid,
    actor_label text,
    action text not null,
    target_type text not null,
    target_id text,
    before_data jsonb,
    after_data jsonb,
    reason text,
    ip text,
    created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_log_created
    on public.admin_audit_log (created_at desc);
create index if not exists idx_admin_audit_log_action
    on public.admin_audit_log (action);
create index if not exists idx_admin_audit_log_actor
    on public.admin_audit_log (actor_user_id);

alter table public.admin_audit_log enable row level security;

create policy "no client access to audit log" on public.admin_audit_log
    for all to anon, authenticated using (false) with check (false);

-- ---------------------------------------------------------------------------
-- system_settings — editable config surfaced to the Admin Settings tab.
-- Backend/service-role reads and writes; clients are denied.
-- ---------------------------------------------------------------------------

create table if not exists public.system_settings (
    key text primary key,
    value jsonb not null,
    updated_at timestamptz not null default now()
);

drop trigger if exists system_settings_set_updated_at on public.system_settings;
create trigger system_settings_set_updated_at before update on public.system_settings
    for each row execute function private.set_updated_at();

insert into public.system_settings (key, value) values
    ('payment', '{"upi_id":"","upi_payee_name":"","amount":499,"currency":"INR","subscription_months":12}'::jsonb),
    ('quotas', '{"free_daily_llm":25}'::jsonb),
    ('features', '{}'::jsonb),
    ('brand', '{"app_name":"Resume Builder"}'::jsonb)
on conflict (key) do nothing;

alter table public.system_settings enable row level security;

create policy "no client access to system settings" on public.system_settings
    for all to anon, authenticated using (false) with check (false);

-- ============ 0003_rls_rewrite.sql ============
-- 0003_rls_rewrite.sql
-- Hardens every RLS policy: identity comes from auth.uid() only, banned
-- users are blocked everywhere, function calls are hoisted with `(select ...)`
-- for performance, and the shares table's accidental "select all rows"
-- public policy is replaced with owner-only access + a public read function.
-- Requires 0002.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists "users select own profile" on public.profiles;
drop policy if exists "users insert own profile" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;

create policy "users select own profile" on public.profiles
    for select to authenticated, anon
    using ((select private.is_active()) and auth.uid() = id);

create policy "users insert own profile" on public.profiles
    for insert to authenticated, anon
    with check ((select private.is_active()) and auth.uid() = id);

create policy "users update own profile" on public.profiles
    for update to authenticated, anon
    using ((select private.is_active()) and auth.uid() = id)
    with check ((select private.is_active()) and auth.uid() = id);

-- ---------------------------------------------------------------------------
-- resumes
-- ---------------------------------------------------------------------------
drop policy if exists "users select own resumes" on public.resumes;
drop policy if exists "users insert own resumes" on public.resumes;
drop policy if exists "users update own resumes" on public.resumes;
drop policy if exists "users delete own resumes" on public.resumes;

create policy "users select own resumes" on public.resumes
    for select to authenticated, anon
    using ((select private.is_active()) and auth.uid() = user_id);

create policy "users insert own resumes" on public.resumes
    for insert to authenticated, anon
    with check ((select private.is_active()) and auth.uid() = user_id);

create policy "users update own resumes" on public.resumes
    for update to authenticated, anon
    using ((select private.is_active()) and auth.uid() = user_id)
    with check ((select private.is_active()) and auth.uid() = user_id);

create policy "users delete own resumes" on public.resumes
    for delete to authenticated, anon
    using ((select private.is_active()) and auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- job_postings
-- ---------------------------------------------------------------------------
drop policy if exists "users select own job postings" on public.job_postings;
drop policy if exists "users insert own job postings" on public.job_postings;
drop policy if exists "users delete own job postings" on public.job_postings;

create policy "users select own job postings" on public.job_postings
    for select to authenticated, anon
    using ((select private.is_active()) and auth.uid() = user_id);

create policy "users insert own job postings" on public.job_postings
    for insert to authenticated, anon
    with check ((select private.is_active()) and auth.uid() = user_id);

create policy "users delete own job postings" on public.job_postings
    for delete to authenticated, anon
    using ((select private.is_active()) and auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- resume_versions (ownership via parent resume)
-- ---------------------------------------------------------------------------
drop policy if exists "users select own versions" on public.resume_versions;
drop policy if exists "users insert own versions" on public.resume_versions;

create policy "users select own versions" on public.resume_versions
    for select to authenticated, anon
    using ((select private.is_active()) and exists (
        select 1 from public.resumes r
        where r.id = resume_versions.base_resume_id and r.user_id = auth.uid()
    ));

create policy "users insert own versions" on public.resume_versions
    for insert to authenticated, anon
    with check ((select private.is_active()) and exists (
        select 1 from public.resumes r
        where r.id = resume_versions.base_resume_id and r.user_id = auth.uid()
    ));

-- ---------------------------------------------------------------------------
-- verification_queue (ownership via resume -> version chain)
-- ---------------------------------------------------------------------------
drop policy if exists "users select own queue" on public.verification_queue;
drop policy if exists "users update own queue" on public.verification_queue;

create policy "users select own queue" on public.verification_queue
    for select to authenticated, anon
    using ((select private.is_active()) and exists (
        select 1 from public.resume_versions v
        join public.resumes r on r.id = v.base_resume_id
        where v.id = verification_queue.resume_version_id and r.user_id = auth.uid()
    ));

create policy "users update own queue" on public.verification_queue
    for update to authenticated, anon
    using ((select private.is_active()) and exists (
        select 1 from public.resume_versions v
        join public.resumes r on r.id = v.base_resume_id
        where v.id = verification_queue.resume_version_id and r.user_id = auth.uid()
    ))
    with check ((select private.is_active()) and exists (
        select 1 from public.resume_versions v
        join public.resumes r on r.id = v.base_resume_id
        where v.id = verification_queue.resume_version_id and r.user_id = auth.uid()
    ));

-- ---------------------------------------------------------------------------
-- applications
-- ---------------------------------------------------------------------------
drop policy if exists "users select own applications" on public.applications;
drop policy if exists "users insert own applications" on public.applications;
drop policy if exists "users update own applications" on public.applications;

create policy "users select own applications" on public.applications
    for select to authenticated, anon
    using ((select private.is_active()) and auth.uid() = user_id);

create policy "users insert own applications" on public.applications
    for insert to authenticated, anon
    with check ((select private.is_active()) and auth.uid() = user_id);

create policy "users update own applications" on public.applications
    for update to authenticated, anon
    using ((select private.is_active()) and auth.uid() = user_id)
    with check ((select private.is_active()) and auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- analysis_reports
-- ---------------------------------------------------------------------------
drop policy if exists "users select own reports" on public.analysis_reports;
drop policy if exists "users insert own reports" on public.analysis_reports;
drop policy if exists "users delete own reports" on public.analysis_reports;

create policy "users select own reports" on public.analysis_reports
    for select to authenticated, anon
    using ((select private.is_active()) and auth.uid() = user_id);

create policy "users insert own reports" on public.analysis_reports
    for insert to authenticated, anon
    with check ((select private.is_active()) and auth.uid() = user_id);

create policy "users delete own reports" on public.analysis_reports
    for delete to authenticated, anon
    using ((select private.is_active()) and auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- evidence
-- ---------------------------------------------------------------------------
drop policy if exists "users select own evidence" on public.evidence;
drop policy if exists "users insert own evidence" on public.evidence;
drop policy if exists "users delete own evidence" on public.evidence;

create policy "users select own evidence" on public.evidence
    for select to authenticated, anon
    using ((select private.is_active()) and auth.uid() = user_id);

create policy "users insert own evidence" on public.evidence
    for insert to authenticated, anon
    with check ((select private.is_active()) and auth.uid() = user_id);

create policy "users delete own evidence" on public.evidence
    for delete to authenticated, anon
    using ((select private.is_active()) and auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- shares
-- Owner-only table access. Public (unauthenticated / any device) reads go
-- through get_share_by_slug() below, which returns exactly one row; this
-- removes the old "anyone can SELECT * FROM shares" enumeration leak.
-- ---------------------------------------------------------------------------
drop policy if exists "anyone can view a share by slug" on public.shares;
drop policy if exists "users insert own shares" on public.shares;
drop policy if exists "users update own shares" on public.shares;
drop policy if exists "users delete own shares" on public.shares;

create policy "users select own shares" on public.shares
    for select to authenticated, anon
    using (auth.uid() = user_id and (select private.is_active()));

create policy "users update own shares" on public.shares
    for update to authenticated, anon
    using (auth.uid() = user_id and (select private.is_active()))
    with check (auth.uid() = user_id and (select private.can_create_share()));

create policy "users delete own shares" on public.shares
    for delete to authenticated, anon
    using (auth.uid() = user_id and (select private.is_active()));

create policy "pro users create shares" on public.shares
    for insert to authenticated
    with check ((select private.can_create_share()));

-- Public, single-row read used by hosted share links. SECURITY DEFINER by
-- design: it is the ONLY way unauthenticated clients may see a share, and it
-- never exposes more than the matching row.
create or replace function public.get_share_by_slug(slug text)
returns public.shares
language sql
stable
security definer
set search_path = ''
as $$
    select * from public.shares where shares.slug = get_share_by_slug.slug limit 1;
$$;

revoke execute on function public.get_share_by_slug(text) from public;
grant execute on function public.get_share_by_slug(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- plan_requests (owners may view/create; decisions are backend/service-role)
-- ---------------------------------------------------------------------------
drop policy if exists "users select own plan requests" on public.plan_requests;
drop policy if exists "users insert own plan requests" on public.plan_requests;

create policy "users select own plan requests" on public.plan_requests
    for select to authenticated, anon
    using (auth.uid() = user_id and (select private.is_active()));

create policy "users insert own plan requests" on public.plan_requests
    for insert to authenticated, anon
    with check (auth.uid() = user_id and (select private.is_active()));

-- ---------------------------------------------------------------------------
-- usage_logs — still fully client-denied; add day index for admin KPIs.
-- ---------------------------------------------------------------------------
drop policy if exists "no direct client access to usage logs" on public.usage_logs;
drop policy if exists "no direct client writes to usage logs" on public.usage_logs;
drop policy if exists "no direct client updates to usage logs" on public.usage_logs;

create policy "no direct client access to usage logs" on public.usage_logs
    for select to anon, authenticated using (false);

create policy "no direct client writes to usage logs" on public.usage_logs
    for insert to anon, authenticated with check (false);

create policy "no direct client updates to usage logs" on public.usage_logs
    for update to anon, authenticated using (false) with check (false);

create index if not exists idx_usage_logs_day on public.usage_logs (day);

-- ============ 0004_anonymous_cleanup.sql ============
-- 0004_anonymous_cleanup.sql
-- Anonymous sign-ins create real rows in auth.users (supported on Free tier).
-- Orphaned anonymous accounts (no email, can't be recovered) are pruned
-- monthly via pg_cron (shipped with Supabase) so the auth table stays lean.
-- Requires 0003.

create extension if not exists pg_cron;

-- Make the job idempotent: remove any previous schedule with this name, then
-- re-create it. Runs at 03:00 on the 1st of every month.
select cron.unschedule(jobid)
from cron.job
where jobname = 'cleanup-anonymous-users';

select cron.schedule(
    'cleanup-anonymous-users',
    '0 3 1 * *',
    $$
    delete from auth.users
    where is_anonymous = true
      and last_sign_in_at < now() - interval '30 days';
    $$
);

-- ============ 0005_cloud_sync_alignment.sql ============
-- Alignment fixes uncovered while wiring cloud sync (not yet deployed).

-- Applications: the tracker stores notes and uses 'saved' as an initial status.
alter table public.applications add column if not exists notes text;

alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications add constraint applications_status_check
    check (status in ('saved','applied','pending','interview','offer','rejected'));

-- Evidence source: allow ai-suggestion rows surfaced from analysis.
alter table public.evidence drop constraint if exists evidence_source_check;
alter table public.evidence add constraint evidence_source_check
    check (source in ('document','user','ai-suggestion'));

-- ============ 0006_grants.sql ============
-- 0006_grants.sql
-- Re-establish role grants after a public-schema reset.
-- Supabase template ALTER DEFAULT PRIVILEGES only applies to objects created by
-- the original provisioning role; tables/sequences/functions created by the
-- management API (or after a DROP SCHEMA CASCADE) inherit no grants to
-- anon/authenticated/service_role. Grant explicitly for every existing object
-- and set defaults so future objects stay usable by PostgREST + backend workers.

grant usage on schema public to anon, authenticated, service_role;

do $$
declare r record;
begin
  for r in
    select format('%I.%I', schemaname, relname) as fullname
    from pg_stat_user_tables
    where schemaname = 'public'
  loop
    execute format('grant select, insert, update, delete on table %s to anon, authenticated, service_role', r.fullname);
  end loop;

  for r in
    select format('%I.%I', sequence_schema, sequence_name) as fullname
    from information_schema.sequences
    where sequence_schema = 'public'
  loop
    execute format('grant usage, select on sequence %s to anon, authenticated, service_role', r.fullname);
  end loop;

  for r in
    select p.oid, n.nspname as schemaname, p.proname, p.proargtypes
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
  loop
    execute format(
      'grant execute on function %I.%I(%s) to anon, authenticated, service_role',
      r.schemaname,
      r.proname,
      pg_catalog.pg_get_function_identity_arguments(r.oid)
    );
  end loop;
end $$;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;

-- ============ 0007_auth_new_user_trigger.sql ============
-- 0007_auth_new_user_trigger.sql
-- Auto-create a profiles row whenever a Supabase auth user is created (the
-- Supabase template's handle_new_user trigger lives in a schema that was wiped,
-- and our baseline never defined one). RLS helpers (private.is_active) require
-- the profiles row to exist or every read is filtered out.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============ 0008_application_dna.sql ============
-- 0008_application_dna.sql
-- Application DNA (Phase 1): per-application resume variant, ATS snapshot,
-- keyword ledger and genuine score; plus 'saved' as an initial status.

alter table public.applications add column if not exists resume_variant jsonb;
alter table public.applications add column if not exists ats_snapshot jsonb;
alter table public.applications add column if not exists keyword_ledger jsonb;
alter table public.applications add column if not exists genuine_score int;

alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications add constraint applications_status_check
    check (status in ('saved','applied','pending','interview','offer','rejected'));

-- ============ 0009_share_recruiter_view.sql ============
-- 0009_share_recruiter_view.sql
-- Phase 2: mark hosted shares whose ATS score is the heuristic/offline read.

alter table public.shares add column if not exists heuristic_ats boolean default false;
-- ============ 00010_share_referral.sql ============
-- 00010_share_referral.sql
-- Phase 3: optional referral attribution on hosted shares (consent-first, informational only).

alter table public.shares add column if not exists referrer text;
