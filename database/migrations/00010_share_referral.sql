-- 00010_share_referral.sql
-- Phase 3: optional referral attribution on hosted shares (consent-first, informational only).

alter table public.shares add column if not exists referrer text;