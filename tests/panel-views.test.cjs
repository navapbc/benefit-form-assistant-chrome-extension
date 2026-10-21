const test = require('node:test');
const assert = require('node:assert/strict');

const format = require('../sidepanel/panel-format.mjs');
const intakeViews = require('../sidepanel/view-intake.mjs');
const connectorViews = require('../sidepanel/view-connector.mjs');
const recertificationViews = require('../sidepanel/view-recertification.mjs');
const applicationViews = require('../sidepanel/view-applications.mjs');
const reviewViews = require('../sidepanel/view-review.mjs');
const directoryViews = require('../sidepanel/view-directory.mjs');
const engine = require('../shared/form-engine.js');
const connectorEngine = require('../shared/connector-engine.mjs');
const recertificationEngine = require('../shared/recertification-engine.mjs');
const programCatalog = require('../shared/program-catalog.mjs');

/** Composes every screen module the way sidepanel.js does, over a fake screen root. */
function screens({ state: stateOverrides = {}, previewMode = false, running = [], agentPlanner = null, sampleClients = [] } = {}) {
  const state = {
    view: 'dashboard',
    error: '',
    participant: null,
    apps: [],
    currentAppId: null,
    handoffApplicationId: null,
    connector: null,
    connectorDraft: null,
    connectorSchema: [],
    pendingConnectorRecord: null,
    documentResult: null,
    activeTab: null,
    directory: { configured: true, baseUrl: 'https://directory.example', signedIn: false, email: '', query: '', results: null },
    agentRuntime: { status: 'checking', message: '' },
    agentProvider: { kind: 'chrome-local' },
    plannerBase: '',
    recertifications: [],
    currentRecertificationId: '',
    recertificationSource: '',
    ...stateOverrides,
  };
  const appRoot = { innerHTML: '' };
  const renderError = () => (state.error ? `<div class="notice error">${format.escapeHtml(state.error)}</div>` : '');
  const clientSummary = () => engine.canonicalizeParticipant(state.participant || {});
  const managedConnector = () => state.connector?.mode === 'managed';
  const base = { state, appRoot, format, renderError };
  let intake = null;
  const connector = connectorViews.create({ ...base, previewMode, connectorEngine, managedConnector, renderRecordId: () => intake.renderRecordId() });
  intake = intakeViews.create({
    ...base,
    previewMode,
    engine,
    agentPlanner,
    programCatalog,
    clientSummary,
    managedConnector,
    directorySection: directoryViews.create({ state, format }).directorySection,
    sampleClients,
    connectorTitle: connector.connectorTitle,
    connectorProvider: connector.connectorProvider,
    connectorSourceId: connector.connectorSourceId,
  });
  const applications = applicationViews.create({
    ...base,
    isRunning: (id) => running.includes(id),
    renderAgentRuntime: intake.renderAgentRuntime,
    firstName: () => clientSummary().values.firstName || 'Client',
  });
  const recertifications = recertificationViews.create({
    ...base,
    recertificationEngine,
    recertificationById: (id = state.currentRecertificationId) => state.recertifications.find((item) => item.id === id) || null,
  });
  const review = reviewViews.create({ ...base, renderDashboard: applications.renderDashboard });
  return { state, appRoot, ...connector, ...intake, ...applications, ...recertifications, ...review };
}

const actionsOf = (html) => [...html.matchAll(/data-action="([^"]+)"/g)].map((match) => match[1]);

test('CAPTCHA and one-time-code checkpoints offer a human-complete-and-resume action', () => {
  const view = screens({ state: { developerMode: true } });
  const captcha = view.applicationCard({ id: 'workflow:a b', name: 'App', url: 'https://site.example/', status: 'needs_attention', tabId: 4, checkpoint: { kind: 'captcha', label: 'Human bot check required' } });
  assert.match(captcha, /data-action="resume-human-checkpoint" data-app="workflow%3Aa%20b">I completed the CAPTCHA — resume</);
  assert.match(captcha, /Checkpoint:<\/strong> Human bot check required/);

  const otp = view.applicationCard({ id: 'b', status: 'needs_attention', tabId: 4, checkpoint: { kind: 'otp', label: 'Code' } });
  assert.match(otp, /I completed the one-time code — resume/);

  const detached = view.applicationCard({ id: 'c', status: 'needs_attention', checkpoint: { kind: 'captcha', label: 'Code' } });
  assert.doesNotMatch(detached, /resume-human-checkpoint/);

  const runningView = screens({ running: ['d'], state: { developerMode: true } });
  const busy = runningView.applicationCard({ id: 'd', status: 'needs_attention', tabId: 4, runProgress: 'Filling page 2…', checkpoint: { kind: 'captcha', label: 'x' } });
  assert.deepEqual(actionsOf(busy), ['open-handoff', 'go-tab']);
  assert.match(busy, /Running automatically\.<\/strong> Filling page 2…/);
});

