-- 017 — rag_term_df RLS consistency + filtered df rebuild (Codex review fixes on top of sql/016).
--
-- WHY:
--  (1) sql/016 enabled RLS on rag_term_df but added NO authenticated policy and granted SELECT only to
--      service_role. keyword_search_chunks is SECURITY INVOKER and granted to authenticated (per 013);
--      an authenticated-ADMIN call would therefore read 0 rows from rag_term_df (RLS deny) → every term
--      scores df=0 → no df filtering → the broad-query timeout could return for that path. (The /api/chat
--      path uses service_role, which bypasses RLS, so it is unaffected — but this restores consistency
--      with the 013 model so a direct authenticated-admin RPC call behaves the same.)
--  (2) sql/016 populated rag_term_df from ALL rag_chunks, but the RPC only searches indexed, non-rejected
--      docs. Rejected/non-indexed chunks could inflate df and wrongly drop useful terms. Rebuild df over
--      the SAME population the RPC queries. (Currently near-zero drift — no 'rejected' docs, all indexed —
--      but correct + future-proof.)
--
-- Additive + idempotent. Rollback: sql/rollback/017_rollback.sql (and sql/rollback/016_rollback.sql drops
-- the table entirely).

begin;

-- (1) Match the 013 corpus pattern: RLS gated on the admin claim for authenticated; service_role bypasses.
grant select on public.rag_term_df to authenticated;
drop policy if exists rag_term_df_admin_read on public.rag_term_df;
create policy rag_term_df_admin_read on public.rag_term_df
  for select to authenticated
  using ((auth.jwt() #>> '{app_metadata,role}') = 'admin');

-- (2) Rebuild df over the RPC's actual search population (indexed, non-rejected).
truncate public.rag_term_df;
insert into public.rag_term_df (lexeme, df)
  select word, ndoc from ts_stat($q$
    select c.fts
    from public.rag_chunks c
    join public.rag_documents d on d.id = c.document_id
    where d.review_status <> 'rejected'
      and d.classification_source is distinct from 'agent_rejected'
      and d.status = 'indexed'
  $q$);

commit;
