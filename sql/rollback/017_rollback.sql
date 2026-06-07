-- Rollback for sql/017 — reverts the rag_term_df authenticated read policy/grant + the filtered df.
-- (To fully remove rag_term_df + restore the sql/014 keyword RPC, use sql/rollback/016_rollback.sql.)

begin;

drop policy if exists rag_term_df_admin_read on public.rag_term_df;
revoke select on public.rag_term_df from authenticated;

-- Restore the sql/016 unfiltered df snapshot.
truncate public.rag_term_df;
insert into public.rag_term_df (lexeme, df)
  select word, ndoc from ts_stat('select fts from public.rag_chunks');

commit;
