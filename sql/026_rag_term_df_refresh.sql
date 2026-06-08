-- 026 — auto-refreshable rag_term_df oracle (audit A4 / C4 root; Fase 6).
--
-- WHY: rag_term_df (the keyword-selectivity oracle that keyword_search_chunks uses to drop corpus
-- stopwords and avoid the ts_rank_cd timeout) is a MANUAL snapshot (sql/016/017 TRUNCATE+INSERT). After a
-- bulk ingest it goes stale: new discriminating terms aren't in it (default df=0 = treated rare = kept —
-- safe), but more importantly the df ceilings drift and, with enough corpus growth, a genuinely-common new
-- term keeps a too-low df and the broad-query timeout (which silently killed the keyword lane twice) can
-- return. There was no trigger and no cron. This adds a refresh FUNCTION + a meta row, called by the ingest
-- after each upload (queue-processor), so the oracle tracks the corpus automatically.
--
-- DESIGN: refresh uses DELETE+INSERT (NOT truncate) so concurrent keyword searches are never blocked
-- (TRUNCATE takes ACCESS EXCLUSIVE; DELETE is MVCC — readers see the old snapshot until commit, then the
-- new one, with no empty window). Population is the SAME filter the RPC searches (indexed, non-rejected) —
-- identical to sql/017. SECURITY DEFINER so the service-role API can call it; search_path pinned.
--
-- Additive + idempotent. No retrieval RPC is recreated (NOT the único-dueño migration). The first run is a
-- no-op data-wise (it recomputes the same df the table already holds). Rollback: sql/rollback/026_rollback.sql.

begin;

-- single-row observability: when was the oracle last refreshed, and how many lexemes does it hold.
create table if not exists public.rag_term_df_meta (
  id boolean primary key default true,
  refreshed_at timestamptz not null default now(),
  lexeme_count integer not null default 0,
  constraint rag_term_df_meta_singleton check (id)
);
alter table public.rag_term_df_meta enable row level security;
revoke all on public.rag_term_df_meta from anon;
grant select on public.rag_term_df_meta to authenticated, service_role;
drop policy if exists rag_term_df_meta_admin_read on public.rag_term_df_meta;
create policy rag_term_df_meta_admin_read on public.rag_term_df_meta
  for select to authenticated
  using ((auth.jwt() #>> '{app_metadata,role}') = 'admin');

create or replace function public.refresh_rag_term_df()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  -- recompute df over the RPC's actual search population (indexed, non-rejected) into a temp, then swap
  -- Population MUST match the live keyword RPC's search WHERE exactly (sql/023): indexed, non-rejected,
  -- AND lifecycle<>'superseded'. (Ronda 2: the superseded predicate was added to the RPC in 019/023 but
  -- the manual sql/017 rebuild predates it — recomputing over a superset inflates df and over-drops terms.)
  create temporary table _rag_term_df_new on commit drop as
    select word as lexeme, ndoc as df from ts_stat($q$
      select c.fts
      from public.rag_chunks c
      join public.rag_documents d on d.id = c.document_id
      where d.review_status <> 'rejected'
        and d.classification_source is distinct from 'agent_rejected'
        and d.status = 'indexed'
        and d.lifecycle is distinct from 'superseded'
    $q$);

  -- DELETE+INSERT (not TRUNCATE) → no ACCESS EXCLUSIVE lock; concurrent keyword searches never block.
  delete from public.rag_term_df;
  insert into public.rag_term_df (lexeme, df) select lexeme, df from _rag_term_df_new;

  select count(*) into v_count from public.rag_term_df;
  insert into public.rag_term_df_meta (id, refreshed_at, lexeme_count) values (true, now(), v_count)
    on conflict (id) do update set refreshed_at = excluded.refreshed_at, lexeme_count = excluded.lexeme_count;
  return v_count;
end $$;

revoke execute on function public.refresh_rag_term_df() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.refresh_rag_term_df() from anon, authenticated';
  end if;
end $$;
grant execute on function public.refresh_rag_term_df() to service_role;

commit;
