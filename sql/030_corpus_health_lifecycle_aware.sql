-- 030 — corpus health: make the governance counts LIFECYCLE-AWARE (exclude superseded).
--
-- WHY: knowledge_corpus_health() filters every governance count by `status='indexed'` but NOT by
-- lifecycle, so docs that were superseded (legacy dedup, sql/028 — out of retrieval; the sql/023 RPCs
-- already exclude lifecycle='superseded' from chat) STILL inflate needs_review / approved /
-- source_of_record. After the F6 dedup (mutation #16, 1,962 superseded) the live metric reads
-- needs_review=1,476 when the EFFECTIVE active backlog is ~188; approved 4,023 vs 3,339 active;
-- source_of_record 1,040 vs 829 active. The superseded docs are byte-exact dup copies (their canonical
-- survives + is still counted) + zero-chunk dead weight — counting them is simply a metric bug.
--
-- FIX: add `and lifecycle is distinct from 'superseded'` to each governance filter (approved,
-- needs_review, rejected, pending, source_of_record, source_of_record_eligible, _pct, authority_sum,
-- authority_count). Body is otherwise VERBATIM from sql/022. `total` stays whole-corpus (it is "total
-- docs", not a governance count); `retired` keys off status; `with_markdown`/`with_source_hash` and the
-- `queue` block are unchanged. Additive-safe: same keys, same shape; only the predicates tighten.
-- `create or replace` preserves grants (re-asserted below). Rollback: sql/rollback/030_rollback.sql
-- (restores sql/022 body verbatim).

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
