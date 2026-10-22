// Intake actions: the side-panel handlers for bringing a client in — record lookup, pasted JSON, document upload and review, choosing programs — and for returning home or ending the client session.

import { planWorkflows } from '../shared/program-catalog.mjs';

/** The form control with this id; these handlers only look up inputs and selects they rendered. */
const control = (id) => /** @type {HTMLInputElement & HTMLSelectElement} */ (document.getElementById(id));

/**
 * deps:
 * - state, render(), setBusy(message), sendRuntime(message), getActiveTab(): panel state, the screen, transport and the active tab.
 * - SKIP_FINAL_RENDER, showScreen(view): the dispatcher handler contract (ui-dispatch's handlerContract).
 * - assertUiGeneration(token), currentUiGeneration(), cancelPendingUiWork(), cancelUiBoundRuns(), cancelAllRuns(): run control.
 * - commitParticipant(participant), persist(options), clearAssistantState(): coordinator writes.
 * - parseDocument(file, options), clientSummary(): the document parser and the canonical client values.
 * - canonicalHomeView(), recordAudit(type, application, details): the home screen and the audit log.
 * - prepareAgentRuntime(), scanTab(tab, options), openSelectedPrograms(values), enqueueApplicationBatch(ids): starting applications.
 * - directory: the participant directory client (shared/participant-directory.mjs); decoded(value): the data-attribute decoder.
 * - currentUiSignal(): aborts a directory request when the screen is left.
 * - state.devTestAccount: the development test account the sign-in screen offers to fill in, or null.
 * - sampleClients: the fictional sample clients ({ id, payload }); welcome: { markSeen() } for the welcome page.
 */
