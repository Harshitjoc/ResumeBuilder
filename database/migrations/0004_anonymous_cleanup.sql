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