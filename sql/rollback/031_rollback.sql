begin;

drop function if exists public.claim_knowledge_ingest_job(integer);
drop trigger if exists trg_knowledge_ingest_jobs_updated_at on public.knowledge_ingest_jobs;
drop function if exists public.set_knowledge_ingest_jobs_updated_at();
drop table if exists public.knowledge_ingest_jobs;

commit;
