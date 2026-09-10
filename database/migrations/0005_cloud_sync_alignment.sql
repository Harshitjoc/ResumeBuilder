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