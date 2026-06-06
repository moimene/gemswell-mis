-- C1 cutover ONLY. Replaces the permissive open_all (USING(true) to public) policies on every
-- public table with an authenticated-only policy. anon is then denied (RLS on, no anon policy).
-- service_role bypasses RLS, so the API routes keep working. DO NOT run during dev — it instantly
-- breaks the currently-anon app. Run at cutover, right after deploying the auth-enabled app.
do $$
declare t record; p record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t.tablename loop
      execute format('drop policy %I on public.%I', p.policyname, t.tablename);
    end loop;
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t.tablename || '_authenticated_all', t.tablename);
  end loop;
end $$;

-- read RPCs callable by authenticated (browser-direct, defensive); write RPC stays service_role-only.
grant execute on function public.match_chunks(vector, integer, text, text, double precision) to authenticated;
grant execute on function public.keyword_search_chunks(text, text, integer, text) to authenticated;
revoke execute on function public.match_chunks(vector, integer, text, text, double precision) from anon;
revoke execute on function public.keyword_search_chunks(text, text, integer, text) from anon;
