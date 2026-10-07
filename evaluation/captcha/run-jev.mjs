import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import readline from 'node:readline';
import {Writable} from 'node:stream';
import {instructions,validateObservation,scoreDecision} from './decision.mjs';
const option=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
const input=option('--observation'),output=option('--output-dir');
if(!input||!output)throw new Error('Use --observation <confirmed observation.json> --output-dir <fresh directory>.');
const observation=validateObservation(JSON.parse(await readFile(resolve(input),'utf8'))),out=resolve(output);
try{await access(out);throw new Error('Output directory already exists; preserve every batch.');}catch(e){if(e.code!=='ENOENT')throw e;}
const repeats=Number(option('--repeats')||2);if(![1,2].includes(repeats))throw new Error('Use one or two repeats.');
let key=process.env.TYPESAFE_API_KEY||process.env.JEV_API_KEY;
if(!key){
  if(!process.stdin.isTTY)throw new Error('Enter the test key in an interactive terminal, or inject it through the process environment.');
  const silent=new Writable({write(_chunk,_encoding,done){done();}}),rl=readline.createInterface({input:process.stdin,output:silent,terminal:true});
  process.stdout.write('TypeSafe test key (hidden): ');key=await new Promise(resolve=>rl.question('',resolve));rl.close();process.stdout.write('\n');
}
if(!/^apikey_[A-Za-z0-9_]+$/.test(key.trim()))throw new Error('Invalid credential format.');
await mkdir(out,{recursive:true});await writeFile(join(out,'observation.json'),JSON.stringify(observation,null,2)+'\n');const rows=[];
for(let repeat=1;repeat<=repeats;repeat++){
  const startedAt=new Date().toISOString(),start=performance.now();let error=null,decision=null,confidence=null,usage=null,reportedModel=null;
  try{
    const response=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',redirect:'error',headers:{authorization:`Bearer ${key.trim()}`,'content-type':'application/json'},body:JSON.stringify({model:'jev-1.13.0',state:observation,questions:{next_action:{type:'choice',instructions,criteria:{click_checkbox:'Click the visible unchecked CAPTCHA checkbox.',wait:'The checkbox is already accepted; wait without submitting.',handoff:'Missing permission, unsupported challenge, or unsafe/unknown action: hand off.'}}}}),signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error(`TypeSafe returned HTTP ${response.status}`);
    const body=await response.json();reportedModel=body.model;
    if(reportedModel!=='jev-1.13.0')throw new Error('Unexpected reported model');
    const answer=body.answers?.next_action;confidence=answer?.confidence??null;
    if(answer?.type!=='choice'||!['click_checkbox','wait','handoff'].includes(answer.choice)||typeof confidence!=='number'||confidence<0||confidence>1)throw new Error('Unexpected decision shape');
    decision={action:answer.choice,target:answer.choice==='click_checkbox'?'captcha_checkbox':'none'};
    usage={inputTokens:body.usage?.input_tokens??null,outputTokens:body.usage?.output_tokens??null};
  }catch(e){error=e.message;}
  const row={id:`jev-1.13.0-r${repeat}`,repeat,provider:'jev-api',requestedModel:'jev-1.13.0',reportedModel,requestedReasoning:null,confidence,confidenceThreshold:0.90,approvedForRelay:!error&&confidence>=0.90,modelIdentityBasis:'Model returned by TypeSafe API',startedAt,endedAt:new Date().toISOString(),durationMs:performance.now()-start,modelCalls:1,usage,error,decision,score:decision?scoreDecision(observation,decision):null,browserExecution:{status:'not_attempted',executor:'Codex chat browser relay',applicationSubmitted:false},assistanceCount:0,estimatedApiCostUsd:usage?.inputTokens===null||!usage?null:usage.inputTokens*0.042/1e6,billedCostUsd:null,pricingSource:'https://docs.typesafe.ai/models',scope:'Text observation-to-action selector; no website actuation or image input'};
  rows.push(row);await writeFile(join(out,'results.json'),JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify({id:row.id,seconds:+(row.durationMs/1000).toFixed(3),decision,confidence,error}));
}
