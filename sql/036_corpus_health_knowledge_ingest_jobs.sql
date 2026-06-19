-- 036 — corpus health: report the durable RAG ingest queue.
--
-- WHY: sql/031 introduced public.knowledge_ingest_jobs as the governed, durable ingestion queue used by
-- SharePoint/local bulk ingestion and the admin retry flow. knowledge_corpus_health() still reported the
-- legacy ingest_queue table, so the documents dashboard showed stale queue totals after the 2026-06-19
-- SharePoint ingestion.
--
-- FIX: keep the lifecycle-aware document aggregates from sql/030 and switch only the `queue` block to
-- public.knowledge_ingest_jobs. Add `canceled` because this is a valid terminal state in the new queue.
-- Same RPC name and auth model; re-assert grants below. Rollback: sql/rollback/036_rollback.sql.

create or replace function knowledge_corpus_health()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'docs', (select jsonb_build_object(
      'total', count(*),
      'approved', count(*) filter (where review_status='approved' and status='indexed' and lifecycle is distinct from 'superseded'),
      'needs_review', count(*) filter (where review_status='needs_review' and status='indexed' and lifecycle is distinct from 'superseded'),
      'rejected', count(*) filter (where review_status='rejected' and status='indexed' and lifecycle is distinct from 'superseded'),
      'pending', count(*) filter (where review_status='pending' and status='indexed' and lifecycle is distinct from 'superseded'),
      'retired', count(*) filter (where status='retired'),
      'source_of_record', count(*) filter (where status='indexed' and lifecycle is distinct from 'superseded' and authority_score>=90 and review_status='approved'
                                            and classification_source in ('human','agent_reviewed','agent_corrected')),
      'source_of_record_eligible', count(*) filter (where status='indexed' and lifecycle is distinct from 'superseded' and authority_score>=90 and review_status='approved'),
      'source_of_record_pct', round(
        count(*) filter (where status='indexed' and lifecycle is distinct from 'superseded' and authority_score>=90 and review_status='approved'
                          and classification_source in ('human','agent_reviewed','agent_corrected'))::numeric
        / nullif(count(*) filter (where status='indexed' and lifecycle is distinct from 'superseded' and authority_score>=90 and review_status='approved'), 0), 4),
      'authority_sum', coalesce(sum(authority_score) filter (where status='indexed' and lifecycle is distinct from 'superseded'), 0),
      'authority_count', count(*) filter (where status='indexed' and lifecycle is distinct from 'superseded'),
      'with_markdown', count(*) filter (where md_path is not null),
      'with_source_hash', count(*) filter (where source_hash is not null)
    ) from rag_documents),
    'queue', (select jsonb_build_object(
      'total', count(*),
      'queued', count(*) filter (where status='queued'),
      'processing', count(*) filter (where status='processing'),
      'done', count(*) filter (where status='done'),
      'error', count(*) filter (where status='error'),
      'canceled', count(*) filter (where status='canceled')
    ) from knowledge_ingest_jobs)
  );
$$;

revoke execute on function knowledge_corpus_health() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function knowledge_corpus_health() from anon, authenticated';
    execute 'grant execute on function knowledge_corpus_health() to service_role';
  end if;
end $$;
