// Intake actions: the side-panel handlers for bringing a client in — record lookup, pasted JSON, document upload and review, choosing programs — and for returning home or ending the client session.

/** The form control with this id; these handlers only look up inputs and selects they rendered. */
const control = (id) => /** @type {HTMLInputElement & HTMLSelectElement} */ (document.getElementById(id));

/**
 * deps:
 * - state, render(), setBusy(message), sendRuntime(message), getActiveTab(): panel state, the screen, transport and the active tab.
 * - SKIP_FINAL_RENDER, showScreen(view): the dispatcher handler contract (ui-dispatch's handlerContract).
 * - assertUiGeneration(token), currentUiGeneration(), cancelPendingUiWork(), cancelUiBoundRuns(), cancelAllRuns(): run control.
 * - commitParticipant(participant), persist(options), clearAssistantState(): coordinator writes.
 * - DEMO_RECORDS, parseDocument(file, options), clientSummary(): the fictional sample record, the document parser, and the
 *   canonical client values.
 * - canonicalHomeView(), recordAudit(type, application, details): the home screen and the audit log.
 * - prepareAgentRuntime(), scanTab(tab, options), openSelectedPrograms(values), enqueueApplicationBatch(ids): starting applications.
 * - directory: the participant directory client (shared/participant-directory.mjs); decoded(value): the data-attribute decoder.
 * - currentUiSignal(): aborts a directory request when the screen is left.
 * - devTestAccount: the development test account the sign-in screen offers to fill in, or null.
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
    DEMO_RECORDS,
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
    devTestAccount,
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

  // ---- Participant directory: the only intake path that needs a sign-in ----

  async function refreshDirectoryState(patch = {}) {
    state.directory = { ...state.directory, ...(await directory.status()), ...patch };
  }

  /** Sends the user back to the sign-in screen when the directory says the session is over; rethrows anything else. */
  async function directoryFailure(error) {
    if (error?.name !== 'DirectoryAuthError') throw error;
    await refreshDirectoryState({ results: null });
    state.view = 'directory-signin';
    state.error = error.message;
  }

  async function chooseDirectory() {
    await refreshDirectoryState({ results: null });
    state.view = state.directory.signedIn ? 'directory' : 'directory-signin';
  }

  async function submitDirectorySignIn({ form, uiToken }) {
    const data = new FormData(form);
    setBusy('Signing in…');
    await directory.signIn(data.get('directoryEmail'), data.get('directoryPassword'), { signal: currentUiSignal() });
    assertUiGeneration(uiToken);
    await refreshDirectoryState({ results: null, query: '' });
    state.view = 'directory';
  }

  function useDirectoryTestAccount() {
    if (!devTestAccount) return SKIP_FINAL_RENDER;
    control('directory-email').value = devTestAccount.email;
    control('directory-password').value = devTestAccount.password;
    return SKIP_FINAL_RENDER;
  }

  async function openDirectoryRecord(id, uiToken) {
    setBusy('Opening the participant…');
    const record = await directory.findById(id, { signal: currentUiSignal() });
    assertUiGeneration(uiToken);
    if (!record) throw new Error('No participant has that ID.');
    const activeTab = await getActiveTab();
    assertUiGeneration(uiToken);
    await commitParticipant(record);
    assertUiGeneration(uiToken);
    state.activeTab = activeTab;
    state.view = 'programs';
    await persist();
  }

  async function submitDirectoryFind({ form, uiToken }) {
    const data = new FormData(form);
    const mode = data.get('directoryMode') === 'id' ? 'id' : 'name';
    const query = String(data.get('directoryQuery') ?? '').trim();
    state.directory = { ...state.directory, mode, query };
    try {
      if (mode === 'id') {
        await openDirectoryRecord(query, uiToken);
        return;
      }
      setBusy('Searching the directory…');
      const results = await directory.searchByName(query, { signal: currentUiSignal() });
      assertUiGeneration(uiToken);
      state.directory = { ...state.directory, results };
      state.view = 'directory';
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

  function useSampleRecord() {
    control('client-json').value = JSON.stringify(DEMO_RECORDS['339619'], null, 2);
    return SKIP_FINAL_RENDER;
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
    const activeTab = await getActiveTab();
    assertUiGeneration(uiToken);
    await commitParticipant(parsed);
    assertUiGeneration(uiToken);
    state.activeTab = activeTab;
    state.view = 'programs';
    await persist();
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
    ['choose-json', showScreen('json')],
    ['choose-directory', chooseDirectory],
    ['directory-pick', pickDirectoryRecord],
    ['directory-use-test-account', useDirectoryTestAccount],
    ['directory-sign-out', signOutDirectory],
    ['choose-document', openDocumentUpload],
    ['back-choice', showScreen('choice')],
    ['back-document', openDocumentUpload],
    ['back-programs', showScreen('programs')],
    ['reload-source', showScreen('choice')],
    ['use-sample', useSampleRecord],
    ['change-client', changeClient],
    ['start-over', startOver],
  ];
  const INTAKE_SUBMIT_ACTIONS = [
    ['record-form', submitRecordId],
    ['json-form', submitClientJson],
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
