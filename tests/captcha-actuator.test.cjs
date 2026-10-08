const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const engine = require('../shared/captcha-engine.js');

test('CAPTCHA model choices are bounded indexes, never arbitrary selectors, scripts or actions', () => {
  for (const decision of [
    { action: 'submit', tiles: [] }, { action: 'select', tiles: [0] }, { action: 'select', tiles: [10] },
    { action: 'select', tiles: [1, 1] }, { action: 'select', tiles: [1], selector: '#submit' },
    { action: 'handoff', tiles: [1] }, { action: 'select', tiles: ['1'] },
  ]) assert.throws(() => engine.validateDecision(decision, 9));
  assert.deepEqual(engine.validateDecision({ action: 'select', tiles: [9, 1] }, 9), { action: 'select', tiles: [1, 9] });
  assert.throws(() => engine.validateDecision({ action: 'select', tiles: [] }, 25));
});

test('provider frames must match a precise HTTPS origin and reCAPTCHA path', () => {
  assert.equal(engine.frameKind('https://www.google.com/recaptcha/api2/anchor?k=public'), 'checkbox');
  assert.equal(engine.frameKind('https://www.recaptcha.net/recaptcha/enterprise/bframe'), 'image');
  for (const url of ['https://evil.test/recaptcha/api2/anchor', 'https://www.google.com.evil.test/recaptcha/api2/anchor',
    'http://www.google.com/recaptcha/api2/anchor', 'https://www.google.com:444/recaptcha/api2/anchor', 'https://www.google.com/other/anchor']) assert.equal(engine.frameKind(url), '');
});

function runner(observations, extras = {}) {
  const actions = [];
  let index = 0;
  return { actions, io: {
    assertActive: async () => {}, observe: async () => observations[Math.min(index++, observations.length - 1)],
    checkbox: async () => actions.push('checkbox'), capture: async () => ({ tileCount: 9 }),
    classify: async () => ({ decision: { action: 'select', tiles: [1, 8, 9] }, metrics: { durationMs: 25, inferenceCalls: 1 } }),
    tiles: async (view) => actions.push(view.decision.tiles), wait: async () => {}, ...extras,
  } };
}
test('checkbox click alone is not counted as acceptance', async () => {
  const { io, actions } = runner([{ status: 'checkbox' }]);
  const result = await engine.run(io);
  assert.equal(result.status, 'handoff');
  assert.equal(result.reason, 'verification_not_observed');
  assert.deepEqual(actions, ['checkbox']);
});
test('one attempt covers a rejected grid and fresh follow-up, with visible acceptance required', async () => {
  const { io, actions } = runner([{ status: 'checkbox' }, { status: 'image' }, { status: 'image' }, { status: 'accepted' }]);
  const result = await engine.run(io);
  assert.equal(result.status, 'accepted'); assert.equal(result.rounds, 2);
  assert.deepEqual(actions, ['checkbox', [1, 8, 9], [1, 8, 9]]);
});
test('model handoff, missing image support and round limit never produce additional clicks', async () => {
  const { io, actions } = runner([{ status: 'image' }], { classify: async () => ({ decision: { action: 'handoff', tiles: [] } }) });
  assert.equal((await engine.run(io)).reason, 'model_handoff'); assert.equal(actions.length, 0);
  const repeated = runner([{ status: 'image' }]);
  assert.equal((await engine.run(repeated.io, { maxRounds: 99 })).reason, 'round_limit');
  assert.equal(repeated.actions.length, 3);
});
test('a model failure retains elapsed time and unknown billing instead of a zero-cost success', async () => {
  const { io, actions } = runner([{ status: 'image' }], { classify: async () => { throw new Error('provider stopped'); } });
  const result = await engine.run(io);
  assert.equal(result.reason, 'model_error'); assert.equal(actions.length, 0);
  assert.equal(result.decisions[0].providerReportedCostUsd, null);
  assert.equal(result.decisions[0].inferenceCalls, null);
  assert.ok(result.decisions[0].durationMs >= 0);
});
test('cancellation while a model is thinking discards its late answer', async () => {
  let active = true;
  const { io, actions } = runner([{ status: 'image' }], {
    assertActive: async () => { if (!active) throw new Error('canceled'); },
    classify: async () => { active = false; return { decision: { action: 'select', tiles: [1] } }; },
  });
  await assert.rejects(engine.run(io), /canceled/); assert.equal(actions.length, 0);
});

