import {Client,createTextWithFileContent} from 'eve/client';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {imageSchema,imageInstructions} from '../image-task.mjs';
const option=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
const input=option('--image'),output=option('--output-dir');if(!input||!output)throw new Error('Use --image <captured screenshot> --output-dir <fresh directory>.');
const out=resolve(output);await mkdir(out);const bytes=await readFile(resolve(input)),hash=createHash('sha256').update(bytes).digest('hex'),rows=[];
const client=new Client({host:'http://127.0.0.1:4194',redirect:'error'});
for(let repeat=1;repeat<=2;repeat++){
 const startedAt=new Date().toISOString(),start=performance.now();let session=null,answer=null,error=null,usage=null,models=null,resultStatus=null,terminalEventType=null;
 try{const created=await client.sessions.create({message:createTextWithFileContent({bytes,filename:'public-wic-challenge.png',mediaType:'image/png',text:imageInstructions}),outputSchema:imageSchema,signal:AbortSignal.timeout(90000)});session=created.session;
 const result=await created.response.result();resultStatus=result.status;answer=result.data??null;const events=result.events;models=events.filter(e=>e.type==='step.started').map(e=>e.data?.modelId).filter(Boolean);const terminal=[...events].reverse().find(e=>['session.completed','session.waiting','session.failed'].includes(e.type));terminalEventType=terminal?.type??null;usage=terminal?.data?.usage??null;if(!answer)error='No structured image result';
 }catch(e){error=e.message;}finally{if(session)await session.reset({reason:'Image trial finished'}).catch(()=>{});}
 const row={id:`eve-gpt-6.1-sol-low-image-r${repeat}`,provider:'eve-0.71.2',repeat,requestedModel:'gpt-6.1-sol',requestedReasoning:'low',reportedModel:models,modelIdentityBasis:'Configured Eve step model; no provider-resolved attestation',startedAt,endedAt:new Date().toISOString(),durationMs:performance.now()-start,answer,error,resultStatus,terminalEventType,usage,imageSha256:hash,directApiKeyChargeUsd:0,billedCostUsd:null,scope:'Frozen public WIC image classification; browser execution separate'};rows.push(row);await writeFile(join(out,'results.json'),JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify({id:row.id,seconds:+(row.durationMs/1000).toFixed(3),answer,error}));
}
