-- Rollback for sql/026 — drop the refresh function + meta table. rag_term_df itself is untouched
-- (it keeps its current contents; refresh just stops being automatic, reverting to manual sql/017 rebuild).
begin;
drop function if exists public.refresh_rag_term_df();
drop table if exists public.rag_term_df_meta;
commit;
