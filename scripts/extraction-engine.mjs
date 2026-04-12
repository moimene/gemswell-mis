#!/usr/bin/env node
/**
 * EXTRACTION ENGINE v0 — Gemswell MIS Layer 3
 *
 * Converts documentary evidence (rag_chunks) into structured metric candidates
 * with contradiction detection and review task creation.
 *
 * Architecture: Prefiltro → Extracción estructurada → Contradicción → Cola de review
 *
 * Usage:
 *   node scripts/extraction-engine.mjs                         # all core metrics, both projects
 *   node scripts/extraction-engine.mjs --project=BHX           # single project
 *   node scripts/extraction-engine.mjs --metric=BHX.capex.eac  # single metric (prefix match)
 *   node scripts/extraction-engine.mjs --dry-run               # extract but don't write
 *   node scripts/extraction-engine.mjs --top-k=10              # chunks per metric (default 8)
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *   ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY, COHERE_API_KEY
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { CohereClient } from 'cohere-ai';

// ─── Config ───────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

let   PROJECT_FILTER = args.project || null;        // BHX | MAD | null; overrideable by --pack
const PACK_ID        = args.pack    || null;        // rpt_pack.pack_id — pack-centric mode
const METRIC_PREFIX  = args.metric  || null;        // prefix match on metric_id
const DRY_RUN        = args['dry-run'] === true;
const TOP_K          = parseInt(args['top-k'] || '8', 10);
const MAX_METRICS    = parseInt(args['max'] || '0', 10);  // 0 = unlimited

// Doc types to search (priority order)
const PRIORITY_DOC_TYPES = [
  'monthly_reporting', 'capex', 'cash_flow', 'funding',
  'bp_underwriting', 'annual_accounts', 'board'
];

// Authority tier → score mapping
const AUTHORITY_SCORES = {
  annual_accounts: 100,    // audited
  funding: 90,             // executed (contracts, facility agreements)
  monthly_reporting: 80,   // controller reporting
  capex: 80,               // controller reporting
  cash_flow: 80,           // controller reporting
  board: 70,               // board packs
  bp_underwriting: 60,     // DD / underwriting
  bp_model: 60,
  due_diligence: 60,
  capital_structure: 50,
  advisors: 40,
  legal: 40,
  sponsor: 30,
  asset_management: 20,
  other: 10,
};

// ─── Clients ──────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });
const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

// ─── Helpers ──────────────────────────────────────────────────────────

const log = (msg) => console.log(`${new Date().toLocaleTimeString('es-ES')} ${msg}`);

function docTypeToAuthority(docType) {
  return AUTHORITY_SCORES[docType] || 10;
}

// ─── Step 1: Load Metric Definitions ──────────────────────────────────

async function loadMetrics() {
  let query = supabase
    .from('intel_metric_definition')
    .select('*')
    .eq('is_active', true);

  if (PROJECT_FILTER) query = query.eq('project_id', PROJECT_FILTER);

  const { data, error } = await query.order('id');
  if (error) throw new Error(`Failed to load metrics: ${error.message}`);

  let metrics = data;
  if (METRIC_PREFIX) {
    metrics = metrics.filter(m => m.id.startsWith(METRIC_PREFIX));
  }
  if (MAX_METRICS > 0) {
    metrics = metrics.slice(0, MAX_METRICS);
  }

  return metrics;
}

// ─── Step 1b: Load Pack Context (pack-centric mode) ───────────────────

async function loadPackContext(packId) {
  const { data, error } = await supabase
    .from('rpt_pack')
    .select('pack_id, cycle_id, project_id, area, status, period_label:cycle_id(period_start,period_end)')
    .eq('pack_id', packId)
    .single();

  if (error) throw new Error(`Pack not found (${packId}): ${error.message}`);
  if (data.status === 'published') throw new Error(`Pack ${packId} is already published — create a new version`);
  return data;
}


// ─── Step 2: Embed query for vector search ────────────────────────────

async function embedQuery(text) {
  const result = await genai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
    config: { outputDimensionality: 768 },
  });
  return result.embeddings?.[0]?.values || [];
}

// ─── Step 3: Prefiltro — Retrieve candidate chunks ────────────────────

async function prefiltroChunks(metric) {
  // Build a rich search query from the metric definition
  const searchParts = [
    metric.display_name,
    metric.extraction_hint || '',
    ...(metric.synonyms || []),
    metric.target_column,
    metric.unit,
  ].filter(Boolean);

  const searchQuery = searchParts.join(' ');

  // Step 3a: Embed the query
  const queryEmbedding = await embedQuery(searchQuery);

  // Step 3b: Vector search with metadata filters via match_chunks RPC
  // We request more than TOP_K to allow for reranking
  const fetchCount = TOP_K * 3;

  const { data: vectorResults, error } = await supabase.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    match_count: fetchCount,
    filter_project: metric.project_id || null,
    filter_doc_type: null,
  });

  if (error) {
    log(`  ⚠️ Vector search failed: ${error.message}`);
    return [];
  }

  if (!vectorResults || vectorResults.length === 0) {
    log(`  ⚠️ No chunks found for ${metric.id}`);
    return [];
  }

  // Step 3c: Filter to priority doc types
  let filtered = vectorResults.filter(c => {
    const docType = c.metadata?.doc_type;
    return PRIORITY_DOC_TYPES.includes(docType);
  });

  // If too few after filter, relax
  if (filtered.length < 3) {
    filtered = vectorResults;
  }

  // Step 3d: Rerank with Cohere for precision
  try {
    const reranked = await cohere.rerank({
      model: 'rerank-v3.5',
      query: searchQuery,
      documents: filtered.map(c => ({ text: c.content.slice(0, 1500) })),
      topN: TOP_K,
    });

    const topChunks = reranked.results.map(r => ({
      ...filtered[r.index],
      relevance_score: r.relevanceScore,
    }));

    return topChunks;
  } catch (rerankErr) {
    log(`  ⚠️ Rerank failed, using vector order: ${rerankErr.message}`);
    return filtered.slice(0, TOP_K);
  }
}

// ─── Step 4: Structured Extraction via Claude ─────────────────────────

const EXTRACTION_SYSTEM = `You are a financial data extraction engine for Gemswell Ventures, a wave park developer.
Your job is to extract precise numeric metrics from document chunks.

RULES:
- Extract ONLY the specific metric requested. Do not hallucinate values.
- If the metric is not present in the chunks, return found: false.
- If multiple values exist for different periods, extract the MOST RECENT one.
- If values are ambiguous (e.g., budget vs actual vs forecast), choose the one matching the metric definition.
- Pay close attention to currency (EUR vs GBP), VAT (incl/excl), and scope (gross vs net).
- Always provide the exact text snippet where you found the value.
- Confidence should reflect: (a) how clearly the value appears, (b) how well it matches the metric, (c) how recent/authoritative the source seems.

Respond ONLY with valid JSON. No markdown, no explanation.`;

async function extractMetric(metric, chunks) {
  const chunksContext = chunks.map((c, i) => {
    const meta = c.metadata || {};
    return `--- CHUNK ${i + 1} ---
Source: ${meta.source_file || 'unknown'}
Doc type: ${meta.doc_type || 'unknown'}
Period: ${meta.period || 'unknown'}
Currency: ${meta.currency || 'unknown'}
Relevance: ${(c.relevance_score || c.similarity || 0).toFixed(3)}

${c.content}
`;
  }).join('\n');

  const userPrompt = `METRIC TO EXTRACT:
- ID: ${metric.id}
- Name: ${metric.display_name}
- Domain: ${metric.domain}
- Project: ${metric.project_id}
- Target: ${metric.target_table}.${metric.target_column}
- Unit: ${metric.unit}
- Hint: ${metric.extraction_hint || 'none'}
- Synonyms: ${(metric.synonyms || []).join(', ') || 'none'}
${metric.min_value != null ? `- Expected range: ${metric.min_value} – ${metric.max_value}` : ''}

DOCUMENT CHUNKS (${chunks.length} chunks, ordered by relevance):

${chunksContext}

Extract the metric value. Return JSON:
{
  "found": true/false,
  "value": <numeric value or null>,
  "currency": "EUR" or "GBP",
  "period_label": "e.g. March 2025, Q1 2026, FY2025",
  "period_date": "YYYY-MM-DD (last day of the period)",
  "confidence": <0.0 to 1.0>,
  "evidence_chunk_indices": [<1-based indices of chunks used>],
  "evidence_quote": "<exact text snippet, max 200 chars>",
  "rationale": "<1-2 sentence explanation>",
  "warnings": ["<any caveats: currency mismatch, VAT ambiguity, etc.>"]
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: EXTRACTION_SYSTEM,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content[0]?.text || '{}';

  // Parse JSON (handle markdown fencing)
  const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    const result = JSON.parse(jsonStr);
    return {
      ...result,
      prompt_tokens: response.usage?.input_tokens || 0,
      completion_tokens: response.usage?.output_tokens || 0,
    };
  } catch (parseErr) {
    log(`  ❌ JSON parse failed: ${parseErr.message}`);
    log(`  Raw: ${text.substring(0, 200)}`);
    return { found: false, warnings: ['JSON parse error'], prompt_tokens: 0, completion_tokens: 0 };
  }
}

// ─── Step 5: Load current fact values for comparison ──────────────────

async function loadCurrentFactValue(metric) {
  const { target_table, target_column, target_filter, project_id } = metric;

  // Build query for latest snapshot
  let query = supabase
    .from(target_table)
    .select(`${target_column}, period_end_date, week_start, source_file`)
    .eq('project_id', project_id);

  // Apply target_filter (e.g., {"capex_category_id": "CC_CONT"})
  if (target_filter && Object.keys(target_filter).length > 0) {
    for (const [k, v] of Object.entries(target_filter)) {
      query = query.eq(k, v);
    }
  }

  // Get latest by date
  const dateCol = target_table === 'fct_cash_13w' ? 'week_start' : 'period_end_date';
  query = query.order(dateCol, { ascending: false }).limit(1);

  const { data, error } = await query;
  if (error || !data || data.length === 0) return null;

  const row = data[0];
  return {
    value: row[target_column],
    date: row[dateCol] || row.period_end_date || row.week_start,
    source_file: row.source_file,
  };
}

// ─── Step 6: Contradiction Detection ──────────────────────────────────

async function detectContradictions(metric, newCandidate, existingCandidates) {
  const contradictions = [];

  for (const existing of existingCandidates) {
    if (existing.status === 'rejected') continue;
    if (!existing.extracted_value || !newCandidate.value) continue;

    // Same period check
    const samePeriod = existing.period_label === newCandidate.period_label ||
      existing.period_date === newCandidate.period_date;
    if (!samePeriod) continue;

    const a = parseFloat(existing.extracted_value);
    const b = parseFloat(newCandidate.value);
    const deltaAbs = Math.abs(a - b);
    const maxVal = Math.max(Math.abs(a), Math.abs(b));
    const deltaPct = maxVal > 0 ? deltaAbs / maxVal : 0;

    // Tolerance: 1% for high-authority, 5% for lower
    const tolerance = (existing.authority_score || 0) >= 80 ? 0.01 : 0.05;

    if (deltaPct > tolerance) {
      const severity = deltaPct > 0.20 ? 'critical' :
                       deltaPct > 0.10 ? 'high' :
                       deltaPct > 0.05 ? 'medium' : 'low';

      contradictions.push({
        existing_candidate_id: existing.id,
        value_a: a,
        value_b: b,
        delta_pct: deltaPct,
        severity,
        authority_a: existing.authority_score,
      });
    }
  }

  return contradictions;
}

// ─── Step 6b: Semantic Gate ────────────────────────────────────────────
//
// Validates an extraction BEFORE insertion. Returns hard blocks (→ validation_failed)
// and soft warnings (→ pending_review). Called in both dry-run and real modes.

function validateExtraction(metric, extraction, chunks) {
  const issues = [];
  const evidenceText = (extraction.evidence_quote || '').toLowerCase();
  const allChunksText = chunks.map(c => c.content).join(' ').toLowerCase();

  // 1. Negative terms — hard block
  for (const term of (metric.negative_terms || [])) {
    if (evidenceText.includes(term.toLowerCase())) {
      issues.push({ code: 'NEGATIVE_TERM', severity: 'hard',
        message: `Evidence contains forbidden term: "${term}"` });
    }
  }

  // 2. Temporal shape — hard block for 13W forecasts
  if (metric.temporal_shape === 'rolling_13w_forecast') {
    const signals = ['13 week', '13-week', '13week', 'weekly forecast', 'week ending', '13 semanas'];
    if (!signals.some(s => allChunksText.includes(s))) {
      issues.push({ code: 'TEMPORAL_SHAPE_MISMATCH', severity: 'hard',
        message: 'Metric requires rolling_13w_forecast evidence; no weekly forecast signals found in chunks' });
    }
  }

  // 3. Period required with no inference allowed — hard block
  if (metric.period_required && !metric.period_inference_allowed && !extraction.period_date) {
    issues.push({ code: 'MISSING_PERIOD', severity: 'hard',
      message: 'Metric requires explicit period date (inference not allowed)' });
  }

  // 4. Forbidden doc types — soft warning
  const topDocType = chunks[0]?.metadata?.doc_type || 'unknown';
  if ((metric.forbidden_doc_types || []).includes(topDocType)) {
    issues.push({ code: 'FORBIDDEN_DOC_TYPE', severity: 'soft',
      message: `Primary evidence from forbidden doc type: "${topDocType}"` });
  }

  // 5. No positive terms found — soft warning
  if ((metric.positive_terms || []).length > 0) {
    const hasPositive = metric.positive_terms.some(t =>
      evidenceText.includes(t.toLowerCase()) || allChunksText.includes(t.toLowerCase())
    );
    if (!hasPositive) {
      issues.push({ code: 'NO_POSITIVE_TERMS', severity: 'soft',
        message: 'Evidence does not match any expected positive terms for this metric' });
    }
  }

  const hardBlocks = issues.filter(i => i.severity === 'hard');
  return { valid: hardBlocks.length === 0, issues };
}

function determineStatus(metric, extraction, authorityScore, validationResult) {
  // Hard gate: validation failure overrides everything
  if (!validationResult.valid) return 'validation_failed';

  // Auto-accept: ALL conditions must pass simultaneously
  const canAutoAccept =
    metric.auto_accept_enabled === true &&
    extraction.confidence >= (metric.auto_accept_min_confidence ?? 0.90) &&
    authorityScore >= 80 &&
    (!metric.auto_accept_requires_period || extraction.period_date) &&
    validationResult.issues.filter(i => i.severity === 'hard').length === 0;

  return canAutoAccept ? 'auto_accepted' : 'pending_review';
}


// ─── Step 7: Write results to intel_* tables ──────────────────────────

async function writeCandidate(metric, extraction, chunks, runId, packId = null, cycleId = null) {
  if (!extraction.found || extraction.value == null) return null;

  // Determine authority from the top evidence chunk
  const topChunkIdx = (extraction.evidence_chunk_indices || [1])[0] - 1;
  const topChunk = chunks[topChunkIdx] || chunks[0];
  const docType = topChunk?.metadata?.doc_type || 'other';
  const authorityScore = docTypeToAuthority(docType);

  // Semantic gate — determines final status
  const validationResult = validateExtraction(metric, extraction, chunks);
  const status = determineStatus(metric, extraction, authorityScore, validationResult);

  // Insert candidate
  const { data: candidate, error } = await supabase
    .from('intel_metric_candidate')
    .insert({
      metric_id: metric.id,
      extraction_run_id: runId,
      rag_document_id: topChunk?.document_id || null,
      rag_chunk_id: topChunk?.id || null,
      extracted_value: extraction.value,
      extracted_text: extraction.evidence_quote || null,
      period_label: extraction.period_label || null,
      period_date: extraction.period_date || null,
      currency: extraction.currency || metric.unit,
      confidence: extraction.confidence || 0.5,
      extraction_method: 'llm',
      context_snippet: extraction.rationale || null,
      authority_score: authorityScore,
      pack_id: packId,
      cycle_id: cycleId,
      status,
      validation_status: validationResult.valid ? 'passed' : 'failed',
      validation_notes: validationResult.issues.length > 0
        ? validationResult.issues : null,
    })
    .select()
    .single();

  if (error) {
    log(`  ❌ Failed to insert candidate: ${error.message}`);
    return null;
  }

  // Insert source links for evidence chunks
  for (const chunkIdx of (extraction.evidence_chunk_indices || [1])) {
    const chunk = chunks[(chunkIdx - 1)] || chunks[0];
    if (!chunk?.id) continue;

    await supabase.from('intel_fact_source_link').insert({
      fact_table: metric.target_table,
      fact_row_id: candidate.id, // temporarily point to candidate itself
      fact_column: metric.target_column,
      rag_chunk_id: chunk.id,
      rag_document_id: chunk.document_id || null,
      link_type: 'evidence',
      confidence: extraction.confidence || 0.5,
      authority_score: docTypeToAuthority(chunk.metadata?.doc_type || 'other'),
      extracted_text: extraction.evidence_quote || null,
      extraction_run_id: runId,
    });
  }

  return candidate;
}

async function writeContradiction(metric, candidateId, contradiction, runId) {
  await supabase.from('intel_contradiction_alert').insert({
    metric_id: metric.id,
    period_label: null,
    project_id: metric.project_id,
    candidate_a_id: contradiction.existing_candidate_id,
    candidate_b_id: candidateId,
    value_a: contradiction.value_a,
    value_b: contradiction.value_b,
    delta_pct: contradiction.delta_pct,
    authority_a: contradiction.authority_a,
    authority_b: metric.authority_score,
    severity: contradiction.severity,
    extraction_run_id: runId,
  });
}

async function createReviewTask(metric, candidateCount, contradictionCount, runId) {
  const { data, error } = await supabase
    .from('intel_review_task')
    .insert({
      title: `Review ${metric.project_id} ${metric.domain} extractions`,
      description: `Extracted ${candidateCount} candidates for ${metric.display_name}. ${contradictionCount > 0 ? `⚠️ ${contradictionCount} contradictions detected.` : ''}`,
      domain: metric.domain,
      project_id: metric.project_id,
      extraction_run_id: runId,
      candidate_count: candidateCount,
      contradiction_count: contradictionCount,
      priority: contradictionCount > 0 ? 'high' : 'normal',
    })
    .select()
    .single();

  if (error) log(`  ⚠️ Failed to create review task: ${error.message}`);
  return data;
}

// ─── Main Orchestrator ────────────────────────────────────────────────

async function main() {
  log('');
  log('════════════════════════════════════════════════════════════');
  log('EXTRACTION ENGINE v0 — Gemswell MIS Layer 3');
  log(`Project: ${PROJECT_FILTER || 'ALL'}`);
  log(`Pack:    ${PACK_ID || 'none'}`);
  log(`Metric filter: ${METRIC_PREFIX || 'ALL core'}`);
  log(`Top-K chunks: ${TOP_K}`);
  log(`Dry run: ${DRY_RUN}`);
  log('════════════════════════════════════════════════════════════');

  // 0. Load pack context (if --pack provided)
  let packId = null;
  let cycleId = null;
  if (PACK_ID) {
    const pack = await loadPackContext(PACK_ID);
    packId = pack.pack_id;
    cycleId = pack.cycle_id;
    if (!PROJECT_FILTER) PROJECT_FILTER = pack.project_id;
    log(`\n📦 Pack: ${packId.substring(0, 8)}... [${pack.area} / ${pack.project_id}]`);
    log(`   Cycle: ${cycleId.substring(0, 8)}...`);
  }

  // 1. Load metrics
  const metrics = await loadMetrics();
  log(`\n📊 Loaded ${metrics.length} metric definitions`);

  if (metrics.length === 0) {
    log('No metrics to process. Exiting.');
    return;
  }

  // 2. Create extraction run
  let runId = null;
  if (!DRY_RUN) {
    const { data: run, error } = await supabase
      .from('intel_extraction_run')
      .insert({
        trigger_type: 'manual',
        project_id: PROJECT_FILTER || null,
        pack_id: packId,
        cycle_id: cycleId,
        domain: null,
        status: 'running',
        llm_model: 'claude-sonnet-4-20250514',
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create run: ${error.message}`);
    runId = run.id;
    log(`\n🏃 Run ID: ${runId}`);
  }

  // 3. Process each metric
  let totalCandidates = 0;
  let totalContradictions = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let documentsScanned = new Set();

  for (let i = 0; i < metrics.length; i++) {
    const metric = metrics[i];
    log(`\n── [${i + 1}/${metrics.length}] ${metric.id} ──`);

    // 3a. Prefiltro
    log(`  🔍 Prefiltro: searching chunks...`);
    const chunks = await prefiltroChunks(metric);

    if (chunks.length === 0) {
      log(`  ⚠️ No relevant chunks found. Skipping.`);
      continue;
    }

    log(`  📄 ${chunks.length} chunks after prefiltro+rerank`);
    chunks.forEach(c => {
      documentsScanned.add(c.metadata?.source_file);
      const score = (c.relevance_score || c.similarity || 0).toFixed(3);
      log(`     [${score}] ${c.metadata?.doc_type} — ${c.metadata?.source_file?.substring(0, 60)}`);
    });

    // 3b. Extract with Claude
    log(`  🤖 Extracting with Claude...`);
    const extraction = await extractMetric(metric, chunks);
    totalPromptTokens += extraction.prompt_tokens || 0;
    totalCompletionTokens += extraction.completion_tokens || 0;

    if (!extraction.found) {
      log(`  ❌ Metric not found in chunks.`);
      if (extraction.warnings?.length) log(`     Warnings: ${extraction.warnings.join(', ')}`);
      continue;
    }

    log(`  ✅ Found: ${extraction.value} ${extraction.currency || metric.unit}`);
    log(`     Period: ${extraction.period_label || 'unknown'}`);
    log(`     Confidence: ${extraction.confidence}`);
    log(`     Evidence: "${(extraction.evidence_quote || '').substring(0, 80)}..."`);
    if (extraction.warnings?.length) log(`     ⚠️ ${extraction.warnings.join(', ')}`);

    // 3b+. Semantic gate preview (runs in both dry-run and real mode)
    const validationPreview = validateExtraction(metric, extraction, chunks);
    if (!validationPreview.valid) {
      validationPreview.issues
        .filter(i => i.severity === 'hard')
        .forEach(i => log(`  🚫 [${i.code}] ${i.message}`));
    } else if (validationPreview.issues.some(i => i.severity === 'soft')) {
      validationPreview.issues
        .filter(i => i.severity === 'soft')
        .forEach(i => log(`  ⚠️  soft [${i.code}] ${i.message}`));
    } else {
      log(`  ✔  Semantic gate: passed`);
    }

    // 3c. Compare against current fact value
    const currentFact = await loadCurrentFactValue(metric);
    if (currentFact?.value != null) {
      const delta = Math.abs(extraction.value - currentFact.value);
      const pct = currentFact.value !== 0 ? (delta / Math.abs(currentFact.value) * 100).toFixed(1) : '∞';
      log(`  📊 vs MIS fact: ${currentFact.value} (Δ ${pct}%)`);
    } else {
      log(`  📊 No existing fact value to compare`);
    }

    if (DRY_RUN) {
      // Compute projected status using preview validation
      const topChunkIdx = (extraction.evidence_chunk_indices || [1])[0] - 1;
      const topChunk = chunks[topChunkIdx] || chunks[0];
      const projAuth = docTypeToAuthority(topChunk?.metadata?.doc_type || 'other');
      const projStatus = determineStatus(metric, extraction, projAuth, validationPreview);
      log(`  🔶 DRY RUN — would be: [${projStatus}]`);
      if (projStatus !== 'validation_failed') totalCandidates++;
      continue;
    }

    // 3d. Write candidate
    const candidate = await writeCandidate(metric, extraction, chunks, runId, packId, cycleId);
    if (!candidate) continue;

    if (candidate.status === 'validation_failed') {
      log(`  🚫 Candidate ${candidate.id.substring(0, 8)}... [validation_failed] — written for audit, not promotable`);
    } else {
      totalCandidates++;
      log(`  💾 Candidate ${candidate.id.substring(0, 8)}... [${candidate.status}]`);
    }

    // 3e. Check contradictions against existing candidates
    const { data: existingCandidates } = await supabase
      .from('intel_metric_candidate')
      .select('*')
      .eq('metric_id', metric.id)
      .neq('id', candidate.id)
      .in('status', ['pending_review', 'accepted', 'auto_accepted']);

    const contradictions = await detectContradictions(metric, extraction, existingCandidates || []);

    for (const c of contradictions) {
      await writeContradiction(metric, candidate.id, c, runId);
      totalContradictions++;
      log(`  ⚡ Contradiction: ${c.value_a} vs ${c.value_b} (Δ ${(c.delta_pct * 100).toFixed(1)}%) [${c.severity}]`);
    }
  }

  // 4. Create review tasks (grouped by project + domain)
  if (!DRY_RUN && totalCandidates > 0) {
    const taskGroups = new Map();
    for (const m of metrics) {
      const key = `${m.project_id}:${m.domain}`;
      if (!taskGroups.has(key)) taskGroups.set(key, { metric: m, candidates: 0, contradictions: 0 });
    }

    // We already created candidates, just create one review task per run
    await createReviewTask(
      { project_id: PROJECT_FILTER || 'ALL', domain: 'multi', display_name: 'batch extraction' },
      totalCandidates,
      totalContradictions,
      runId
    );
  }

  // 5. Finalize run
  if (!DRY_RUN && runId) {
    await supabase
      .from('intel_extraction_run')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        documents_scanned: documentsScanned.size,
        candidates_created: totalCandidates,
        contradictions_found: totalContradictions,
        prompt_tokens: totalPromptTokens,
        completion_tokens: totalCompletionTokens,
      })
      .eq('id', runId);
  }

  // 6. Summary
  log('\n════════════════════════════════════════════════════════════');
  log('EXTRACTION COMPLETE');
  log(`  Metrics processed:  ${metrics.length}`);
  log(`  Documents scanned:  ${documentsScanned.size}`);
  log(`  Candidates created: ${totalCandidates}`);
  log(`  Contradictions:     ${totalContradictions}`);
  log(`  Tokens used:        ${totalPromptTokens} prompt + ${totalCompletionTokens} completion`);
  if (DRY_RUN) log(`  ⚠️ DRY RUN — nothing written to database`);
  log('════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
