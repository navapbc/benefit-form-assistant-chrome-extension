// Developer-mode actions: the one switch that turns the experimental features on or off, and applying a change made
// here or in another side panel (each Chrome window has its own panel; they share the stored setting).
import { writeDeveloperMode, isExperimentalView } from '../shared/developer-mode.mjs';

/**
 * deps:
 * - state: panel state (developerMode, view, error).
 * - store: storage-shaped { get, set } that holds the setting (chrome.storage.local, or page memory in the preview).
 * - activeRunCount(): how many application runs are active; the switch only changes while none are.
 * - restoreAgentProvider(): re-reads the planner provider after the setting changes.
 * - captchaAuthorizations: this window's per-run CAPTCHA opt-ins; cleared when the mode turns off.
 * - canonicalHomeView(): the home screen for the current session, used when leaving an experimental view.
 */
function create(deps) {
  const { state, store, activeRunCount, restoreAgentProvider, captchaAuthorizations, canonicalHomeView } = deps;
  let applying = Promise.resolve(false);

  /**
   * Applies a developer mode to this panel. Changes are applied one at a time, and a value the panel already has is a
   * no-op, so the toggling panel's own storage echo never applies the change twice. Resolves true when it changed.
   * @param {boolean} enabled
   * @returns {Promise<boolean>}
   */
  function applyDeveloperMode(enabled) {
    const next = enabled === true;
    applying = applying.catch(() => false).then(async () => {
      if (state.developerMode === next) return false;
      state.developerMode = next;
      if (!next) captchaAuthorizations?.clear();
      await restoreAgentProvider();
      if (!next && isExperimentalView(state.view)) state.view = canonicalHomeView();
      return true;
    });
    return applying;
  }

  async function toggleDeveloperMode() {
    if (activeRunCount() > 0) {
      state.error = 'Wait for the active application runs to pause before changing developer mode.';
      return;
    }
    const next = !state.developerMode;
    await writeDeveloperMode(store, next);
    await applyDeveloperMode(next);
  }

  const DEVELOPER_CLICK_ACTIONS = [
    ['toggle-developer-mode', toggleDeveloperMode],
  ];

  return { DEVELOPER_CLICK_ACTIONS, applyDeveloperMode };
}

export { create };
