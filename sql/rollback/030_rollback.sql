-- 022 — corpus health: expose source_of_record_eligible + _pct (audit C2 measurement / Fase 4 WS3-T6).
--
-- knowledge_corpus_health() already returns `source_of_record` (docs that ARE official). This adds:
--   * source_of_record_eligible — docs that COULD be endorsed (authority>=90 ∧ approved ∧ indexed) = the 797;
--   * source_of_record_pct — source_of_record / eligible (0.0..1.0), the progress toward closing C2.
-- Body is VERBATIM from sql/011 (security definer + search_path + every existing key) — ONLY the two new
-- keys are added inside the 'docs' object. Additive + backward-compatible (extra jsonb keys ignored by old
-- callers). `create or replace` preserves the existing EXECUTE grants (revoked from public, granted to
-- service_role in sql/011); re-asserted here for safety. Rollback: sql/rollback/022_rollback.sql.

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
      -- NEW (022): the pool that COULD become official (one endorse away), and the progress ratio.
      'source_of_record_eligible', count(*) filter (where status='indexed' and authority_score>=90 and review_status='approved'),
      'source_of_record_pct', round(
        count(*) filter (where status='indexed' and authority_score>=90 and review_status='approved'
                          and classification_source in ('human','agent_reviewed','agent_corrected'))::numeric
        / nullif(count(*) filter (where status='indexed' and authority_score>=90 and review_status='approved'), 0), 4),
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
