-- 032 — Reclassify engineering annexes mislabeled doc_type='legal'/'board' → 'capex' (backlog B1, 2026-06-13).
--
-- WHY: ~29 construction-technical annexes of the MAD Acuerdo Marco (HUB URB architectural/structural/
-- installation PLANS, COVE measurements, PLAN DE PLAZOS Y COSTES, Doc.ahorros energy/cost, PLIEGO BREEAM
-- spec, drawings) are typed 'legal' at authority_tier='audited' (score 95). They therefore rank as TOP
-- AUTHORITATIVE LEGAL SOURCES in retrieval — a query "what does the framework agreement say" surfaces a
-- measurement table. They are 28,613 chunks (~19% of corpus). Reclassifying to 'capex' removes them from
-- legal-scoped retrieval (the RPCs read live d.doc_type via coalesce, so this propagates without touching
-- chunk metadata). Authority is LEFT unchanged: they are genuine audited project-cost docs, correctly
-- high-authority for capex queries — only their *category* was wrong.
--
-- ADVERSARIAL SCOPING (false positives excluded): the title regex deliberately EXCLUDES legal annexes that
-- a naive "anexo" match would catch — AM_MPS-Anexo (annexes TO the Acuerdo Marco), 'Vigencia de datos',
-- 'Oferta de servicios', 'CUADRO HONORARIOS', and anything with contract keywords / 'covenant' (Tax
-- Covenant is a real contract, NOT a COVE measurement → 'cove' is matched only as 'cove <number>').
--
-- REVERSIBLE: each change writes a rag_document_events row (action='reclassify') with old doc_type.
-- Rollback: UPDATE rag_documents d SET doc_type = e.old_value FROM rag_document_events e
--           WHERE e.document_id=d.id AND e.action='reclassify' AND e.field='doc_type'.

begin;

with eng as (
  select id, doc_type as old_dt
  from public.rag_documents
  where doc_type in ('legal','board') and lifecycle <> 'superseded'
    -- 'pliego' dropped (Codex: matches a real "Pliego de Condiciones" legal doc); 'breeam' still catches
    -- the only legit case here (ANEXO I.1 PLIEGO BREEAM = technical spec).
    and title ~* '(hub urb|cove\s*[0-9]|plan de plazos|plazos y costes|doc\.?\s*ahorros|breeam|roof\s?plan|drawing|surface water|pl\.(arq|est|inst|vial)|costes cmo|cuadro de medicion|mediciones)'
    -- NOTE: Postgres ~* has no PCRE \b word boundary; exclusion terms are plain distinctive substrings.
    and title !~* '(am[_ ]mps|acuerdo marco|vigencia de datos|oferta de|honorarios|contrato|contract|agreement|pacto|escritura|loan|prestamo|cesion|covenant|estatuto|pliego de condicion)'
),
upd as (
  update public.rag_documents d
  set doc_type = 'capex'
  from eng where d.id = eng.id and d.doc_type <> 'capex'
  returning d.id, eng.old_dt
)
insert into public.rag_document_events (document_id, action, field, old_value, new_value, actor, reason)
select id, 'reclassify', 'doc_type', old_dt, 'capex', 'admin:console',
  'B1: engineering annex mislabeled legal/board → capex (sql/032, trabajo de fondo backlog)'
from upd;

commit;
