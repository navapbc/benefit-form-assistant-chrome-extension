import { createRequire } from 'node:module';
const { LABELS } = createRequire(import.meta.url)('../shared/form-engine.js');

export const JEV_MODEL = 'jev-1.13.0';
const text = (v, max = 240) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);
const finite = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
export const finalControl = (f) => /captcha|signature|submit|certif|affirm|one.time.code|password|login|payment/i.test(`${f.fieldKey} ${f.label} ${f.question}`);
const decisionControl = (f) => f.required || ['checkbox', 'radio', 'select-one'].includes(f.type) || Boolean(f.purposeHint);

export function validateDecisionRequest(value = {}) {
  if (!Array.isArray(value.fields) || !value.fields.length || value.fields.length > 80) throw new Error('Provide 1–80 minimized form controls.');
  if (!Array.isArray(value.sources) || value.sources.length > 200) throw new Error('Provide the available source-purpose inventory.');
  const threshold = value.threshold ?? 0.9;
  if (![0.8, 0.9, 0.95].includes(threshold)) throw new Error('Use a confidence threshold of 0.8, 0.9 or 0.95.');
  const fields = value.fields.map((f) => ({
    fieldKey: text(f.fieldKey, 180), label: text(f.label), question: text(f.question),
    type: text(f.type, 40), required: Boolean(f.required), alreadyFilled: Boolean(f.alreadyFilled),
    purposeHint: Object.hasOwn(LABELS, f.purposeHint) ? f.purposeHint : '',
    options: Array.isArray(f.options) ? f.options.slice(0, 30).map((o) => text(o, 120)) : [],
  }));
  const keys = fields.map((f) => f.fieldKey);
  if (keys.some((k) => !k || ['__proto__', 'constructor', 'prototype'].includes(k)) || new Set(keys).size !== keys.length) throw new Error('Controls need unique, safe field identifiers.');
  const purposes = [...new Set(value.sources.map((s) => s.purpose))];
  if (purposes.some((p) => !Object.hasOwn(LABELS, p))) throw new Error('A source purpose is outside the form engine allowlist.');
  // Rebuild labels locally; participant values and arbitrary source properties cannot be forwarded.
  return { domain: text(value.domain, 160), fields, sources: purposes.map((purpose) => ({ purpose, label: LABELS[purpose] })), threshold };
}

export function jevRequest(input) {
  const criteria = { ask: 'No safe source answer exists: ask the caseworker.', leave: 'Final or inapplicable control: leave it alone.' };
  input.sources.forEach((s) => { criteria[s.purpose] = s.label; });
  return { model: JEV_MODEL, state: { domain: input.domain, fields: input.fields, availableSources: input.sources }, questions: Object.fromEntries(input.fields.map((f, i) => [`f${i}`, {
    type: 'choice', criteria,
    instructions: `Classify state.fields[${i}], field ${JSON.stringify(f.fieldKey)}: ${JSON.stringify(f.question || f.label)} (${f.required ? 'required' : 'optional'} ${f.type}). The versioned site purpose hint is ${JSON.stringify(f.purposeHint || 'none')}. Choose that exact purpose when present in availableSources. Otherwise choose the matching available source purpose, respecting person/entity scope. Ask when a required answer is unavailable; leave final or inapplicable controls. Do not substitute another person's identifier.`,
  }])) };
}

