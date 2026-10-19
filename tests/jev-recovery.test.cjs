const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../shared/form-engine.js');
const planner = require('../shared/agentic-planner.js');
const adapters = require('../shared/site-adapters.js');
const page = { url: 'https://www.ruhealth.org/appointments/apply-4-wic-form', domain: 'www.ruhealth.org', documentId: 'test-document-a' };
const address = { street: '12 Test Street', unit: 'Apt 3', city: 'Riverside', state: 'CA', zip: '92501' };
const person = { firstName: 'Synthetic', lastName: 'Applicant', mediCalCoverage: 'No', address: { residential: address, mailing: address } };
const field = (id, extra = {}) => ({ id, fieldKey: id, type: 'text', label: id, value: '', ...adapters.fieldPolicy('www.ruhealth.org', '/appointments/apply-4-wic-form', { id }), ...extra });
const controls = [field('edit-name'), field('edit-home-address'), field('edit-if-yes'), field('edit-mailing-address-if-different-from-home-address-')];
function bridge(choose) {
  const sent = [];
  planner.configure({ kind: 'local-cli', provider: 'jev', endpoint: 'http://127.0.0.1:4174', token: 'test-pairing-token-24-characters' });
  planner.setBridgeFetchForTests(async (url, options) => {
    if (url.endsWith('/health')) return { ok: true, json: async () => ({ ok: true, providers: { jev: { configured: true } } }) };
    const input = JSON.parse(options.body); sent.push(input);
    const mappings = {}, approved = [], gaps = [];
    input.fields.forEach(f => {
      const decision = choose(f, sent.length);
      if (decision) { mappings[f.fieldKey] = decision.purpose; approved.push({ fieldKey: f.fieldKey, ...decision }); }
      else gaps.push({ fieldKey: f.fieldKey });
    });
    return { ok: true, json: async () => ({ ok: true, plan: { purposeOverrides: mappings, approved, gaps, deferred: gaps.map(f => f.fieldKey), metadata: {
      reportedModel: 'jev-1.13.0', usage: { prompts: 1, inputTokens: 100, outputTokens: 20, durationMs: 2, apiCostUsd: null, providerReportedCostUsd: null, estimatedApiCostUsd: 0.0000042 } } } }) };
  });
  return sent;
}
test.afterEach(() => { planner.setRuntimeForTests(null); planner.setBridgeFetchForTests(null); });

test('WIC conditional blanks are excluded; low-confidence recovery has explicit site-rule attribution', async () => {
  const sent = bridge(() => null);
  const plan = await planner.plan({ engine, page, rawFields: controls, participant: person });
  assert.equal(sent.length, 1); assert.equal(sent[0].fields.length, 2);
  assert.equal(plan.metadata.trustedHintMappings, 2); assert.equal(plan.metadata.initialModelApprovedMappings, 0);
  assert.equal(plan.metadata.inapplicableControls, 2); assert.equal(plan.gaps.length, 0);
  assert.ok(plan.approved.every(a => a.source === 'site-rule' && a.confidence === null));
  const analysis = engine.buildAnalysis(controls, person, { purposeOverrides: plan.purposeOverrides, requirePurposeOverrides: true });
  assert.equal(analysis.assignments.find(a => a.fieldKey === 'edit-home-address').value, '12 Test Street, Apt 3, Riverside, CA, 92501');
  assert.equal(analysis.notApplicable.length, 2);
});

test('one retry accepts a recovered model classification without relaxing confidence; usage includes both calls', async () => {
  const sent = bridge((_f, pass) => ({ purpose: 'income', confidence: pass === 1 ? 0.89 : 0.95 }));
  const plan = await planner.plan({ engine, page: { domain: 'unknown.test' }, rawFields: [{ fieldKey: 'income', type: 'text', label: 'Monthly income', required: true }], participant: { income: 1200 } });
  assert.equal(sent.length, 2); assert.equal(plan.approved[0].source, 'jev-retry');
  assert.equal(plan.metadata.retryModelApprovedMappings, 1); assert.equal(plan.metadata.recoveryPasses, 1);
  assert.equal(plan.metadata.usage.inputTokens, 200); assert.equal(plan.metadata.usage.outputTokens, 40);
  assert.equal(plan.metadata.usage.apiCostUsd, null); assert.equal(plan.metadata.usage.estimatedApiCostUsd, 0.0000084);
});

