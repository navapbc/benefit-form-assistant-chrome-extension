// Developer mode: one switch that hides the experimental features by default.
//
// The setting lives in chrome.storage.local. Only the stored value `true` means on; anything else, a store that throws
// or no store at all means off, so a failure can never expose an experimental feature.

const STORAGE_KEY = 'nava:developer-mode';
const DEVELOPER_MODE_OFF_MESSAGE = 'Developer mode is off.';

/**
 * A read-only view of a set: only the reading methods exist, so no importer can add or remove an entry.
 * @param {string[]} items
 * @returns {ReadonlySet<string>}
 */
function readonlySet(items) {
  const inner = new Set(items);
  const view = /** @type {ReadonlySet<string>} */ (/** @type {unknown} */ (Object.freeze({
    has: (value) => inner.has(value),
    get size() { return inner.size; },
    forEach: (callback, thisArg) => inner.forEach((value) => callback.call(thisArg, value, value, view)),
    values: () => inner.values(),
    keys: () => inner.keys(),
    entries: () => inner.entries(),
    [Symbol.iterator]: () => inner.values(),
  })));
  return view;
}

/** Dispatcher click action names, submit form ids and change-handler element ids of the experimental features. */
const EXPERIMENTAL_ACTIONS = readonlySet([
  'try-captcha',
  'open-handoff',
  'accept-handoff',
  'pause',
  'save-planner',
  'disconnect-planner',
  'client-link',
  'choose-id',
  'configure-connector',
  'back-providers',
  'select-provider',
  'back-connector',
  'local-connector-settings',
  'reset-connector',
  'back-record-id',
  'confirm-connector-record',
  'open-recertifications',
  'back-recertifications',
  'review-recertification',
  'draft-recertification-outreach',
  'complete-recertification-outreach',
  'prepare-recertification',
  'record-form',
  'connector-form',
  'connector-mapping-form',
  'recertification-intake-form',
  'handoff-form',
  'connector-provider',
  'captcha-provider',
]);

/** `state.view` values that only exist for the experimental features. */
const EXPERIMENTAL_VIEWS = readonlySet([
  'connector',
  'providers',
  'connector-mapping',
  'record-review',
  'record',
  'recertifications',
  'recertification-detail',
  'handoff',
]);

/** Service worker message types that only serve the experimental features. */
const EXPERIMENTAL_MESSAGE_TYPES = readonlySet([
  'NAVA_CAPTCHA_COMMAND',
  'DISCOVER_CONNECTOR',
  'SAVE_CONNECTOR',
  'RESET_CONNECTOR',
  'LOOKUP_RECORD',
  'LIST_RECERTIFICATIONS',
]);

/**
 * Whether developer mode is on. Never throws.
 * @param {{ get(key: string): Promise<Record<string, unknown>> } | undefined} storage
 * @returns {Promise<boolean>}
 */
async function readDeveloperMode(storage) {
  try {
    const stored = await storage?.get(STORAGE_KEY);
    return stored?.[STORAGE_KEY] === true;
  } catch {
    return false;
  }
}

/**
 * Turn developer mode on or off. Stores a strict boolean.
 * @param {{ set(items: Record<string, unknown>): Promise<void> }} storage
 * @param {boolean} enabled
 * @returns {Promise<void>}
 */
async function writeDeveloperMode(storage, enabled) {
  await storage.set({ [STORAGE_KEY]: Boolean(enabled) });
}

/**
 * The developer mode a `chrome.storage.onChanged` event sets, or null when the event does not change it.
 * Only a new value of `true` means on; a removed or other value means off.
 * @param {Record<string, { newValue?: unknown }> | undefined} changes
 * @param {string} areaName
 * @returns {boolean | null}
 */
function developerModeFromChange(changes, areaName) {
  if (areaName !== 'local' || !changes || !Object.prototype.hasOwnProperty.call(changes, STORAGE_KEY)) return null;
  return changes[STORAGE_KEY]?.newValue === true;
}

/** @param {unknown} name */
const isExperimentalAction = (name) => EXPERIMENTAL_ACTIONS.has(/** @type {string} */ (name));
/** @param {unknown} view */
const isExperimentalView = (view) => EXPERIMENTAL_VIEWS.has(/** @type {string} */ (view));
/** @param {unknown} type */
const isExperimentalMessage = (type) => EXPERIMENTAL_MESSAGE_TYPES.has(/** @type {string} */ (type));

export {
  STORAGE_KEY,
  DEVELOPER_MODE_OFF_MESSAGE,
  EXPERIMENTAL_ACTIONS,
  EXPERIMENTAL_VIEWS,
  EXPERIMENTAL_MESSAGE_TYPES,
  readDeveloperMode,
  writeDeveloperMode,
  developerModeFromChange,
  isExperimentalAction,
  isExperimentalView,
  isExperimentalMessage,
};
