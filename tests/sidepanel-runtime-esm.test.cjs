const test = require('node:test');
const assert = require('node:assert/strict');
const { loadEsm } = require('./helpers/esm.cjs');

// The API each side-panel actions/runtime module exported before it became an ES module, recorded from the classic-script build.
const EXPORTED_KEYS = {
  'actions-agent': ['create'],
  'actions-applications': ['create'],
  'actions-connector': ['create'],
  'actions-developer': ['create'],
  'actions-intake': ['create'],
  'actions-recertification': ['create'],
  'agent-runtime': ['create'],
  'application-runner': ['create'],
  'automatic-runs': ['create'],
  'captcha-runs': ['create'],
  'coordinator-merge': ['create'],
  'coordinator-sync': ['create', 'viewSurvivesCoordinatorChange'],
  'coordinator-writes': ['create'],
  'preview-runtime': ['create'],
  'run-control': ['create'],
  'ui-dispatch': ['create', 'handlerContract'],
};

for (const [name, keys] of Object.entries(EXPORTED_KEYS)) {
  test(`sidepanel/${name}.mjs exports the same API keys as the classic-script build`, () => {
    assert.deepEqual(Object.keys(loadEsm(`sidepanel/${name}.mjs`)).sort(), keys);
  });
}
