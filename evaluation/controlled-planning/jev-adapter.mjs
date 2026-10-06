// Real TypeSafe transport, not a scripted substitute. Provider keys remain in Node.
export const JEV_MODEL='jev-1.13.0';
export function requestForJev({domain,fields,sources}){
 const criteria={ask:'The answer is missing: ask the participant or caseworker.',leave:'This is a final action, CAPTCHA, signature, or inapplicable control: leave it alone.'};
 for(const s of sources)criteria[s.purpose]=s.label||s.purpose;
 const questions=Object.fromEntries(fields.map((f,i)=>['f'+i,{type:'choice',instructions:`For the ${f.required?'required':'optional'} ${f.type} control ${JSON.stringify(f.question||f.label)}, choose the exact available source purpose. Do not substitute another person or identifier. If no matching source exists for a required answer, choose ask. For CAPTCHA, signature, submit or an explicitly inapplicable control choose leave.`,criteria}]));
 return {model:JEV_MODEL,state:{domain,fields:fields.map(({label,question,type,required,options,purposeHint})=>({label,question,type,required,options,purposeHint})),availableSources:sources.map(({purpose,label})=>({purpose,label}))},questions};
}
export function interpretJev(fields,sources,body,threshold=0.8){
 const allowed=new Set(sources.map(s=>s.purpose));const purposeOverrides={},gaps=[],deferred=[],decisions=[];
 fields.forEach((f,i)=>{const a=body.answers?.['f'+i];const confidence=typeof a?.confidence==='number'?a.confidence:NaN;const forbidden=/captcha|signature|submit/i.test(`${f.fieldKey} ${f.label}`);
  if(forbidden){decisions.push({fieldKey:f.fieldKey,action:'leave',basis:'Local final-action policy'});return;}
  if(a?.type!=='choice'||!Number.isFinite(confidence)||confidence<0||confidence>1||confidence<threshold||!(a.choice==='ask'||a.choice==='leave'||allowed.has(a.choice))){deferred.push(f.fieldKey);decisions.push({fieldKey:f.fieldKey,action:'defer',confidence:Number.isFinite(confidence)?confidence:null});return;}
  decisions.push({fieldKey:f.fieldKey,action:a.choice,confidence});
  if(a.choice==='ask')gaps.push({fieldKey:f.fieldKey,question:f.question||f.label});
  else if(a.choice!=='leave')purposeOverrides[f.fieldKey]=a.choice;
 });return {purposeOverrides,gaps,deferred,decisions};
}
export async function callJev(input,{key=process.env.TYPESAFE_API_KEY||process.env.JEV_API_KEY,threshold=0.8}={}){
 if(!key)return {status:'not-run',reason:'Missing TypeSafe credential',model:JEV_MODEL,score:null,usage:null,costUsd:null};
 const request=requestForJev(input),start=performance.now();const res=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(20000)});
 const body=await res.json().catch(()=>null);if(!res.ok)throw new Error(`Jev HTTP ${res.status}`);
 const number=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
 return {status:'scored',requestedModel:JEV_MODEL,reportedModel:body?.model??null,wallMs:performance.now()-start,usage:{inputTokens:number(body?.usage?.input_tokens),outputTokens:number(body?.usage?.output_tokens)},plan:interpretJev(input.fields,input.sources,body||{},threshold),rawResponse:body,pricingBasis:'Price must be verified and recorded at run time; missing usage is unknown.'};
}