test('nonprogress stops after one retry and a missing known source is never retried', async () => {
  const sent = bridge(() => null);
  const rawFields = [{ fieldKey: 'ambiguous', label: 'An ambiguous decision', type: 'select-one', required: true },
    { fieldKey: 'missing', label: 'Email', purpose: 'email', type: 'text', required: true }];
  const plan = await planner.plan({ engine, page: {}, rawFields, participant: { firstName: 'Synthetic' } });
  assert.equal(sent.length, 2); assert.deepEqual(sent[1].fields.map(f => f.fieldKey), ['ambiguous']);
  assert.deepEqual(plan.gaps.map(f => f.fieldKey), ['ambiguous', 'missing']);
});

test('entity-scoped identifiers and final controls receive neither playbook recovery nor retries', async () => {
  const sent = bridge(() => ({ purpose: 'ssn', confidence: 1 }));
  const plan = await planner.plan({ engine, page, rawFields: [{ fieldKey: 'other', label: 'Other household member Social Security Number', required: true },
    { fieldKey: 'captcha', label: 'CAPTCHA', required: true }, { fieldKey: 'submit', label: 'Submit', required: true }], participant: { ssn: '000-00-0000' } });
  assert.equal(sent.length, 1); assert.equal(sent[0].fields.length, 1); assert.equal(plan.approved.length, 0);
  assert.deepEqual(plan.gaps.map(f => f.fieldKey), ['other']);
});

test('verified reuse requires matching DOM value, source, control shape and document; no cache values leave the planner', async () => {
  const sent = bridge(f => ({ purpose: f.purposeHint, confidence: 1 }));
  const raw = [field('edit-name')];
  await planner.plan({ engine, page, rawFields: raw, participant: person });
  const filled = [field('edit-name', { value: 'Synthetic Applicant' })];
  const reused = await planner.plan({ engine, page, rawFields: filled, participant: person });
  assert.equal(sent.length, 1); assert.equal(reused.metadata.retainedVerifiedMappings, 1);
  assert.equal(reused.metadata.usage.prompts, 0); assert.equal(reused.metadata.reportedModel, null);
  assert.doesNotMatch(JSON.stringify(reused), /Synthetic Applicant|92501/);
  await planner.plan({ engine, page, rawFields: [field('edit-name', { value: 'Wrong Name' })], participant: person });
  assert.equal(sent.length, 2);
  await planner.plan({ engine, page, rawFields: filled, participant: { ...person, firstName: 'Changed' } });
  assert.equal(sent.length, 3);
  await planner.plan({ engine, page: { ...page, documentId: 'new-document' }, rawFields: filled, participant: person });
  assert.equal(sent.length, 4);
  await planner.plan({ engine, page, rawFields: [field('edit-name', { value: 'Synthetic Applicant', label: 'Changed meaning' })], participant: person });
  assert.equal(sent.length, 5);
});

test('unverified approvals are not cached and lookalike sites cannot supply deterministic recovery', async () => {
  const sent = bridge(() => null);
  const plan = await planner.plan({ engine, page: { ...page, url: page.url.replace('www.ruhealth.org', 'www.ruhealth.org.evil.test') },
    rawFields: [field('edit-name', { required: true })], participant: person });
  assert.equal(sent.length, 2); assert.equal(plan.metadata.trustedHintMappings, 0); assert.equal(plan.gaps.length, 1);
  await planner.plan({ engine, page, rawFields: [field('edit-name')], participant: person });
  await planner.plan({ engine, page, rawFields: [field('edit-name')], participant: person });
  assert.equal(sent.length, 4);
});

test('conditional Yes needs a case number; different mailing fills its complete address', () => {
  const payload = { ...person, mediCalCoverage: true, mediCalCaseNumber: 'TEST-001', address: { residential: address, mailing: { ...address, street: '14 Other Test Street' } } };
  const analysis = engine.buildAnalysis(controls, payload);
  assert.equal(analysis.notApplicable.length, 0); assert.equal(analysis.gaps.length, 0);
  assert.equal(analysis.assignments.find(a => a.purpose === 'mediCalCaseNumber').value, 'TEST-001');
  assert.match(analysis.assignments.find(a => a.purpose === 'alternateMailingAddress').value, /14 Other Test Street, Apt 3, Riverside, CA, 92501/);
  const missing = engine.buildAnalysis(controls, { ...payload, mediCalCaseNumber: undefined });
  assert.ok(missing.gaps.some(g => g.fieldKey === 'edit-if-yes'));
});

