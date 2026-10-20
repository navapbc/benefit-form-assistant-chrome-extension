const test = require('node:test');
const assert = require('node:assert/strict');
const planner = require('../shared/agentic-planner.mjs');

const originalFetch = globalThis.fetch;
const originalChrome = globalThis.chrome;
const gateway = { endpoint: 'https://api.example.test/v1/plan', token: 'fake-tenant-key' };

function settings(initial = {}) {
  const values = { ...initial };
  globalThis.chrome = { storage: { local: {
    async get(keys) { return Object.fromEntries(keys.filter((key) => key in values).map((key) => [key, values[key]])); },
    async set(next) { Object.assign(values, next); },
    async remove(keys) { keys.forEach((key) => delete values[key]); },
  } } };
  return values;
}

function response(payload = { ok: true }) {
  return { ok: true, status: 200, async json() { return payload; } };
}

test.afterEach(() => {
  planner.reset();
  globalThis.fetch = originalFetch;
  globalThis.chrome = originalChrome;
  delete globalThis.NAVA_PLAN_GATEWAY;
});

test('shared API accepts HTTPS origins and requires explicit opt-in for exact loopback HTTP', () => {
  assert.equal(planner.normalizeGatewayBase('https://api.example.test:8443/'), 'https://api.example.test:8443');
  for (const base of ['http://127.0.0.1:4175', 'http://localhost:4175', 'http://[::1]:4175']) {
    assert.throws(() => planner.normalizeGatewayBase(base), /HTTPS/);
    assert.equal(planner.normalizeGatewayBase(base, { allowLoopbackHttp: true }), base);
  }
  for (const base of ['http://api.example.test', 'http://localhost.evil.test', 'http://127.0.0.1.evil.test',
    'file:///etc/passwd', 'javascript:alert(1)', 'ftp://api.example.test', 'data:text/plain,hello',
    'https://user:password@api.example.test', 'https://api.example.test/v1', 'https://api.example.test?q=secret',
    'https://api.example.test#fragment', 'invalid']) {
    assert.throws(() => planner.normalizeGatewayBase(base, { allowLoopbackHttp: true }), Error, base);
  }
});

test('changing origins requires a new key; the previous key is never silently reused', async () => {
  const values = settings({ navaApiBase: 'https://first.example.test', navaApiToken: 'fake-first-key' });
  const same = await planner.saveGatewayConfig({ base: 'https://first.example.test/', token: '' });
  assert.equal(same.token, 'fake-first-key');
  await assert.rejects(planner.saveGatewayConfig({ base: 'https://second.example.test' }), /changing.*address/);
  assert.equal(values.navaApiBase, 'https://first.example.test');
  await planner.saveGatewayConfig({ base: 'https://second.example.test', token: 'fake-second-key' });
  assert.equal(values.navaApiToken, 'fake-second-key');
  assert.equal((await planner.gatewayConfig()).endpoint, 'https://second.example.test/v1/plan');
});

test('unsafe persisted settings and injected settings are rejected before any network request', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return response(); };
  const values = settings({ navaApiBase: 'http://remote.example.test', navaApiToken: 'fake-key' });
  await assert.rejects(planner.gatewayConfig(), /HTTPS/);
  values.navaApiBase = 'http://localhost:4175';
  await assert.rejects(planner.gatewayConfig(), /HTTPS/);
  values.navaApiAllowLoopbackHttp = true;
  assert.equal((await planner.gatewayConfig()).endpoint, 'http://localhost:4175/v1/plan');
  globalThis.NAVA_PLAN_GATEWAY = { ...gateway, endpoint: 'https://user:password@api.example.test/v1/plan' };
  await assert.rejects(planner.gatewayConfig(), /invalid/);
  await assert.rejects(planner.gatewayRequest({ ...gateway, endpoint: 'http://remote.example.test/v1/plan' }, '/v1/plan', {}), /HTTPS/);
  assert.equal(calls, 0);
});

