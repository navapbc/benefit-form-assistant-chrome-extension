// Six actual decision-model requests; threshold replays are separate analyses.
import {createRequire} from 'node:module';
import {writeFile,mkdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {cases,caseSources} from './cases.mjs';
import {scorePlan} from './score.mjs';
import {callJev,interpretJev,requestForJev,JEV_MODEL} from './jev-adapter.mjs';
const key=process.env.TYPESAFE_API_KEY||process.env.JEV_API_KEY;
if(!key){console.log(JSON.stringify({status:'not-run',reason:'Missing TypeSafe test credential',model:JEV_MODEL,measuredAttempts:0}));process.exitCode=2;}
else{
 const planner=createRequire(import.meta.url)('./source/agentic-planner.cjs');
 const outIndex=process.argv.indexOf('--output-dir');
 const out=outIndex<0?new URL('../../outputs/benchmark-evidence/jev-controlled/',import.meta.url):pathToFileURL(resolve(process.argv[outIndex+1])+'/');
 let exists=false;try{await access(new URL('results.json',out));exists=true;}catch{}if(exists)throw new Error('Results already exist; select a fresh --output-dir.');
 await mkdir(out,{recursive:true});const rows=[];
 for(let repeat=1;repeat<=2;repeat++)for(const c of cases){
  const id=`jev-${JEV_MODEL}-${c.id}-r${repeat}`,fields=planner.groupedInventory(c.rawFields),sources=caseSources(c),input={domain:c.site==='WIC'?'www.ruhealth.org':c.site==='IHSS'?'www.riversideihss.org':'benefitscal.com',fields,sources};
  const start=performance.now(),startedAt=new Date().toISOString();let receipt=null,error=null;
  try{receipt=await callJev(input,{key});}catch(e){error=e.message;}
  const analyses=receipt?.rawResponse?[0.8,0.9,0.95].map(threshold=>{const plan=interpretJev(fields,sources,receipt.rawResponse,threshold);return {threshold,score:scorePlan(c,plan),deferred:plan.deferred.length,decisions:plan.decisions};}):[];
  const row={id,repeat,caseId:c.id,site:c.site,fixtureKind:c.kind,backbone:'Jev decision stage; no Eve fallback or browser execution',model:JEV_MODEL,requestedModel:JEV_MODEL,reportedModel:receipt?.reportedModel??null,startedAt,endedAt:new Date().toISOString(),wallMs:performance.now()-start,status:error?'failed':'scored',modelCalls:1,assistanceCount:0,requestSha256:createHash('sha256').update(JSON.stringify(requestForJev(input))).digest('hex'),usage:receipt?.usage??null,billedCostUsd:null,totalOperatingCostUsd:null,analyses,receipt,error};
  rows.push(row);await writeFile(new URL(`${id}.json`,out),JSON.stringify(row,null,2)+'\n');await writeFile(new URL('results.json',out),JSON.stringify(rows,null,2)+'\n');
  console.log(JSON.stringify({id,status:row.status,wallSeconds:row.wallMs/1000,planningPassAt08:analyses[0]?.score.planningPass??null,error}));
  if(error&&rows.length===1)throw new Error('First Jev request failed; remaining attempts were not run. Receipt preserved.');
 }
}
