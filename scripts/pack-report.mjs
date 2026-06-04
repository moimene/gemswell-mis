#!/usr/bin/env node
/**
 * MAD Finance Mar-2026 — Pack Report Generator
 *
 * 1. Updates pack completeness_score + status=submitted
 * 2. Generates CEO confirmation/correction report (Markdown)
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { writeFile } from 'fs/promises';
import { join } from 'path';

const PACK_ID    = 'e264957c-9947-420a-b37a-0890069ff3c7';
const REPORT_OUT = join(process.cwd(), 'scripts', 'MAD_Finance_Mar2026_v1.md');
const TODAY      = new Date().toISOString().slice(0, 10);

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function log(msg) { console.log(msg); }

log('\n════════════════════════════════════════════════════════════');
log('PACK REPORT GENERATOR — MAD Finance Mar-2026');
log('════════════════════════════════════════════════════════════\n');

// ─── 1. Load pack ─────────────────────────────────────────────────────────────

const { data: pack, error: packErr } = await sb
  .from('rpt_pack')
  .select('*')
  .eq('pack_id', PACK_ID)
  .single();

if (packErr) { console.error('❌ Pack load error:', packErr.message); process.exit(1); }
log(`✅ Pack loaded — status: ${pack.status}`);

// ─── 2. Load accepted candidates ──────────────────────────────────────────────

const { data: candidates, error: cErr } = await sb
  .from('intel_metric_candidate')
  .select('id,metric_id,extracted_value,currency,period_label,period_date,confidence,validation_notes,context_snippet')
  .eq('pack_id', PACK_ID)
  .eq('status', 'accepted')
  .order('metric_id');

if (cErr) { console.error('❌ Candidates error:', cErr.message); process.exit(1); }
log(`✅ ${candidates.length} accepted candidates`);

// ─── 3. Load metric definitions ───────────────────────────────────────────────

const metricIds = candidates.map(c => c.metric_id);
const { data: defs } = await sb
  .from('intel_metric_definition')
  .select('id,display_name,unit,domain')
  .in('id', metricIds);

const defMap = Object.fromEntries((defs || []).map(d => [d.id, d]));

// ─── 4. Update pack: completeness_score + status=submitted ────────────────────

const TOTAL_METRICS  = 10;
const ACCEPTED       = candidates.length;
const PROVISIONAL    = candidates.filter(c =>
  c.validation_notes?.toLowerCase().includes('provisional')
).length;
const completeness   = Math.round((ACCEPTED / TOTAL_METRICS) * 100);
const GAP_COUNT      = 3;

log(`\n📊 Completeness: ${ACCEPTED}/${TOTAL_METRICS} = ${completeness}%  (${PROVISIONAL} provisional)`);

const { error: updateErr } = await sb
  .from('rpt_pack')
  .update({
    completeness_score: completeness,
    status:             'submitted',
    submitted_at:       new Date().toISOString(),
    notes: `v1 snapshot — ${ACCEPTED}/${TOTAL_METRICS} metrics accepted (${PROVISIONAL} provisional). ${GAP_COUNT} reconciliation gaps open. Generated ${TODAY}.`,
  })
  .eq('pack_id', PACK_ID);

if (updateErr) log(`⚠️  Pack update error: ${updateErr.message}`);
else           log(`✅ Pack → status=submitted, completeness=${completeness}%`);

// ─── 5. Format helpers ────────────────────────────────────────────────────────

function fmtEUR(v) {
  const n = parseFloat(v);
  if (isNaN(n)) return String(v);
  if (Math.abs(n) >= 1_000_000) return `€${(n / 1_000_000).toFixed(3)}M`;
  if (Math.abs(n) >= 1_000)     return `€${(n / 1_000).toFixed(1)}K`;
  return `€${n.toLocaleString('es-ES', {minimumFractionDigits:2})}`;
}

function fmtValue(c) {
  const def = defMap[c.metric_id];
  const unit = def?.unit || c.currency || 'EUR';
  const v = c.extracted_value;
  if (unit === 'EUR' || unit === '€') return fmtEUR(v);
  if (unit === '%') return `${parseFloat(v).toFixed(1)}%`;
  return `${v} ${unit}`;
}

function fmtPeriod(c) {
  if (c.period_label) return c.period_label;
  if (c.period_date)  return c.period_date.slice(0, 7);
  return '—';
}

function confPct(c) {
  return `${Math.round((c.confidence || 0) * 100)}%`;
}

function isProvisional(c) {
  return c.validation_notes?.toLowerCase().includes('provisional') ||
         c.confidence < 0.75;
}

// ─── 6. Group by domain/area ──────────────────────────────────────────────────

const AREA_ORDER  = ['capex', 'cash', 'funding', 'revenue', 'opex'];
const AREA_LABELS = {
  capex:   'CAPEX & Budget',
  cash:    'Cash Position',
  funding: 'Funding & Facility',
  revenue: 'Revenue & Leasing',
  opex:    'Operating Expenditure',
};

const byArea = {};
for (const c of candidates) {
  const area = defMap[c.metric_id]?.domain || c.metric_id.split('.')[1] || 'other';
  if (!byArea[area]) byArea[area] = [];
  byArea[area].push(c);
}

// ─── 7. Build metric tables ───────────────────────────────────────────────────

let metricSections = '';
const orderedAreas = [...AREA_ORDER.filter(a => byArea[a]), ...Object.keys(byArea).filter(a => !AREA_ORDER.includes(a))];

for (const area of orderedAreas) {
  const cs = byArea[area];
  const label = AREA_LABELS[area] || area.toUpperCase();
  metricSections += `\n### ${label}\n\n`;
  metricSections += `| # | Metric | Value | Period | Conf. | Status | Notes |\n`;
  metricSections += `|---|--------|-------|--------|-------|--------|-------|\n`;

  cs.forEach((c, i) => {
    const def  = defMap[c.metric_id] || {};
    const name = def.display_name || c.metric_id.split('.').slice(1).join('.');
    const val  = fmtValue(c);
    const per  = fmtPeriod(c);
    const conf = confPct(c);
    const prov = isProvisional(c);
    const flag = prov ? '⚠️ PROVISIONAL' : '✅';
    // Short evidence note
    const note = (c.validation_notes || '').replace(/^Accepted[: ]*/i,'').split('.')[0];
    metricSections += `| ${i+1} | ${name} | **${val}** | ${per} | ${conf} | ${flag} | ${note} |\n`;
  });
}

