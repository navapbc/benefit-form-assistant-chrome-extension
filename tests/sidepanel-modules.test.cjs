// Side-panel coordination modules created on their own over recording stubs: run control, coordinator sync and
// writes, the planner runtime, automatic runs, the recertification caseload, connector actions, and UI dispatch.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const workQueueEngine = require('../shared/work-queue-engine.mjs');
const connectorEngine = require('../shared/connector-engine.mjs');
const { sidePanelScripts, sidePanelSource } = require('./runtime-sources.cjs');
const runControlModule = require('../sidepanel/run-control.mjs');
const captchaRunsModule = require('../sidepanel/captcha-runs.mjs');
const coordinatorMergeModule = require('../sidepanel/coordinator-merge.mjs');
const coordinatorSyncModule = require('../sidepanel/coordinator-sync.mjs');
const coordinatorWritesModule = require('../sidepanel/coordinator-writes.mjs');
const agentRuntimeModule = require('../sidepanel/agent-runtime.mjs');
const automaticRunsModule = require('../sidepanel/automatic-runs.mjs');
const recertificationCaseloadModule = require('../sidepanel/recertification-caseload.mjs');
const agentActionsModule = require('../sidepanel/actions-agent.mjs');
const recertificationActionsModule = require('../sidepanel/actions-recertification.mjs');
const intakeActionsModule = require('../sidepanel/actions-intake.mjs');
const connectorActionsModule = require('../sidepanel/actions-connector.mjs');
const applicationActionsModule = require('../sidepanel/actions-applications.mjs');
const developerActionsModule = require('../sidepanel/actions-developer.mjs');
const uiDispatchModule = require('../sidepanel/ui-dispatch.mjs');

const MODULES = {
  'sidepanel/run-control.mjs': runControlModule,
  'sidepanel/captcha-runs.mjs': captchaRunsModule,
  'sidepanel/coordinator-merge.mjs': coordinatorMergeModule,
  'sidepanel/coordinator-sync.mjs': coordinatorSyncModule,
  'sidepanel/coordinator-writes.mjs': coordinatorWritesModule,
  'sidepanel/agent-runtime.mjs': agentRuntimeModule,
  'sidepanel/automatic-runs.mjs': automaticRunsModule,
  'sidepanel/recertification-caseload.mjs': recertificationCaseloadModule,
  'sidepanel/actions-agent.mjs': agentActionsModule,
  'sidepanel/actions-recertification.mjs': recertificationActionsModule,
  'sidepanel/actions-intake.mjs': intakeActionsModule,
  'sidepanel/actions-connector.mjs': connectorActionsModule,
  'sidepanel/actions-applications.mjs': applicationActionsModule,
  'sidepanel/actions-developer.mjs': developerActionsModule,
  'sidepanel/ui-dispatch.mjs': uiDispatchModule,
};

const tick = () => new Promise((resolve) => setImmediate(resolve));
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/** A chrome stand-in that records tab messages and storage writes per area. */
function fakeChrome() {
  const calls = [];
  const area = (name) => ({
    async get(key) {
      calls.push([`storage.${name}.get`, key]);
      return {};
    },
    async set(value) {
      calls.push([`storage.${name}.set`, value]);
    },
  });
  return {
    calls,
    tabs: {
      async sendMessage(tabId, message) {
        calls.push(['tabs.sendMessage', tabId, message]);
      },
    },
    storage: { session: area('session'), local: area('local') },
  };
}

function runControl({ state, previewMode = false, onCancelAll = () => {}, revokeApplicationRun = async () => {} }) {
  return runControlModule.create({
    state,
    previewMode,
    checkpoint: (kind, label) => ({ kind, label }),
    revokeApplicationRun,
    onCancelAll,
  });
}

test('every side-panel module exports create(), is imported by the composition root, and reads no Nava globals', () => {
  const scripts = sidePanelScripts();
  const rootIndex = scripts.indexOf('sidepanel/main.mjs');
  assert.equal(rootIndex, scripts.length - 1, 'main.mjs comes last, after everything it imports');
  const main = fs.readFileSync(path.resolve(__dirname, '..', 'sidepanel/main.mjs'), 'utf8');
  for (const [file, api] of Object.entries(MODULES)) {
    assert.equal(typeof api.create, 'function', file);
    const index = scripts.indexOf(file);
    assert.ok(index >= 0 && index < rootIndex, `${file} must be loaded before main.mjs`);
    assert.ok(main.includes(`'./${path.basename(file)}'`), `${file} must be imported by main.mjs`);
    const source = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
    assert.doesNotMatch(source, /globalThis\.Nava/, `${file} must take its engines from the composition root`);
  }
});

