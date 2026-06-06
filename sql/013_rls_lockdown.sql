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

-- 1. Tables: RLS + authenticated-only policy + revoke anon table grants (defense-in-depth).
do $$
declare t record; p record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t.tablename loop
      execute format('drop policy %I on public.%I', p.policyname, t.tablename);
    end loop;
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t.tablename || '_authenticated_all', t.tablename);
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

-- 3. Functions: anon executes nothing in public; grant back only the two read RPCs the browser may need.
--    (R2-F2: get_fact_evidence/get_metric_candidates/get_portfolio_kpis + others were anon-executable.)
--    The write RPC apply_document_governance + knowledge_corpus_health stay service_role-only (B's lockdown).
revoke execute on all functions in schema public from anon;
grant execute on function public.match_chunks(vector, integer, text, text, double precision) to authenticated;
grant execute on function public.keyword_search_chunks(text, text, integer, text) to authenticated;