// ─── 8. Reconciliation gaps table ────────────────────────────────────────────

const GAPS = [
  {
    sev:    '🔴 High',
    metric: 'cash.net_position',
    type:   'Staleness',
    issue:  'Cash balance is Dec-2024 (balance sheet). No Mar-2026 bank balance found. Gap ≈ 15 months.',
    action: 'Provide extracto bancario or saldo bancario as of 31-Mar-2026 (or most recent date).',
  },
  {
    sev:    '🟡 Medium',
    metric: 'funding.drawn.total',
    type:   'Completeness',
    issue:  'Only first drawdown documented (€715K, Oct-2024). Subsequent disposiciones not in corpus.',
    action: 'Provide certificado bancario de disposiciones acumuladas or Caixabank utilisation statement.',
  },
  {
    sev:    '🟡 Medium',
    metric: 'funding.undrawn.total',
    type:   'Proxy value',
    issue:  'Undrawn = total facility (€31M) − first drawdown (€715K) = €30,285K. Proxy only.',
    action: 'Same as funding.drawn — utilisation statement resolves both simultaneously.',
  },
];

const gapRows = GAPS.map((g, i) =>
  `| ${i+1} | ${g.sev} | \`${g.metric}\` | ${g.type} | ${g.issue} | ${g.action} |`
).join('\n');

// ─── 9. Build full report ─────────────────────────────────────────────────────

