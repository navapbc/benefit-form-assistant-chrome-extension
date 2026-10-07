import {Client} from 'eve/client';
export async function eveCall(request){
  const client=new Client({host:'http://127.0.0.1:4194',redirect:'error'}),start=performance.now(),startedAt=new Date().toISOString();let session=null;
  try{
    const created=await client.sessions.create({message:JSON.stringify({role:request.role,roleInstructions:request.systemPrompt,observation:request.prompt}),outputSchema:request.responseSchema,signal:AbortSignal.timeout(90000)});
    session=created.session;const result=await created.response.result(),events=result.events.filter(e=>!e.type.startsWith('reasoning.'));
    const reportedModel=events.filter(e=>e.type==='step.started').map(e=>e.data?.modelId).filter(Boolean),terminal=[...events].reverse().find(e=>['session.completed','session.waiting','session.failed'].includes(e.type));
    const receipt={startedAt,endedAt:new Date().toISOString(),durationMs:performance.now()-start,reportedModel,usageRaw:terminal?.data?.usage??null,modelIdentityBasis:'Eve configured step model; no provider-resolved attestation'};
    if(result.status==='failed'||result.data===undefined)return{receipt,error:'Eve produced no structured decision'};
    return{text:JSON.stringify(result.data),receipt};
  }catch(e){return{error:e.message,receipt:{startedAt,endedAt:new Date().toISOString(),durationMs:performance.now()-start,reportedModel:null}};}
  finally{if(session)await session.reset({reason:'CAPTCHA decision trial finished'}).catch(()=>{});}
}
