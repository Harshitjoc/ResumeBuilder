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