test('expired sources reload client data and pending handoffs must be accepted', () => {
  const view = screens({ state: { developerMode: true } });
  const expired = view.applicationCard({ id: 'e', status: 'source_expired', tabId: 4 });
  assert.deepEqual(actionsOf(expired), ['reload-source', 'go-tab']);
  assert.match(expired, /Reload source data\./);

  const handoff = view.applicationCard({ id: 'h&1', status: 'handoff_pending', owner: { state: 'pending', assignedTo: '<Intake>' } });
  assert.deepEqual(actionsOf(handoff), ['accept-handoff']);
  assert.match(handoff, /data-app="h%261"/);
  assert.match(handoff, /Assigned to &lt;Intake&gt;/);

  const gaps = view.applicationCard({ id: 'g', status: 'needs_attention', analysis: { gaps: [{}, {}] } });
  assert.deepEqual(actionsOf(gaps), ['answer-run', 'answer', 'open-handoff']);
  assert.match(gaps, /2 answers are needed before this page is complete/);

  const fill = view.applicationCard({ id: 'f', status: 'ready_to_fill', tabId: 2, agentic: { approvedMappings: 1, provider: 'claude' } });
  assert.deepEqual(actionsOf(fill), ['run', 'fill', 'open-handoff', 'go-tab']);
  assert.match(fill, /Claude · mapper, gap analyst, and independent reviewer/);
});