test('the dispatcher outcome and screen switch are declared once, so every action table shares their identity', () => {
  const panel = sidePanelSource();
  assert.equal(panel.match(/const SKIP_FINAL_RENDER = /g).length, 1);
  assert.equal(panel.match(/function showScreen\(/g).length, 1);
  const first = uiDispatchModule.handlerContract({});
  const second = uiDispatchModule.handlerContract({});
  assert.equal(first.SKIP_FINAL_RENDER, second.SKIP_FINAL_RENDER);
  assert.ok(Object.isFrozen(first.SKIP_FINAL_RENDER));
  const state = { view: 'choice' };
  uiDispatchModule.handlerContract(state).showScreen('record')();
  assert.equal(state.view, 'record');
});

test('run control issues one token per application, replaces a live run only after it settles, and clears it on end', async () => {
  const application = { id: 'app-1', controlGeneration: 0 };
  const state = { apps: [application], sessionEpoch: 1, workerId: 'worker-1' };
  const control = runControl({ state });

  const first = await control.beginApplicationRun(application);
  assert.equal(control.isRunning('app-1'), true);
  assert.equal(control.activeRun('app-1'), first);
  assert.equal(control.activeRunCount(), 1);
  assert.doesNotThrow(() => control.assertApplicationRun(application, first));
  application.controlGeneration = 1;
  assert.throws(() => control.assertApplicationRun(application, first), { name: 'RunCancelledError' });
  application.controlGeneration = 0;

  const replacement = control.beginApplicationRun(application);
  assert.equal(first.cancelled, true, 'a new run cancels the live one');
  assert.equal(control.activeRun('app-1'), first, 'and waits for it to settle');
  control.endApplicationRun(application, first);
  const second = await replacement;
  assert.notEqual(second, first);
  assert.equal(control.activeRun('app-1'), second);
  control.endApplicationRun(application, second);
  assert.equal(control.isRunning('app-1'), false);
  assert.equal(control.activeRunCount(), 0);

  assert.equal(await control.withNewApplicationRun(application, async (token) => token.uiBound), false);
  assert.equal(control.activeRunCount(), 0, 'withNewApplicationRun ends its run');
  await assert.rejects(control.beginApplicationRun({ id: 'gone' }), { name: 'RunCancelledError' });
});

test('cancelling every run bumps the session, cancels each run, then clears the automatic queue', async () => {
  const one = { id: 'one' };
  const two = { id: 'two' };
  const state = { apps: [one, two], sessionEpoch: 1, workerId: 'worker-1' };
  const tokens = {};
  const cancelledAtClear = [];
  const control = runControl({
    state,
    onCancelAll: () => cancelledAtClear.push(tokens.one.cancelled, tokens.two.cancelled),
  });
  tokens.one = await control.beginApplicationRun(one);
  tokens.two = await control.beginApplicationRun(two);
  const waitingReplacement = control.beginApplicationRun(one);

  control.cancelAllRuns();
  assert.deepEqual(cancelledAtClear, [true, true]);
  control.endApplicationRun(one, tokens.one);
  await assert.rejects(waitingReplacement, { name: 'RunCancelledError' }, 'a run requested before the cancel belongs to the old session');
  assert.throws(() => control.assertApplicationRun(two, tokens.two), { name: 'RunCancelledError' });

  control.endApplicationRun(two, tokens.two);
  const fresh = await control.beginApplicationRun(two);
  assert.doesNotThrow(() => control.assertApplicationRun(two, fresh));
});

test('NAVA_CANCEL goes to the tab only outside the preview and only when this window holds the lease', () => {
  const cases = [
    { previewMode: false, application: { id: 'a', tabId: 9, lease: { holder: 'worker-1' } }, sent: true },
    { previewMode: false, application: { id: 'a', tabId: 9, lease: { holder: 'other-window' } }, sent: false },
    { previewMode: false, application: { id: 'a', tabId: 9 }, sent: false },
    { previewMode: false, application: { id: 'a', lease: { holder: 'worker-1' } }, sent: false },
    { previewMode: true, application: { id: 'a', tabId: 9, lease: { holder: 'worker-1' } }, sent: false },
  ];
  for (const { previewMode, application, sent } of cases) {
    globalThis.chrome = fakeChrome();
    const control = runControl({ state: { apps: [application], sessionEpoch: 1, workerId: 'worker-1' }, previewMode });
    control.cancelApplicationRun(application);
    assert.deepEqual(globalThis.chrome.calls, sent ? [['tabs.sendMessage', 9, { type: 'NAVA_CANCEL' }]] : [], JSON.stringify(application));
  }
  delete globalThis.chrome;
});

test('a UI-bound run requested under an older screen generation stops with UiCancelledError', async () => {
  const application = { id: 'app-1' };
  const control = runControl({ state: { apps: [application], sessionEpoch: 1, workerId: 'worker-1' } });
  const generation = control.currentUiGeneration();
  const previous = await control.beginApplicationRun(application);
  let ran = false;
  const uiRun = control.withNewApplicationRun(application, async () => { ran = true; }, { uiBound: true });

  assert.equal(control.cancelPendingUiWork(), generation + 1);
  assert.equal(control.currentUiGeneration(), generation + 1);
  control.endApplicationRun(application, previous);
  await assert.rejects(uiRun, { name: 'UiCancelledError' });
  assert.equal(ran, false);
  assert.equal(control.isRunning('app-1'), false);
  assert.throws(() => control.assertUiGeneration(generation), { name: 'UiCancelledError' });
  assert.doesNotThrow(() => control.assertUiGeneration(generation + 1));
});

test('returning home pauses only UI-bound runs, after revoking each one', async () => {
  const uiBound = { id: 'ui', autoRun: true, status: 'filling' };
  const automatic = { id: 'auto', autoRun: true, status: 'filling' };
  const revoked = [];
  const control = runControl({
    state: { apps: [uiBound, automatic], sessionEpoch: 1, workerId: 'worker-1' },
    revokeApplicationRun: async (application) => revoked.push(application.id),
  });
  const uiToken = await control.beginApplicationRun(uiBound, { uiBound: true });
  const automaticToken = await control.beginApplicationRun(automatic);
  await control.cancelUiBoundRuns();
  assert.deepEqual(revoked, ['ui']);
  assert.equal(uiToken.cancelled, true);
  assert.equal(automaticToken.cancelled, false);
  assert.equal(uiBound.status, 'paused');
  assert.equal(uiBound.autoRun, false);
  assert.deepEqual(uiBound.checkpoint, { kind: 'voluntary_pause', label: 'Paused when the assistant returned home' });
  assert.equal(automatic.status, 'filling');
});

/** Coordinator writes over a real run control and scripted service-worker responses; `events` records sends and sync calls in order. */
function coordinatorWrites({ responses, apps = [{ id: 'app-1' }], syncRunning = () => false }) {
  const state = {
    apps,
    audit: [],
    currentAppId: null,
    sessionEpoch: 4,
    participantSessionId: 'session-1',
    coordinatorRevision: 7,
    workerId: 'worker-1',
  };
  const events = [];
  const control = runControl({ state });
  const writes = coordinatorWritesModule.create({
    ...control,
    state,
    previewMode: false,
    workQueueEngine,
    async sendRuntime(message) {
      events.push(['send', message.type]);
      return responses.shift();
    },
    recordAudit: () => {},
    withCoordinatorMutation: (action) => action(),
    applyCoordinatorMetadata: (response) => events.push(['apply', response.stateRevision ?? null]),
    applicationGenerations: () => ({}),
    applicationRevisions: () => ({}),
    restore: async () => {},
    scheduleCoordinatorSync: (...args) => events.push(['schedule', ...args]),
    waitForCoordinatorSync: async () => { events.push(['wait']); },
    coordinatorSyncRunning: syncRunning,
  });
  return { writes, control, state, events };
}

test('persist retries once after a stale state revision, waiting for the coordinator sync in between', async () => {
  let syncRunning = false;
  const idle = coordinatorWrites({
    responses: [{ ok: false, code: 'STALE_STATE_REVISION' }, { ok: true, stateRevision: 8 }],
    syncRunning: () => syncRunning,
  });
  await idle.writes.persist();
  assert.deepEqual(idle.events, [
    ['send', 'PERSIST_ASSISTANT_STATE'],
    ['schedule'],
    ['schedule'],
    ['wait'],
    ['send', 'PERSIST_ASSISTANT_STATE'],
    ['apply', 8],
  ]);

  syncRunning = true;
  const running = coordinatorWrites({
    responses: [{ ok: false, code: 'STALE_STATE_REVISION' }, { ok: true, stateRevision: 8 }],
    syncRunning: () => syncRunning,
  });
  await running.writes.persist();
  assert.deepEqual(running.events.map(([name]) => name), ['send', 'schedule', 'wait', 'send', 'apply'], 'a running sync is joined, not rescheduled');

  const twice = coordinatorWrites({ responses: [{ ok: false, code: 'STALE_STATE_REVISION' }, { ok: false, code: 'STALE_STATE_REVISION' }] });
  await assert.rejects(twice.writes.persist(), /could not save its current checkpoint/);
  assert.equal(twice.events.filter(([name, type]) => name === 'send' && type === 'PERSIST_ASSISTANT_STATE').length, 2);
});

test('a stale persist response stops the caller with the coordinator stale error', async () => {
  const { writes, events } = coordinatorWrites({
    responses: [{ ok: false, stale: true, applicationId: 'app-1', error: 'Changed in another window.', stateRevision: 9 }],
  });
  await assert.rejects(writes.persist({ applicationIds: ['app-1'] }), { name: 'RunCancelledError', message: 'Changed in another window.' });
  assert.deepEqual(events, [['send', 'PERSIST_ASSISTANT_STATE'], ['apply', 9], ['schedule', 'app-1']]);
});

test('persist cancels the runs of applications the coordinator rejected, and only those', async () => {
  const kept = { id: 'kept' };
  const rejected = { id: 'rejected' };
  const { writes, control, events } = coordinatorWrites({
    responses: [{ ok: true, stateRevision: 8, rejectedApplicationIds: ['rejected'] }],
    apps: [kept, rejected],
  });
  const keptToken = await control.beginApplicationRun(kept);
  const rejectedToken = await control.beginApplicationRun(rejected);
  await assert.rejects(writes.persist(), { name: 'RunCancelledError', message: /paused or changed in another assistant window/ });
  assert.equal(rejectedToken.cancelled, true);
  assert.equal(keptToken.cancelled, false);
  assert.deepEqual(events.at(-1), ['schedule', ['rejected']]);
});

test('a refused lease is a coordinator change when stale, and a lease conflict otherwise', async () => {
  const stale = coordinatorWrites({ responses: [{ allowed: false, stale: true, error: 'The run moved.' }] });
  await assert.rejects(stale.writes.acquireApplicationLease(stale.state.apps[0]), { name: 'RunCancelledError', message: 'The run moved.' });
  assert.deepEqual(stale.events, [['send', 'ACQUIRE_APPLICATION_LEASE'], ['schedule', 'app-1']]);

  const lease = { holder: 'other-window', expiresAt: '2030-01-01T00:00:00.000Z' };
  const conflict = coordinatorWrites({ responses: [{ allowed: false, reason: 'Held elsewhere.', lease }] });
  await assert.rejects(conflict.writes.acquireApplicationLease(conflict.state.apps[0]), (error) => {
    assert.equal(error.name, 'LeaseConflictError');
    assert.equal(error.message, 'Held elsewhere.');
    assert.deepEqual(error.lease, lease);
    return true;
  });
  assert.deepEqual(conflict.events, [['send', 'ACQUIRE_APPLICATION_LEASE']], 'a losing contender does not sync');

  const granted = coordinatorWrites({
    responses: [{ allowed: true, stateRevision: 8, lease: { holder: 'worker-1' }, applicationGeneration: 3, applicationRevision: 5 }],
  });
  const application = granted.state.apps[0];
  await granted.writes.acquireApplicationLease(application);
  assert.deepEqual(application.lease, { holder: 'worker-1' });
  assert.equal(application.controlGeneration, 3);
  assert.equal(application.controlRevision, 5);
  assert.equal(granted.writes.APPLICATION_LEASE_MS, 2 * 60 * 1000);
});

/** Coordinator sync over the real merge rules and a scripted coordinator state. */
function coordinatorSync({ state, response, previewMode = false }) {
  const calls = [];
  const sync = coordinatorSyncModule.create({
    ...coordinatorMergeModule.create({ workQueueEngine }),
    state,
    previewMode,
    workQueueEngine,
    attachApplicationPolicy: (application) => application,
    async requestAssistantState() {
      calls.push('request');
      return response;
    },
    cancelApplicationRun: (application) => calls.push(`cancel:${application.id}`),
    cancelAllRuns: () => calls.push('cancelAll'),
    coordinatorStaleError: (message) => Object.assign(new Error(message), { name: 'RunCancelledError' }),
    canonicalHomeView: () => 'choice',
    render: () => calls.push('render'),
  });
  return { sync, calls };
}

test('coordinator deltas ask for a full sync, a targeted one, or nothing', () => {
  const state = {
    sessionEpoch: 2,
    participantSessionId: 'session-1',
    coordinatorRevision: 5,
    apps: [{ id: 'a', controlGeneration: 1, controlRevision: 0 }, { id: 'b' }],
  };
  const { sync } = coordinatorSync({ state });
  const same = { sessionEpoch: 2, participantSessionId: 'session-1', stateRevision: 5, applicationGenerations: { a: 1 }, applicationRevisions: {} };
  assert.deepEqual(sync.coordinatorDelta(same), { full: false, applicationIds: [] });
  assert.deepEqual(sync.coordinatorDelta(null), { full: false, applicationIds: [] });
  assert.deepEqual(sync.coordinatorDelta({ ...same, sessionEpoch: 3 }), { full: true, applicationIds: [] });
  assert.deepEqual(sync.coordinatorDelta({ ...same, participantSessionId: 'session-2' }), { full: true, applicationIds: [] });
  assert.deepEqual(sync.coordinatorDelta({ ...same, applicationGenerations: { a: 1, unknown: 0 } }), { full: true, applicationIds: [] });
  assert.deepEqual(sync.coordinatorDelta({ ...same, applicationGenerations: { a: 2 }, stateRevision: 6 }), { full: false, applicationIds: ['a'] });
  assert.deepEqual(sync.coordinatorDelta({ ...same, stateRevision: 6 }), { full: true, applicationIds: [] });
  assert.deepEqual(coordinatorSync({ state: { ...state, sessionEpoch: 0 } }).sync.coordinatorDelta(same), { full: false, applicationIds: [] });
});

test('a sync requested during a coordinator mutation waits for the mutation, then runs once', async () => {
  const state = {
    sessionEpoch: 1,
    participantSessionId: 'session-1',
    coordinatorRevision: 1,
    view: 'dashboard',
    currentAppId: null,
    participant: null,
    audit: [],
    apps: [{ id: 'app-1', controlGeneration: 0, copy: 'local' }],
  };
  const response = {
    ok: true,
    sessionEpoch: 1,
    participantSessionId: 'session-1',
    stateRevision: 2,
    applicationGenerations: { 'app-1': 1 },
    applicationRevisions: {},
    session: { participant: { record_id: '1' }, apps: [{ id: 'app-1', copy: 'coordinator' }] },
    queue: { applications: [], audit: [] },
  };
  const { sync, calls } = coordinatorSync({ state, response });
  let finishMutation;
  const mutation = sync.withCoordinatorMutation(() => new Promise((resolve) => { finishMutation = resolve; }));

  sync.scheduleCoordinatorSync('app-1');
  assert.equal(sync.coordinatorSyncRunning(), false, 'no sync starts while the mutation is open');
  sync.scheduleCoordinatorSync('app-1');
  await tick();
  assert.equal(sync.coordinatorSyncRunning(), false);
  assert.deepEqual(calls, []);

  finishMutation();
  await mutation;
  assert.equal(sync.coordinatorSyncRunning(), true);
  await sync.waitForCoordinatorSync();
  assert.equal(sync.coordinatorSyncRunning(), false);
  assert.deepEqual(calls, ['request', 'cancel:app-1', 'render']);
  assert.equal(state.apps[0].copy, 'coordinator');
  assert.equal(state.apps[0].controlGeneration, 1);
  assert.equal(state.coordinatorRevision, 2);

  const preview = coordinatorSync({ state: { ...state, apps: [] }, response, previewMode: true });
  preview.sync.scheduleCoordinatorSync();
  assert.equal(preview.sync.coordinatorSyncRunning(), false, 'the preview never syncs');
});

/** Automatic runs over stub run control; each lease holds until the test releases it. */
function automaticRuns({ apps, developerMode = true }) {
  const state = { apps, developerMode, view: 'dashboard', sessionEpoch: 1, error: '' };
  const tokens = new Map();
  const leases = [];
  const started = [];
  let running = 0;
  let maxRunning = 0;
  const runs = automaticRunsModule.create({
    state,
    previewMode: true,
    isDeveloperMode: () => state.developerMode,
    activeRun: (id) => tokens.get(id),
    isRunning: (id) => tokens.has(id),
    async beginApplicationRun(application) {
      const token = { cancelled: false };
      tokens.set(application.id, token);
      return token;
    },
    assertApplicationRun: () => {},
    endApplicationRun: (application) => tokens.delete(application.id),
    APPLICATION_LEASE_MS: 2 * 60 * 1000,
    async withApplicationLease(application) {
      started.push(application.id);
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      const outcome = await new Promise((resolve) => leases.push({ id: application.id, resolve }));
      running -= 1;
      if (outcome instanceof Error) throw outcome;
    },
    setApplicationProgress: () => {},
    setCheckpoint: () => {},
    persist: async () => {},
    render: () => {},
    renderDashboardIfVisible: () => {},
  });
  const release = async (outcome) => {
    leases.splice(0).forEach((lease) => lease.resolve(outcome));
    await tick();
  };
  return { runs, state, started, leases, release, maxRunning: () => maxRunning };
}

const eligibleApp = (id) => ({ id, tabId: 7, autoRun: true, status: 'not_started' });

test('only automatic, tab-bound applications that can still fill are eligible to run', () => {
  const { runs } = automaticRuns({ apps: [] });
  const known = { analysis: { assignments: [{ fieldKey: 'f' }] } };
  assert.equal(runs.eligibleAutomaticApplication(eligibleApp('a')), true);
  assert.equal(runs.eligibleAutomaticApplication({ ...eligibleApp('a'), status: 'ready_to_fill' }), true);
  assert.equal(runs.eligibleAutomaticApplication({ ...eligibleApp('a'), status: 'needs_attention', ...known }), true);
  assert.equal(runs.eligibleAutomaticApplication({ ...eligibleApp('a'), status: 'needs_attention' }), false);
  assert.equal(runs.eligibleAutomaticApplication({ ...eligibleApp('a'), status: 'paused' }), false);
  assert.equal(runs.eligibleAutomaticApplication({ ...eligibleApp('a'), autoRun: false }), false);
  assert.equal(runs.eligibleAutomaticApplication({ ...eligibleApp('a'), tabId: null }), false);
  assert.equal(runs.eligibleAutomaticApplication(undefined), false);
});

test('the automatic queue de-duplicates applications and runs at most three at a time', async () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  const harness = automaticRuns({ apps: ids.map(eligibleApp) });
  await harness.runs.enqueueApplicationBatch(['a', 'b', 'a', 'c', 'd', '', 'e']);
  await harness.runs.enqueueApplicationBatch(['d', 'e', 'f']);
  await tick();
  assert.deepEqual(harness.started, ['a', 'b', 'c']);
  await harness.release();
  assert.deepEqual(harness.started, ['a', 'b', 'c', 'd', 'e', 'f']);
  await harness.release();
  assert.equal(harness.maxRunning(), 3);
  assert.equal(harness.leases.length, 0);
});

