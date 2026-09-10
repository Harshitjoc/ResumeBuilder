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
-- profiles.role
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists role text not null default 'user'
    check (role in ('user','admin','banned'));

create index if not exists idx_profiles_role on public.profiles (role);

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