const test = require('node:test');
const assert = require('node:assert/strict');
const { loadEsm } = require('./helpers/esm.cjs');

// The API each side-panel leaf module exported before it became an ES module, recorded from the classic-script build.
const EXPORTED_KEYS = {
  'panel-format': ['agentUsageSummary', 'decoded', 'displayValue', 'encoded', 'escapeHtml', 'formatTimestamp', 'hostLabel', 'mergeAgenticMetadata', 'mergeVerifiedProvenance', 'progressFor', 'provenanceForScan', 'providerInitials', 'sourceLabel'],
  'application-policy': ['DEFAULT_AUTOMATED_PAGES', 'MAX_AUTOMATED_PAGES', 'assertSameDocumentLocation', 'automatedPageLimit', 'checkpoint', 'checkpointFromScan', 'commandLocation', 'create', 'pathMatchesPrefix', 'pendingHumanCheck', 'stopCheckpoint', 'urlHash', 'urlOrigin', 'urlPath', 'urlSearch'],
  'extension-messaging': ['PAGE_AGENT_VERSION', 'create'],
  'host-access': ['ensureHostAccess', 'originPattern'],
  'scan-analysis': ['agentGapOptions', 'agentGapQuestion', 'analysisFromAgentPlan', 'create', 'gapFromAgent', 'mergeAgentGaps', 'participantForApplication', 'scanAuditDetails', 'scannedStatus'],
  'ocr-engine': ['LIMITS', 'boundedDimensions', 'imageFileSource', 'linesFromResult', 'pdfPageSource', 'recognizeSources'],
  'document-readers': ['setOcrEngineForTests', 'FORMATS', 'MAX_PDF_PAGES', 'MAX_TEXT_CHARS', 'cleanText', 'delimitedToLabeledText', 'fileExtension', 'formatFor', 'parseDelimitedRows', 'readDocument', 'readPdfDocument'],
  'document-parser': ['delimitedToLabeledText', 'extractFieldsFromObject', 'extractFieldsFromOcrPages', 'extractFieldsFromText', 'mergeFields', 'parseDocument'],
  'page-scan': ['create'],
  'recertification-caseload': ['create'],
  'captcha-model': ['classify', 'companionUrl', 'configFor'],
};

for (const [name, keys] of Object.entries(EXPORTED_KEYS)) {
  test(`sidepanel/${name}.mjs exports the same API keys as the classic-script build`, () => {
    assert.deepEqual(Object.keys(loadEsm(`sidepanel/${name}.mjs`)).sort(), [...keys].sort());
  });
}