test('clearing the automatic queue drops queued applications and pending lease retries', async () => {
  const queued = automaticRuns({ apps: ['a', 'b', 'c', 'd', 'e'].map(eligibleApp) });
  await queued.runs.enqueueApplicationBatch(['a', 'b', 'c', 'd', 'e']);
  await tick();
  queued.runs.clear();
  await queued.release();
  assert.deepEqual(queued.started, ['a', 'b', 'c'], 'queued work never starts after clear()');

  const conflict = () => Object.assign(new Error('Held elsewhere.'), { name: 'LeaseConflictError', lease: { expiresAt: new Date().toISOString() } });
  for (const clearBeforeRetry of [false, true]) {
    const retrying = automaticRuns({ apps: [eligibleApp('a')] });
    await retrying.runs.enqueueApplicationBatch(['a']);
    await tick();
    await retrying.release(conflict());
    if (clearBeforeRetry) retrying.runs.clear();
    await wait(400);
    assert.deepEqual(retrying.started, clearBeforeRetry ? ['a'] : ['a', 'a'], `clear before retry: ${clearBeforeRetry}`);
    await retrying.release();
  }
});

function agentRuntime({ state = {}, activeRunCount = () => 0 } = {}) {
  return agentRuntimeModule.create({
    state: { agentProvider: { kind: 'chrome-local' }, agentRuntime: {}, ...state },
    previewMode: true,
    agentPlanner: {},
    setBusy: () => {},
    setApplicationProgress: () => {},
    assertUiGeneration: () => {},
    activeRunCount,
    persist: async () => {},
  });
}