test('API requests pin their origin, forbid redirects/cookies and allow only the supported API operations', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return response(); };
  for (const path of ['/v1/plan', '/v1/households', '/v1/applications', '/v1/applications/id%2Fpart/share']) {
    await planner.gatewayRequest(gateway, path, { synthetic: true });
  }
  for (const path of ['//evil.example.test', 'https://evil.example.test', '/v1/plan?key=x', '/v1/applications/a/b/share']) {
    await assert.rejects(planner.gatewayRequest(gateway, path, {}), /Unsupported/);
  }
  assert.equal(calls.length, 4);
  calls.forEach(({ url, init }) => {
    assert.equal(new URL(url).origin, 'https://api.example.test');
    assert.equal(init.redirect, 'error');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.headers.authorization, 'Bearer fake-tenant-key');
    assert.deepEqual(JSON.parse(init.body), { synthetic: true });
  });
});

test('server and transport errors cannot echo a key, response body or sensitive network error into the UI', async () => {
  for (const status of [401, 403, 429, 500]) {
    globalThis.fetch = async () => ({ ok: false, status, json: async () => ({ error: 'fake-tenant-key private values' }) });
    await assert.rejects(planner.gatewayRequest(gateway, '/v1/plan', {}), (error) => {
      assert.doesNotMatch(error.message, /fake-tenant-key|private values/);
      assert.match(error.message, /shared API/);
      return true;
    });
  }
  globalThis.fetch = async () => { throw new Error('Redirect to https://user:fake-tenant-key@evil.test private values'); };
  await assert.rejects(planner.gatewayRequest(gateway, '/v1/plan', {}), /could not be reached/);
  globalThis.fetch = async () => response({ ok: false, error: 'fake-tenant-key private values' });
  await assert.rejects(planner.gatewayRequest(gateway, '/v1/plan', {}), /invalid response/);
});

test('a stalled response body times out and aborts the transport', async () => {
  let transportSignal;
  globalThis.fetch = async (_url, init) => {
    transportSignal = init.signal;
    return { ok: true, status: 200, json: () => new Promise(() => {}) };
  };
  await assert.rejects(planner.gatewayRequest(gateway, '/v1/plan', {}, { timeoutMs: 20 }), /time limit/);
  assert.equal(transportSignal.aborted, true);
});

test('cancellation rejects promptly even if transport ignores abort; a pre-cancelled request sends nothing', async () => {
  let calls = 0;
  let transportSignal;
  globalThis.fetch = async (_url, init) => {
    calls += 1;
    transportSignal = init.signal;
    return new Promise(() => {});
  };
  const abort = new AbortController();
  const pending = planner.gatewayRequest(gateway, '/v1/plan', {}, { signal: abort.signal });
  abort.abort();
  await assert.rejects(pending, /cancelled/);
  assert.equal(transportSignal.aborted, true);
  await assert.rejects(planner.gatewayRequest(gateway, '/v1/households', {}, { signal: abort.signal }), /cancelled/);
  assert.equal(calls, 1);
});

test('disconnect aborts pending requests, removes the token and all API preferences, and restores no-gateway state', async () => {
  const values = settings({ navaApiBase: 'https://api.example.test', navaApiToken: 'fake-key', navaPlanModel: 'test-model', navaApiAllowLoopbackHttp: false, unrelated: 'preserved' });
  globalThis.fetch = async () => new Promise(() => {});
  const pending = planner.gatewayRequest(await planner.gatewayConfig(), '/v1/plan', {});
  await planner.clearGatewayConfig();
  await assert.rejects(pending, /cancelled/);
  assert.deepEqual(values, { unrelated: 'preserved' });
  assert.equal(await planner.gatewayConfig(), null);
});

const runControlModule = require('../sidepanel/run-control.mjs');
const agentRuntimeModule = require('../sidepanel/agent-runtime.mjs');
const applicationActionsModule = require('../sidepanel/actions-applications.mjs');
const uiDispatchModule = require('../sidepanel/ui-dispatch.mjs');

