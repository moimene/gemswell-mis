# Embedding pin decision — WS7-T1 (Fase 8, convergence gate)

**Date:** 2026-06-08 · **Status:** DECIDED (empirical) · **Owner:** autonomous run (Opus 4.8)
**Evidence:** `scripts/experiments/embedding-compat.mjs` → `scripts/experiments/embedding-compat-result.json` (read-only; ~54 single-text REST `embedContent` calls; no DB, no prod writes).
**Adversarial review:** 2 independent opus reviewers (methodology + decision correctness), both SOUND-WITH-NITS; every nit folded into this version (see "What the experiment can and cannot show").

## Question
Is a corpus embedded with **`gemini-embedding-001`** (Gemswell prod, 768-dim) cross-compatible with **`gemini-embedding-2`** / **`gemini-embedding-2-preview`** — i.e. could Gemswell and MDL ever share one vector corpus, or query each other's vectors, **without a full re-embed**? This gates the `@teras/rag-core` convergence (WS7-T4..T8): a shared core over a shared corpus is only safe if the vector spaces are interoperable under drop-in reuse.

The decisive metric is **not** "do the two models give similar vectors for the same text?" A uniform rotation between two spaces would preserve nearest-neighbour ranking while destroying same-text cosine. What matters for a shared corpus is whether the **nearest-neighbour structure survives** when a corpus embedded with model A is queried with a vector from model B. So the retrieval-interop metric is the decider; same-text cosine and within-model quality are context.

## Method
Bilingual ES/EN financial micro-corpus matching the Gemswell domain: 6 query→target pairs + 6 distractors (12-doc corpus). All texts embedded with each model at `outputDimensionality=768` (prod parity; all three returned 768). Metrics: (A) same-text cross-model cosine; (B) within-model retrieval (sanity); (C) **interop** — corpus embedded with `001`, queried with `001` (native baseline) vs with `2` (the shared-corpus scenario), comparing top-1, nDCG@5, Spearman, and target-rank drop; plus a direct `2-preview`↔`2` equivalence probe.

## Results (hard numbers, from the artifact)

| Metric | `001` (prod) | `2-preview` | `2` (GA) |
|---|---|---|---|
| Within-model retrieval — top-1 / nDCG@5 (trivial harness) | 1.00 / 1.00 | 1.00 / 1.00 | 1.00 / 1.00 |
| Same-text cosine `001`↔model — mean / min / max | — | **0.008 / −0.054 / 0.076** | 0.008 / −0.054 / 0.076 |
| **Interop** (corpus-`001`, query-model) — top-1 / nDCG@5 | 1.00 / 1.00 *(native baseline)* | **0.17 / 0.24** | **0.17 / 0.24** |
| Interop — mean target-rank drop (of 12) | — | **+6.2** (rank 1 → 8–10) | +6.2 |
| `2-preview` ↔ `2` same-text cosine — mean / min / max | — | — | **1.000000 / 1.0 / 1.0** |

**The load-bearing result is the interop collapse:** with the corpus embedded by `001`, switching only the *query* embedder to `2` drops top-1 from 1.00 to 0.17 — concretely, **5 of 6 target docs fall from rank 1 to ranks 8–10 of 12 (bottom third)**. (Spearman vs native is −0.07, but with n=6 its SE ≈ 0.12, so that number is statistically indistinguishable from zero — read it as "no rank correlation," not as a precise finding. The point estimate top-1 = 0.17 is likewise "1 of 6 survived"; the robust claim is the consistent fall-to-bottom, not the precise fraction.)

## Findings
1. **`001` and `2` are not interoperable under drop-in reuse.** Querying the `001` corpus with `2` vectors collapses retrieval (5/6 targets fall to the bottom third; native top-1 1.00 → 0.17). A shared corpus or cross-model query **without re-embed silently destroys** retrieval — exactly the C4-style degradation this run exists to prevent. Same-text cosine is near zero (0.008), consistent with unrelated bases. *Scope caveat:* this proves incompatibility under **naive reuse only**; we did **not** test whether a learned linear/affine alignment (Procrustes) could bridge the two 768-spaces. The decision is about drop-in reuse, which is the only thing convergence would actually do.
2. **Each model retrieves correctly on its own** (within-model top-1 = nDCG@5 = 1.00). This harness is deliberately trivial (distractors are off-topic), so it proves only "no model is broken" — it does **not** rank model *quality* and is **saturated** (no headroom to detect `2` being better than `001`). So this experiment can show incompatibility; it has **zero power** to show a `001→2` quality upgrade.
3. **`gemini-embedding-2-preview` ≡ `gemini-embedding-2`** — same-text cosine 1.000000 (min/max 1.0) across all texts. The preview tag is an alias of the GA model.

