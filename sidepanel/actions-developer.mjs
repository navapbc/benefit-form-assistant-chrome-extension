// Developer-mode actions: the one switch that turns the experimental features on or off.
import { writeDeveloperMode, isExperimentalView } from '../shared/developer-mode.mjs';

/**
 * deps:
 * - state: panel state (developerMode, view, error).
 * - store: storage-shaped { get, set } that holds the setting (chrome.storage.local, or page memory in the preview).
 * - activeRunCount(): how many application runs are active; the switch only changes while none are.
 * - restoreAgentProvider(): re-reads the planner provider after the setting changes.
 */
function create(deps) {
  const { state, store, activeRunCount, restoreAgentProvider } = deps;

  async function toggleDeveloperMode() {
    if (activeRunCount() > 0) {
      state.error = 'Wait for the active application runs to pause before changing developer mode.';
      return;
    }
    const next = !state.developerMode;
    await writeDeveloperMode(store, next);
    state.developerMode = next;
    await restoreAgentProvider();
    if (!next && isExperimentalView(state.view)) state.view = 'choice';
  }

  const DEVELOPER_CLICK_ACTIONS = [
    ['toggle-developer-mode', toggleDeveloperMode],
  ];

  return { DEVELOPER_CLICK_ACTIONS };
}

export { create };
