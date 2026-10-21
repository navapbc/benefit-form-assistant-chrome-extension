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
  for (const view of ['connector', 'providers', 'connector-mapping', 'record-review', 'record', 'recertifications', 'recertification-detail', 'handoff']) {
    assert.equal(dev.isExperimentalView(view), true, view);
  }
  for (const view of ['choice', 'details', 'welcome', 'document', 'document-review', 'programs', 'dashboard', 'questions', 'review']) {
    assert.equal(dev.isExperimentalView(view), false, view);
  }
  assert.equal(dev.DEVELOPER_MODE_OFF_MESSAGE, 'Developer mode is off.');
});
