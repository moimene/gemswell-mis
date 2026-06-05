-- 010_governance_rpcs.sql — Spec B adversarial-review fixes (applied as `governance_action_and_health_rpcs`).
--
-- F1: apply_document_governance() — atomic governance action (primary patch + optional related/superseded
--     patch + audit events) in ONE transaction, with optimistic version check + double-supersede guard.
--     Replaces the route's 3 separate non-transactional writes (split-brain risk found by the review swarm).
-- F6: knowledge_corpus_health() — single-query corpus health; status='indexed'-scoped source_of_record;
--     replaces 9 head-counts + a full 5.5k authority scan + a full ingest_queue scan (perf + count fidelity).

create or replace function apply_document_governance(
  p_doc_id uuid,
  p_patch jsonb default '{}'::jsonb,
  p_expected_version integer default null,
  p_related_id uuid default null,
  p_related_patch jsonb default '{}'::jsonb,
  p_events jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cur_version integer;
  v_existing uuid;
begin
  select current_version into v_cur_version from rag_documents where id = p_doc_id for update;
  if not found then
    raise exception 'document % not found', p_doc_id using errcode = 'P0002';
  end if;
  if p_expected_version is not null and v_cur_version is distinct from p_expected_version then
    raise exception 'version conflict on % (expected %, found %)', p_doc_id, p_expected_version, v_cur_version using errcode = '40001';
  end if;

  if p_related_id is not null then
    if p_related_id = p_doc_id then
      raise exception 'a document cannot supersede itself' using errcode = '22023';
    end if;
    perform 1 from rag_documents where id = p_related_id for update;
    if not found then
      raise exception 'superseded document % not found', p_related_id using errcode = 'P0002';
    end if;
    select id into v_existing from rag_documents where supersedes_document_id = p_related_id and id <> p_doc_id limit 1;
    if v_existing is not null then
      raise exception 'document % already superseded by %', p_related_id, v_existing using errcode = '23505';
    end if;
  end if;

  update rag_documents set
    review_status          = coalesce((p_patch->>'review_status')::review_status_enum, review_status),
    classification_source  = coalesce((p_patch->>'classification_source')::classification_source_enum, classification_source),
    status                 = coalesce(p_patch->>'status', status),
    doc_type               = coalesce(p_patch->>'doc_type', doc_type),
    project_id             = coalesce(p_patch->>'project_id', project_id),
    period                 = coalesce(p_patch->>'period', period),
    lifecycle              = coalesce((p_patch->>'lifecycle')::lifecycle_enum, lifecycle),
    authority_tier         = coalesce((p_patch->>'authority_tier')::authority_tier_enum, authority_tier),
    authority_score        = coalesce((p_patch->>'authority_score')::integer, authority_score),
    supersedes_document_id = coalesce((p_patch->>'supersedes_document_id')::uuid, supersedes_document_id),
    current_version        = coalesce((p_patch->>'current_version')::integer, current_version)
  where id = p_doc_id;

  if p_related_id is not null and p_related_patch is not null and p_related_patch <> '{}'::jsonb then
    update rag_documents set
      status    = coalesce(p_related_patch->>'status', status),
      lifecycle = coalesce((p_related_patch->>'lifecycle')::lifecycle_enum, lifecycle)
    where id = p_related_id;
  end if;

  if p_events is not null and jsonb_array_length(p_events) > 0 then
    insert into rag_document_events (document_id, action, field, old_value, new_value, actor, reason)
    select (e->>'document_id')::uuid, e->>'action', e->>'field', e->>'old_value', e->>'new_value',
           coalesce(e->>'actor','admin:console'), e->>'reason'
    from jsonb_array_elements(p_events) as e;
  end if;

  return jsonb_build_object('ok', true, 'document_id', p_doc_id,
    'version', (select current_version from rag_documents where id = p_doc_id));
end $$;

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
      'rejected', count(*) filter (where review_status='rejected'),
      'pending', count(*) filter (where review_status='pending'),
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
