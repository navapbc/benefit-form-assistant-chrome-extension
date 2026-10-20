const test = require('node:test');
const assert = require('node:assert/strict');
const { loadEsm } = require('./helpers/esm.cjs');

// The API each service-worker module exported before it became an ES module, recorded from the classic-script build.
const EXPORTED_KEYS = {
  'coordinator-rules': ['activeLease', 'applicationChanged', 'applicationsById', 'assertActiveLeaseHolder', 'assertApplicationGeneration', 'assertApplicationRevision', 'assertCoordinatorEpoch', 'assertCurrentApplicationRun', 'assertLeaseNotHeldByOther', 'assertParticipantSession', 'assertStateRevision', 'coordinationError', 'coordinatorError', 'coordinatorFields', 'invalidateApplicationRun', 'mergeAudit', 'newParticipantSessionId', 'normalizeCoordinator', 'normalizedGeneration', 'participantValue', 'replaceApplications', 'revokedApplication', 'sameValue', 'storedApplicationIds', 'validCoordinatorId'],
  'client-session': ['create'],
  'application-runs': ['create'],
  'connector-client': ['create'],
};

for (const [name, keys] of Object.entries(EXPORTED_KEYS)) {
  test(`background/${name}.mjs exports the same API keys as the classic-script build`, () => {
    assert.deepEqual(Object.keys(loadEsm(`background/${name}.mjs`)).sort(), keys);
  });
}

test('background/service-worker.mjs exports startServiceWorker, and background.js only starts it', () => {
  assert.equal(typeof loadEsm('background/service-worker.mjs').startServiceWorker, 'function');
});