function frameFixture(kind) {
  let clicks = [];
  const box = { x: 0, y: 0, width: 300, height: 300 };
  const element = (name, text = '') => ({ textContent: text, disabled: false, attrs: {},
    classList: { contains: () => false }, getAttribute(key) { return this.attrs[key] || ''; },
    getBoundingClientRect: () => box, querySelectorAll: () => [], click() { clicks.push(name); } });
  const anchor = element('checkbox'); anchor.attrs['aria-checked'] = 'false';
  const cells = Array.from({ length: 9 }, (_, i) => { const cell = element(i + 1); cell.img = { src: `public-fixture-${i}` }; cell.querySelectorAll = () => [cell.img]; return cell; });
  const grid = element('grid'), verify = element('verify', 'Verify'), description = element('description', 'Select all traffic lights');
  const document = {
    getElementById: (id) => ({ 'recaptcha-anchor': anchor, 'recaptcha-verify-button': verify })[id] || null,
    querySelector: (selector) => ({ '.rc-imageselect-target': grid, '.rc-imageselect-desc-wrapper': description })[selector] || null,
    querySelectorAll: () => cells,
  };
  const context = { document, window: { name: 'fixture' }, location: { href: `https://www.google.com/recaptcha/api2/${kind === 'checkbox' ? 'anchor' : 'bframe'}`, hostname: 'www.google.com', pathname: `/recaptcha/api2/${kind === 'checkbox' ? 'anchor' : 'bframe'}` },
    NavaCaptchaEngine: engine, URLSearchParams, crypto: webcrypto, TextEncoder, Uint8Array, Date, getComputedStyle: () => ({ display: 'block', visibility: 'visible' }) };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(require.resolve('../content/captcha-agent.js'), 'utf8'), context);
  return { api: context.NavaCaptchaFrame, clicks, anchor, cells, verify, description, context };
}
test('native frame actuator clicks checkbox, observes acceptance and touches no application controls', async () => {
  const fixture = frameFixture('checkbox');
  fixture.api.arm('scope', Date.now() + 1000);
  await fixture.api.act('scope', { type: 'checkbox' }); assert.deepEqual(fixture.clicks, ['checkbox']);
  assert.equal((await fixture.api.observe()).status, 'checkbox');
  fixture.anchor.attrs['aria-checked'] = 'true'; assert.equal((await fixture.api.observe()).status, 'accepted');
});
test('native grid actuator rejects stale images and revoked authorizations before any tile or Verify click', async () => {
  const fixture = frameFixture('image'); const view = await fixture.api.observe();
  fixture.api.arm('scope', Date.now() + 1000); fixture.cells[0].img.src = 'replaced';
  await assert.rejects(fixture.api.act('scope', { type: 'tiles', challengeId: view.challengeId, decision: { action: 'select', tiles: [1] } }), /changed/);
  assert.equal(fixture.clicks.length, 0);
  fixture.api.revoke('scope'); assert.throws(() => fixture.api.arm('scope', Date.now() + 1000), /expired/);
});
test('static grid executor clicks only selected tiles and the provider Verify control', async () => {
  const fixture = frameFixture('image'); const view = await fixture.api.observe(); fixture.api.arm('scope', Date.now() + 1000);
  await fixture.api.act('scope', { type: 'tiles', challengeId: view.challengeId, decision: { action: 'select', tiles: [1, 8, 9] } });
  assert.deepEqual(fixture.clicks, [1, 8, 9, 'verify']);
  fixture.description.textContent = 'Select new images until none left'; assert.equal((await fixture.api.observe()).status, 'unsupported');
});
test('revocation during image hashing stops the pending tile click and Verify', async () => {
  const fixture = frameFixture('image'); const view = await fixture.api.observe(); fixture.api.arm('scope', Date.now() + 1000);
  let hashes = 0;
  fixture.context.crypto = { subtle: { async digest(...args) {
    hashes += 1;
    const hash = await webcrypto.subtle.digest(...args);
    if (hashes === 2) fixture.api.revoke('scope');
    return hash;
  } } };
  await assert.rejects(fixture.api.act('scope', { type: 'tiles', challengeId: view.challengeId, decision: { action: 'select', tiles: [1] } }), /revoked/);
  assert.equal(fixture.clicks.length, 0);
});
test('an actuator error after classification retains the model time and usage receipt', async () => {
  const { io } = runner([{ status: 'image' }], { tiles: async () => { throw new Error('challenge expired'); } });
  const result = await engine.run(io); assert.equal(result.reason, 'tile_actuation_stopped');
  assert.equal(result.decisions.length, 1); assert.equal(result.decisions[0].durationMs, 25);
});