test('planner start-up progress names the model download, the provider, and each planning phase', () => {
  const local = agentRuntime();
  assert.equal(local.agentProgressMessage({ phase: 'download', progress: 0.416 }), 'Downloading Chrome\'s on-device language model 42%…');
  assert.equal(local.agentProgressMessage({ phase: 'download', progress: 0 }), 'Downloading Chrome\'s on-device language model…');
  assert.equal(local.agentProgressMessage({ phase: 'starting' }), 'Starting three on-device form agents…');
  assert.equal(local.agentProgressMessage({ phase: 'planning' }), 'Field-mapping and gap-analysis agents are reviewing this page…');
  assert.equal(local.agentProgressMessage({ phase: 'reviewing' }), 'The independent review agent is checking the proposed plan…');
  assert.equal(local.agentProgressMessage(), 'Preparing the on-device form agents…');
  for (const [provider, title] of [['codex', 'Codex CLI'], ['claude', 'Claude Code']]) {
    const cli = agentRuntime({ state: { agentProvider: { kind: 'local-cli', provider } } });
    assert.equal(cli.agentProgressMessage({ phase: 'starting' }), `Connecting three planner roles to ${title}…`);
  }
});

test('client links group BenefitsCal programs, keep one program otherwise, and map question input types', async () => {
  const { clientLinkPrograms, apiInputType, saveAgentProvider } = agentRuntime({ activeRunCount: () => 1 });
  assert.deepEqual(clientLinkPrograms(['calfresh', 'wic', 'medical', 'calworks']), ['calfresh', 'medical', 'calworks']);
  assert.deepEqual(clientLinkPrograms(['wic', 'calfresh']), ['wic']);
  assert.deepEqual(clientLinkPrograms([null, 'ihss', 'wic']), ['ihss']);
  assert.deepEqual(clientLinkPrograms(undefined), []);
  assert.equal(apiInputType({ inputType: 'multi_choice' }), 'checkbox');
  for (const type of ['text', 'select', 'radio', 'checkbox', 'date', 'number']) assert.equal(apiInputType({ inputType: type }), type);
  assert.equal(apiInputType({ inputType: 'combobox', options: [{ label: 'A' }] }), 'select');
  assert.equal(apiInputType({ inputType: 'combobox', options: [] }), 'text');
  assert.equal(apiInputType({}), 'text');
  await assert.rejects(saveAgentProvider({}, 0), /Wait for the active application runs to pause/);
});

