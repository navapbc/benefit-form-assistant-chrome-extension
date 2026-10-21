// Side-panel entry and composition root: imports the panel modules, creates each in dependency order over the shared panel state, keeps the shared render loop, and starts the panel.
import { formEngine as engine } from '../shared/engines.mjs';
import * as agentPlanner from '../shared/agentic-planner.mjs';
import * as connectorEngine from '../shared/connector-engine.mjs';
import * as workQueueEngine from '../shared/work-queue-engine.mjs';
import * as programCatalog from '../shared/program-catalog.mjs';
import * as recertificationEngine from '../shared/recertification-engine.mjs';
import * as demoConnectorData from '../shared/demo-connector-data.mjs';
import * as participantDirectoryModule from '../shared/participant-directory.mjs';
import { loadDirectoryUrl, loadDevTestAccount } from '../shared/directory-config.mjs';
import * as panelFormat from './panel-format.mjs';
import * as applicationPolicy from './application-policy.mjs';
import * as scanAnalysis from './scan-analysis.mjs';
import * as runControlModule from './run-control.mjs';
import * as documentParserModule from './document-parser.mjs';
import * as previewRuntimeModule from './preview-runtime.mjs';
import * as previewDirectory from './preview-directory.mjs';
import * as extensionMessagingModule from './extension-messaging.mjs';
import * as coordinatorSyncModule from './coordinator-sync.mjs';
import * as coordinatorMergeModule from './coordinator-merge.mjs';
import * as coordinatorWritesModule from './coordinator-writes.mjs';
import * as agentRuntimeModule from './agent-runtime.mjs';
import * as pageScanModule from './page-scan.mjs';
import * as applicationRunnerModule from './application-runner.mjs';
import * as captchaRunsModule from './captcha-runs.mjs';
import { captchaEngine } from '../shared/engines.mjs';
import * as captchaModelModule from './captcha-model.mjs';
import * as automaticRunsModule from './automatic-runs.mjs';
import * as recertificationCaseloadModule from './recertification-caseload.mjs';
import * as connectorViewsModule from './view-connector.mjs';
import * as intakeViewsModule from './view-intake.mjs';
import * as directoryViewsModule from './view-directory.mjs';
import * as welcomeViewsModule from './view-welcome.mjs';
import { SCENARIOS as SAMPLE_CLIENTS } from '../shared/mock-scenarios.mjs';
import * as recertificationViewsModule from './view-recertification.mjs';
import * as applicationViewsModule from './view-applications.mjs';
import * as reviewViewsModule from './view-review.mjs';
import * as agentActionsModule from './actions-agent.mjs';
import * as recertificationActionsModule from './actions-recertification.mjs';
import * as intakeActionsModule from './actions-intake.mjs';
import * as connectorActionsModule from './actions-connector.mjs';
import * as applicationActionsModule from './actions-applications.mjs';
import * as uiDispatchModule from './ui-dispatch.mjs';

const appRoot = document.getElementById('app');
const {
  escapeHtml,
  decoded,
  mergeVerifiedProvenance,
  provenanceForScan,
  hostLabel,
  mergeAgenticMetadata,
} = panelFormat;
const {
  urlOrigin,
  urlPath,
  commandLocation,
  assertSameDocumentLocation,
  checkpoint,
  checkpointFromScan,
  automatedPageLimit,
} = applicationPolicy;
const { attachApplicationPolicy, assertApprovedApplicationLocation } = applicationPolicy.create({
  programs: programCatalog.PROGRAMS,
  hostLabel,
});
const previewMode = new URLSearchParams(location.search).get('preview') === '1'
  || !globalThis.chrome?.runtime?.id;
const demoMode = new URLSearchParams(location.search).get('demo') === '1';
const previewBanner = document.getElementById('preview-banner');
if (previewBanner) previewBanner.hidden = !previewMode;