function clientLinkContext(extra = {}) {
  const state = extra.state || { apps: [], view: 'questions' };
  const runs = runControlModule.create({ state, previewMode: true, checkpoint: () => ({}),
    revokeApplicationRun: async () => {}, onCancelAll() {} });
  const runtime = agentRuntimeModule.create({ state, previewMode: false, agentPlanner: planner,
    currentUiSignal: runs.currentUiSignal, persist: extra.persist || (async () => {}) });
  const applicationActions = applicationActionsModule.create({ state, ...uiDispatchModule.handlerContract(state), cancelPendingUiWork: runs.cancelPendingUiWork });
  const empty = { AGENT_CLICK_ACTIONS: [], AGENT_SUBMIT_ACTIONS: [], AGENT_CHANGE_HANDLERS: [],
    RECERTIFICATION_CLICK_ACTIONS: [], RECERTIFICATION_SUBMIT_ACTIONS: [], INTAKE_CLICK_ACTIONS: [], INTAKE_SUBMIT_ACTIONS: [],
    CONNECTOR_CLICK_ACTIONS: [], CONNECTOR_SUBMIT_ACTIONS: [], CONNECTOR_CHANGE_HANDLERS: [] };
  const dispatch = uiDispatchModule.create({ state, render() {},
    assertUiGeneration: runs.assertUiGeneration, currentUiGeneration: runs.currentUiGeneration,
    agentActions: empty, recertificationActions: empty, intakeActions: empty, connectorActions: empty, applicationActions });
  return { result: { ...runtime, ...runs }, click: dispatch.onClick, state };
}
const application = () => ({ id: 'synthetic-workflow', programIds: ['wic'],
  participant: { firstName: 'PrivateClientValue' },
  analysis: { gaps: [{ fieldKey: 'income', question: 'Monthly income?', label: 'Income', required: true }] },
});

test('participant-link workflow uses the bounded authenticated helper for all three requests and excludes record values', async () => {
  settings({ navaApiBase: 'https://api.example.test', navaApiToken: 'fake-key' });
  const replies = [{ household: { id: 'synthetic-household' } }, { application: { id: 'synthetic/application' } }, { url: 'https://api.example.test/client/synthetic' }];
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return response(replies.shift()); };
  let persists = 0;
  const context = clientLinkContext({ persist: async () => { persists += 1; } });
  const app = application();
  await context.result.mintClientLink(app);
  assert.equal(calls.length, 3);
  assert.equal(calls[2].url, 'https://api.example.test/v1/applications/synthetic%2Fapplication/share');
  assert.equal(app.clientLink, 'https://api.example.test/client/synthetic');
  assert.equal(persists, 1);
  assert.ok(calls.every(({ init }) => init.redirect === 'error' && !init.body.includes('PrivateClientValue')));
});

test('returning home aborts a participant-link workflow before a later request or UI update', async () => {
  settings({ navaApiBase: 'https://api.example.test', navaApiToken: 'fake-key' });
  let started;
  const requested = new Promise((resolve) => { started = resolve; });
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; started(); return new Promise(() => {}); };
  let persists = 0;
  const context = clientLinkContext({ persist: async () => { persists += 1; } });
  const app = application();
  const pending = context.result.mintClientLink(app);
  await requested;
  context.result.cancelPendingUiWork();
  await assert.rejects(pending, /cancelled/);
  assert.equal(calls, 1);
  assert.equal(persists, 0);
  assert.equal(app.clientLink, undefined);
});

test('Pause aborts its pending gateway plan through the application run signal', async () => {
  globalThis.fetch = async () => new Promise(() => {});
  const app = application();
  const context = clientLinkContext({ state: { apps: [app], sessionEpoch: 1 } });
  const token = await context.result.beginApplicationRun(app);
  const pending = planner.gatewayRequest(gateway, '/v1/plan', {}, { signal: token.abort.signal });
  context.result.cancelApplicationRun(app);
  await assert.rejects(pending, /cancelled/);
  assert.equal(token.cancelled, true);
  assert.equal(context.result.runActive(app.id), false);
  assert.equal(context.result.isRunning(app.id), true, 'old run retains ownership until settled');
  context.result.endApplicationRun(app, token);
});

test('Back from questions aborts sharing through the actual click handler', async () => {
  settings({ navaApiBase: 'https://api.example.test', navaApiToken: 'fake-key' });
  let started;
  const requested = new Promise((resolve) => { started = resolve; });
  globalThis.fetch = async () => { started(); return new Promise(() => {}); };
  const context = clientLinkContext({ state: { apps: [], view: 'questions' } });
  const pending = context.result.mintClientLink(application());
  await requested;
  await context.click({ dataset: { action: 'back-dashboard' } });
  await assert.rejects(pending, /cancelled/);
  assert.equal(context.state.view, 'dashboard');
});