function recertificationCaseload({ state, previewMode = false, generation = () => 0 }) {
  const calls = [];
  const caseload = recertificationCaseloadModule.create({
    state: { recertifications: [], recertificationWorkspace: {}, apps: [], participant: null, ...state },
    previewMode,
    recertificationEngine: {
      normalizeCaseload: (cases) => cases,
      mergeWorkspace: (item, saved) => ({ ...item, saved: saved || null }),
    },
    async sendRuntime(message) {
      calls.push(['send', message.type]);
      return { ok: true, cases: [{ id: 'r-1' }], source: 'Fictional' };
    },
    setBusy: () => {},
    render: () => {},
    assertUiGeneration: (token) => calls.push(['assertUiGeneration', token]),
    currentUiGeneration: generation,
    commitParticipant: async () => calls.push(['commitParticipant']),
    persist: async () => {},
    prepareAgentRuntime: async () => {},
    openSelectedPrograms: async () => [],
    enqueueApplicationBatch: async () => {},
  });
  return { caseload, calls };
}

test('recertification preparation refuses an unready case and a different client while applications are open', async () => {
  const unready = recertificationCaseload({ state: {} });
  await assert.rejects(unready.caseload.prepareRecertification({ readyToPrepare: false, recordId: '1' }, 0), /Complete the data check/);
  assert.deepEqual(unready.calls, []);

  const busy = recertificationCaseload({ state: { participant: { record_id: '111' }, apps: [{ id: 'app-1' }] } });
  await assert.rejects(
    busy.caseload.prepareRecertification({ readyToPrepare: true, recordId: '222', displayName: 'Client' }, 0),
    /Finish or end the active client session/,
  );
  assert.deepEqual(busy.calls, []);
});

test('recertification answers are kept in session storage only, and the caseload reads the live UI generation', async () => {
  globalThis.chrome = fakeChrome();
  const item = {
    id: 'r-1',
    requirements: [{ key: 'income', status: 'confirmed', note: 'Pay stub', confirmedAt: '2026-01-01T00:00:00.000Z' }],
    consent: { status: 'authorized' },
    outreach: { status: 'drafted' },
  };
  let generation = 3;
  const { caseload, calls } = recertificationCaseload({ state: {}, generation: () => generation });
  await caseload.saveRecertificationWorkspace(item);
  assert.deepEqual(globalThis.chrome.calls.map(([name]) => name), ['storage.session.set']);
  const [[, written]] = globalThis.chrome.calls;
  assert.deepEqual(Object.keys(written), ['nava:recertification-workspace']);
  assert.deepEqual(written['nava:recertification-workspace']['r-1'].requirements.income.status, 'confirmed');

  generation = 4;
  await caseload.loadRecertifications();
  assert.deepEqual(calls.find(([name]) => name === 'assertUiGeneration'), ['assertUiGeneration', 4]);
  assert.ok(globalThis.chrome.calls.every(([name]) => name.startsWith('storage.session.')));

  globalThis.chrome = fakeChrome();
  const preview = recertificationCaseload({ state: {}, previewMode: true });
  await preview.caseload.saveRecertificationWorkspace(item);
  assert.deepEqual(globalThis.chrome.calls, [], 'the preview writes no browser storage');
  delete globalThis.chrome;
});

function connectorActions(connector) {
  const state = { connector };
  return connectorActionsModule.create({
    ...uiDispatchModule.handlerContract(state),
    state,
    managedConnector: () => state.connector?.mode === 'managed',
    connectorEngine,
  });
}

/** A FormData-like reader over a plain object. */
const formData = (fields) => ({ get: (name) => fields[name] ?? null });

test('resubmitting the saved connector source keeps its mappings under the next mapping version', () => {
  const saved = {
    mode: 'managed',
    provider: 'apricot360',
    backendUrl: 'http://127.0.0.1:4789',
    connectionId: 'nava-demo',
    sourceId: '99',
    mappings: { firstName: 'first_name' },
    mappingVersion: 2,
  };
  const fields = {
    provider: 'apricot360',
    backendUrl: ' http://127.0.0.1:4789 ',
    connectionId: 'nava-demo',
    sourceId: '99',
    organizationName: ' Riverside ',
    maxAgeDays: '30',
  };
  const same = connectorActions(saved).connectorConfigFromForm(formData(fields));
  assert.equal(same.mappingVersion, 3);
  assert.equal(same.mappings, saved.mappings);
  assert.equal(same.backendUrl, 'http://127.0.0.1:4789');
  assert.equal(same.organizationName, 'Riverside');
  assert.equal(same.maxAgeDays, 30);

  const otherSource = connectorActions(saved).connectorConfigFromForm(formData({ ...fields, sourceId: '100' }));
  assert.equal(otherSource.mappingVersion, 1);
  assert.deepEqual(otherSource.mappings, {});

  const unmanaged = connectorActions({ ...saved, mode: 'demo' }).connectorConfigFromForm(formData(fields));
  assert.equal(unmanaged.mappingVersion, 1);
  assert.deepEqual(unmanaged.mappings, {});
});

