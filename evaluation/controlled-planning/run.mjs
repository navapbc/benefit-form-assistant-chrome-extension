import {createRequire} from 'node:module';
import {writeFile,readFile,mkdir,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {cases,engine} from './cases.mjs';
import {scorePlan} from './score.mjs';
import {codexCall} from './codex-call.mjs';
const require=createRequire(import.meta.url),planner=require('./source/agentic-planner.cjs');
const hash=x=>createHash('sha256').update(x).digest('hex');
const base=new URL('./',import.meta.url);
const option=name=>{const i=process.argv.indexOf(name);if(i<0)return null;if(!process.argv[i+1]||process.argv[i+1].startsWith('--'))throw new Error(`Missing value for ${name}`);return process.argv[i+1];};
const models=(option('--models')??'gpt-6.1-sol,gpt-6-luna').split(','),efforts=(option('--reasoning')??'low,xhigh').split(',');
if(models.some(x=>!['gpt-6.1-sol','gpt-6-luna'].includes(x)))throw new Error('This priced pilot supports only GPT-6.1 Sol and GPT-6 Luna; add verified model metadata before extending it.');
if(efforts.some(x=>!['low','medium','high','xhigh','max'].includes(x)))throw new Error('Unsupported reasoning setting for this matrix.');
const only=process.argv.includes('--smoke'),repeats=only?1:Number(option('--repeats')??2);
if(!Number.isInteger(repeats)||repeats<1||repeats>100)throw new Error('Repeats must be an integer from 1 to 100.');
const requestedOut=option('--output-dir');
const out=requestedOut?pathToFileURL(resolve(requestedOut)+'/'):new URL(only?'../local-results/cli-smoke/':'../local-results/cli-default/',base);
let exists=false;try{await access(new URL('results.json',out));exists=true;}catch{}if(exists)throw new Error('Results already exist. Use --output-dir with a fresh batch directory; measured attempts must not be overwritten.');
await mkdir(out,{recursive:true});
for(const c of cases){const keys=new Set(planner.groupedInventory(c.rawFields).map(f=>f.fieldKey));for(const k of [...Object.keys(c.expectedMappings),...c.expectedGaps])if(!keys.has(k))throw new Error(`Invalid golden field ${c.id}: ${k}`);}
const manifest={schema:'benefit-evaluation/v1',startedAt:new Date().toISOString(),layer:'Planning classification only; no browser execution',models:only?models.slice(0,1):models,reasoning:only?efforts.slice(0,1):efforts,repeats,order:'Sequential plans; mapper and gap analyst may overlap inside each plan; reverse config order on repeat 2',harness:'Frozen three-role extension planner',cliVersion:'0.159.2',plannerSha256:hash(await readFile(new URL('./source/agentic-planner.cjs',base))),casesSha256:hash(await readFile(new URL('./cases.mjs',base))),pricing:{directApiKeyChargeUsd:0,basis:'Signed-in ChatGPT allowance; API keys removed from child environment',subscriptionAllocationUsd:null,operatingCostUsd:null},assistanceAllowed:false,caseSummaries:cases.map(c=>({id:c.id,site:c.site,kind:c.kind,expectedMappings:c.expectedMappings,expectedGaps:c.expectedGaps,knownExecutionDefect:c.knownExecutionDefect??null})),notMeasured:['live DOM actuation','page transitions','CAPTCHA','final review','semantic value accuracy','full application completeness','Eve performance','Jev performance']};
await writeFile(new URL('manifest.json',out),JSON.stringify(manifest,null,2)+'\n');
const configs=manifest.models.flatMap(model=>manifest.reasoning.map(reasoning=>({model,reasoning,timeoutMs:120000})));
const all=[],pending=new Set();let active;
planner.setBridgeFetchForTests(async(url,options)=>{
 if(url.endsWith('/health'))return {ok:true,json:async()=>({ok:true,providers:{codex:{installed:true,subscription:true}}})};
 const request=JSON.parse(options.body),attempt=active;
 const task=(async()=>{const result=await codexCall(request,attempt.config);attempt.calls.push(result.receipt);
  await writeFile(new URL(`${attempt.id}-${request.role}.json`,out),JSON.stringify(result.receipt,null,2)+'\n');
  return {ok:!result.error,json:async()=>result.error?{ok:false,error:result.error}:{ok:true,text:result.text,usage:{...result.receipt.usage,durationMs:result.receipt.durationMs,providerReportedCostUsd:null}}};})();
 pending.add(task);try{return await task;}finally{pending.delete(task);}
});
for(let repeat=1;repeat<=repeats;repeat++)for(const config of repeat%2?configs:[...configs].reverse())for(const c of only?cases.slice(0,1):cases){
 const id=`${config.model}-${config.reasoning}-${c.id}-r${repeat}`;
 active={id,config,calls:[]};planner.configure({kind:'local-cli',provider:'codex',model:config.model,endpoint:'http://127.0.0.1:4174',token:'benchmark-in-process-no-network-token'});
 const startedAt=new Date().toISOString(),start=performance.now();let plan=null,error=null;
 try{plan=await planner.plan({engine,page:{domain:c.site==='WIC'?'www.ruhealth.org':c.site==='IHSS'?'www.riversideihss.org':'benefitscal.com'},rawFields:c.rawFields,participant:c.participant});}catch(e){error=e.message;}
 // Preserve a parallel call receipt even if its sibling failed first.
 await Promise.allSettled([...pending]);
 const row={id,repeat,caseId:c.id,site:c.site,fixtureKind:c.kind,model:config.model,reasoning:config.reasoning,backbone:'extension-three-role/Codex-CLI',status:error?'failed':'scored',startedAt,endedAt:new Date().toISOString(),wallMs:performance.now()-start,modelCalls:active.calls.length,usage:active.calls.map(x=>x.usage),assistanceCount:0,score:plan?scorePlan(c,plan):null,error,plan,callReceipts:active.calls.map(x=>({role:x.role,reportedModel:x.reportedModel,reportedReasoning:x.reportedReasoning,modelIdentityBasis:x.modelIdentityBasis,durationMs:x.durationMs,timedOut:x.timedOut,toolCalls:x.toolCalls,error:x.error??null})),directApiKeyChargeUsd:0,totalOperatingCostUsd:null};
 await writeFile(new URL(`${id}.json`,out),JSON.stringify(row,null,2)+'\n');all.push(row);await writeFile(new URL('results.json',out),JSON.stringify(all,null,2)+'\n');
 console.log(JSON.stringify({id,status:row.status,wallSeconds:+(row.wallMs/1000).toFixed(2),score:row.score?{maps:`${row.score.mappingCorrect}/${row.score.mappingExpected}`,gaps:`${row.score.gapFound}/${row.score.gapExpected}`,wrong:row.score.wrongMappings,falseGaps:row.score.falseGaps,pass:row.score.planningPass}:null,error}));planner.reset();
}
manifest.endedAt=new Date().toISOString();manifest.executedPlans=all.length;manifest.failedPlans=all.filter(x=>x.status==='failed').length;await writeFile(new URL('manifest.json',out),JSON.stringify(manifest,null,2)+'\n');
