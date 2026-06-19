-- Rollback for sql/036 — restore the sql/030 lifecycle-aware RPC with legacy ingest_queue metrics.

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
      'error', count(*) filter (where status='error')
    ) from ingest_queue)
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