test('change events reach only their own select handlers; prototype ids do nothing', () => {
  const elements = {
    'model-companion-fields': { hidden: true },
    'model-provider': { value: 'codex' },
    'captcha-provider': { value: 'same' },
    'connector-source-id': { placeholder: '' },
  };
  const sourceLabel = { textContent: '' };
  const listeners = {};
  globalThis.document = {
    getElementById: (id) => elements[id] || null,
    querySelector: (selector) => (selector === 'label[for="connector-source-id"]' ? sourceLabel : null),
    addEventListener: (type, listener) => { listeners[`document:${type}`] = listener; },
  };
  const state = { view: 'choice', error: '', developerMode: true };
  const contract = uiDispatchModule.handlerContract(state);
  const deps = { ...contract, state, connectorEngine, managedConnector: () => false };
  const dispatch = uiDispatchModule.create({
    state,
    appRoot: { addEventListener: (type, listener) => { listeners[type] = listener; } },
    render: () => {},
    assertUiGeneration: () => {},
    currentUiGeneration: () => 0,
    agentActions: agentActionsModule.create(deps),
    recertificationActions: recertificationActionsModule.create(deps),
    intakeActions: intakeActionsModule.create(deps),
    connectorActions: connectorActionsModule.create(deps),
    applicationActions: applicationActionsModule.create(deps),
    developerActions: developerActionsModule.create({ state, store: {}, activeRunCount: () => 0, restoreAgentProvider: async () => {} }),
  });
  dispatch.installListeners();
  assert.deepEqual(Object.keys(listeners).sort(), ['change', 'document:click', 'submit']);
  assert.deepEqual([...dispatch.CHANGE_HANDLERS.keys()], ['model-provider', 'captcha-provider', 'connector-provider']);

  listeners.change({ target: { id: 'model-provider', value: 'codex' } });
  assert.equal(elements['model-companion-fields'].hidden, false);
  elements['model-provider'].value = 'chrome-local';
  listeners.change({ target: { id: 'model-provider', value: 'chrome-local' } });
  assert.equal(elements['model-companion-fields'].hidden, true);

  listeners.change({ target: { id: 'connector-provider', value: 'apricot360' } });
  assert.equal(sourceLabel.textContent, 'Apricot form ID');
  assert.equal(elements['connector-source-id'].placeholder, 'Apricot form ID');
  listeners.change({ target: { id: 'connector-provider', value: 'no-such-provider' } });
  assert.equal(sourceLabel.textContent, 'Apricot form ID');

  for (const id of ['toString', 'constructor', '__proto__', 'hasOwnProperty', 'other-select', '']) {
    assert.doesNotThrow(() => listeners.change({ target: { id, value: 'x' } }), id);
  }
  assert.equal(elements['model-companion-fields'].hidden, true);
  delete globalThis.document;
});

test('a coordinator echo of the pause does not throw the caseworker off the handoff form', () => {
  const survives = coordinatorSyncModule.viewSurvivesCoordinatorChange;
  const paused = { id: 'app-1', status: 'paused', handoff: null };
  const state = { apps: [paused], handoffApplicationId: 'app-1' };
  assert.equal(survives(state, 'handoff'), true);
  assert.equal(survives(state, 'dashboard'), true);
  assert.equal(survives(state, 'review'), false, 'detail screens of a changed application still close');
  assert.equal(survives({ ...state, apps: [] }, 'handoff'), false, 'the application is gone');
  const handedOff = { ...paused, handoff: { to: 'Eligibility Team', createdAt: '2026-10-07T00:00:00.000Z', acceptedAt: null } };
  assert.equal(survives({ ...state, apps: [handedOff] }, 'handoff'), false, 'another window already handed it off');
});

test('a cancelled run stops counting as running for the card, but still holds the application until it settles', async () => {
  const state = { apps: [{ id: 'app-1', controlGeneration: 0 }], sessionEpoch: 'epoch-1', workerId: 'window-a' };
  const runs = runControlModule.create({ state, previewMode: true, checkpoint: () => ({}), revokeApplicationRun: async () => {}, onCancelAll: () => {} });
  const application = state.apps[0];
  const token = await runs.beginApplicationRun(application);
  assert.equal(runs.isRunning('app-1'), true);
  assert.equal(runs.runActive('app-1'), true);
  runs.cancelApplicationRun(application);
  assert.equal(runs.runActive('app-1'), false, 'the card shows the stop at once');
  assert.equal(runs.isRunning('app-1'), true, 'automatic runs still wait for the old run to settle');
  runs.endApplicationRun(application, token);
  assert.equal(runs.isRunning('app-1'), false);
});

/** Run control over two applications, as the side panel holds them. */
function twoApplicationRuns(developerMode) {
  const state = { developerMode, apps: [{ id: 'wic', controlGeneration: 0 }, { id: 'ihss', controlGeneration: 0 }], sessionEpoch: 'epoch-1', workerId: 'window-a' };
  const runs = runControlModule.create({ state, previewMode: true, checkpoint: () => ({}), revokeApplicationRun: async () => {}, onCancelAll: () => {} });
  return { state, runs, wic: state.apps[0], ihss: state.apps[1] };
}

test('with developer mode off a caseworker-started run waits for a different application\'s run, with a plain message', async () => {
  const { runs, wic, ihss } = twoApplicationRuns(false);
  const automatic = await runs.beginApplicationRun(ihss); // the automatic queue's run
  let started = 0;
  await assert.rejects(runs.withNewApplicationRun(wic, async () => { started += 1; }, { uiBound: true }), { message: 'Wait for the running application to stop first.' });
  assert.equal(started, 0);
  assert.equal(runs.isRunning('wic'), false, 'no token is left behind');
  assert.equal(runs.runActive('ihss'), true, 'the running application is not cancelled');
  assert.throws(() => runs.assertNoOtherRun(null), { message: 'Wait for the running application to stop first.' });
  runs.endApplicationRun(ihss, automatic);
  await runs.withNewApplicationRun(wic, async () => { started += 1; }, { uiBound: true });
  assert.equal(started, 1, 'once the other run settles the caseworker can start this one');
  assert.doesNotThrow(() => runs.assertNoOtherRun(null));
});

test('with developer mode off resuming the application that is itself running still works', async () => {
  const { runs, wic } = twoApplicationRuns(false);
  const first = runs.withNewApplicationRun(wic, (token) => new Promise((resolve) => { token.abort.signal.addEventListener('abort', resolve); }), { uiBound: true });
  await new Promise((resolve) => setImmediate(resolve));
  let resumed = 0;
  await runs.withNewApplicationRun(wic, async () => { resumed += 1; }, { uiBound: true });
  await first;
  assert.equal(resumed, 1);
  assert.doesNotThrow(() => runs.assertNoOtherRun('wic'));
});

test('with developer mode off the automatic queue\'s own runs are not refused by the caseworker rule', async () => {
  const { runs, wic, ihss } = twoApplicationRuns(false);
  const ui = await runs.beginApplicationRun(wic, { uiBound: true });
  const automatic = await runs.beginApplicationRun(ihss);
  assert.ok(automatic, 'the pump keeps its own one-at-a-time limit');
  runs.endApplicationRun(wic, ui);
  runs.endApplicationRun(ihss, automatic);
});