test('the dashboard groups applications and the handoff form falls back when the application is gone', () => {
  const view = screens({ state: { participant: { firstName: 'Ana' }, apps: [{ id: 'r', name: 'Review me', status: 'ready_for_review' }] } });
  view.renderDashboard();
  assert.match(view.appRoot.innerHTML, /Ana's applications/);
  assert.match(view.appRoot.innerHTML, /READY FOR REVIEW/);
  assert.doesNotMatch(view.appRoot.innerHTML, /NEEDS YOUR ATTENTION/);

  view.state.handoffApplicationId = 'missing';
  view.renderHandoff();
  assert.equal(view.state.view, 'dashboard');
  view.state.handoffApplicationId = 'r';
  view.renderHandoff();
  assert.match(view.appRoot.innerHTML, /id="handoff-form"/);
  assert.match(view.appRoot.innerHTML, /Do not put client names, identifiers, or answers in the assignee field/);
});

test('the review screen escapes every filled value and always restates that the caseworker submits', () => {
  const application = {
    id: 'workflow:r',
    name: '<b>Benefits</b>',
    status: 'ready_for_review',
    provenance: [{ fieldKey: 'f', label: '<img src=x onerror=alert(1)>', value: '"><script>', source: 'record', detail: 'From <source>' }],
    empty: [{ label: 'Middle name' }],
    analysis: { noFields: [{ purpose: 'phone', label: 'Phone & text' }] },
  };
  const view = screens({ state: { apps: [application], currentAppId: 'workflow:r' } });
  view.renderReview();
  const html = view.appRoot.innerHTML;
  assert.doesNotMatch(html, /<script>|<img|<b>Benefits/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&quot;&gt;&lt;script&gt;/);
  assert.match(html, /title="From &lt;source&gt;"/);
  assert.match(html, /<td>\(empty\)<\/td>|>\(empty\)</);
  assert.match(html, /No matching field in this flow: Phone &amp; text\./);
  assert.match(html, /The assistant will not submit this application\. Review the page, complete any affirmation or bot check, and submit it yourself\./);
  assert.doesNotMatch(html, /data-action="submit/);

  application.runStopReason = 'Signature required <now>';
  view.renderReview();
  assert.match(view.appRoot.innerHTML, /Signature required &lt;now&gt;/);

  view.state.currentAppId = 'gone';
  view.renderReview();
  assert.equal(view.state.view, 'dashboard');
});

test('questions render choice, multi-choice with an explicit none option, and sensitive text inputs', () => {
  const gaps = [
    { fieldKey: 'm', question: 'Which apply?', inputType: 'multi_choice', options: [{ value: 'a', label: 'A' }, { optionLabel: 'B', value: 'b' }] },
    { fieldKey: 'c', question: 'Pick one', inputType: 'choice', kind: 'decision', options: [] },
    { fieldKey: 's', question: 'SSN?', inputType: 'text', sensitive: true, required: true },
  ];
  const view = screens({ state: { apps: [{ id: 'q', name: 'App', autoRun: true, analysis: { gaps } }], currentAppId: 'q' } });
  view.renderQuestions();
  const html = view.appRoot.innerHTML;
  assert.match(html, /type="checkbox" name="answer-0" value="__none__"/);
  assert.match(html, /type="radio" name="answer-1" value="yes"/);
  assert.match(html, /type="radio" name="answer-1" value="no"/);
  assert.match(html, /name="answer-2" autocomplete="off" inputmode="numeric"/);
  assert.match(html, /The form marks this as required/);
  assert.match(html, /Fill and continue automatically/);
  assert.deepEqual(view.choiceOptions({ options: [{ value: '' }, { label: 'Only label' }] }), [{ value: 'Only label', label: 'Only label' }]);
});

test('connector screens mark only the demo-tested adapter as available and review imported records', () => {
  const view = screens();
  view.renderProviderCatalog();
  const catalog = view.appRoot.innerHTML;
  assert.equal((catalog.match(/Fictional demo available/g) || []).length, 1);
  assert.equal((catalog.match(/Provisioned Nava adapter required/g) || []).length, connectorEngine.PROVIDER_CATALOG.length - 1);

  view.state.view = 'record-review';
  view.renderConnectorRecordReview();
  assert.equal(view.state.view, 'record');
  assert.match(view.appRoot.innerHTML, /id="record-form"/);

  view.state.pendingConnectorRecord = {
    record_id: '42',
    firstName: 'Ana',
    ssn: '111-22-3333',
    _connector: { organizationName: 'Org', freshness: 'unknown', provenance: { firstName: { sourceLabel: 'Given', sourceFieldId: '7' } } },
  };
  view.renderConnectorRecordReview();
  assert.match(view.appRoot.innerHTML, /Confirm this client/);
  assert.match(view.appRoot.innerHTML, /••••3333/);
  assert.doesNotMatch(view.appRoot.innerHTML, /111-22-3333/);
  assert.match(view.appRoot.innerHTML, /Source update time unavailable/);
});

test('document review never preselects low-confidence, OCR-review, or conflicting values', () => {
  const field = (key, value, extra = {}) => ({ key, value, label: key, displayValue: value, confidence: 'high', evidence: 'Label: value', ...extra });
  const view = screens({
    state: {
      participant: { firstName: 'Ana' },
      documentResult: {
        file: { name: 'scan.png' },
        quality: { method: 'ocr' },
        warnings: [],
        fields: [
          field('lastName', 'Diaz'),
          field('firstName', 'Anna'),
          field('email', 'a@b.example', { confidence: 'low' }),
          field('phone', '5550100', { reviewRequired: true, source: { method: 'ocr', pageNumber: 2, region: { x0: 1.2, y0: 2.6, x1: 30, y1: 40 } } }),
        ],
      },
    },
  });
  view.renderDocumentReview();
  const html = view.appRoot.innerHTML;
  const checked = [...html.matchAll(/name="fieldIndex" value="(\d)" (checked)?/g)].map((match) => Boolean(match[2]));
  assert.deepEqual(checked, [true, false, false, false]);
  assert.match(html, /Different from current:<\/strong> Ana\./);
  assert.match(html, /Page 2 · region 1,3–30,40/);
  assert.match(html, /On-device OCR · 4 proposed fields · 1 conflict · 1 low confidence/);
});

test('recertification preparation stays locked until data is current and the client authorizes it', () => {
  const [item] = recertificationEngine.normalizeCaseload([{
    id: 'r1', recordId: '1', displayName: 'Client One', programId: 'calfresh', programName: 'CalFresh', dueDate: '2099-01-01',
    requirements: { contact: { status: 'current' }, household: { status: 'missing' } },
  }]);
  const view = screens({ state: { recertifications: [item], currentRecertificationId: 'r1' } });
  view.renderRecertificationDetail();
  assert.match(view.appRoot.innerHTML, /The AI run stays locked until all information areas are current or confirmed/);
  assert.doesNotMatch(view.appRoot.innerHTML, /data-action="prepare-recertification"/);
  assert.match(view.recertificationCard(item), /data-action="review-recertification" data-recert="r1"/);

  view.state.currentRecertificationId = 'missing';
  view.renderRecertificationDetail();
  assert.equal(view.state.view, 'recertifications');
  assert.match(view.appRoot.innerHTML, /Client messages remain drafts until an authorized worker sends them/);
});

test('the model-runtime notice explains preview, unavailable, and companion states', () => {
  assert.match(screens({ previewMode: true }).renderAgentRuntime(), /Fixture preview · model calls are simulated/);

  const unavailable = screens({ state: { developerMode: true, agentRuntime: { status: 'unavailable', message: '' } } }).renderAgentRuntime();
  assert.match(unavailable, /class="notice error"/);
  assert.match(unavailable, /Chrome on-device AI unavailable\./);
  assert.match(unavailable, /data-action="enable-agent"/);
  assert.match(unavailable, /id="model-companion-fields" class="form-stack compact-form" hidden/);

  const companion = screens({
    state: { developerMode: true, agentRuntime: { status: 'ready', shared: false }, agentProvider: { kind: 'local-cli', provider: 'codex', endpoint: 'http://127.0.0.1:9', token: 't"k' } },
    agentPlanner: { runtimeInfo: () => ({ title: 'Codex CLI', detail: 'Paired.' }) },
  }).renderAgentRuntime();
  assert.match(companion, /Codex CLI ready[\s\S]*Paired\. The field mapper/);
  assert.doesNotMatch(companion, /enable-agent/);
  assert.match(companion, /<option value="codex" selected>/);
  assert.match(companion, /value="t&quot;k"/);
});

test('intake screens offer every client source and analyze only regular web pages', () => {
  const view = screens({ state: { developerMode: true, activeTab: { url: 'chrome://extensions' }, participant: { firstName: 'Ana' } } });
  view.renderChoice();
  const start = view.appRoot.innerHTML;
  assert.deepEqual(actionsOf(start).filter((action) => action.startsWith('choose-')), ['choose-details', 'choose-document']);
  assert.match(start, /Find your client/);
  assert.match(start, /id="directory-signin-form"/, 'searching for a client is the first thing offered');
  assert.doesNotMatch(start, /JSON|Find by record ID|Recertification status|Shared planner API|Data and review safeguards|Agentic AI|configure-connector/);
  assert.match(start, /Renewals due/);
  assert.match(start, /data-action="show-welcome"/);

  view.renderPrograms();
  assert.match(view.appRoot.innerHTML, /value="current" disabled/);
  assert.equal((view.appRoot.innerHTML.match(/name="program" value="/g) || []).length, programCatalog.PROGRAMS.length + 1);

  view.state.activeTab = { url: 'https://www.forms.example/apply' };
  view.renderPrograms();
  assert.match(view.appRoot.innerHTML, /value="current" >/);
  assert.match(view.appRoot.innerHTML, /forms\.example/);
});

test('the start screen shows the Developer mode switch in both states', () => {
  for (const developerMode of [false, true]) {
    const view = screens({ state: { developerMode } });
    view.renderChoice();
    const start = view.appRoot.innerHTML;
    assert.match(start, /<details class="settings-disclosure"><summary>Developer mode<\/summary>/);
    assert.match(start, /data-action="toggle-developer-mode"/);
    assert.match(start, /Turns on experimental features that are still being tested\./);
    assert.match(start, developerMode ? /Developer mode is on/ : /Developer mode is off/);
    assert.match(start, developerMode ? /Turn off/ : /Turn on/);
    assert.match(start, /aria-pressed="/);
  }
});

test('application cards escape every text and attribute value that can come from a page, record, or handoff', () => {
  const hostile = '"><img src=x onerror=alert(1)>';
  const view = screens({ state: { agentProvider: { kind: 'chrome-local' } } });
  const card = view.applicationCard({
    id: hostile,
    name: hostile,
    url: `https://site.example/${hostile}`,
    status: 'needs_attention',
    tabId: 4,
    error: hostile,
    runProgress: hostile,
    owner: { assignedTo: hostile, state: hostile },
    checkpoint: { kind: 'captcha', label: hostile },
    agentic: { provider: hostile, approvedMappings: hostile },
  });
  assert.doesNotMatch(card, /<img/i);
  assert.doesNotMatch(card, /"><img/);
  assert.match(card, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('the directory card signs in, then searches; it escapes names and encodes IDs', () => {
  const directoryViews = require('../sidepanel/view-directory.mjs');
  const state = { directory: { configured: true, signedIn: false, email: '', query: '', results: null }, devTestAccount: { email: 'dev@example.com', password: 'pw<1>' } };
  const card = () => directoryViews.create({ state, format }).directorySection();

  let html = card();
  assert.match(html, /Sign in to search for a client/);
  assert.match(html, /id="directory-signin-form"/);
  assert.doesNotMatch(html, /directoryBase|Directory address/, 'the address comes from the code, not the user');
  assert.match(html, /type="password"/);
  assert.match(html, /Development test account[\s\S]*dev@example\.com[\s\S]*pw&lt;1&gt;/);
  assert.match(html, /data-action="directory-use-test-account"/);
  state.devTestAccount = null;
  assert.doesNotMatch(card(), /Development test account|directory-use-test-account/, 'no local account file means no note');
  state.devTestAccount = { email: 'dev@example.com', password: 'pw<1>' };

  state.directory = { configured: false, signedIn: false, email: '', query: '', results: null };
  html = card();
  assert.match(html, /directory is not set up/);
  assert.doesNotMatch(html, /directory-signin-form|type="password"/, 'with no address there is nothing to sign in to');

  state.directory = { configured: true, signedIn: true, email: 'ada@example.com', query: '', results: null };
  html = card();
  assert.match(html, /Search for a client/);
  assert.match(html, /Signed in as ada@example\.com/);
  assert.match(html, /id="directory-find-form"/);
  assert.doesNotMatch(html, /id="directory-mode"|No clients matched/);

  state.directory.results = [];
  state.directory.query = 'zed';
  assert.match(card(), /No clients matched “zed”/);

  const hostile = '"><img src=x onerror=alert(1)>';
  state.directory.results = [{ recordId: 'a/b c', firstName: hostile, lastName: 'Lovelace' }];
  state.directory.query = hostile;
  html = card();
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /data-id="a%2Fb%20c"/);
  assert.match(html, /1 client found/);
});

test('the welcome page explains the steps and the safeguards, and offers one way forward', () => {
  const welcomeViews = require('../sidepanel/view-welcome.mjs');
  const appRoot = { innerHTML: '' };
  welcomeViews.create({ appRoot }).renderWelcome();
  assert.match(appRoot.innerHTML, /How it works/);
  assert.match(appRoot.innerHTML, /What keeps you in control/);
  assert.match(appRoot.innerHTML, /You always submit/);
  assert.match(appRoot.innerHTML, /No guessing/);
  assert.deepEqual(actionsOf(appRoot.innerHTML), ['dismiss-welcome']);
});

test('the details screen offers sample clients first, a typed form, and a hidden advanced paste', () => {
  const view = screens({ state: { view: 'details' }, sampleClients: [{ id: 'complete', label: 'Complete record', description: 'Everything is filled in.' }, { id: 'a/b', label: '<b>x</b>', description: 'd' }] });
  view.renderClientDetails();
  const html = view.appRoot.innerHTML;
  assert.match(html, /Enter client details/);
  assert.deepEqual(actionsOf(html).filter((action) => action === 'use-sample-client').length, 2);
  assert.match(html, /data-id="a%2Fb"/);
  assert.doesNotMatch(html, /<b>x<\/b>/);
  for (const name of ['firstName', 'lastName', 'dateOfBirth', 'phone', 'email', 'addressLine1', 'addressLine2', 'city', 'state', 'postalCode']) {
    assert.match(html, new RegExp(`name="${name}"`), name);
  }
  assert.match(html, /id="details-form"/);
  assert.match(html, /<details class="settings-disclosure">\s*<summary>Advanced: paste a full client record/);
  assert.match(html, /id="json-form"/);
});

// ---- Developer mode: experimental controls are rendered only when state.developerMode is on ----

const { loadEsm } = require('./helpers/esm.cjs');
const { EXPERIMENTAL_ACTIONS } = loadEsm('shared/developer-mode.mjs');

const CAPTCHA_APP = { id: 'cap', name: 'Captcha app', url: 'https://site.example/', status: 'needs_attention', tabId: 4, checkpoint: { kind: 'captcha', label: 'Human bot check required' } };
const RUNNING_APP = { id: 'run', name: 'Running app', url: 'https://site.example/', status: 'ready_to_fill', tabId: 5, runProgress: 'Filling page 2…' };
const GAP_APP = { id: 'gap', name: 'Gap app', status: 'needs_attention', tabId: 6, analysis: { gaps: [{ fieldKey: 'a', question: 'Q?', inputType: 'text' }] } };
const READY_APP = { id: 'rdy', name: 'Ready app', status: 'ready_to_fill', tabId: 7 };
const REVIEW_APP = { id: 'rev', name: 'Review app', status: 'ready_for_review', tabId: 8 };
const OTHER_APP = { id: 'oth', name: 'Other app', status: 'not_started', tabId: 9 };
const ALL_APPS = [CAPTCHA_APP, RUNNING_APP, GAP_APP, READY_APP, REVIEW_APP, OTHER_APP];

/** Every core screen a caseworker can reach, rendered over one set of fixtures. */
function coreScreens(developerMode) {
  const documentResult = { file: { name: 'scan.txt' }, quality: { method: 'text' }, warnings: [], fields: [{ key: 'firstName', value: 'Ana', label: 'First name', displayValue: 'Ana', confidence: 'high', evidence: 'x' }] };
  const state = { developerMode, participant: { firstName: 'Ana' }, apps: ALL_APPS, currentAppId: 'gap', documentResult, activeTab: { url: 'https://www.forms.example/apply' }, agentRuntime: { status: 'ready', shared: false }, agentProvider: { kind: 'local-cli', provider: 'codex', captcha: { provider: 'codex' } } };
  const sampleClients = [{ id: 'complete', label: 'Complete record', description: 'd' }];
  const view = screens({ state, running: ['run'], sampleClients });
  const welcomeViews = require('../sidepanel/view-welcome.mjs');
  const welcomeRoot = { innerHTML: '' };
  welcomeViews.create({ appRoot: welcomeRoot }).renderWelcome();
  const out = { welcome: welcomeRoot.innerHTML };
  for (const name of ['renderChoice', 'renderClientDetails', 'renderDocumentUpload', 'renderDocumentReview', 'renderPrograms', 'renderDashboard', 'renderQuestions', 'renderReview']) {
    view[name]();
    out[name] = view.appRoot.innerHTML;
  }
  out.dashboardNoRunning = (() => {
    const solo = screens({ state: { ...state, apps: [CAPTCHA_APP], currentAppId: 'cap' } });
    solo.renderDashboard();
    return solo.appRoot.innerHTML;
  })();
  return out;
}

/** Every dispatcher action, submit form id and change-handler id the markup refers to. */
const hooksOf = (html) => [...html.matchAll(/(?:data-action|id)="([^"]+)"/g)].map((match) => match[1]);

test('with developer mode off no core screen renders a control that belongs to an experimental feature', () => {
  for (const [name, html] of Object.entries(coreScreens(false))) {
    const leaked = hooksOf(html).filter((hook) => EXPERIMENTAL_ACTIONS.has(hook));
    assert.deepEqual(leaked, [], `${name} renders experimental controls`);
    assert.doesNotMatch(html, /· experimental|data-captcha-app|Pause or hand off|Renewals due/i, name);
  }
});

test('with developer mode on the experimental controls are still rendered', () => {
  const screensOn = coreScreens(true);
  const seen = new Set(Object.values(screensOn).flatMap(hooksOf));
  for (const action of ['try-captcha', 'open-handoff', 'open-recertifications', 'client-link']) assert.ok(seen.has(action), action);
  assert.match(screensOn.renderDashboard, /data-captcha-app="run"|data-captcha-app="gap"/);
  assert.match(screensOn.renderDashboard, /Pause or hand off/);
  assert.match(screensOn.renderChoice, /<h2 class="section-title">Renewals<\/h2>/);
});

test('core controls remain with developer mode off, and a run can still be stopped', () => {
  const html = coreScreens(false);
  const dashboard = html.renderDashboard;
  const seen = new Set(hooksOf(dashboard));
  for (const action of ['resume-human-checkpoint', 'fill', 'run', 'answer', 'review', 'add-application', 'export-audit', 'start-over', 'go-tab', 'scan-application']) {
    assert.ok(seen.has(action), `${action} stays on the dashboard`);
  }
  assert.match(dashboard, /End this session/);
  assert.match(dashboard, /Scanning, filling, and continuing in this application tab/);
  assert.match(html.renderQuestions, /Fill this page|Fill and continue automatically/);
  assert.ok(hooksOf(html.renderChoice).includes('choose-details'));
});

test('a CAPTCHA checkpoint shows the manual resume action when developer mode is off', () => {
  const view = screens({ state: { developerMode: false } });
  const card = view.applicationCard(CAPTCHA_APP);
  assert.deepEqual(actionsOf(card), ['resume-human-checkpoint', 'go-tab']);
  assert.match(card, /I completed the CAPTCHA — resume/);
  assert.doesNotMatch(card, /try-captcha|experimental|open-handoff/);
  view.state.apps = [CAPTCHA_APP];
  view.renderDashboard();
  assert.ok(actionsOf(view.appRoot.innerHTML).includes('start-over'));
});

test('a pending handoff shows no accept control when developer mode is off', () => {
  const view = screens({ state: { developerMode: false } });
  assert.deepEqual(actionsOf(view.applicationCard({ id: 'h', status: 'handoff_pending' })), []);
});

test('the model runtime offers only Gemini Nano when developer mode is off', () => {
  const base = { agentRuntime: { status: 'ready', shared: false }, agentProvider: { kind: 'local-cli', provider: 'codex', captcha: { provider: 'codex' } } };
  const planner = { runtimeInfo: () => ({ title: 'Codex CLI', detail: 'Paired.' }) };
  const off = screens({ state: { ...base, developerMode: false }, agentPlanner: planner }).renderAgentRuntime();
  assert.deepEqual([...off.matchAll(/<option value="([^"]+)"/g)].map((match) => match[1]), ['chrome-local']);
  assert.match(off, /Chrome on-device Gemini Nano/);
  assert.doesNotMatch(off, /model-companion-fields|model-endpoint|model-token|CAPTCHA images|captcha-provider|captchaModel/);
  const on = screens({ state: { ...base, developerMode: true }, agentPlanner: planner }).renderAgentRuntime();
  for (const value of ['chrome-local', 'codex', 'claude', 'jev']) assert.match(on, new RegExp(`<option value="${value}"`));
  assert.match(on, /model-companion-fields/);
  assert.match(on, /CAPTCHA images · experimental/);
});

test('the program picker hints at one application at a time when developer mode is off only', () => {
  const off = screens({ state: { developerMode: false, participant: { firstName: 'Ana' } } });
  off.renderPrograms();
  assert.equal((off.appRoot.innerHTML.match(/Choose one application at a time\./g) || []).length, 1);
  const on = screens({ state: { developerMode: true, participant: { firstName: 'Ana' } } });
  on.renderPrograms();
  assert.doesNotMatch(on.appRoot.innerHTML, /Choose one application at a time/);
});
