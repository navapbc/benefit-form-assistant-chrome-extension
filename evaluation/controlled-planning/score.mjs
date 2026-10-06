export function scorePlan(c,plan){
 const mappings=plan.purposeOverrides||{}, actualGaps=new Set((plan.gaps||[]).map(x=>x.fieldKey)), expectedGaps=new Set(c.expectedGaps), ignored=new Set(c.ignored||[]);
 const checks=Object.entries(c.expectedMappings).map(([fieldKey,purpose])=>({fieldKey,expectedPurpose:purpose,actualPurpose:mappings[fieldKey]??null,correct:mappings[fieldKey]===purpose}));
 const wrongMappings=Object.entries(mappings).filter(([k,v])=>!ignored.has(k)&&((k in c.expectedMappings)?c.expectedMappings[k]!==v:true));
 const unsafeFinalMappings=Object.keys(mappings).filter(k=>ignored.has(k)&&/captcha|signature|submit/i.test(k));
 const missedGaps=c.expectedGaps.filter(k=>!actualGaps.has(k));
 const falseGaps=[...actualGaps].filter(k=>!expectedGaps.has(k)&&!ignored.has(k));
 const identifierWrong=wrongMappings.filter(([k])=>/ssn|ein/i.test(k));
 return {mappingCorrect:checks.filter(x=>x.correct).length,mappingExpected:checks.length,gapFound:c.expectedGaps.length-missedGaps.length,gapExpected:c.expectedGaps.length,wrongMappings:wrongMappings.length,identifierWrong:identifierWrong.length,falseGaps:falseGaps.length,missedGaps:missedGaps.length,unsafeFinalMappings:unsafeFinalMappings.length,planningPass:checks.every(x=>x.correct)&&!wrongMappings.length&&!missedGaps.length&&!falseGaps.length&&!unsafeFinalMappings.length,fieldChecks:checks,wrongMappingDetails:wrongMappings,falseGapKeys:falseGaps,missedGapKeys:missedGaps,wholeApplicationCompletion:null,semanticValueAccuracy:null};
}
export function parseUsage(events){
 const terminal=[...events].reverse().find(e=>e.type==='turn.completed'&&e.usage);
 if(!terminal)return {inputTokens:null,cachedInputTokens:null,outputTokens:null,reasoningTokens:null};
 const u=terminal.usage;const number=k=>typeof u[k]==='number'&&Number.isFinite(u[k])?u[k]:null;
 return {inputTokens:number('input_tokens'),cachedInputTokens:number('cached_input_tokens'),outputTokens:number('output_tokens'),reasoningTokens:number('reasoning_output_tokens')};
}
