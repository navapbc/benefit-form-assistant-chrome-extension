const test = require('node:test');
const assert = require('node:assert/strict');
const captchaRuns = require('../sidepanel/captcha-runs.mjs');
const captchaEngine = require('../shared/captcha-engine.js');

const originalChrome = globalThis.chrome;
test.afterEach(() => { globalThis.chrome = originalChrome; });

function harness({ initial = 'checkbox', classify } = {}) {
  const app = { id: 'workflow:test', tabId: 12, url: 'https://www.ruhealth.org/appointments/apply-4-wic-form',
    controlGeneration: 4, controlRevision: 9, checkpoint: { kind: 'captcha' } };
  const state = { apps: [app], sessionEpoch: 3, participantSessionId: 'session:test', workerId: 'panel:test', agentProvider: { kind: 'chrome-local' } };
  const commands = [];
  const events = [];
  const token = { cancelled: false };
  let status = initial;
  globalThis.chrome = { tabs: { get: async () => ({ id: app.tabId, url: app.url }) } };
  const runs = captchaRuns.create({
    state, previewMode: false, captchaEngine,
    captchaModel: { configFor: () => ({ provider: 'nano' }), classify: classify || (async () => { throw new Error('No image should be requested'); }) },
    assertApplicationRun(_app, current) { if (current.cancelled) throw Object.assign(new Error('Run stopped'), { name: 'RunCancelledError' }); },
    goToApplication: async () => {}, assertApprovedApplicationLocation() {}, assertSameDocumentLocation() {},
    probeTabDocument: async () => ({ documentId: 'document:test' }),
    async sendRuntime(message) {
      commands.push(message);
      if (message.verb === 'begin') return { ok: true, token: 'authorization:test' };
      if (message.verb === 'checkbox') { status = 'accepted'; return { ok: true }; }
      if (message.verb === 'capture') return { ok: true, tileCount: 9, task: 'Test grid' };
      return { ok: true, status, challengeId: 'challenge:test' };
    },
    setApplicationProgress() {}, recordAudit: (...args) => events.push(['audit', ...args]),
    persist: async () => events.push(['persist']),
    resumeHumanCheckpoint: async () => events.push(['resume']), setCheckpoint() {},
  });
  return { app, token, runs, commands, events };
}

test('native CAPTCHA commands retain document and coordinator scope through acceptance, then resume', async () => {
  const h = harness();
  await h.runs.tryCaptcha(h.app, { runToken: h.token });
  assert.equal(h.app.captchaResult.status, 'accepted');
  assert.equal(h.app.captchaResult.decisions.length, 0);
  assert.deepEqual(h.events.map(([kind]) => kind), ['audit', 'persist', 'resume']);
  assert.ok(h.commands.some(({ verb }) => verb === 'checkbox'));
  const scoped = h.commands.filter(({ verb }) => verb !== 'end');
  scoped.forEach((message) => {
    assert.equal(message.type, 'NAVA_CAPTCHA_COMMAND');
    assert.equal(message.applicationId, h.app.id);
    assert.equal(message.tabId, 12);
    assert.equal(message.documentId, 'document:test');
    assert.equal(message.sessionEpoch, 3);
    assert.equal(message.participantSessionId, 'session:test');
    assert.equal(message.applicationGeneration, 4);
    assert.equal(message.applicationRevision, 9);
    assert.equal(message.holder, 'panel:test');
    if (message.verb !== 'begin') assert.equal(message.token, 'authorization:test');
  });
  assert.equal(h.commands.at(-1).verb, 'end');
  assert.equal(h.token.captchaAbort, null);
  assert.ok(h.commands.every(({ type, verb }) => !/submit/i.test(`${type} ${verb}`)));
});

test('cancelling during image classification ends authorization without tiles, resume, or saved success', async () => {
  let started;
  const requested = new Promise((resolve) => { started = resolve; });
  const h = harness({ initial: 'image', classify: (_capture, _provider, { signal }) => new Promise((_resolve, reject) => {
    started();
    signal.addEventListener('abort', () => reject(new Error('Cancelled image request')), { once: true });
  }) });
  const pending = h.runs.tryCaptcha(h.app, { runToken: h.token });
  await requested;
  h.token.cancelled = true;
  h.token.captchaAbort.abort();
  await assert.rejects(pending, { name: 'RunCancelledError' });
  assert.equal(h.commands.at(-1).verb, 'end');
  assert.equal(h.commands.some(({ verb }) => verb === 'tiles'), false);
  assert.equal(h.app.captchaResult, undefined);
  assert.deepEqual(h.events, []);
  assert.equal(h.token.captchaAbort, null);
});
