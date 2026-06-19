-- 031 — durable browser-upload ingest jobs.
--
-- WHY: /admin/ingest needs product-grade ingestion: quick handoff after the raw file reaches Storage,
-- observable processing state, manual retry, and cron/worker execution. `rag_documents` is the governed
-- corpus; this table is the operational upload-job ledger that points at the raw Storage object.
--
-- RISK: low/moderate — additive table only. Existing synchronous /api/knowledge/upload remains available.
-- Apply before enabling /api/cron/ingest-jobs in Vercel. Rollback: sql/rollback/031_rollback.sql.

begin;

create table if not exists public.knowledge_ingest_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  lease_expires_at timestamptz,

  status text not null default 'queued'
    check (status in ('queued', 'processing', 'done', 'error', 'canceled')),
  stage text not null default 'queued',
  attempts smallint not null default 0,
  max_attempts smallint not null default 3,

  storage_bucket text not null default 'documents',
  storage_path text not null,
  file_name text not null,
  file_ext text not null,
  file_size bigint,
  project_id text,
  doc_type_hint text,
  source_channel text not null default 'browser_upload',

  document_id uuid references public.rag_documents(id) on delete set null,
  chunks integer,
  parser text,
  error_message text,
  requested_by text
);

create index if not exists idx_knowledge_ingest_jobs_status_queue
  on public.knowledge_ingest_jobs(status, queued_at);

create index if not exists idx_knowledge_ingest_jobs_document_id
  on public.knowledge_ingest_jobs(document_id);

alter table public.knowledge_ingest_jobs enable row level security;

drop policy if exists knowledge_ingest_jobs_admin_all on public.knowledge_ingest_jobs;
create policy knowledge_ingest_jobs_admin_all on public.knowledge_ingest_jobs
  for all to authenticated
  using ((auth.jwt() #>> '{app_metadata,role}') = 'admin')
  with check ((auth.jwt() #>> '{app_metadata,role}') = 'admin');

create or replace function public.set_knowledge_ingest_jobs_updated_at()
returns trigger
language plpgsql
set search_path = ''   -- pin search_path (Supabase advisor 0011); now() resolves from the always-present pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_knowledge_ingest_jobs_updated_at on public.knowledge_ingest_jobs;
create trigger trg_knowledge_ingest_jobs_updated_at
before update on public.knowledge_ingest_jobs
for each row execute function public.set_knowledge_ingest_jobs_updated_at();

revoke execute on function public.set_knowledge_ingest_jobs_updated_at() from public, anon, authenticated;

comment on table public.knowledge_ingest_jobs is
  'Operational ledger for durable browser-upload ingestion. Raw bytes live in Storage; completed jobs link to rag_documents.';

create or replace function public.claim_knowledge_ingest_job(p_lease_seconds integer default 7200)
returns setof public.knowledge_ingest_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.knowledge_ingest_jobs%rowtype;
begin
  update public.knowledge_ingest_jobs
     set status = 'queued',
         stage = 'retry_wait',
         queued_at = now(),
         lease_expires_at = null,
         error_message = 'Lease expired; requeued'
   where status = 'processing'
     and lease_expires_at < now()
     and attempts < max_attempts;

  update public.knowledge_ingest_jobs
     set status = 'error',
         stage = 'error',
         finished_at = now(),
         lease_expires_at = null,
         error_message = 'Lease expired after final attempt'
   where status = 'processing'
     and lease_expires_at < now()
     and attempts >= max_attempts;

  update public.knowledge_ingest_jobs
     set status = 'error',
         stage = 'error',
         finished_at = now(),
         lease_expires_at = null,
         error_message = coalesce(error_message, 'Retry ceiling reached')
   where status = 'queued'
     and attempts >= max_attempts;

  select *
    into v_job
    from public.knowledge_ingest_jobs
   where status = 'queued'
     and attempts < max_attempts
     and queued_at <= now()
   order by queued_at asc
   for update skip locked
   limit 1;

  if not found then
    return;
  end if;

  update public.knowledge_ingest_jobs
     set status = 'processing',
         stage = 'processing',
         attempts = attempts + 1,
         started_at = now(),
         finished_at = null,
         lease_expires_at = now() + make_interval(secs => greatest(coalesce(p_lease_seconds, 1200), 60)),
         error_message = null
   where id = v_job.id
   returning * into v_job;

  return next v_job;
end;
$$;

revoke execute on function public.claim_knowledge_ingest_job(integer) from public, anon, authenticated;
grant execute on function public.claim_knowledge_ingest_job(integer) to service_role;

revoke all on public.knowledge_ingest_jobs from anon;
grant select, insert, update on public.knowledge_ingest_jobs to authenticated;
grant all on public.knowledge_ingest_jobs to service_role;

commit;
