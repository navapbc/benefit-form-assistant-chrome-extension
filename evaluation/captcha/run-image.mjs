import {readFile,mkdir,writeFile,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {codexCall} from '../controlled-planning/codex-call.mjs';
import {imageSchema as schema,imageInstructions as instructions} from './image-task.mjs';
const option=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
const input=option('--image'),output=option('--output-dir');
if(!input||!output)throw new Error('Use --image <observed challenge.png> --output-dir <fresh directory>.');
const out=resolve(output),image=resolve(input);
try{await access(out);throw new Error('Preserve existing image trials; use a fresh directory.');}catch(e){if(e.code!=='ENOENT')throw e;}
await mkdir(out,{recursive:true});
const gridSize=Number(option('--grid-size')||3);if(![3,4].includes(gridSize))throw new Error('Use a visibly observed 3 or 4 tile grid size.');
const taskSchema=gridSize===3?schema:{...schema,properties:{...schema.properties,tiles:{type:'array',items:{type:'integer',minimum:1,maximum:16}}}};
const taskInstructions=gridSize===3?instructions:instructions.replace('3 by 3','4 by 4').replace('1 to 9','1 to 16');
const request={role:'captcha_image_classifier',systemPrompt:taskInstructions,prompt:'Read the challenge instruction in the attached screenshot and identify matching tiles.',responseSchema:taskSchema};
const hash=createHash('sha256').update(await readFile(image)).digest('hex'),rows=[];
// Start with the runtime that encountered this challenge. Repeat on frozen pixels.
if(option('--model')&&!['gpt-6.1-sol','gpt-6-luna'].includes(option('--model')))throw new Error('Use a requested Sol or Luna model.');
if(option('--reasoning')&&!['low','xhigh'].includes(option('--reasoning')))throw new Error('Use low or xhigh reasoning.');
const configs=option('--model')?[{model:option('--model'),reasoning:option('--reasoning')||'low'}]:[{model:'gpt-6.1-sol',reasoning:'xhigh'},{model:'gpt-6.1-sol',reasoning:'low'},{model:'gpt-6-luna',reasoning:'low'},{model:'gpt-6-luna',reasoning:'xhigh'}];
const repeats=Number(option('--repeats')||2);if(![1,2].includes(repeats))throw new Error('Use one or two repeats.');
for(let repeat=1;repeat<=repeats;repeat++)for(const config of repeat===1?configs:[...configs].reverse()){
 const result=await codexCall(request,{...config,imagePaths:[image],timeoutMs:90000});
 const r=result.receipt;let answer=null,error=result.error||null;if(!error)try{answer=JSON.parse(result.text);}catch{error='Invalid JSON';}
 const row={id:`codex-${config.model}-${config.reasoning}-image-r${repeat}`,provider:'codex-cli',repeat,requestedModel:config.model,requestedReasoning:config.reasoning,reportedModel:r.reportedModel,modelIdentityBasis:r.modelIdentityBasis,startedAt:r.startedAt,endedAt:r.endedAt,durationMs:r.durationMs,usage:r.usage,answer,error,modelCalls:1,toolCalls:r.toolCalls,imageSha256:hash,directApiKeyChargeUsd:0,billedCostUsd:null,scope:'Frozen public WIC image challenge classification; live site execution recorded separately'};
 rows.push(row);await writeFile(join(out,'results.json'),JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify({id:row.id,seconds:+(row.durationMs/1000).toFixed(3),answer,error}));
}
