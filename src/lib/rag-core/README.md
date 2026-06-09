# @teras/rag-core

Provider-agnostic RAG primitives shared by **Gemswell MIS** and **MDL Patrimonio**. Pure TypeScript,
zero runtime dependencies, **no Supabase / RPC / DB / governance-enum coupling**. Everything app-specific
(governance→trust mapping, RPC names, embedding model, dimensionality) is **injected by the host app**.

This is the Fase 8 (WS7-T4..T8) convergence core. The two apps live in separate repos with no shared
workspace, so "shared" means: this directory is the single source of truth, copied/vendored into MDL (or
later published) — kept dependency-free precisely so that copy is trivial and safe.

## Modules (extracted so far — behaviour-identical, gated by the host apps' unchanged tests)

- **`injection.ts`** — prompt-injection hardening (`scanForInjection`, `wrapUntrustedContent`). Fully
  universal: chunk bodies are untrusted input in both apps. Shared **verbatim** (no parametrization
  needed). Gemswell re-exports it from `src/lib/rag/injection.ts`; MDL should import it directly.
- **`rank.ts`** — the universal trust-ranking *algorithm* (`rankBySourceTrust(chunks, trustTier,
  approvedRank)`): tier desc → approved desc → relevance desc → stable. The `trustTier`/`approvedRank`
  mappers are **injected** because Gemswell and MDL have different governance models. Gemswell wires its
  mapping in `src/lib/rag/rank.ts` (verificationFromGovernance + tier order); MDL wires its own.

## Injection contract (what a host app must provide)

```ts
import { rankBySourceTrust, type TrustTierFn, type ApprovedRankFn } from '@teras/rag-core/rank'

const trustTier: TrustTierFn = (metadata) => /* app governance → 0..N */
const approvedRank: ApprovedRankFn = (metadata) => /* secondary key, higher = preferred */
const ranked = rankBySourceTrust(chunks, trustTier, approvedRank)
```

## NOT yet extracted (staged — they touch the live chat retrieval path; need the eval harness to prove
non-regression, so they are deliberately NOT ripped out blind):

- **`retrieve.ts`** (hybrid vector+keyword retrieve) — heavily RPC-coupled (`match_chunks`,
  `keyword_search_chunks`). Parametrizing the RPC names + governance filter (WS7-T8) is the único-dueño
  retrieval path; do it behind the eval gate (`npm run eval:*`, degraded must stay 0), never blind.
- **verifier**, **rerank** (Cohere), **chunking/embeddings** — extract next, each behind the eval gate.

## Embedding pin (WS7-T1, `docs/embedding-pin-decision.md`)

The core never assumes cross-app vector compatibility: Gemswell pins `gemini-embedding-001` (768d), MDL
pins `gemini-embedding-2-preview` (768d). These are **not interoperable** — never share a vector corpus
across apps without a full re-embed. The embedding model + dims are injected, never hardcoded in core.