test('with developer mode on caseworker-started runs on several applications run at once, as before', async () => {
  const { runs, wic, ihss } = twoApplicationRuns(true);
  const automatic = await runs.beginApplicationRun(ihss);
  let started = 0;
  await runs.withNewApplicationRun(wic, async () => { started += 1; }, { uiBound: true });
  assert.equal(started, 1);
  assert.doesNotThrow(() => runs.assertNoOtherRun(null));
  runs.endApplicationRun(ihss, automatic);
});

/** The planner runtime outside preview mode, over a recording planner and a chrome.storage.session stand-in. */
function liveAgentRuntime({ developerMode, stored, gateway = null, agentRuntime = { status: 'ready' }, rejectCompanion = false }) {
  const configured = [];
  const storage = { 'nava:agent-provider': stored };
  const writes = [];
  const prepared = [];
  const gatewayRequests = [];
  const state = { developerMode, agentProvider: { kind: 'chrome-local' }, agentRuntime };
  globalThis.chrome = {
    storage: {
      session: {
        async get(key) { return key in storage && storage[key] !== undefined ? { [key]: storage[key] } : {}; },
        async set(value) { writes.push(['set', value]); Object.assign(storage, value); },
        async remove(key) { writes.push(['remove', key]); delete storage[key]; },
      },
    },
  };
  const runtime = agentRuntimeModule.create({
    state,
    previewMode: false,
    agentPlanner: {
      configure: (config) => {
        if (rejectCompanion && config.kind === 'local-cli') throw new Error('Paste the pairing token printed by the local model companion.');
        configured.push(config);
      },
      gatewayConfig: async () => gateway,
      gatewayRequest: async (...args) => { gatewayRequests.push(args); return {}; },
      prepare: async () => { prepared.push('nano'); return { status: 'ready' }; },
      runtimeInfo: () => ({ title: 'Test' }),
    },
    setBusy: () => {},
    setApplicationProgress: () => {},
    assertUiGeneration: () => {},
    activeRunCount: () => 0,
    currentUiSignal: () => undefined,
    persist: async () => {},
  });
  return { runtime, state, configured, storage, writes, prepared, gatewayRequests };
}

const jevProvider = { kind: 'local-cli', provider: 'jev', endpoint: 'http://127.0.0.1:4789', token: 'secret', model: 'jev-1.13.0' };

test('with developer mode off the planner uses Gemini Nano and leaves a stored experimental provider untouched', async () => {
  const off = liveAgentRuntime({ developerMode: false, stored: jevProvider });
  await off.runtime.restoreAgentProvider();
  assert.deepEqual(off.state.agentProvider, { kind: 'chrome-local' });
  assert.deepEqual(off.configured, [{ kind: 'chrome-local', gateway: false }]);
  assert.deepEqual(off.writes, [], 'the stored provider is neither removed nor overwritten');
  assert.deepEqual(off.storage['nava:agent-provider'], jevProvider);

  off.state.developerMode = true;
  await off.runtime.restoreAgentProvider();
  assert.deepEqual(off.state.agentProvider, jevProvider, 'turning the mode back on restores the stored provider');
  assert.deepEqual(off.configured.at(-1), jevProvider);

  const on = liveAgentRuntime({ developerMode: true, stored: jevProvider });
  await on.runtime.restoreAgentProvider();
  assert.deepEqual(on.state.agentProvider, jevProvider);
});

test('with developer mode off, using a model runtime applies Gemini Nano only and never touches stored settings', async () => {
  const form = { fields: { modelProvider: 'jev', modelEndpoint: 'http://127.0.0.1:4789', modelToken: 'secret', captchaProvider: 'codex', captchaModel: 'x', captchaReasoning: 'xhigh' } };
  const realFormData = globalThis.FormData;
  globalThis.FormData = class { constructor(source) { this.fields = source.fields; } get(name) { return this.fields[name] ?? null; } };
  try {
    const off = liveAgentRuntime({ developerMode: false, stored: jevProvider });
    await off.runtime.saveAgentProvider(form, 0);
    assert.deepEqual(off.state.agentProvider, { kind: 'chrome-local' });
    assert.deepEqual(off.configured, [{ kind: 'chrome-local', gateway: false }]);
    assert.deepEqual(off.writes, []);
    assert.deepEqual(off.storage['nava:agent-provider'], jevProvider);

    const on = liveAgentRuntime({ developerMode: true, stored: undefined });
    await on.runtime.saveAgentProvider(form, 0);
    assert.equal(on.state.agentProvider.provider, 'jev');
    assert.equal(on.state.agentProvider.captcha.provider, 'codex');
    assert.equal(on.writes.length, 1);
  } finally {
    globalThis.FormData = realFormData;
  }
});

const savedGateway = { base: 'https://api.example.test', endpoint: 'https://api.example.test/v1/plan', token: 'fake-tenant-key' };
const sharedReady = () => ({ status: 'ready', shared: true, message: 'Planning runs on the shared API at https://api.example.test. Filling still happens in this tab.' });

test('with developer mode off a saved shared planner API is not used: the runtime prepares and reports Gemini Nano', async () => {
  const off = liveAgentRuntime({ developerMode: false, stored: undefined, gateway: savedGateway, agentRuntime: sharedReady() });
  await off.runtime.restoreAgentProvider();
  assert.deepEqual(off.configured, [{ kind: 'chrome-local', gateway: false }], 'the planner is told not to use the gateway');
  assert.equal(off.state.agentRuntime.shared, undefined, 'the shared-API status is cleared');
  await off.runtime.prepareAgentRuntime();
  assert.deepEqual(off.prepared, ['nano'], 'Gemini Nano is prepared');
  assert.equal(off.state.agentRuntime.shared, undefined);
  assert.doesNotMatch(off.state.agentRuntime.message, /shared API/);
  assert.match(off.state.agentRuntime.message, /Test is ready/);
  assert.deepEqual(off.gatewayRequests, []);
});

test('with developer mode on a saved shared planner API still plans', async () => {
  const on = liveAgentRuntime({ developerMode: true, stored: undefined, gateway: savedGateway, agentRuntime: { status: 'checking', message: '' } });
  await on.runtime.restoreAgentProvider();
  assert.deepEqual(on.configured, [{ kind: 'chrome-local' }], 'the on path configures exactly as before');
  await on.runtime.prepareAgentRuntime();
  assert.deepEqual(on.prepared, []);
  assert.equal(on.state.agentRuntime.shared, true);
  assert.match(on.state.agentRuntime.message, /Planning runs on the shared API at https:\/\/api\.example\.test/);
});

