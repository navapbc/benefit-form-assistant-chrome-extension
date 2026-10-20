const test = require('node:test');
const assert = require('node:assert/strict');
const { loadEsm } = require('./helpers/esm.cjs');

// The API each side-panel view module exported before it became an ES module, recorded from the classic-script build.
const EXPORTED_KEYS = {
  'view-applications': ['create'],
  'view-connector': ['create'],
  'view-intake': ['create'],
  'view-recertification': ['create'],
  'view-review': ['create'],
};

for (const [name, keys] of Object.entries(EXPORTED_KEYS)) {
  test(`sidepanel/${name}.mjs exports the same API keys as the classic-script build`, () => {
    assert.deepEqual(Object.keys(loadEsm(`sidepanel/${name}.mjs`)).sort(), keys);
  });
}