export function decisionsToPlan(input, body) {
  const available = new Set(input.sources.map((s) => s.purpose));
  const purposeOverrides = Object.create(null), approved = [], rejected = [], gaps = [], deferred = [];
  input.fields.forEach((field, i) => {
    if (finalControl(field)) return;
    const answer = body?.answers?.[`f${i}`];
    const confidence = finite(answer?.confidence);
    const choice = answer?.choice;
    const scopedIdentifier = choice === 'ssn' && /other|another|household member|spouse|child|employer/i.test(`${field.label} ${field.question}`);
    const valid = answer?.type === 'choice' && confidence !== null && confidence <= 1 && confidence >= input.threshold && (available.has(choice) || ['ask', 'leave'].includes(choice));
    const hintConflict = available.has(choice) && field.purposeHint && choice !== field.purposeHint;
    if (valid && available.has(choice) && !scopedIdentifier && !hintConflict) {
      purposeOverrides[field.fieldKey] = choice;
      approved.push({ fieldKey: field.fieldKey, purpose: choice, confidence, source: 'jev', reason: 'Passed source allowlist, scope and confidence checks.' });
      return;
    }
    if (!valid || scopedIdentifier || hintConflict) {
      deferred.push(field.fieldKey);
      rejected.push({ fieldKey: field.fieldKey, reason: 'Uncertain or locally unsupported classification.', confidence });
    }
    if (decisionControl(field) || (valid && choice === 'ask')) {
      gaps.push({ fieldKey: field.fieldKey, question: field.question || field.label || 'What answer belongs in this field?', reason: 'Confirm this answer before filling; no safe approved source mapping.' });
    }
  });
  return { purposeOverrides, approved, rejected, gaps, deferred };
}

export async function runDecisionRequest(value, { environment = process.env, fetchImpl = fetch } = {}) {
  const input = validateDecisionRequest(value);
  const key = environment.TYPESAFE_API_KEY || environment.JEV_API_KEY;
  if (!key) throw new Error('Jev is not configured in the local companion. Supply its test credential to the Node process.');
  const plan = { purposeOverrides: Object.create(null), approved: [], rejected: [], gaps: [], deferred: [] };
  let inputTokens = 0, outputTokens = 0, calls = 0;
  const start = performance.now();
  for (let offset = 0; offset < input.fields.length; offset += 20) {
    const batch = { ...input, fields: input.fields.slice(offset, offset + 20) };
    const response = await fetchImpl('https://api.typesafe.ai/v1/systemone', { method: 'POST', redirect: 'error', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify(jevRequest(batch)), signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Jev returned HTTP ${response.status}. No form values were changed.`);
    const body = await response.json();
    if (body?.model !== JEV_MODEL || !body.answers || typeof body.answers !== 'object') throw new Error('Jev returned an unexpected model or response shape. No form values were changed.');
    const result = decisionsToPlan(batch, body);
    Object.assign(plan.purposeOverrides, result.purposeOverrides);
    for (const k of ['approved', 'rejected', 'gaps', 'deferred']) plan[k].push(...result[k]);
    const ins = finite(body.usage?.input_tokens), outs = finite(body.usage?.output_tokens);
    inputTokens = inputTokens === null || ins === null ? null : inputTokens + ins;
    outputTokens = outputTokens === null || outs === null ? null : outputTokens + outs;
    calls += 1;
  }
  return { plan: { ...plan, metadata: {
    runtime: 'jev-typesafe-local-companion', provider: 'jev', mode: 'cloud-decision-with-local-validation',
    requestedModel: JEV_MODEL, reportedModel: JEV_MODEL, reasoningEffort: null, confidenceThreshold: input.threshold,
    agents: ['decision_classifier'], independentModelReview: false,
    proposedMappings: plan.approved.length + plan.rejected.length, approvedMappings: plan.approved.length,
    rejectedMappings: plan.rejected.length, deferredControls: plan.deferred.length, trustedHintMappings: 0,
    billing: 'typesafe-api-estimate-billed-unknown',
    usage: { prompts: calls, inputTokens, outputTokens, contextUsageUnits: null, durationMs: performance.now() - start,
      apiCostUsd: null, providerReportedCostUsd: null, estimatedApiCostUsd: inputTokens === null ? null : inputTokens * 0.042 / 1e6 },
    pricing: { source: 'https://docs.typesafe.ai/models', checkedAt: '2026-10-07', inputUsdPerMillion: 0.042, outputUsdPerMillion: 0 },
    reviewedAt: new Date().toISOString(), summary: 'Jev classified purposes; local policies checked them. Uncertain decisions require caseworker confirmation. No independent model reviewer.'
  } } };
}