function create(deps) {
  const {
    state,
    render,
    setBusy,
    sendRuntime,
    getActiveTab,
    SKIP_FINAL_RENDER,
    showScreen,
    assertUiGeneration,
    currentUiGeneration,
    cancelPendingUiWork,
    cancelUiBoundRuns,
    cancelAllRuns,
    commitParticipant,
    persist,
    clearAssistantState,
    parseDocument,
    clientSummary,
    canonicalHomeView,
    recordAudit,
    prepareAgentRuntime,
    scanTab,
    openSelectedPrograms,
    enqueueApplicationBatch,
    directory,
    decoded,
    currentUiSignal,
    sampleClients = [],
    welcome,
  } = deps;

  async function lookupRecord(recordId, uiToken) {
    assertUiGeneration(uiToken);
    setBusy('Finding the client record…');
    const response = await sendRuntime({ type: 'LOOKUP_RECORD', recordId });
    assertUiGeneration(uiToken);
    if (!response?.ok || !response.record) throw new Error(response?.message || 'No client record was found.');
    if (response.record._connector) {
      state.pendingConnectorRecord = response.record;
      state.view = 'record-review';
      return;
    }
    const activeTab = await getActiveTab();
    assertUiGeneration(uiToken);
    await commitParticipant(response.record);
    assertUiGeneration(uiToken);
    state.activeTab = activeTab;
    state.view = 'programs';
    await persist();
  }

  // ---- Participant directory: the only intake path that needs a sign-in. It lives on the start screen. ----

  async function refreshDirectoryState(patch = {}) {
    state.directory = { ...state.directory, ...(await directory.status()), ...patch };
  }

  /** Back to the start screen's sign-in when the directory says the session is over; rethrows anything else. */
  async function directoryFailure(error) {
    if (error?.name !== 'DirectoryAuthError') throw error;
    await refreshDirectoryState({ results: null });
    state.view = 'choice';
    state.error = error.message;
  }

  function useDirectoryTestAccount() {
    if (!state.devTestAccount) return SKIP_FINAL_RENDER;
    control('directory-email').value = state.devTestAccount.email;
    control('directory-password').value = state.devTestAccount.password;
    return SKIP_FINAL_RENDER;
  }

  async function submitDirectorySignIn({ form, uiToken }) {
    const data = new FormData(form);
    setBusy('Signing in…');
    await directory.signIn(data.get('directoryEmail'), data.get('directoryPassword'), { signal: currentUiSignal() });
    assertUiGeneration(uiToken);
    await refreshDirectoryState({ results: null, query: '' });
    state.view = 'choice';
  }

  /** Commits a record from any source and moves on to choosing the application. */
  async function startWithRecord(record, uiToken) {
    const activeTab = await getActiveTab();
    assertUiGeneration(uiToken);
    await commitParticipant(record);
    assertUiGeneration(uiToken);
    state.activeTab = activeTab;
    state.view = 'programs';
    await persist();
  }

  async function openDirectoryRecord(id, uiToken) {
    setBusy('Opening the client…');
    const record = await directory.findById(id, { signal: currentUiSignal() });
    assertUiGeneration(uiToken);
    if (!record) throw new Error('That client could not be found.');
    await startWithRecord(record, uiToken);
  }

  /** One search box: something that looks like an ID is tried as an ID first, anything else is a name search. */
  async function submitDirectoryFind({ form, uiToken }) {
    const query = String(new FormData(form).get('directoryQuery') ?? '').trim();
    state.directory = { ...state.directory, query };
    try {
      if (/^[A-Za-z0-9._-]{1,64}$/.test(query) && /\d/.test(query)) {
        setBusy('Looking for that ID…');
        const record = await directory.findById(query, { signal: currentUiSignal() });
        assertUiGeneration(uiToken);
        if (record) {
          await startWithRecord(record, uiToken);
          return;
        }
      }
      setBusy('Searching…');
      const results = await directory.searchByName(query, { signal: currentUiSignal() });
      assertUiGeneration(uiToken);
      state.directory = { ...state.directory, results };
      state.view = 'choice';
    } catch (error) {
      if (error?.name === 'UiCancelledError') throw error;
      await directoryFailure(error);
    }
  }

  async function pickDirectoryRecord({ button, uiToken }) {
    try {
      await openDirectoryRecord(decoded(button.dataset.id), uiToken);
    } catch (error) {
      if (error?.name === 'UiCancelledError') throw error;
      await directoryFailure(error);
    }
  }

  async function signOutDirectory() {
    await directory.signOut();
    await refreshDirectoryState({ results: null, query: '' });
    state.view = 'choice';
  }

  // ---- Typed details and sample clients: no sign-in ----

  const DETAIL_KEYS = ['firstName', 'lastName', 'dateOfBirth', 'phone', 'email', 'addressLine1', 'addressLine2', 'city', 'state', 'postalCode'];

  async function submitClientDetails({ form, uiToken }) {
    const data = new FormData(form);
    const values = {};
    for (const key of DETAIL_KEYS) {
      const value = String(data.get(key) ?? '').trim();
      if (value) values[key] = value;
    }
    if (!values.firstName || !values.lastName) throw new Error('Enter at least the client’s first and last name.');
    await startWithRecord(values, uiToken);
  }

  async function useSampleClient({ button, uiToken }) {
    const sample = sampleClients.find((client) => client.id === decoded(button.dataset.id));
    if (!sample) throw new Error('That sample client is not available.');
    await startWithRecord(structuredClone(sample.payload), uiToken);
  }

  // ---- Welcome page ----

  async function dismissWelcome() {
    await welcome.markSeen();
    state.view = canonicalHomeView();
  }

  async function returnHome() {
    await cancelUiBoundRuns();
    const uiToken = cancelPendingUiWork();
    state.connectorDraft = null;
    state.connectorSchema = [];
    state.pendingConnectorRecord = null;
    state.documentResult = null;
    state.handoffApplicationId = null;
    state.view = canonicalHomeView();
    return { uiToken };
  }

  /** Stops every run, cancels pending screens, forgets the client and their applications, and clears the saved session. */
  async function endClientSession({ recordSessionEnd }) {
    cancelAllRuns();
    const uiToken = cancelPendingUiWork();
    if (recordSessionEnd) recordAudit('session_ended', null);
    state.participant = null;
    state.documentResult = null;
    state.pendingConnectorRecord = null;
    state.apps = [];
    state.currentAppId = null;
    state.previewPage = 1;
    state.view = 'choice';
    await clearAssistantState();
    return { uiToken };
  }

  async function changeClient() {
    return endClientSession({ recordSessionEnd: false });
  }

  async function startOver() {
    return endClientSession({ recordSessionEnd: true });
  }

  function openDocumentUpload() {
    state.documentResult = null;
    state.view = 'document';
  }

  async function submitRecordId({ form, uiToken }) {
    await lookupRecord(new FormData(form).get('recordId'), uiToken);
  }

  async function submitClientJson({ form, uiToken }) {
    const raw = String(new FormData(form).get('clientJson') ?? '');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('That is not valid JSON. Check the commas and quotation marks, then try again.');
    }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Paste one client record as a JSON object.');
    await startWithRecord(parsed, uiToken);
  }

  async function submitClientDocument({ form, uiToken }) {
    const file = form.elements.clientDocument?.files?.[0];
    setBusy('Reading the document on this device…');
    const documentResult = await parseDocument(file, {
      onProgress(update) {
        if (uiToken !== currentUiGeneration()) return;
        const page = update.pageNumber ? ` page ${update.pageNumber}${update.totalPages ? ` of ${update.totalPages}` : ''}` : '';
        const percent = Number.isFinite(update.progress) && update.progress > 0 ? ` · ${Math.round(update.progress * 100)}%` : '';
        setBusy(`On-device OCR${page}: ${update.status || 'working'}${percent}`);
      },
    });
    assertUiGeneration(uiToken);
    state.documentResult = documentResult;
    state.view = 'document-review';
  }

  async function submitDocumentReview({ form, uiToken }) {
    const result = state.documentResult;
    if (!result) throw new Error('Choose and read a document first.');
    const selectedIndexes = new FormData(form).getAll('fieldIndex').map(Number);
    if (!selectedIndexes.length) throw new Error('Select at least one detail to use.');
    const selected = selectedIndexes.map((index) => result.fields[index]).filter(Boolean);
    const currentValues = state.participant ? clientSummary().values : {};
    const existing = Object.fromEntries(Object.entries(currentValues).filter(([, value]) => value !== undefined && value !== null && value !== ''));
    const additions = Object.fromEntries(selected.map((field) => [field.key, field.value]));
    const activeTab = await getActiveTab();
    assertUiGeneration(uiToken);
    const participant = {
      ...existing,
      ...additions,
      ...(state.participant?._connector ? { _connector: state.participant._connector } : {}),
      _documentSources: [
        ...(state.participant?._documentSources || []),
        {
          name: result.file.name,
          fields: selected.map((field) => field.key),
          quality: result.quality,
          provenance: selected.map((field) => ({
            key: field.key,
            confidence: field.confidence,
            ocrConfidence: field.ocrConfidence,
            source: field.source,
          })),
        },
      ],
    };
    await commitParticipant(participant);
    assertUiGeneration(uiToken);
    state.documentResult = null;
    state.activeTab = activeTab;
    state.view = 'programs';
    await persist();
  }

  async function submitProgramChoice({ form, uiToken }) {
    const values = new FormData(form).getAll('program');
    if (!values.length) throw new Error('Choose at least one application or the current form.');
    if (!state.developerMode) {
      const known = values.filter((value) => value !== 'current');
      if ((values.includes('current') ? 1 : 0) + planWorkflows(known).length > 1) throw new Error('Choose one application at a time.');
    }
    await prepareAgentRuntime();
    assertUiGeneration(uiToken);
    const applicationsToRun = [];
    if (values.includes('current')) {
      const activeTab = await getActiveTab();
      assertUiGeneration(uiToken);
      state.activeTab = activeTab;
      applicationsToRun.push(await scanTab(state.activeTab, { uiToken }));
    }
    applicationsToRun.push(...await openSelectedPrograms(values));
    const showDashboard = uiToken === currentUiGeneration();
    if (showDashboard) state.view = 'dashboard';
    await persist({
      applicationIds: applicationsToRun.map((application) => application.id),
      includeCurrentAppId: true,
    });
    if (showDashboard) render();
    void enqueueApplicationBatch(applicationsToRun.map((application) => application.id)).catch((error) => {
      state.error = error.message;
      if (state.view === 'dashboard') render();
    });
    return SKIP_FINAL_RENDER;
  }

  const INTAKE_CLICK_ACTIONS = [
    ['home', returnHome],
    ['choose-id', showScreen('record')],
    ['choose-details', showScreen('details')],
    ['use-sample-client', useSampleClient],
    ['dismiss-welcome', dismissWelcome],
    ['show-welcome', showScreen('welcome')],
    ['directory-pick', pickDirectoryRecord],
    ['directory-use-test-account', useDirectoryTestAccount],
    ['directory-sign-out', signOutDirectory],
    ['choose-document', openDocumentUpload],
    ['back-choice', showScreen('choice')],
    ['back-document', openDocumentUpload],
    ['back-programs', showScreen('programs')],
    ['reload-source', showScreen('choice')],
    ['change-client', changeClient],
    ['start-over', startOver],
  ];
  const INTAKE_SUBMIT_ACTIONS = [
    ['record-form', submitRecordId],
    ['json-form', submitClientJson],
    ['details-form', submitClientDetails],
    ['directory-signin-form', submitDirectorySignIn],
    ['directory-find-form', submitDirectoryFind],
    ['document-form', submitClientDocument],
    ['document-review-form', submitDocumentReview],
    ['program-form', submitProgramChoice],
  ];

  return {
    INTAKE_CLICK_ACTIONS,
    INTAKE_SUBMIT_ACTIONS,
  };
}

export { create };
