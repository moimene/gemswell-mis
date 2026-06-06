-- C1 cutover ONLY. Locks the confidential corpus to authenticated-only across TABLES, VIEWS, and
-- FUNCTIONS, and revokes anon grants (defense-in-depth). anon is then denied; service_role bypasses RLS
-- (API routes keep working); authenticated (logged-in browser + API after the session check) has full access.
--
-- The security review (R2) found a table-only lockdown was INSUFFICIENT: 8 public views were
-- security_invoker=false (run as owner → bypass RLS) and several functions were anon-EXECUTE-able, so the
-- corpus stayed world-readable via PostgREST. Sections 2+3 close those.
--
-- DO NOT run during dev — it instantly breaks the currently-anon app. Run at CUTOVER, right after
-- deploying the auth-enabled app. Verified via a `begin … rollback` probe (anon→0 rows on tables AND views).

-- Run as ONE transaction (paste the whole file into the Supabase SQL Editor). If anything fails,
-- nothing applies — you never end up with a half-locked DB. (If applying via MCP apply_migration,
-- which already wraps in a transaction, drop the outer begin/commit.)
begin;

-- 1. Tables: RLS + authenticated-only policy + revoke anon table grants (defense-in-depth).
do $$
declare t record; p record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t.tablename loop
      execute format('drop policy %I on public.%I', p.policyname, t.tablename);
    end loop;
    execute format('alter table public.%I enable row level security', t.tablename);
    -- CX-1: gate on the admin CLAIM, not bare `authenticated` — a stray self-signup (authenticated but
    -- no app_metadata.role=admin) gets nothing. service_role bypasses RLS, so API routes still work.
    execute format($f$create policy %I on public.%I for all to authenticated
      using ((auth.jwt() #>> '{app_metadata,role}') = 'admin')
      with check ((auth.jwt() #>> '{app_metadata,role}') = 'admin')$f$,
      t.tablename || '_admin_all', t.tablename);
    execute format('revoke all on public.%I from anon', t.tablename);
  end loop;
end $$;

-- 2. Views (+ materialized): regular views run as the CALLER (security_invoker) so underlying-table RLS
--    applies through them; revoke anon SELECT on all. (R2-F1: non-invoker views bypassed RLS for anon.)
do $$
declare v record;
begin
  for v in
    select c.relname, c.relkind
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v', 'm')
  loop
    if v.relkind = 'v' then
      execute format('alter view public.%I set (security_invoker = true)', v.relname);
    end if;
    execute format('revoke all on public.%I from anon', v.relname);
  end loop;
end $$;

-- 3. Functions: revoke EXECUTE from anon AND public (CX-2: functions default EXECUTE to PUBLIC, so a
--    revoke-from-anon-only is a no-op). Future functions too. Grant back only the two read RPCs.
--    SECURITY DEFINER write RPCs (apply_document_governance, knowledge_corpus_health) stay
--    service_role-only (granted explicitly in 011). The read RPCs are SECURITY INVOKER, so they already
--    respect the new table RLS.
revoke execute on all functions in schema public from anon, public;
alter default privileges in schema public revoke execute on functions from public;
-- PRE-FLIGHT BLOCKER FIX: the server calls these RPCs as `service_role` (createApiClient in
-- /api/chat), and service_role inherits function EXECUTE only via PUBLIC — which the revoke above
-- just stripped. Without the service_role grant, every /api/chat returns 42501 permission denied.
-- Grant to authenticated (direct browser calls, if any) AND service_role (the API path).
grant execute on function public.match_chunks(vector, integer, text, text, double precision) to authenticated, service_role;
grant execute on function public.keyword_search_chunks(text, text, integer, text) to authenticated, service_role;

commit;