test('with developer mode off a client link is never minted through a saved shared API', async () => {
  const application = { id: 'app-1', programIds: ['wic'], analysis: { gaps: [{ fieldKey: 'a', question: 'Q?' }] } };
  const off = liveAgentRuntime({ developerMode: false, stored: undefined, gateway: savedGateway });
  await assert.rejects(off.runtime.mintClientLink(application), { message: 'Developer mode is off.' });
  assert.deepEqual(off.gatewayRequests, []);
  assert.equal(application.clientLink, undefined);
});

test('turning developer mode off after a shared-API session resets the runtime even though the provider is unchanged', async () => {
  const flip = liveAgentRuntime({ developerMode: true, stored: undefined, gateway: savedGateway, agentRuntime: { status: 'checking', message: '' } });
  await flip.runtime.restoreAgentProvider();
  await flip.runtime.prepareAgentRuntime();
  assert.equal(flip.state.agentRuntime.shared, true);
  flip.state.developerMode = false;
  await flip.runtime.restoreAgentProvider();
  assert.deepEqual(flip.state.agentRuntime, { status: 'checking', message: '' });
  await flip.runtime.prepareAgentRuntime();
  assert.deepEqual(flip.prepared, ['nano']);
});

test('a stored provider the planner rejects falls back to Gemini Nano and resets the runtime status', async () => {
  const broken = liveAgentRuntime({ developerMode: true, stored: { ...jevProvider, token: 'short' }, rejectCompanion: true, agentRuntime: { status: 'ready', message: 'Jev decision model is ready.' } });
  await broken.runtime.restoreAgentProvider();
  assert.deepEqual(broken.state.agentProvider, { kind: 'chrome-local' });
  assert.deepEqual(broken.state.agentRuntime, { status: 'checking', message: '' });
  assert.deepEqual(broken.writes, [['remove', 'nava:agent-provider']]);
});

/** The program-choice submit handler over a recording opener. */
function programChoice(developerMode) {
  const opened = [];
  const state = { developerMode, apps: [], view: 'program' };
  const actions = intakeActionsModule.create({
    state,
    render: () => {},
    SKIP_FINAL_RENDER: Symbol('skip'),
    showScreen: () => () => {},
    assertUiGeneration: () => {},
    currentUiGeneration: () => 0,
    persist: async () => {},
    prepareAgentRuntime: async () => {},
    getActiveTab: async () => ({ id: 1 }),
    scanTab: async () => ({ id: 'current-app' }),
    openSelectedPrograms: async (values) => { opened.push(values); return values.filter((v) => v !== 'current').map((v) => ({ id: v })); },
    enqueueApplicationBatch: async () => {},
  });
  const submit = Object.fromEntries(actions.INTAKE_SUBMIT_ACTIONS)['program-form'];
  return async (values) => {
    const realFormData = globalThis.FormData;
    globalThis.FormData = class { getAll() { return values; } };
    try { return await submit({ form: {}, uiToken: 0 }); } finally { globalThis.FormData = realFormData; }
  };
}

test('with developer mode off one application at a time is allowed, and one BenefitsCal workflow counts as one', async () => {
  const off = programChoice(false);
  await assert.doesNotReject(off(['calfresh', 'medical']));
  await assert.doesNotReject(off(['current']));
  await assert.doesNotReject(off(['wic']));
  const refused = programChoice(false);
  const outcomes = [];
  for (const values of [['wic', 'ihss'], ['current', 'wic']]) {
    await assert.rejects(refused(values), { message: 'Choose one application at a time.' });
    outcomes.push(values);
  }
  assert.equal(outcomes.length, 2);
  const on = programChoice(true);
  for (const values of [['calfresh', 'medical'], ['current'], ['wic', 'ihss'], ['current', 'wic']]) {
    await assert.doesNotReject(on(values), values.join());
  }
});

test('a refused multi-application choice opens nothing', async () => {
  const opened = [];
  const state = { developerMode: false, apps: [], view: 'program' };
  const actions = intakeActionsModule.create({
    state, render: () => {}, SKIP_FINAL_RENDER: Symbol('skip'), showScreen: () => () => {},
    assertUiGeneration: () => {}, currentUiGeneration: () => 0, persist: async () => {},
    prepareAgentRuntime: async () => { opened.push('prepare'); }, getActiveTab: async () => { opened.push('tab'); return {}; },
    scanTab: async () => { opened.push('scan'); return { id: 'x' }; },
    openSelectedPrograms: async () => { opened.push('open'); return []; }, enqueueApplicationBatch: async () => {},
  });
  const submit = Object.fromEntries(actions.INTAKE_SUBMIT_ACTIONS)['program-form'];
  const realFormData = globalThis.FormData;
  globalThis.FormData = class { getAll() { return ['wic', 'ihss']; } };
  try {
    await assert.rejects(submit({ form: {}, uiToken: 0 }), /Choose one application at a time\./);
  } finally { globalThis.FormData = realFormData; }
  assert.deepEqual(opened, []);
});

test('with developer mode off the queue runs one application at a time; with it on, three', async () => {
  const off = automaticRuns({ apps: ['a', 'b', 'c'].map(eligibleApp), developerMode: false });
  await off.runs.enqueueApplicationBatch(['a', 'b', 'c']);
  await tick();
  assert.deepEqual(off.started, ['a']);
  await off.release();
  assert.deepEqual(off.started, ['a', 'b']);
  await off.release();
  assert.deepEqual(off.started, ['a', 'b', 'c']);
  await off.release();
  assert.equal(off.maxRunning(), 1);

  const on = automaticRuns({ apps: ['a', 'b', 'c', 'd'].map(eligibleApp), developerMode: true });
  await on.runs.enqueueApplicationBatch(['a', 'b', 'c', 'd']);
  await tick();
  assert.deepEqual(on.started, ['a', 'b', 'c']);
  await on.release();
  await on.release();
  assert.equal(on.maxRunning(), 3);
});

test('changing the applied planner provider resets the runtime status; an unchanged provider leaves it', async () => {
  const off = liveAgentRuntime({ developerMode: false, stored: jevProvider });
  off.state.agentProvider = jevProvider;
  await off.runtime.restoreAgentProvider();
  assert.equal(off.state.agentRuntime.status, 'checking');
  assert.deepEqual(await off.runtime.prepareAgentRuntime(), { status: 'ready' }, 'Nano is prepared rather than returning early');
  assert.match(off.state.agentRuntime.message, /Test is ready/);

  off.state.developerMode = true;
  await off.runtime.restoreAgentProvider();
  assert.deepEqual(off.state.agentProvider, jevProvider);
  assert.equal(off.state.agentRuntime.status, 'checking');

  off.state.agentRuntime = { status: 'ready', message: 'kept' };
  await off.runtime.restoreAgentProvider();
  assert.deepEqual(off.state.agentRuntime, { status: 'ready', message: 'kept' });
});
