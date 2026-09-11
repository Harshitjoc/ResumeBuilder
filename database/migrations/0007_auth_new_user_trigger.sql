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