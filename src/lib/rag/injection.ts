// Prompt-injection hardening — moved to the provider-agnostic @teras/rag-core (Fase 8 WS7-T5).
// This module is fully pure (no governance/RPC/DB coupling), so it is shared verbatim between
// Gemswell and MDL. This file is a thin re-export to keep every existing call site unchanged.
export * from '@/lib/rag-core/injection'
