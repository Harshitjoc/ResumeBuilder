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