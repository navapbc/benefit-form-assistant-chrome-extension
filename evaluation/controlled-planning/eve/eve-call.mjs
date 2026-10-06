import {Client} from 'eve/client';
import {createHash} from 'node:crypto';
const sha256=x=>createHash('sha256').update(x).digest('hex');
const number=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
export async function eveCall(request,{host='http://127.0.0.1:4188',model='gpt-6.1-sol',reasoning='low'}={}){
 const client=new Client({host,redirect:'error'}),start=performance.now(),startedAt=new Date().toISOString();let session;
 try{
  const created=await client.sessions.create({message:JSON.stringify({role:request.role,roleInstructions:request.systemPrompt,inventoryPrompt:request.prompt}),outputSchema:request.responseSchema,signal:AbortSignal.timeout(120000)});
  session=created.session;const result=await created.response.result();
  const events=result.events.filter(x=>!x.type.startsWith('reasoning.'));
  const steps=events.filter(x=>x.type==='step.completed');
  const starts=events.filter(x=>x.type==='step.started');
  const terminal=[...events].reverse().find(x=>['session.waiting','session.completed','session.failed'].includes(x.type));
  const receipt={role:request.role,startedAt,endedAt:new Date().toISOString(),durationMs:performance.now()-start,requestedModel:model,requestedReasoning:reasoning,reportedModel:starts.map(x=>x.data?.modelId).filter(Boolean),requestHashes:{system:sha256(request.systemPrompt),inventory:sha256(request.prompt),schema:sha256(JSON.stringify(request.responseSchema))},status:result.status,usageRaw:terminal?.data?.usage??null,stepUsage:steps.map(x=>x.data?.usage??null),events,output:result.data??null,modelSteps:steps.length,framework:'eve',frameworkVersion:'0.71.2',modelIdentityBasis:'Configured model in public Eve step.started events; no provider-resolved attestation',pricingBasis:'Local ChatGPT subscription; no API key; allocation and total cost unknown'};
  if(result.data===undefined||result.status==='failed')return {receipt,error:'Eve did not produce a structured result'};
  const u=terminal?.data?.usage??{};return {text:JSON.stringify(result.data),receipt,usage:{inputTokens:number(u.inputTokens??u.input_tokens),outputTokens:number(u.outputTokens??u.output_tokens),cachedInputTokens:number(u.cacheReadTokens??u.cachedInputTokens??u.cached_input_tokens),durationMs:receipt.durationMs,providerReportedCostUsd:number(u.costUsd)}};
 }catch(e){return {error:e.message,receipt:{role:request.role,startedAt,endedAt:new Date().toISOString(),durationMs:performance.now()-start,requestedModel:model,requestedReasoning:reasoning,status:'failed',error:e.message,usage:null,framework:'eve',frameworkVersion:'0.71.2'}};}
 finally{if(session)await session.reset({reason:'Benchmark attempt finished; fresh session required for next role'}).catch(()=>{});}
}
