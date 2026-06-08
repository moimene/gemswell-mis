-- Rollback for sql/022 — restore the sql/011 knowledge_corpus_health() (without source_of_record_eligible/_pct).
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
      'approved', count(*) filter (where review_status='approved' and status='indexed'),
      'needs_review', count(*) filter (where review_status='needs_review' and status='indexed'),
      'rejected', count(*) filter (where review_status='rejected' and status='indexed'),
      'pending', count(*) filter (where review_status='pending' and status='indexed'),
      'retired', count(*) filter (where status='retired'),
      'source_of_record', count(*) filter (where status='indexed' and authority_score>=90 and review_status='approved'
                                            and classification_source in ('human','agent_reviewed','agent_corrected')),
      'authority_sum', coalesce(sum(authority_score) filter (where status='indexed'), 0),
      'authority_count', count(*) filter (where status='indexed'),
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
