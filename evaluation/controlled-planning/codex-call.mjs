import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseUsage} from './score.mjs';
import {createHash} from 'node:crypto';
const sha256=x=>createHash('sha256').update(x).digest('hex');
export async function codexCall(request,config){
 const dir=await mkdtemp(join(tmpdir(),'benefit-eval-')),schema=join(dir,'schema.json'),output=join(dir,'output.json');
 await writeFile(schema,JSON.stringify(request.responseSchema));
 const args=['exec','--ephemeral','--skip-git-repo-check','--sandbox','read-only','--ignore-user-config','--ignore-rules','--model',config.model,'--config',`model_reasoning_effort="${config.reasoning}"`,'--json','--output-schema',schema,'--output-last-message',output,'--color','never','--cd',dir,'-'];
 if(config.imagePaths?.length)args.splice(args.length-1,0,...config.imagePaths.flatMap(path=>['--image',path]));
 const env={...process.env};delete env.OPENAI_API_KEY;delete env.AZURE_OPENAI_API_KEY;delete env.TYPESAFE_API_KEY;delete env.JEV_API_KEY;
 const startedAt=new Date().toISOString(),start=performance.now();let stdout='',stderr='',timeout=false;
 try{
  const code=await new Promise((resolve,reject)=>{const child=spawn('codex',args,{shell:false,env,cwd:dir,stdio:['pipe','pipe','pipe']});const timer=setTimeout(()=>{timeout=true;child.kill('SIGKILL');},config.timeoutMs??120000);child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);child.once('error',reject);child.once('close',code=>{clearTimeout(timer);resolve(code);});child.stdin.end(request.systemPrompt+'\n\nDo not use tools, inspect files, or browse. Return only the requested structured classification.\n\n'+request.prompt);});
  const events=stdout.split('\n').filter(Boolean).flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}});
  const usage=parseUsage(events);
  const modelMatch=stderr.match(/^model:\s*(.+)$/m),effortMatch=stderr.match(/^reasoning effort:\s*(.+)$/m);
  const tooling=events.filter(e=>e.type==='item.completed'&&/command_execution|mcp_tool_call|web_search/.test(e.item?.type||''));
  const receipt={role:request.role,startedAt,endedAt:new Date().toISOString(),durationMs:performance.now()-start,requestedModel:config.model,requestedReasoning:config.reasoning,reportedModel:modelMatch?.[1]?.trim()??null,reportedReasoning:effortMatch?.[1]?.trim()??null,modelIdentityBasis:modelMatch?'CLI startup banner':'Explicit CLI flags; provider-resolved identity not emitted',requestHashes:{system:sha256(request.systemPrompt),inventory:sha256(request.prompt),schema:sha256(JSON.stringify(request.responseSchema))},usage,exitCode:code,timedOut:timeout,toolCalls:tooling.length,events:events.filter(e=>e.type!=='item.completed'||e.item?.type!=='reasoning'),stderr:stderr.slice(0,8000)};
  if(code!==0||tooling.length){receipt.error=timeout?'timeout':tooling.length?'Tools invoked during classification':(events.find(e=>e.type==='error')?.message||stderr.trim().slice(-500)||`CLI exited ${code}`);return {receipt,error:receipt.error};}
  let text;try{text=await readFile(output,'utf8');JSON.parse(text);}catch(e){receipt.error='Malformed or absent JSON output';return {receipt,error:receipt.error};}
  receipt.output=JSON.parse(text);return {text,receipt};
 }finally{await rm(dir,{recursive:true,force:true});}
}
