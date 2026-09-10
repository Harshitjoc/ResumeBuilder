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