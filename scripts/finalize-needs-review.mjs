// Finalize the residual active needs_review backlog using the Opus classification
// (scripts/reclassify-needs-review-opus.ts --json). Handles two things in one reversible pass:
//   ITEM 2 — over-promotion: docs currently authority_score>=90 that Opus confidently (conf>=DOWNGRADE_CONF)
//            reads as LOW-stakes low-authority (construction drawings, etc.) → downgrade authority to the
//            Opus tier/score (removes them from source_of_record — they were never official) + approve.
//   ITEM 1 — backlog: remaining LOW-stakes docs (conf>=APPROVE_CONF) → approve (low-authority context;
//            they can never be source_of_record). HIGH-stakes types and low-confidence stay for HUMAN.
// Reversible (--revert from audit events), optimistic-locked, audit-evented. Authority is changed ONLY to
// LOWER it (never promotes). HIGH-stakes types are never touched here.
//
// Usage:
//   node scripts/finalize-needs-review.mjs [path=/tmp/opus_191.json]     # DRY
//   node scripts/finalize-needs-review.mjs --apply [path]
//   node scripts/finalize-needs-review.mjs --revert [path]
import { readFileSync } from 'node:fs'
const ROOT = '/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app'
function env(n){const m=readFileSync(`${ROOT}/.env.local`,'utf8').match(new RegExp(`^${n}=(.*)$`,'m'));if(!m)throw new Error(n);return m[1].trim().replace(/^["']|["']$/g,'')}
const SUPA=env('NEXT_PUBLIC_SUPABASE_URL'),SRK=env('SUPABASE_SERVICE_ROLE_KEY')
const H={apikey:SRK,Authorization:`Bearer ${SRK}`,'Content-Type':'application/json'}
const argv=process.argv.slice(2)
const APPLY=argv.includes('--apply'), REVERT=argv.includes('--revert')
const PATH=argv.find(a=>!a.startsWith('--'))||'/tmp/opus_191.json'
const ACTOR='admin:console'
const APPROVE_CONF=0.7, DOWNGRADE_CONF=0.8
const HIGH_STAKES=new Set(['legal','funding','financial_statements','annual_accounts','board','tax','dd','kyc','bp_model'])
async function rest(p){const r=await fetch(`${SUPA}/rest/v1/${p}`,{headers:H});if(!r.ok)throw new Error(`${p} -> ${r.status}: ${(await r.text()).slice(0,150)}`);return r.json()}
async function rpc(fn,b){const r=await fetch(`${SUPA}/rest/v1/rpc/${fn}`,{method:'POST',headers:H,body:JSON.stringify(b)});if(!r.ok)throw new Error(`rpc ${fn} ${r.status} ${(await r.text()).slice(0,150)}`);return r.status===204?null:r.json()}

async function revert(){
  const ev=await rest(`rag_document_events?select=document_id,action,field,old_value,new_value,created_at&action=in.(finalize_approve,finalize_downgrade_tier,finalize_downgrade_score)&order=created_at.desc&limit=10000`)
  // group by doc so we restore tier+score+review together with one fresh version read
  const byDoc=new Map()
  for(const e of ev){if(!byDoc.has(e.document_id))byDoc.set(e.document_id,[]);byDoc.get(e.document_id).push(e)}
  let n=0
  for(const [id,evs] of byDoc){
    const [cur]=await rest(`rag_documents?select=current_version,review_status,authority_tier,authority_score&id=eq.${id}`)
    if(!cur)continue
    const patch={}, events=[]
    for(const e of evs){
      if(e.field==='review_status'&&cur.review_status===e.new_value){patch.review_status=e.old_value}
      if(e.field==='authority_tier'&&cur.authority_tier===e.new_value){patch.authority_tier=e.old_value}
      if(e.field==='authority_score'&&String(cur.authority_score)===String(e.new_value)){patch.authority_score=parseInt(e.old_value,10)}
      if(Object.keys(patch).length)events.push({document_id:id,action:e.action+'_revert',field:e.field,old_value:e.new_value,new_value:e.old_value,actor:ACTOR,reason:'revert finalize'})
    }
    if(!Object.keys(patch).length)continue
    await rpc('apply_document_governance',{p_doc_id:id,p_patch:patch,p_expected_version:cur.current_version,p_events:events})
    n++
  }
  console.log(`reverted ${n} docs`)
}

async function main(){
  if(REVERT)return revert()
  const rows=JSON.parse(readFileSync(PATH,'utf8'))
  const downgrade=[], approve=[], keepHuman=[]
  for(const r of rows){
    const lowStakes=!HIGH_STAKES.has(r.now.doc_type)
    const wasHighAuth=(r.was.score??0)>=90
    if(!lowStakes||r.now.confidence<APPROVE_CONF){keepHuman.push(r);continue}
    if(wasHighAuth && r.now.confidence>=DOWNGRADE_CONF && (r.now.score??0)<90){
      downgrade.push(r) // downgrade authority + approve
    }else{
      approve.push(r) // just approve (low-stakes low-authority)
    }
  }
  console.log(JSON.stringify({
    source:PATH, total:rows.length,
    item2_downgrade_and_approve:downgrade.length,
    item1_approve_only:approve.length,
    kept_for_human:keepHuman.length,
    downgrade_detail:downgrade.map(r=>({title:r.title,wasTier:r.was.tier,wasScore:r.was.score,nowType:r.now.doc_type,nowTier:r.now.tier,nowScore:r.now.score,conf:r.now.confidence})),
    keptHuman_byType:Object.fromEntries(Object.entries(keepHuman.reduce((m,r)=>{const k=r.now.doc_type+(r.now.confidence<APPROVE_CONF?'(lowconf)':'');m[k]=(m[k]||0)+1;return m},{})).sort((a,b)=>b[1]-a[1])),
  },null,2))
  if(!APPLY){console.error('\nDRY. add --apply');return}
  let dn=0,ap=0,skip=0
  const doApprove=async(r,downgradeToo)=>{
    const [cur]=await rest(`rag_documents?select=current_version,review_status,lifecycle,authority_tier,authority_score&id=eq.${r.id}`)
    if(!cur||cur.lifecycle==='superseded'||cur.review_status!=='needs_review'){skip++;return}
    const patch={review_status:'approved'}, events=[{document_id:r.id,action:'finalize_approve',field:'review_status',old_value:'needs_review',new_value:'approved',actor:ACTOR,reason:'finalize: low-stakes opus-classified context approved'}]
    if(downgradeToo && (cur.authority_score??0)>=90 && (r.now.score??0)<90){
      patch.authority_tier=r.now.tier; patch.authority_score=r.now.score
      events.push({document_id:r.id,action:'finalize_downgrade_tier',field:'authority_tier',old_value:cur.authority_tier,new_value:r.now.tier,actor:ACTOR,reason:`finalize: over-promotion corrected (opus conf ${r.now.confidence})`})
      events.push({document_id:r.id,action:'finalize_downgrade_score',field:'authority_score',old_value:String(cur.authority_score),new_value:String(r.now.score),actor:ACTOR,reason:'finalize: over-promotion corrected'})
    }
    try{await rpc('apply_document_governance',{p_doc_id:r.id,p_patch:patch,p_expected_version:cur.current_version,p_events:events});ap++;if(patch.authority_tier)dn++}
    catch(e){skip++;console.error(`skip ${r.id}: ${e.message}`)}
  }
  for(const r of downgrade)await doApprove(r,true)
  for(const r of approve)await doApprove(r,false)
  console.log(`applied: approvals=${ap} (of which authority-downgraded=${dn}) skipped=${skip}`)
}
main().catch(e=>{console.error(e);process.exit(1)})