const state = {
  view: 'choice',
  error: '',
  participant: null,
  documentResult: null,
  activeTab: null,
  apps: [],
  currentAppId: null,
  previewPage: 1,
  connector: null,
  connectorDraft: null,
  connectorSchema: [],
  pendingConnectorRecord: null,
  audit: [],
  handoffApplicationId: null,
  sessionEpoch: 0,
  participantSessionId: '',
  coordinatorRevision: 0,
  workerId: globalThis.crypto?.randomUUID?.() || `panel-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  agentRuntime: { status: previewMode ? 'preview' : 'checking', message: '' },
  plannerBase: '',
  plannerAllowLoopbackHttp: false,
  agentProvider: { kind: 'chrome-local' },
  recertifications: [],
  recertificationWorkspace: {},
  currentRecertificationId: '',
  recertificationSource: '',
  devTestAccount: null, // from the gitignored shared/directory-config.local.mjs, loaded at start-up
  directory: { configured: false, baseUrl: '', signedIn: false, email: '', query: '', results: null },
};

const captchaAuthorizations = new Set(); // This window/run only, never a persisted blanket grant.

const MAX_SAME_PAGE_FILL_PASSES = 3;
const NAVIGATION_TIMEOUT_MS = 60_000;
const COORDINATOR_STORAGE_KEY = 'nava:assistant-coordinator';

// The preview serves only the shared demo connector's primary fictional record, cloned so the panel never mutates the shared copy.
const DEMO_RECORDS = Object.fromEntries(demoConnectorData.CLIENT_RECORDS
  .filter((record) => record.record_id === String(demoConnectorData.RECORD_ID))
  .map((record) => [record.record_id, structuredClone(record)]));

const PREVIEW_CONNECTOR_SCHEMA = demoConnectorData.SCHEMA;
const PREVIEW_RAW_RECORD = {
  data: [{
    id: demoConnectorData.RECORD_ID,
    attributes: demoConnectorData.recordAttributes(new Date().toISOString()),
  }],
};

// The participant directory: the only intake path that needs a sign-in. The preview simulates it in memory.
const directory = participantDirectoryModule.create(previewMode
  ? { storage: previewDirectory.memoryStorage(), fetchImpl: previewDirectory.previewDirectoryFetch(demoConnectorData.CLIENT_RECORDS), defaultBaseUrl: 'https://directory.preview.invalid' }
  : { storage: { local: chrome.storage.local, session: chrome.storage.session }, defaultBaseUrl: await loadDirectoryUrl() });

// The welcome page shows once per browser session. Previews remember it only for the life of the page.
const WELCOME_KEY = 'nava:welcome-seen';
let previewWelcomeSeen = false;
const welcome = {
  async seen() {
    if (previewMode) return previewWelcomeSeen;
    return Boolean((await chrome.storage.session.get(WELCOME_KEY))[WELCOME_KEY]);
  },
  async markSeen() {
    if (previewMode) previewWelcomeSeen = true;
    else await chrome.storage.session.set({ [WELCOME_KEY]: true });
  },
};

// Deps that most panel modules share.
const panelBase = {
  state,
  previewMode,
  sendRuntime,
  setBusy,
  render,
};

// Run control owns the run tokens and the session and UI generations. The coordinator revoke and the automatic run
// queue are created after it, so it reaches them through lazy wrappers.
const runControl = runControlModule.create({
  state,
  previewMode,
  checkpoint,
  captchaAuthorizations,
  revokeApplicationRun: (application) => revokeApplicationRun(application),
  onCancelAll: () => automaticRuns.clear(),
});
const {
  currentUiGeneration,
  currentUiSignal,
  runActive,
  runCancelledError,
  coordinatorStaleError,
  assertUiGeneration,
  assertApplicationRun,
  cancelApplicationRun,
} = runControl;
const parseDocument = (file, options) => documentParserModule.parseDocument(file, options);

// Simulated responses for the extension-free preview; it reads the fictional records declared above.
const {
  previewRuntime,
  previewTabMessage,
  loadPreviewQueueFixture,
  loadPreviewDocumentFixture,
} = previewRuntimeModule.create({
  state,
  previewMode,
  demoMode,
  search: location.search,
  engine,
  connectorEngine,
  programCatalog,
  workQueueEngine,
  DEMO_RECORDS,
  PREVIEW_CONNECTOR_SCHEMA,
  PREVIEW_RAW_RECORD,
  managedConnector,
  checkpoint,
  assertUiGeneration,
  parseDocument,
});

const { requestAssistantState, probeTabDocument, ensurePageAgent, sendToTab } = extensionMessagingModule.create({
  previewMode,
  state,
  sendRuntime,
  previewTabMessage,
  onStaleCommand(application) {
    cancelApplicationRun(application);
    scheduleCoordinatorSync(application.id);
  },
  coordinatorStaleError,
  assertApprovedApplicationLocation,
  assertSameDocumentLocation,
  urlOrigin,
  urlPath,
  urlSearch: applicationPolicy.urlSearch,
  urlHash: applicationPolicy.urlHash,
});

// The coordinator: the merge rules, the sync that keeps this window in step with it, and the writes that change it.
const coordinatorSync = coordinatorSyncModule.create({
  ...panelBase,
  ...runControl,
  ...coordinatorMergeModule.create({ workQueueEngine }),
  workQueueEngine,
  attachApplicationPolicy,
  requestAssistantState,
  canonicalHomeView,
});
const { restore, observeCoordinator, scheduleCoordinatorSync } = coordinatorSync;
const coordinatorWrites = coordinatorWritesModule.create({
  ...panelBase,
  ...runControl,
  ...coordinatorSync,
  workQueueEngine,
  recordAudit,
});
const { revokeApplicationRun, persist, renewApplicationLease } = coordinatorWrites;

// The planner runtime: the model provider or the shared gateway, start-up progress, and gateway client links.
const agentRuntime = agentRuntimeModule.create({
  ...panelBase,
  agentPlanner,
  setApplicationProgress,
  assertUiGeneration,
  activeRunCount: runControl.activeRunCount,
  currentUiSignal,
  persist,
});
const {
  agentProgressMessage,
  prepareAgentRuntime,
  restorePlannerBase,
  restoreAgentProvider,
  checkAgentAvailability,
} = agentRuntime;

// The write path: the page scan, then the multi-page runner over it, each with explicit dependencies.
const { scanTab } = pageScanModule.create({
  state,
  previewMode,
  engine,
  agentPlanner,
  scanAnalysis,
  scanRecord: scanAnalysis.create({
    signatureHash: workQueueEngine.signatureHash,
    hostLabel,
    provenanceForScan,
    urlOrigin,
    urlPath,
    commandLocation,
  }),
  sendToTab,
  assertApprovedApplicationLocation,
  attachApplicationPolicy,
  urlPath,
  commandLocation,
  checkpointFromScan,
  assertApplicationRun,
  cancelApplicationRun,
  assertUiGeneration,
  currentUiSignal,
  setCheckpoint,
  recordAudit,
  persist,
  newWorkflowId,
  setBusy,
  setApplicationProgress,
  agentProgressMessage,
  prepareAgentRuntime,
  mergeVerifiedProvenance,
  mergeAgenticMetadata,
});
const {
  runThroughApplication,
  fillApplication,
  goToApplication,
  resumeApplication,
  resumeHumanCheckpoint,
} = applicationRunnerModule.create({
  state,
  previewMode,
  workQueueEngine,
  scanAnalysis,
  MAX_SAME_PAGE_FILL_PASSES,
  NAVIGATION_TIMEOUT_MS,
  sendToTab,
  scanTab,
  getActiveTab,
  assertApprovedApplicationLocation,
  assertSameDocumentLocation,
  urlOrigin,
  urlPath,
  commandLocation,
  automatedPageLimit,
  stopCheckpoint: applicationPolicy.stopCheckpoint,
  pendingHumanCheck: applicationPolicy.pendingHumanCheck,
  assertApplicationRun,
  runCancelledError,
  renewApplicationLease,
  setCheckpoint,
  recordAudit,
  persist,
  setBusy,
  setApplicationProgress,
  mergeVerifiedProvenance,
  captchaAuthorizations,
  tryCaptcha: (application, options) => captchaRuns.tryCaptcha(application, options),
});
const captchaRuns = captchaRunsModule.create({
  ...panelBase,
  ...runControl,
  captchaEngine: captchaEngine,
  captchaModel: captchaModelModule,
  goToApplication,
  assertApprovedApplicationLocation,
  assertSameDocumentLocation,
  probeTabDocument,
  setApplicationProgress,
  recordAudit,
  persist,
  resumeHumanCheckpoint,
  setCheckpoint,
});

// Automatic runs take opened program tabs through the runner; the recertification caseload prepares cases into them.
const automaticRuns = automaticRunsModule.create({
  ...panelBase,
  ...runControl,
  ...coordinatorSync,
  ...coordinatorWrites,
  newWorkflowId,
  recordAudit,
  probeTabDocument,
  ensurePageAgent,
  assertApprovedApplicationLocation,
  assertSameDocumentLocation,
  scanTab,
  runThroughApplication,
  setApplicationProgress,
  setCheckpoint,
  renderDashboardIfVisible,
});
const { openSelectedPrograms, enqueueApplicationBatch } = automaticRuns;
const recertificationCaseload = recertificationCaseloadModule.create({
  ...panelBase,
  ...runControl,
  ...coordinatorWrites,
  recertificationEngine,
  prepareAgentRuntime,
  openSelectedPrograms,
  enqueueApplicationBatch,
});

// Screen templates get explicit dependencies; the connector and intake screens reach each other lazily.
const viewBase = { state, appRoot, format: panelFormat, renderError };
const connectorViews = connectorViewsModule.create({
  ...viewBase,
  previewMode,
  connectorEngine,
  managedConnector,
  renderRecordId: () => intakeViews.renderRecordId(),
});
const directoryViews = directoryViewsModule.create({ state, format: panelFormat });
const welcomeViews = welcomeViewsModule.create({ appRoot });
const intakeViews = intakeViewsModule.create({
  ...viewBase,
  previewMode,
  engine,
  agentPlanner,
  programCatalog,
  clientSummary,
  managedConnector,
  directorySection: directoryViews.directorySection,
  sampleClients: SAMPLE_CLIENTS,
  connectorTitle: connectorViews.connectorTitle,
  connectorProvider: connectorViews.connectorProvider,
  connectorSourceId: connectorViews.connectorSourceId,
});
const recertificationViews = recertificationViewsModule.create({
  ...viewBase,
  recertificationEngine,
  recertificationById: recertificationCaseload.recertificationById,
});
const applicationViews = applicationViewsModule.create({
  ...viewBase,
  isRunning: runActive,
  captchaAuthorizations,
  renderAgentRuntime: intakeViews.renderAgentRuntime,
  firstName,
});
const reviewViews = reviewViewsModule.create({ ...viewBase, renderDashboard: applicationViews.renderDashboard });
const { renderProviderCatalog, renderConnectorSetup, renderConnectorMapping, renderConnectorRecordReview } = connectorViews;
const { renderChoice, renderRecordId, renderClientDetails, renderDocumentUpload, renderDocumentReview, renderPrograms } = intakeViews;
const { renderWelcome } = welcomeViews;
const { renderRecertifications, renderRecertificationDetail } = recertificationViews;
const { renderDashboard, renderHandoff } = applicationViews;
const { renderQuestions, renderReview } = reviewViews;

function clientSummary() {
  return engine.canonicalizeParticipant(state.participant || {});
}

function firstName() {
  return clientSummary().values.firstName || clientSummary().name || 'Client';
}

function managedConnector() {
  return state.connector?.mode === 'managed';
}

async function getActiveTab() {
  if (previewMode) {
    return { id: 7001, title: 'Benefits application', url: `https://benefitscal.com/ApplyForBenefits/step-${state.previewPage}` };
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function sendRuntime(message) {
  if (previewMode) return previewRuntime(message);
  return chrome.runtime.sendMessage(message);
}

function newWorkflowId() {
  return `workflow:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function recordAudit(type, application, details = {}) {
  const event = workQueueEngine.auditEvent(type, application, details);
  state.audit = workQueueEngine.appendAudit(state.audit, event);
}

function setBusy(message = 'Checking this form…') {
  appRoot.innerHTML = `
    <div class="loading">
      <div>
        <div class="spinner" aria-hidden="true"></div>
        <strong>${escapeHtml(message)}</strong>
      </div>
    </div>`;
}

function setApplicationProgress(application, message) {
  application.runProgress = message;
  application.updatedAt = new Date().toISOString();
  renderDashboardIfVisible();
}

function renderError() {
  return state.error
    ? `<div class="notice error" role="alert"><span aria-hidden="true">!</span><span>${escapeHtml(state.error)}</span></div>`
    : '';
}

function canonicalHomeView() {
  if (state.apps.length) return 'dashboard';
  if (state.participant) return 'programs';
  return 'choice';
}

function render() {
  const renderView = {
    connector: renderConnectorSetup,
    providers: renderProviderCatalog,
    'connector-mapping': renderConnectorMapping,
    'record-review': renderConnectorRecordReview,
    record: renderRecordId,
    details: renderClientDetails,
    welcome: renderWelcome,
    document: renderDocumentUpload,
    'document-review': renderDocumentReview,
    programs: renderPrograms,
    dashboard: renderDashboard,
    recertifications: renderRecertifications,
    'recertification-detail': renderRecertificationDetail,
    handoff: renderHandoff,
    questions: renderQuestions,
    review: renderReview,
  }[state.view] || renderChoice;
  renderView();
  const resetScroll = () => {
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
    appRoot.scrollTop = 0;
  };
  resetScroll();
  requestAnimationFrame(() => requestAnimationFrame(resetScroll));
  setTimeout(resetScroll, 100);
}

function renderDashboardIfVisible() {
  if (state.view === 'dashboard') render();
}

function setCheckpoint(application, kind, label, status = 'paused') {
  application.checkpoint = checkpoint(kind, label);
  application.status = status;
  application.autoRun = false;
  application.runProgress = '';
  application.updatedAt = new Date().toISOString();
  recordAudit('checkpoint_reached', application, { checkpointKind: kind, toStatus: status });
}

// Action tables: each domain's handlers, written against one handler contract, then the dispatcher over them.
const { SKIP_FINAL_RENDER, showScreen } = uiDispatchModule.handlerContract(state);
const actionBase = {
  ...panelBase,
  ...runControl,
  ...coordinatorWrites,
  SKIP_FINAL_RENDER,
  showScreen,
  getActiveTab,
  decoded,
};
const agentActions = agentActionsModule.create({
  ...actionBase,
  ...agentRuntime,
  agentPlanner,
  captchaAuthorizations,
  enqueueApplicationBatch,
});
const recertificationActions = recertificationActionsModule.create({
  ...actionBase,
  ...recertificationCaseload,
  recertificationEngine,
});
const intakeActions = intakeActionsModule.create({
  ...actionBase,
  directory,
  sampleClients: SAMPLE_CLIENTS,
  welcome,
  DEMO_RECORDS,
  parseDocument,
  clientSummary,
  canonicalHomeView,
  recordAudit,
  prepareAgentRuntime,
  scanTab,
  openSelectedPrograms,
  enqueueApplicationBatch,
});
const connectorActions = connectorActionsModule.create({
  ...actionBase,
  ...coordinatorSync,
  connectorEngine,
  managedConnector,
  canonicalHomeView,
  setCheckpoint,
});
const applicationActions = applicationActionsModule.create({
  ...actionBase,
  checkpoint,
  recordAudit,
  setCheckpoint,
  scanTab,
  runThroughApplication,
  fillApplication,
  goToApplication,
  resumeApplication,
  resumeHumanCheckpoint,
  tryCaptcha: captchaRuns.tryCaptcha,
});
const { restoreConnector } = connectorActions;
const { installListeners } = uiDispatchModule.create({
  state,
  appRoot,
  render,
  assertUiGeneration,
  currentUiGeneration,
  agentActions,
  recertificationActions,
  intakeActions,
  connectorActions,
  applicationActions,
});

installListeners();

async function refreshActiveTab() {
  if (previewMode) return;
  try {
    state.activeTab = await getActiveTab();
    if (state.view === 'programs') render();
  } catch {
    // Tabs can disappear between Chrome's event and the lookup.
  }
}

if (!previewMode) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[COORDINATOR_STORAGE_KEY]?.newValue) return;
    observeCoordinator(changes[COORDINATOR_STORAGE_KEY].newValue);
  });
  chrome.tabs.onActivated.addListener(() => {
    void refreshActiveTab();
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!tab.active || (!changeInfo.url && changeInfo.status !== 'complete')) return;
    void refreshActiveTab();
  });
}

async function bootstrap() {
  const uiToken = currentUiGeneration();
  setBusy('Opening the assistant…');
  try {
    await restoreConnector();
    await restore();
    state.directory = { ...state.directory, ...(await directory.status()) };
    state.devTestAccount = await loadDevTestAccount();
    await restorePlannerBase();
    await restoreAgentProvider();
    state.activeTab = await getActiveTab();
    assertUiGeneration(uiToken);
    loadPreviewQueueFixture();
    await loadPreviewDocumentFixture(uiToken);
    assertUiGeneration(uiToken);
    await checkAgentAvailability();
    if (state.view === 'choice' && !state.participant && !state.apps.length && !(await welcome.seen())) state.view = 'welcome';
    render();
  } catch (error) {
    if (error?.name === 'UiCancelledError' || uiToken !== currentUiGeneration()) return;
    state.error = error.message;
    state.view = 'choice';
    render();
  }
}

bootstrap();
