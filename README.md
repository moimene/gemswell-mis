# Gemswell MIS

Management Information System for the Gemswell Ventures wave-park portfolio (Madrid Playa Surf · Birmingham). A four-layer system over a governed document corpus:

1. **Corpus** — `rag_documents` (5,498) + `rag_chunks` (156,898, pgvector) with real governance (authority tier, review status, classification source).
2. **RAG chat** — `/api/chat`: vector search → Cohere rerank → trust-tier ranking → Claude (`claude-sonnet-4`) with a verifier pass and source citations.
3. **Extraction** — `intel_metric_*` candidates, human review (`/admin/review`), pack grounding (`/admin/packs`), governed document manager (`/admin/documents`).
4. **Reporting** — CEO dashboard (`/`) + domain pages (portfolio, funding, pricing, commercial, risks, critical-path, readiness, BP & budget, decisions).

## Stack

Next.js 16 (App Router, `src/app`; **middleware is `src/proxy.ts`** — the Next 16 rename) · Supabase Postgres + pgvector · Tailwind · Anthropic / Cohere / Google AI · deployed on Vercel (push to `main` auto-deploys).

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (expect "ƒ Proxy (Middleware)")
npm test         # vitest
npm run lint     # eslint
```

## Environment (`.env.local`)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` (chat), `COHERE_API_KEY` (rerank), `GOOGLE_AI_API_KEY` (embeddings). `DMS_ROOT` is local-only (ingest). See the cutover runbook for the full production env list.

## Auth & cutover

Admin-only access (Supabase Auth, `app_metadata.role === 'admin'`). The auth layer ships **dormant**: the proxy guards routes and `sql/013` locks RLS, but `013` is applied only at the **cutover** — until then the live corpus is anon-open by design. Follow `docs/superpowers/specs/2026-06-06-auth-rls-C1-cutover-runbook.md` to seed admins, deploy, and lock down the DB.
