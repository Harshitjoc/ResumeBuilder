-- ============ 0008_application_dna.sql ============
-- Application DNA (Phase 1): per-application resume snapshot + ATS snapshot +
-- keyword ledger + genuine score at time of application, and an initial
-- 'saved' status used by the tracker before the user marks an application as
-- submitted. Idempotent so it can be applied over the live database.
--
-- Mirror of what was already applied manually to the nknhmztsshosmunfpbip
-- project (see schema.sql for the canonical table definition).

alter table public.applications add column if not exists resume_variant jsonb;
alter table public.applications add column if not exists ats_snapshot jsonb;
alter table public.applications add column if not exists keyword_ledger jsonb;
alter table public.applications add column if not exists genuine_score int;

alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications add constraint applications_status_check
    check (status in ('saved','applied','pending','interview','offer','rejected'));