test('unknown applicability and incomplete full addresses remain questions; existing inapplicable values are conflicts', () => {
  const missing = { ...person, mediCalCoverage: undefined, address: { residential: { street: '12 Test Street' }, mailing: { street: '12 Test Street' } } };
  const analysis = engine.buildAnalysis(controls, missing);
  assert.equal(analysis.notApplicable.length, 0);
  assert.deepEqual(analysis.gaps.map(g => g.kind), ['incomplete_address', 'applicability', 'applicability']);
  const conflict = engine.buildAnalysis([field('edit-if-yes', { value: 'STALE-TEST' })], person);
  assert.equal(conflict.gaps[0].kind, 'conditional_conflict'); assert.equal(conflict.observed.length, 0);
});

test('split-address forms still receive only street and separate city, state and ZIP', () => {
  const raw = [{ fieldKey: 'street', purpose: 'addressLine1', label: 'Street address', type: 'text' },
    { fieldKey: 'unit', purpose: 'addressLine2', label: 'Apartment', type: 'text' },
    { fieldKey: 'city', purpose: 'city', label: 'City', type: 'text' }];
  const analysis = engine.buildAnalysis(raw, person);
  assert.equal(analysis.assignments.find(a => a.fieldKey === 'street').value, '12 Test Street');
  assert.equal(analysis.assignments.find(a => a.fieldKey === 'city').value, 'Riverside');
});

test('final controls remain outside ordinary form answers and questions', () => {
  const analysis = engine.buildAnalysis([{ fieldKey: 'captcha', label: 'CAPTCHA', required: true },
    { fieldKey: 'signature', label: 'Signature', type: 'signature', required: true }], person);
  assert.equal(analysis.assignments.length, 0); assert.equal(analysis.gaps.length, 0);
});

test('DOM identities survive new scan command IDs while current values are independently reverified', async () => {
  const sent = bridge(f => ({ purpose: f.purposeHint, confidence: 1 }));
  await planner.plan({ engine, page, rawFields: [field('edit-name', { fieldKey: 'field:1:0', identityKey: 'id:edit-name', optionValue: '' })], participant: person });
  const plan = await planner.plan({ engine, page, rawFields: [field('edit-name', { fieldKey: 'field:2:0', identityKey: 'id:edit-name', value: 'Synthetic Applicant', optionValue: 'Synthetic Applicant' })], participant: person });
  assert.equal(sent.length, 1); assert.equal(plan.metadata.retainedVerifiedMappings, 1);
  assert.equal(plan.purposeOverrides['field:2:0'], 'fullName'); assert.equal(plan.purposeOverrides['field:1:0'], undefined);
});

test('duplicate DOM IDs fall back to scan-specific command identities instead of reusable cache entries', () => {
  const inventory = planner.groupedInventory([
    { id: 'duplicate', identityKey: '', fieldKey: 'field:1:1' },
    { id: 'duplicate', identityKey: '', fieldKey: 'field:1:2' },
  ]);
  assert.deepEqual(inventory.map(field => field.identityKey), ['field:1:1', 'field:1:2']);
});

test('the Jev path uses identifying-value redaction without marking the selected category option', async () => {
  const sent = bridge(() => null);
  await planner.plan({ engine, page: { domain: 'example.test' }, participant: {
    firstName: 'Celeste', preferredContact: 'Email',
  }, rawFields: [{ fieldKey: 'contact', type: 'select-one', label: 'How should we contact Celeste?',
    required: true, options: [{ label: 'Email' }, { label: 'Phone' }, { label: 'Mail' }] }] });
  assert.equal(sent.length, 2);
  assert.doesNotMatch(JSON.stringify(sent), /Celeste/);
  assert.equal(sent[0].fields[0].label, 'How should we contact [source value]?');
  assert.deepEqual(sent[0].fields[0].options, ['Email', 'Phone', 'Mail']);
});

test('changing the paired runtime clears previously verified Jev mappings', async () => {
  const sent = bridge(f => ({ purpose: f.purposeHint, confidence: 1 }));
  await planner.plan({ engine, page, rawFields: [field('edit-name')], participant: person });
  const filled = [field('edit-name', { value: 'Synthetic Applicant' })];
  await planner.plan({ engine, page, rawFields: filled, participant: person });
  assert.equal(sent.length, 1, 'verified mapping was reused before changing the runtime');
  planner.configure({ kind: 'local-cli', provider: 'codex', endpoint: 'http://127.0.0.1:4174', token: 'test-pairing-token-24-characters' });
  planner.configure({ kind: 'local-cli', provider: 'jev', endpoint: 'http://127.0.0.1:4174', token: 'test-pairing-token-24-characters' });
  const afterChange = await planner.plan({ engine, page, rawFields: filled, participant: person });
  assert.equal(sent.length, 2, 'new runtime must classify rather than inherit the prior verified cache');
  assert.equal(afterChange.metadata.retainedVerifiedMappings, 0);
});
