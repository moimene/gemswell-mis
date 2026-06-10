// Apply the Opus needs_review re-classification analysis (scripts/reclassify-needs-review-opus.ts --json).
// Conservative + REVERSIBLE + optimistic-locked + audit-evented. Consumes the analysis JSON so it writes
// EXACTLY what was reviewed (re-fetches current_version/review_status/lifecycle fresh per doc → safe under
// the concurrent governance session).
//
// Writes, per doc, via apply_document_governance:
//   • doc_type  ← Opus proposal, ONLY when conf>=0.7 AND proposed!='other' AND proposed!=current (enrichment;
//                 authority is NOT touched — drawings stay low-tier; no source_of_record is created here);
//   • review_status='approved'  ← ONLY for docs the SSOT rule (triageNeedsReview) decided 'approve'.
// Skips any doc no longer needs_review or now superseded. Events: action 'opus_reclassify' (doc_type) +
// 'opus_triage_approve' (review_status), each carrying old_value → exact --revert.
//
// Usage:
//   node scripts/apply-opus-reclassify.mjs [path=/tmp/opus_191.json]            # DRY: list intended writes
//   node scripts/apply-opus-reclassify.mjs --apply [path]                        # apply
//   node scripts/apply-opus-reclassify.mjs --revert [path]                       # undo from audit events
import { readFileSync } from 'node:fs'
const ROOT = '/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app'
function env(n){const m=readFileSync(`${ROOT}/.env.local`,'utf8').match(new RegExp(`^${n}=(.*)$`,'m'));if(!m)throw new Error(n);return m[1].trim().replace(/^["']|["']$/g,'')}
const SUPA=env('NEXT_PUBLIC_SUPABASE_URL'),SRK=env('SUPABASE_SERVICE_ROLE_KEY')
const H={apikey:SRK,Authorization:`Bearer ${SRK}`,'Content-Type':'application/json'}
const argv=process.argv.slice(2)
const APPLY=argv.includes('--apply'), REVERT=argv.includes('--revert')
const CONF_MIN=0.7
const PATH=argv.find(a=>!a.startsWith('--'))||'/tmp/opus_191.json'
const ACTOR='admin:console'
async function rest(p){const r=await fetch(`${SUPA}/rest/v1/${p}`,{headers:H});if(!r.ok)throw new Error(`${p} -> ${r.status}: ${(await r.text()).slice(0,150)}`);return r.json()}
async function rpc(fn,b){const r=await fetch(`${SUPA}/rest/v1/rpc/${fn}`,{method:'POST',headers:H,body:JSON.stringify(b)});if(!r.ok)throw new Error(`rpc ${fn} ${r.status} ${(await r.text()).slice(0,150)}`);return r.status===204?null:r.json()}

async function revert(){
  const ev=await rest(`rag_document_events?select=document_id,action,field,old_value,new_value,created_at&action=in.(opus_reclassify,opus_triage_approve)&order=created_at.desc&limit=10000`)
  let n=0
  for(const e of ev){
    const [cur]=await rest(`rag_documents?select=current_version,review_status,doc_type&id=eq.${e.document_id}`)
    if(!cur)continue
    // only revert if the field still holds the value we set
    if(e.field==='review_status'&&cur.review_status!==e.new_value)continue
    if(e.field==='doc_type'&&cur.doc_type!==e.new_value)continue
    await rpc('apply_document_governance',{p_doc_id:e.document_id,p_patch:{[e.field]:e.old_value},p_expected_version:cur.current_version,p_events:[{document_id:e.document_id,action:e.action+'_revert',field:e.field,old_value:e.new_value,new_value:e.old_value,actor:ACTOR,reason:'revert opus reclassify'}]})
    n++
  }
  console.log(`reverted ${n} field-changes`)
}

async function main(){
  if(REVERT)return revert()
  const rows=JSON.parse(readFileSync(PATH,'utf8'))
  const plan=[]
  for(const r of rows){
    const setDocType = r.now.confidence>=CONF_MIN && r.now.doc_type!=='other' && r.now.doc_type!==r.was.doc_type
    const setApprove = r.decision==='approve'
    if(setDocType||setApprove)plan.push({id:r.id,title:r.title,setDocType:setDocType?r.now.doc_type:null,fromDocType:r.was.doc_type,setApprove,conf:r.now.confidence})
  }
  const docTypeWrites=plan.filter(p=>p.setDocType).length, approveWrites=plan.filter(p=>p.setApprove).length
  console.log(JSON.stringify({source:PATH,docsTouched:plan.length,docType_enrichments:docTypeWrites,approvals:approveWrites,sample:plan.slice(0,10)},null,2))
  if(!APPLY){console.error('\nDRY. add --apply');return}
  let dt=0,ap=0,skip=0
  for(const p of plan){
    const [cur]=await rest(`rag_documents?select=current_version,review_status,lifecycle,doc_type&id=eq.${p.id}`)
    if(!cur||cur.lifecycle==='superseded'||cur.review_status!=='needs_review'){skip++;continue}
    const patch={}, events=[]
    if(p.setDocType&&cur.doc_type!==p.setDocType){patch.doc_type=p.setDocType;events.push({document_id:p.id,action:'opus_reclassify',field:'doc_type',old_value:cur.doc_type,new_value:p.setDocType,actor:ACTOR,reason:`opus reclassify (conf ${p.conf})`})}
    if(p.setApprove){patch.review_status='approved';events.push({document_id:p.id,action:'opus_triage_approve',field:'review_status',old_value:'needs_review',new_value:'approved',actor:ACTOR,reason:'opus-classified SSOT auto-approve'})}
    if(!events.length){skip++;continue}
    try{await rpc('apply_document_governance',{p_doc_id:p.id,p_patch:patch,p_expected_version:cur.current_version,p_events:events});if(patch.doc_type)dt++;if(patch.review_status)ap++}
    catch(e){skip++;console.error(`skip ${p.id}: ${e.message}`)}
  }
  console.log(`applied: doc_type=${dt} approvals=${ap} skipped=${skip}`)
}
main().catch(e=>{console.error(e);process.exit(1)})