const report = `# Madrid Playa Surf — Finance Snapshot Mar-2026
## v1 · For CEO Confirmation/Correction

| | |
|---|---|
| **Pack** | \`${PACK_ID.slice(0,8)}\` |
| **Status** | Submitted |
| **Generated** | ${TODAY} |
| **Completeness** | ${completeness}% (${ACCEPTED}/${TOTAL_METRICS} metrics) |
| **Provisional** | ${PROVISIONAL} metric${PROVISIONAL !== 1 ? 's' : ''} require correction |
| **Open gaps** | ${GAP_COUNT} reconciliation issues |
| **Due** | ${pack.due_at?.slice(0,10)} |

---

> **HOW TO USE THIS DOCUMENT**
>
> This is the first automated extraction of Gemswell MIS — values are drawn from the documentary corpus
> (financial statements, CapEx monitoring, financing contracts).
>
> - ✅ = value accepted from primary evidence — please confirm or correct
> - ⚠️ PROVISIONAL = value is a proxy or estimate — **correction required**
> - Strike-through or annotate corrections directly and return
> - For gaps: provide the document listed in the Required Action column

---

## Metric Snapshot
${metricSections}

---

## Reconciliation Gaps (${GAP_COUNT} Open)

These gaps must be resolved before the pack can be **Published**:

| # | Severity | Metric | Type | Issue | Required Action |
|---|----------|--------|------|-------|-----------------|
${gapRows}

---

## Missing Metrics (2 — No Evidence Found)

| Metric | Why Missing | Document Needed |
|--------|-------------|-----------------|
| \`cash.total_inflow\` | CapEx Monitoring CF has granular line items but no aggregated cobros total | Estado de Flujos de Efectivo or 13W cash flow |
| \`cash.total_outflow\` | Same — no aggregated pagos total in corpus | Estado de Flujos de Efectivo or 13W cash flow |

---

## Evidence Summary

All accepted values were extracted from the following documents in the MIS corpus:

| Document | Metrics Sourced | Type | Authority |
|----------|-----------------|------|-----------|
| MPSCIERREDEF2024.xlsx | cash.net_position | Financial Statements | 92 |
| Cost Allocation MPS_Hard and Soft Costs.xlsx | capex.budget_baseline, capex.committed, capex.eac | CapEx | 85 |
| 20260324_CapEx Monitoring CF.xlsx | capex.paid | Cash Flow/CapEx | 85 |
| Contrato de Financiación (Caixabank) | funding.committed, funding.drawn, funding.undrawn | Funding | 90 |

---

## CEO Review Checklist

- [ ] **cash.net_position** — Confirm Dec-2024 balance (€94.7K) or provide current date
- [ ] **capex.budget_baseline** — Confirm €57.13M Budget UW figure
- [ ] **capex.committed** — Confirm €48.92M contracted (Mar-2025) or provide latest figure
- [ ] **capex.eac** — Confirm €64.81M EAC (Mar-2025) or provide latest figure
- [ ] **capex.paid** — Confirm €21.07M paid YTD through Dec-2025
- [ ] **funding.committed** — Confirm €48.16M = senior €31M + participativo €15.66M + IVA €1.50M
- [ ] **funding.drawn** — Correct €715K first drawdown only → provide total drawn to date
- [ ] **funding.undrawn** — Correct €30,285K proxy → provide net undrawn from bank statement
- [ ] Provide **extracto bancario / saldo bancario** Mar-2026 → resolves cash.net_position
- [ ] Provide **certificado de disposiciones** Caixabank → resolves funding.drawn + funding.undrawn
- [ ] Provide **Estado de Flujos de Efectivo** or **13W cash flow** → resolves cash.total_inflow + outflow

---
*Generated by Gemswell MIS · Layer 3 Extraction Engine · ${TODAY}*
*Pack \`${PACK_ID}\` · Project MAD · Cycle Mar-2026*
`;

await writeFile(REPORT_OUT, report, 'utf8');
log(`\n📄 Report → ${REPORT_OUT}`);

// ─── 10. Summary ──────────────────────────────────────────────────────────────

log('\n════════════════════════════════════════════════════════════');
log('DONE');
log(`  Pack:         MAD Finance Mar-2026 → submitted`);
log(`  Completeness: ${completeness}%  (${ACCEPTED}/${TOTAL_METRICS} metrics)`);
log(`  Provisional:  ${PROVISIONAL}`);
log(`  Open gaps:    ${GAP_COUNT}`);
log(`  Report:       MAD_Finance_Mar2026_v1.md`);
log('════════════════════════════════════════════════════════════\n');