## Decision
1. **Pin per app. Gemswell stays on `gemini-embedding-001`.** The 156,898-chunk corpus is `001`; it stays `001`.
2. **Never share a corpus or cross-query across embedding models without a full re-embed to the same model.** No "common corpus" between Gemswell and MDL. The `@teras/rag-core` convergence is therefore **shared code over per-app corpora**, with the embedding model (and dims) injected — never a shared vector store.
3. **Enforce query/corpus model agreement — and note it is NOT enforced today.** `rag_chunks.embedding_model` (sql/025, live; 156,898 = `gemini-embedding-001`) is provenance, but **the retrieval path does not check it**: `match_chunks` (019, live) has no `embedding_model` predicate and takes a bare `vector` with no dim constraint; `retrieve.ts` passes no model id; `EMBEDDING_MODEL` is read only at *ingest write* (queue-processor.ts:376). Today a single-model corpus is preserved **only by convention** (one ingest path, one `EMBEDDING_MODEL` constant). Concrete follow-up (Fase 6/8): add a `filter_embedding_model` arg to `match_chunks`/`keyword_search_chunks` (defaults to the corpus model, rejects mismatch) — under the ÚNICO-DUEÑO-DE-RPC rule this rides on the next 023-class recreation, not a separate one — plus a CI/migration invariant that `select distinct embedding_model from rag_chunks` is single-valued.
4. **If `2` is ever adopted, pin the GA `gemini-embedding-2`, never the `-preview` alias** in prod.

## What the shared core must parametrize (convergence blockers beyond the model)
The embedding model is necessary but not sufficient. The shared `@teras/rag-core` must also parametrize / account for:
- **Vector dimensionality** — prod hardcodes `DIMENSIONS = 768` and hard-asserts it (`assertEmbeddingDimensions`, embeddings.ts:91-97). A model with native dims ≠ 768 (or a different MRL truncation target) breaks the assert *and* the column type.
- **Column + HNSW index** — `rag_chunks.embedding vector(768)` and its HNSW index are built for the `001`/768 corpus. A re-embed at a different dim is a **column-type change + full index rebuild**, not just a re-embed. (`001→2` happens to stay 768, so it's "only" a re-embed — a coincidence of the chosen dim, not a property of the design.)
- **RPC names + governance predicate** — differ between Gemswell and MDL schemas (already flagged in plan WS7-T4..T8); orthogonal to the embedding pin but real convergence blockers.
- **Rerank (Cohere)** — space-agnostic to the embedding model, so it does **not** block convergence; called out only so the "what's shared" audit is complete.

## Consequence for the rest of Fase 8
- A Gemswell migration `001 → 2` is **possible but OPTIONAL and deferred on cost/risk grounds, not because `2` was shown to be no better** (this harness is saturated and cannot compare quality). It would require re-embedding all 156,898 chunks — a planned, gated, budgeted batch, never ad hoc (plan §"Re-embed de los 156.898 chunks legacy", Fase 6/8). Revisit only if a concrete capability gap appears, measured on a *non-saturated* harness.
- `@teras/rag-core` proceeds with embedding model + dims injected and the corpus strictly per-app; the core never assumes cross-app vector compatibility.
- MDL: keep its own pin; the latent `text-embedding-005` 404 (WS7-T2) is a separate fix — MDL must pin a real, available model and tag its chunks too.

## Reproduce
```
GOOGLE_AI_API_KEY=… node scripts/experiments/embedding-compat.mjs
```
Reproducible up to API drift (preview/GA models may change under you); writes `scripts/experiments/embedding-compat-result.json`. The experiment's query path is byte-for-byte the prod interactive-query path (single-text REST `embedContent`, 768, same body); the prod corpus was written via the SDK batch path, which for the same model+dim returns identical values (server-side MRL truncation, no client normalization in either path), so the REST-vs-SDK transport difference is immaterial to this result.
