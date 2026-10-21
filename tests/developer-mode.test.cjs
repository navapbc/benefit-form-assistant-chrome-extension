const test = require('node:test');
const assert = require('node:assert/strict');
const dev = require('../shared/developer-mode.mjs');

const storeWith = (value, present = true) => ({ get: async (key) => (present ? { [key]: value } : {}) });

test('reads only true as on', async () => {
  assert.equal(dev.STORAGE_KEY, 'nava:developer-mode');
  assert.equal(await dev.readDeveloperMode(storeWith(true)), true);
  for (const value of [false, 'true', 1, null, {}]) {
    assert.equal(await dev.readDeveloperMode(storeWith(value)), false, String(value));
  }
  assert.equal(await dev.readDeveloperMode(storeWith(undefined, false)), false);
});

test('a throwing or missing store reads as off', async () => {
  assert.equal(await dev.readDeveloperMode({ get: async () => { throw new Error('boom'); } }), false);
  assert.equal(await dev.readDeveloperMode({ get: () => { throw new Error('sync boom'); } }), false);
  assert.equal(await dev.readDeveloperMode(undefined), false);
});

test('write stores a strict boolean', async () => {
  const writes = [];
  const storage = { set: async (obj) => { writes.push(obj); } };
  await dev.writeDeveloperMode(storage, 1);
  await dev.writeDeveloperMode(storage, 0);
  assert.deepEqual(writes, [{ 'nava:developer-mode': true }, { 'nava:developer-mode': false }]);
});

test('the experimental lists contain exactly the spec\'s items', () => {
  const clicks = ['try-captcha', 'open-handoff', 'accept-handoff', 'pause', 'save-planner', 'disconnect-planner', 'client-link', 'choose-id', 'configure-connector', 'back-providers', 'select-provider', 'back-connector', 'local-connector-settings', 'reset-connector', 'back-record-id', 'confirm-connector-record', 'open-recertifications', 'back-recertifications', 'review-recertification', 'draft-recertification-outreach', 'complete-recertification-outreach', 'prepare-recertification'];
  const submits = ['record-form', 'connector-form', 'connector-mapping-form', 'recertification-intake-form', 'handoff-form'];
  assert.deepEqual([...dev.EXPERIMENTAL_ACTIONS].sort(), [...clicks, ...submits, 'connector-provider'].sort());
  for (const name of [...clicks, ...submits, 'connector-provider']) {
    assert.equal(dev.EXPERIMENTAL_ACTIONS.has(name), true, name);
    assert.equal(dev.isExperimentalAction(name), true, name);
  }
  for (const name of ['fill', 'run', 'answer', 'review', 'resume-human-checkpoint', 'start-over', 'add-application', 'export-audit', 'directory-pick', 'details-form', 'document-form', 'program-form', 'model-provider-form']) {
    assert.equal(dev.EXPERIMENTAL_ACTIONS.has(name), false, name);
    assert.equal(dev.isExperimentalAction(name), false, name);
  }
});

test('message types', () => {
  assert.deepEqual([...dev.EXPERIMENTAL_MESSAGE_TYPES].sort(), ['DISCOVER_CONNECTOR', 'LIST_RECERTIFICATIONS', 'LOOKUP_RECORD', 'NAVA_CAPTCHA_COMMAND', 'RESET_CONNECTOR', 'SAVE_CONNECTOR']);
  assert.equal(dev.isExperimentalMessage('SAVE_CONNECTOR'), true);
  for (const type of ['OPEN_PROGRAMS', 'GET_CONNECTOR_STATUS']) assert.equal(dev.isExperimentalMessage(type), false, type);
});

test('views', () => {
  assert.deepEqual([...dev.EXPERIMENTAL_VIEWS].sort(), ['connector', 'connector-mapping', 'handoff', 'providers', 'recertification-detail', 'recertifications', 'record', 'record-review']);
  for (const view of ['connector', 'providers', 'connector-mapping', 'record-review', 'record', 'recertifications', 'recertification-detail', 'handoff']) {
    assert.equal(dev.isExperimentalView(view), true, view);
  }
  for (const view of ['choice', 'details', 'welcome', 'document', 'document-review', 'programs', 'dashboard', 'questions', 'review']) {
    assert.equal(dev.isExperimentalView(view), false, view);
  }
  assert.equal(dev.DEVELOPER_MODE_OFF_MESSAGE, 'Developer mode is off.');
});

test('write rejects instead of throwing for a missing or invalid store', async () => {
  await assert.rejects(dev.writeDeveloperMode(undefined, true));
  await assert.rejects(dev.writeDeveloperMode({}, true));
});

test('the exported lists are read-only', () => {
  for (const set of [dev.EXPERIMENTAL_ACTIONS, dev.EXPERIMENTAL_VIEWS, dev.EXPERIMENTAL_MESSAGE_TYPES]) {
    const before = [...set];
    for (const method of ['add', 'delete', 'clear']) {
      assert.equal(set[method], undefined, method);
      assert.throws(() => set[method]('x'));
    }
    assert.equal(Object.isFrozen(set), true);
    assert.deepEqual([...set], before);
    assert.equal(set.size, before.length);
    assert.equal(set.has('x'), false);
  }
});

test('forEach and the iterators do not hand out the private set', () => {
  for (const set of [dev.EXPERIMENTAL_ACTIONS, dev.EXPERIMENTAL_VIEWS, dev.EXPERIMENTAL_MESSAGE_TYPES]) {
    const before = [...set];
    set.forEach((value, key, third) => {
      assert.equal(third instanceof Set, false);
      for (const method of ['add', 'delete', 'clear']) assert.equal(third[method], undefined, method);
      assert.equal(third, set);
    });
    for (const iterator of [set.values(), set.keys(), set.entries(), set[Symbol.iterator]()]) {
      assert.equal(iterator instanceof Set, false);
      for (const method of ['add', 'delete', 'clear']) assert.equal(iterator[method], undefined, method);
    }
    assert.deepEqual([...set], before);
  }
});
