-- 037 — allow OpenAI as chat primary provider provenance.
-- 035 originally allowed only anthropic/gemini. OpenAI is now the primary path, so the
-- provider check must accept it before assistant-message metadata can be persisted.

alter table public.rag_messages
  drop constraint if exists rag_messages_provider_check;

alter table public.rag_messages
  add constraint rag_messages_provider_check
  check (provider is null or provider in ('openai', 'anthropic', 'gemini'));

comment on column public.rag_messages.provider is
  'LLM provider that generated an assistant message: openai, anthropic or gemini. NULL for legacy/user rows.';
