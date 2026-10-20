// Planner runtime: the chosen model provider or the shared Nava planner gateway, planner start-up progress, and client links minted through the gateway for the open questions.

const AGENT_PROVIDER_STORAGE_KEY = 'nava:agent-provider';

/**
 * deps:
 * - state, previewMode: panel state (agentRuntime, agentProvider, plannerBase) and whether the panel runs without extension APIs.
 * - agentPlanner: NavaAgenticPlanner (prepare, configure, gatewayConfig, runtimeInfo, availability).
 * - setBusy(message), setApplicationProgress(application, message): full-screen and per-application progress.
 * - assertUiGeneration(token), activeRunCount(): run control, read when the runtime changes.
 * - persist(options): saves the minted client link with its application.
 */
function create(deps) {
  const {
    state,
    previewMode,
    agentPlanner,
    setBusy,
    setApplicationProgress,
    assertUiGeneration,
    activeRunCount,
    currentUiSignal,
    persist,
  } = deps;

  function agentProgressMessage(update = {}) {
    if (update.phase === 'download') {
      const percent = Number.isFinite(update.progress) && update.progress > 0
        ? ` ${Math.round(update.progress * 100)}%`
        : '';
      return `Downloading Chrome's on-device language model${percent}…`;
    }
    if (state.agentProvider.provider === 'jev') {
      if (update.phase === 'planning') return 'Jev is classifying this page; uncertain answers will pause for confirmation…';
      if (update.phase === 'recovering') return 'Jev is retrying unresolved mappings once…';
      if (update.phase === 'starting') return 'Connecting to Jev through the local companion…';
    }
    if (update.phase === 'starting') {
      if (state.agentProvider.kind === 'local-cli') {
        return `Connecting three planner roles to ${state.agentProvider.provider === 'codex' ? 'Codex CLI' : 'Claude Code'}…`;
      }
      return 'Starting three on-device form agents…';
    }
    if (update.phase === 'planning') return 'Field-mapping and gap-analysis agents are reviewing this page…';
    if (update.phase === 'reviewing') return 'The independent review agent is checking the proposed plan…';
    return 'Preparing the on-device form agents…';
  }

  async function prepareAgentRuntime({ application = null } = {}) {
    if (previewMode) return { status: 'preview', agents: [] };
    if (!agentPlanner?.prepare) throw new Error('The agentic planner did not load. Reload the extension and try again.');
    if (state.agentProvider.provider !== 'jev' && agentPlanner.gatewayConfig) {
      const gateway = await agentPlanner.gatewayConfig();
      if (gateway) {
        state.agentRuntime = {
          status: 'ready',
          shared: true,
          message: `Planning runs on the shared API at ${gateway.base}. Filling still happens in this tab.`,
        };
        return { status: 'ready', agents: ['field_mapper', 'gap_analyst', 'form_reviewer'] };
      }
    }
    if (state.agentRuntime.status === 'ready') return { status: 'ready' };
    const providerTitle = agentPlanner.runtimeInfo?.().title || 'Agentic AI';
    state.agentRuntime = { status: 'starting', message: `Starting ${providerTitle}…` };
    try {
      const prepared = await agentPlanner.prepare({
        onProgress(update) {
          const message = agentProgressMessage(update);
          state.agentRuntime = { status: update.phase === 'ready' ? 'ready' : update.phase, message };
          if (application) setApplicationProgress(application, message);
          else setBusy(message);
        },
      });
      state.agentRuntime = { status: 'ready', message: state.agentProvider.provider === 'jev' ? `${providerTitle} is ready for purpose classification and local validation.` : `${providerTitle} is ready for three planner roles.` };
      return prepared;
    } catch (error) {
      state.agentRuntime = { status: 'unavailable', message: error.message };
      throw error;
    }
  }

  async function restoreAgentProvider() {
    if (previewMode || !agentPlanner?.configure) return;
    let stored = null;
    try {
      stored = (await chrome.storage.session.get(AGENT_PROVIDER_STORAGE_KEY))[AGENT_PROVIDER_STORAGE_KEY] || null;
      state.agentProvider = stored || { kind: 'chrome-local' };
      agentPlanner.configure(state.agentProvider);
    } catch {
      state.agentProvider = { kind: 'chrome-local' };
      agentPlanner.configure(state.agentProvider);
      if (stored) await chrome.storage.session.remove(AGENT_PROVIDER_STORAGE_KEY);
    }
  }

  async function saveAgentProvider(form, uiToken) {
    if (activeRunCount()) throw new Error('Wait for the active application runs to pause before changing the model runtime.');
    const data = new FormData(form);
    const selected = String(data.get('modelProvider') || 'chrome-local');
    const config = selected === 'chrome-local'
      ? { kind: 'chrome-local' }
      : {
        kind: 'local-cli',
        provider: selected,
        endpoint: String(data.get('modelEndpoint') || '').trim(),
        token: String(data.get('modelToken') || '').trim(),
        model: selected === 'jev' ? 'jev-1.13.0' : selected === 'claude' ? 'sonnet' : '',
      };
    agentPlanner.configure(config);
    config.captcha = {
      provider: ['same', 'nano', 'codex', 'eve'].includes(String(data.get('captchaProvider'))) ? data.get('captchaProvider') : 'same',
      model: String(data.get('captchaModel') || 'gpt-6.1-sol').trim(),
      reasoning: data.get('captchaReasoning') === 'xhigh' ? 'xhigh' : 'low',
    };
    // A Nano form planner can use a separately paired image companion.
    if (selected === 'chrome-local') {
      config.endpoint = String(data.get('modelEndpoint') || '').trim();
      config.token = String(data.get('modelToken') || '').trim();
    }
    state.agentProvider = config;
    state.agentRuntime = { status: 'checking', message: '' };
    await chrome.storage.session.set({ [AGENT_PROVIDER_STORAGE_KEY]: config });
    setBusy(`Connecting ${selected === 'jev' ? 'Jev decision model' : selected === 'chrome-local' ? 'Chrome on-device AI' : `${selected === 'codex' ? 'Codex CLI' : 'Claude Code'} subscription`}…`);
    await prepareAgentRuntime();
    assertUiGeneration(uiToken);
  }

  function clientLinkPrograms(programIds) {
    const ids = (programIds || []).filter(Boolean);
    const benefitsCal = new Set(['calfresh', 'medical', 'calworks']);
    if (benefitsCal.has(ids[0])) return ids.filter((id) => benefitsCal.has(id));
    return ids.slice(0, 1);
  }

  function apiInputType(gap) {
    const type = String(gap.inputType || '');
    if (type === 'multi_choice') return 'checkbox';
    if (['text', 'select', 'radio', 'checkbox', 'date', 'number'].includes(type)) return type;
    return Array.isArray(gap.options) && gap.options.length ? 'select' : 'text';
  }

  /**
   * Creates an API application for the open questions and returns a link the
   * client can answer. Values stay in this tab. The request sends questions
   * only, and the audit log on the API records that an application was added.
   */
  async function mintClientLink(application, { signal = currentUiSignal() } = {}) {
    const gateway = await agentPlanner.gatewayConfig();
    if (!gateway) throw new Error('Save the shared planner API address and a tenant key first.');
    const programIds = clientLinkPrograms(application.programIds);
    if (!programIds.length) throw new Error('Choose a program before creating a client link.');
    const questions = (application.analysis?.gaps || []).slice(0, 40).map((gap) => ({
      fieldKey: String(gap.fieldKey || '').slice(0, 180),
      label: String(gap.label || gap.fieldKey || 'Question').slice(0, 200),
      question: String(gap.question || 'What is the answer?').slice(0, 240),
      required: Boolean(gap.required),
      inputType: apiInputType(gap),
      options: (Array.isArray(gap.options) ? gap.options : [])
        .map((option) => String(option.label || option.value || option))
        .filter(Boolean)
        .slice(0, 20),
    })).filter((gap) => gap.fieldKey && gap.question);
    if (!questions.length) throw new Error('This page has no questions to send.');
    const post = (path, body) => agentPlanner.gatewayRequest(gateway, path, body, { signal });
    const household = await post('/v1/households', { externalRef: `extension-${application.id}` });
    if (!household.household?.id) throw new Error('The shared API did not return a household.');
    const created = await post('/v1/applications', {
      householdId: household.household.id,
      programIds,
      questions,
    });
    if (!created.application?.id) throw new Error('The shared API did not return an application.');
    const share = await post(`/v1/applications/${encodeURIComponent(created.application.id)}/share`, {
      createdBy: 'extension-caseworker',
    });
    application.clientLink = share.url;
    await persist({ applicationIds: [application.id] });
  }

  /** Restores the shared planner API address saved in local storage, outside the preview. */
  async function restorePlannerBase() {
    if (!previewMode && chrome.storage?.local?.get) {
      const stored = await chrome.storage.local.get(['navaApiBase', 'navaApiAllowLoopbackHttp']);
      state.plannerBase = String(stored?.navaApiBase || '');
      state.plannerAllowLoopbackHttp = stored?.navaApiAllowLoopbackHttp === true;
    }
  }

  /** Reports whether Chrome's on-device model is available, outside the preview. */
  async function checkAgentAvailability() {
    if (!previewMode && agentPlanner?.availability) {
      const availability = await agentPlanner.availability();
      state.agentRuntime = {
        status: availability === 'available' ? 'available' : availability,
        message: availability === 'available' ? 'The on-device model is available.' : '',
      };
    }
  }

  return {
    agentProgressMessage,
    prepareAgentRuntime,
    restoreAgentProvider,
    saveAgentProvider,
    clientLinkPrograms,
    apiInputType,
    mintClientLink,
    restorePlannerBase,
    checkAgentAvailability,
  };
}

export { create };
