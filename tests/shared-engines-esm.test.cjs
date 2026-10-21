const test = require('node:test');
const assert = require('node:assert/strict');
const { loadEsm } = require('./helpers/esm.cjs');

// The API each shared engine exported before it became an ES module, recorded from the CommonJS build.
const EXPORTED_KEYS = {
  'connector-engine': ['CANONICAL_FIELDS', 'PROVIDER_CATALOG', 'mapRecord', 'normalize', 'normalizeSchemaFields', 'providerDefinition', 'sanitizeConfig', 'suggestMappings', 'validateBackendUrl', 'validateMappings'],
  'work-queue-engine': ['DEFAULT_LEASE_MS', 'MAX_APPLICATIONS', 'MAX_AUDIT_EVENTS', 'QUEUE_VERSION', 'acquireLease', 'appendAudit', 'auditEvent', 'buildQueue', 'durableApplication', 'exportAudit', 'markTabClosed', 'releaseLease', 'restoreApplications', 'resumeDecision', 'safeLocation', 'safeOrigin', 'signatureHash'],
  'program-catalog': ['PROGRAMS', 'planWorkflows', 'programDefinition'],
  'recertification-engine': ['REQUIREMENTS', 'daysUntil', 'dueDateLabel', 'mergeWorkspace', 'normalizeCase', 'normalizeCaseload', 'notificationPlan', 'summarize', 'urgencyFor'],
  'demo-connector-data': ['CLIENT_RECORDS', 'FORM_ID', 'RECERTIFICATION_CASELOAD', 'RECORD_ID', 'SCHEMA', 'isoDateOffset', 'recertificationCase', 'recordAttributes'],
  'planner-inventory': ['compactText', 'groupedInventory', 'planningInventory', 'redactSourceValues', 'sourceInventory'],
  'planner-runtime': ['ROLE_NAMES', 'availability', 'configure', 'decisionPlan', 'gatewayAllowed', 'onReset', 'prepare', 'promptRole', 'reset', 'runtimeInfo', 'setBridgeFetchForTests', 'setRuntimeForTests'],
  'agentic-planner': ['availability', 'clearGatewayConfig', 'configure', 'gatewayConfig', 'gatewayRequest', 'groupedInventory', 'normalizeGatewayBase', 'plan', 'prepare', 'reset', 'runtimeInfo', 'saveGatewayConfig', 'setBridgeFetchForTests', 'setRuntimeForTests'],
};

for (const [name, keys] of Object.entries(EXPORTED_KEYS)) {
  test(`shared/${name}.mjs exports the same API keys as the CommonJS build`, () => {
    assert.deepEqual(Object.keys(loadEsm(`shared/${name}.mjs`)).sort(), keys);
  });
}
