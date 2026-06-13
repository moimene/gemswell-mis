-- 033 — Down-weight near-empty IMAGE/DRAWING docs (backlog B2, 2026-06-13). v2 after adversarial review.
--
-- WHY: a handful of live docs are image-only (CAD drawings, plots, CGIs, scanned section/elevation sheets)
-- with < 200 chars of extractable text — just the title block. Source bytes are gone (storage_path=0) so
-- they cannot be re-OCR'd. Some sit at authority_score 95 'audited', so they could surface as near-empty
-- AUTHORITATIVE sources. Lower their authority_score so they rank at the bottom (trust-tier-dominant
-- ranking keys on authority_score) without removing them from the index.
--
-- ADVERSARIAL SCOPING (Codex CRITICAL #3/#4): the previous version selected ANY live doc with <200 chars,
-- which would wrongly demote short *signed* one-pagers, certificates, or authorizations that are genuinely
-- authoritative. This version requires the title to look like an IMAGE/DRAWING (section/plan/plot/cgi/
-- drawing/elevation/ceiling/stair/drainage/render/.dwg) AND EXCLUDES legal/contract/certificate/
-- authorization titles. So a 150-char signed authorization is NOT touched; a 77-char "…Sections.pdf" is.
-- (Postgres ~* has no PCRE \b — these tokens are distinctive substrings, verified by a dry-run SELECT.)
-- REVERSIBLE: rag_document_events row per change (action='downweight') with the old score.

begin;

with near_empty_images as (
  select d.id, d.authority_score as old_score
  from public.rag_documents d
  join public.rag_chunks c on c.document_id = d.id
  where d.lifecycle <> 'superseded' and d.status = 'indexed' and d.authority_score > 20
    -- 'render' dropped (Codex: matches 'surrender'). Image/drawing title tokens only.
    and d.title ~* '(section|roof ?plan|hubsection|surf plot| plot\.|\.plot|cgi|drawing|elevation|ceiling|floor ?plan|\.dwg|sketch|stair|drainage|reflectedceiling)'
    and d.title !~* '(contrato|contract|agreement|acuerdo|pacto|escritura|loan|prestamo|nda|poder|acta|junta|consejo|estatuto|certificad|authoriz|autoriz|vigencia|memoria abreviada|cuentas|accounts|deed|lease|notice|surrender|escrow)'
  group by d.id, d.authority_score
  having sum(length(c.content)) < 200
),
upd as (
  update public.rag_documents d
  set authority_score = 10
  from near_empty_images n where d.id = n.id
  returning d.id, n.old_score
)
insert into public.rag_document_events (document_id, action, field, old_value, new_value, actor, reason)
select id, 'downweight', 'authority_score', old_score::text, '10', 'admin:console',
  'B2: near-empty image/drawing doc (<200 chars, no source bytes to OCR) down-weighted (sql/033 v2)'
from upd;

commit;
