const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../shared/form-engine.js');
const planner = require('../shared/agentic-planner.js');
const base = { fields: [{ fieldKey: 'name', label: 'Applicant full name', type: 'text', required: true }], sources: [{ purpose: 'fullName', label: 'must be rebuilt', value: 'PRIVATE' }] };
const response = (answers, usage = { input_tokens: 100, output_tokens: 20 }) => ({ model: 'jev-1.13.0', answers, usage });
test.afterEach(() => { planner.setRuntimeForTests(null); planner.setBridgeFetchForTests(null); });

test('Jev request strips values, allowlists purposes and rejects invalid controls', async () => {
  const j = await import('../model-bridge/jev.mjs');
  const input = j.validateDecisionRequest({ ...base, participant: 'PRIVATE', fields: [{ ...base.fields[0], value: 'PRIVATE' }] });
  assert.doesNotMatch(JSON.stringify(j.jevRequest(input)), /PRIVATE|must be rebuilt/);
  assert.throws(() => j.validateDecisionRequest({ ...base, sources: [{ purpose: 'arbitrary' }] }), /allowlist/);
  assert.throws(() => j.validateDecisionRequest({ ...base, fields: [{ ...base.fields[0], fieldKey: '__proto__' }] }), /safe field/);
});

test('required deferrals and leave responses become explicit questions; final actions never do', async () => {
  const j = await import('../model-bridge/jev.mjs');
  const input = j.validateDecisionRequest({ ...base, fields: [base.fields[0], { fieldKey: 'captcha', label: 'CAPTCHA', required: true }, { fieldKey: 'signature', label: 'Signature', required: true }] });
  for (const answer of [{ type: 'choice', choice: 'fullName', confidence: 0.44 }, { type: 'choice', choice: 'leave', confidence: 1 }, { type: 'choice', choice: 'fullName', confidence: NaN }, undefined]) {
    const p = j.decisionsToPlan(input, response({ f0: answer, f1: { type: 'choice', choice: 'fullName', confidence: 1 } }));
    assert.deepEqual(p.gaps.map((g) => g.fieldKey), ['name']);
    assert.equal(Object.keys(p.purposeOverrides).length, 0);
  }
});

test('other-person identifiers and conflicting site hints are rejected even at full confidence', async () => {
  const j = await import('../model-bridge/jev.mjs');
  const input = j.validateDecisionRequest({ fields: [{ fieldKey: 'other-ssn', label: 'Other household member Social Security Number', required: true }, { fieldKey: 'last', label: 'Last name', purposeHint: 'lastName', required: true }], sources: [{ purpose: 'ssn' }, { purpose: 'firstName' }] });
  const p = j.decisionsToPlan(input, response({ f0: { type: 'choice', choice: 'ssn', confidence: 1 }, f1: { type: 'choice', choice: 'firstName', confidence: 1 } }));
  assert.equal(Object.keys(p.purposeOverrides).length, 0);
  assert.equal(p.gaps.length, 2);
});

test('Jev transport chunks large inventories, preserves missing usage and returns no key or raw response', async () => {
  const j = await import('../model-bridge/jev.mjs'); let requests = 0;
  const result = await j.runDecisionRequest({ ...base, fields: Array.from({ length: 21 }, (_, i) => ({ ...base.fields[0], fieldKey: `name-${i}` })) }, { environment: { TYPESAFE_API_KEY: 'sentinel-test-key' }, fetchImpl: async (_url, options) => {
    requests++; assert.equal(options.redirect, 'error'); assert.equal(options.headers.authorization, 'Bearer sentinel-test-key');
    const req = JSON.parse(options.body); assert.ok(Object.keys(req.questions).length <= 20);
    return { ok: true, json: async () => response(Object.fromEntries(Object.keys(req.questions).map((k) => [k, { type: 'choice', choice: 'fullName', confidence: 1 }])), requests === 2 ? {} : { input_tokens: 100, output_tokens: 20 }) };
  }});
  assert.equal(requests, 2); assert.equal(result.plan.metadata.usage.prompts, 2);
  assert.equal(result.plan.metadata.usage.inputTokens, null); assert.equal(result.plan.metadata.usage.apiCostUsd, null); assert.equal(result.plan.metadata.usage.estimatedApiCostUsd, null);
  assert.doesNotMatch(JSON.stringify(result), /sentinel-test-key|probabilities|rawResponse/);
  await assert.rejects(j.runDecisionRequest(base, { environment: {} }), /not configured/);
  await assert.rejects(j.runDecisionRequest(base, { environment: { JEV_API_KEY: 'sentinel-test-key' }, fetchImpl: async () => ({ ok: false, status: 401 }) }), /HTTP 401/);
});

test('extension uses Jev companion without Nano and revalidates hostile mappings before execution', async () => {
  planner.configure({ kind: 'local-cli', provider: 'jev', endpoint: 'http://127.0.0.1:4174', token: 'test-pairing-token-24-characters' });
  const sent = [];
  planner.setBridgeFetchForTests(async (url, options) => {
    if (url.endsWith('/health')) return { ok: true, json: async () => ({ ok: true, providers: { jev: { configured: true } } }) };
    sent.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ ok: true, plan: { purposeOverrides: { first: 'firstName', income: 'firstName', captcha: 'firstName' }, approved: [{ fieldKey: 'first', purpose: 'firstName', confidence: 1 }, { fieldKey: 'income', purpose: 'firstName', confidence: 0.3 }, { fieldKey: 'captcha', purpose: 'firstName', confidence: 1 }], gaps: [], metadata: { reportedModel: 'jev-1.13.0' } } }) };
  });
  const p = await planner.plan({ engine, page: { domain: 'example.test' }, participant: { firstName: 'PrivateSourceName' }, rawFields: [{ fieldKey: 'first', type: 'text', label: 'First name for PrivateSourceName', required: true }, { fieldKey: 'income', type: 'text', label: 'Monthly income', required: true }, { fieldKey: 'captcha', label: 'CAPTCHA', required: true }] });
  assert.equal(sent.length, 1); assert.doesNotMatch(JSON.stringify(sent), /PrivateSourceName/);
  assert.deepEqual(p.purposeOverrides, { first: 'firstName' });
  assert.deepEqual(p.gaps.map((g) => g.fieldKey), ['income']);
  assert.equal(planner.runtimeInfo().provider, 'jev');
});
