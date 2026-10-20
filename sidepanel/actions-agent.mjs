// Agent actions: the side-panel handlers for the planner runtime — the shared planner gateway, client links, enabling the agent, and the model-provider form and select.
import * as hostAccess from './host-access.mjs';

/** The form control with this id; these handlers only look up inputs and selects they rendered. */
const control = (id) => /** @type {HTMLInputElement & HTMLSelectElement} */ (document.getElementById(id));

/**
 * deps:
 * - state, render(), assertUiGeneration(token): panel state, the screen, and the UI-generation guard.
 * - SKIP_FINAL_RENDER: the dispatcher outcome for handlers that render for themselves (NavaUiDispatch.handlerContract).
 * - prepareAgentRuntime(), saveAgentProvider(form, uiToken), mintClientLink(application): the planner runtime.
 * - enqueueApplicationBatch(ids): restarts automatic runs the missing planner interrupted.
 */
function create(deps) {
  const {
    state,
    agentPlanner,
    activeRunCount,
    isRunning,
    decoded,
    captchaAuthorizations,
    render,
    assertUiGeneration,
    SKIP_FINAL_RENDER,
    prepareAgentRuntime,
    saveAgentProvider,
    mintClientLink,
    enqueueApplicationBatch,
  } = deps;

  async function savePlannerGateway({ action, uiToken }) {
    if (activeRunCount()) throw new Error('Pause active application runs before changing the shared API.');
    if (action === 'disconnect-planner') {
      await agentPlanner.clearGatewayConfig();
      state.plannerBase = '';
      state.plannerAllowLoopbackHttp = false;
      agentPlanner.reset();
      state.agentRuntime = { status: 'checking', message: '' };
    } else {
      await hostAccess?.ensureHostAccess(control('nava-api-base')?.value);
      const config = await agentPlanner.saveGatewayConfig({
        base: control('nava-api-base')?.value,
        token: control('nava-api-token')?.value,
        allowLoopbackHttp: control('nava-api-loopback')?.checked === true,
      });
      state.plannerBase = config.base;
      state.plannerAllowLoopbackHttp = config.allowLoopbackHttp;
      state.agentRuntime = { status: 'checking', message: '' };
      await prepareAgentRuntime();
    }
    assertUiGeneration(uiToken);
  }

  async function createClientLink({ uiToken }) {
    const application = state.apps.find((item) => item.id === state.currentAppId);
    if (!application) return SKIP_FINAL_RENDER;
    await mintClientLink(application);
    assertUiGeneration(uiToken);
    render();
  }

  async function enableAgent({ uiToken }) {
    await prepareAgentRuntime();
    assertUiGeneration(uiToken);
    const interruptedRuns = state.apps
      .filter((application) => application.autoRun && ['not_started', 'ready_to_fill'].includes(application.status) && application.tabId)
      .map((application) => application.id);
    if (interruptedRuns.length) void enqueueApplicationBatch(interruptedRuns);
  }

  async function submitModelProvider({ form, uiToken }) {
    await saveAgentProvider(form, uiToken);
    render();
    return SKIP_FINAL_RENDER;
  }

  /** The model-provider select shows the companion endpoint and token fields only for a subscription CLI. */
  function showModelCompanionFields(event) {
    const fields = control('model-companion-fields');
    if (fields) fields.hidden = control('model-provider')?.value === 'chrome-local'
      && !['codex', 'eve'].includes(control('captcha-provider')?.value);
  }

  function changeCaptchaAuthorization(event) {
    const id = decoded(event.target.dataset.captchaApp);
    if (!state.apps.some((item) => item.id === id) || isRunning(id)) return;
    if (event.target.checked) captchaAuthorizations.add(id);
    else captchaAuthorizations.delete(id);
  }

  const AGENT_CLICK_ACTIONS = [
    ['save-planner', savePlannerGateway],
    ['disconnect-planner', savePlannerGateway],
    ['client-link', createClientLink],
    ['enable-agent', enableAgent],
  ];
  const AGENT_SUBMIT_ACTIONS = [
    ['model-provider-form', submitModelProvider],
  ];
  const AGENT_CHANGE_HANDLERS = [
    ['model-provider', showModelCompanionFields],
    ['captcha-provider', showModelCompanionFields],
  ];

  return {
    AGENT_CLICK_ACTIONS,
    AGENT_SUBMIT_ACTIONS,
    AGENT_CHANGE_HANDLERS,
    changeCaptchaAuthorization,
  };
}

export { create };