test('image companion rejects applicant data, remote images, unbounded images and unsupported providers', async () => {
  const { validateCaptchaRequest } = await import('../model-bridge/captcha.mjs');
  const bytes = Buffer.alloc(24); Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes); bytes.write('IHDR', 12); bytes.writeUInt32BE(300, 16); bytes.writeUInt32BE(300, 20);
  const request = { provider: 'codex', task: 'Select traffic lights', tileCount: 9, image: `data:image/png;base64,${bytes.toString('base64')}` };
  assert.equal(validateCaptchaRequest(request).reasoning, 'low');
  for (const extra of [{ applicant: 'private' }, { image: 'https://evil.test/image' }, { provider: 'jev' }, { reasoning: 'unsafe' }, { model: '--override' }, { image: 'data:image/svg+xml;base64,abc' }]) assert.throws(() => validateCaptchaRequest({ ...request, ...extra }));
  bytes.writeUInt32BE(2000, 16);
  assert.throws(() => validateCaptchaRequest({ ...request, image: `data:image/png;base64,${bytes.toString('base64')}` }), /dimensions/);
});
test('image MIME must match magic bytes; bounded JPEG metadata is supported without rewriting pixels', async () => {
  const { validateCaptchaRequest } = await import('../model-bridge/captcha.mjs');
  const jpeg = Buffer.alloc(24); jpeg[0] = 0xff; jpeg[1] = 0xd8; jpeg[2] = 0xff; jpeg[3] = 0xc0;
  jpeg.writeUInt16BE(17, 4); jpeg[6] = 8; jpeg.writeUInt16BE(300, 7); jpeg.writeUInt16BE(300, 9);
  const request = { provider: 'codex', task: 'Select traffic lights', tileCount: 9 };
  const image = jpeg.toString('base64');
  assert.throws(() => validateCaptchaRequest({ ...request, image: `data:image/png;base64,${image}` }), /PNG/);
  assert.equal(validateCaptchaRequest({ ...request, image: `data:image/jpeg;base64,${image}` }).mediaType, 'image/jpeg');
});
test('CAPTCHA audit retains real long durations and unknown billing without client/image values', () => {
  const queue = require('../shared/work-queue-engine.js');
  const event = queue.auditEvent('captcha_attempt', { id: 'app', url: 'https://benefits.test/?secret=private' }, {
    captchaDurationMs: 120_100, captchaOutcome: 'handoff', captchaBilledCost: 'unknown', modelInputTokens: null, image: 'private pixels', participant: 'private', captchaUsageStatus: 'partial',
  });
  assert.equal(event.details.captchaDurationMs, 120_100); assert.equal(event.details.captchaBilledCost, 'unknown');
  assert.equal(event.details.modelInputTokens, undefined); assert.doesNotMatch(JSON.stringify(event), /private/);
});
test('Codex image invocation is ephemeral, read-only, attaches one crop and strips provider keys', async () => {
  const { captchaInvocation } = await import('../model-bridge/captcha.mjs');
  const { subscriptionOnlyEnvironment } = await import('../model-bridge/core.mjs');
  const command = captchaInvocation({ model: 'gpt-6-luna', reasoning: 'xhigh', prompt: 'Classify one crop' }, { tempDirectory: '/tmp/fixture', schemaPath: '/tmp/schema', outputPath: '/tmp/answer', imagePath: '/tmp/crop.png' });
  assert.equal(command.args[command.args.indexOf('--image') + 1], '/tmp/crop.png');
  assert.equal(command.args[command.args.indexOf('--sandbox') + 1], 'read-only');
  assert.ok(command.args.includes('--ephemeral')); assert.ok(command.args.includes('model_reasoning_effort="xhigh"'));
  const env = subscriptionOnlyEnvironment('codex', { OPENAI_API_KEY: 'secret', JEV_API_KEY: 'secret', TYPESAFE_API_KEY: 'secret' });
  assert.equal(env.OPENAI_API_KEY, undefined); assert.equal(env.JEV_API_KEY, undefined); assert.equal(env.TYPESAFE_API_KEY, undefined);
});
test('Jev retains the shared checkbox executor but makes zero image model calls', async () => {
  globalThis.NavaCaptchaEngine = engine;
  const model = require('../sidepanel/captcha-model.js');
  const result = await model.classify({ task: 'Select traffic lights', tileCount: 9, image: 'not-transmitted' }, { kind: 'local-cli', provider: 'jev' });
  assert.equal(result.decision.action, 'handoff'); assert.equal(result.metrics.inferenceCalls, 0);
  assert.throws(() => model.companionUrl('https://external.test'), /loopback/);
});
