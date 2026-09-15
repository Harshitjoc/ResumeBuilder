-- ============ 0009_share_recruiter_view.sql ============
-- Phase 2: hosted share links may carry a flag saying the ATS score is the
-- heuristic/offline read, so the recruiter view can label the score origin.
-- Idempotent over the live database.

alter table public.shares add column if not exists heuristic_ats boolean default false;