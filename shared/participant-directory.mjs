// Participant directory client: signs a user in to the participant API and finds a participant by ID or name.
//
// Only this path needs a sign-in. Manual entry, test data and document upload never touch it. The address is not secret
// and lives in chrome.storage.local; the session token and the short-lived JWT live in chrome.storage.session only.
// Server response bodies are never surfaced: callers get fixed messages.

const CONFIG_KEY = 'nava:directory';
const SESSION_KEY = 'nava:directory-session';
const REFRESH_MARGIN_MS = 60_000;
const ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

class DirectoryAuthError extends Error {
  constructor(message = 'Your sign-in expired. Sign in again.') {
    super(message);
    this.name = 'DirectoryAuthError';
  }
}

/** The directory's origin, or an error. HTTPS only; HTTP is accepted solely for loopback development. */
function normalizeBase(value, { allowLoopbackHttp = false } = {}) {
  let url;
  try {
    url = new URL(String(value || '').trim());
  } catch {
    throw new Error('Enter the directory address as an https:// URL.');
  }
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  const secure = url.protocol === 'https:' || (allowLoopbackHttp && loopback && url.protocol === 'http:');
  if (!secure || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('Enter the directory address as an https:// URL with no path, query or credentials.');
  }
  return url.origin;
}

/** The expiry (ms) and email claims of a JWT. The signature is checked by the server, never here. */
function tokenClaims(token) {
  try {
    const payload = JSON.parse(atob(String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return { expiresAt: Number(payload.exp) * 1000 || 0, email: typeof payload.email === 'string' ? payload.email : '' };
  } catch {
    return { expiresAt: 0, email: '' };
  }
}

/**
 * deps:
 * - fetchImpl: fetch; storage: { local, session } with chrome.storage-style get/set/remove.
 * - defaultBaseUrl: the directory address the code provides (shared/directory-config.mjs); a saved address overrides it.
 * - now(): current time in ms; timeoutMs: per-request limit.
 * @param {{ fetchImpl?: typeof fetch, storage?: any, defaultBaseUrl?: string, now?: () => number, timeoutMs?: number, allowLoopbackHttp?: boolean }} [deps]
 */
function create({ fetchImpl = globalThis.fetch, storage, defaultBaseUrl = '', now = () => Date.now(), timeoutMs = 15_000, allowLoopbackHttp = false } = {}) {
  const provided = defaultBaseUrl ? normalizeBase(defaultBaseUrl, { allowLoopbackHttp: true }) : '';

  let refreshing = null;

  const read = async (area, key) => (await storage[area].get(key))?.[key] ?? null;

  /**
   * @param {string} base
   * @param {string} path
   * @param {{ method?: string, body?: object, token?: string, signal?: AbortSignal }} [options]
   */
  async function request(base, path, { method = 'GET', body, token, signal } = {}) {
    const signals = [AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])];
    let response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        method,
        redirect: 'error',
        cache: 'no-store',
        credentials: 'omit',
        headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.any(signals),
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new Error('Could not reach the participant directory.');
    }
    const json = await response.json().catch(() => null);
    return { status: response.status, json };
  }

  async function config() {
    const saved = await read('local', CONFIG_KEY);
    return { baseUrl: typeof saved?.baseUrl === 'string' && saved.baseUrl ? saved.baseUrl : provided };
  }

  async function clearSession() {
    await storage.session.remove(SESSION_KEY);
  }

  async function saveConfig(baseUrl) {
    const origin = normalizeBase(baseUrl, { allowLoopbackHttp });
    const current = await config();
    // A session belongs to one directory; never present its tokens to another address.
    if (current.baseUrl && current.baseUrl !== origin) await clearSession();
    await storage.local.set({ [CONFIG_KEY]: { baseUrl: origin } });
    return origin;
  }

  async function status() {
    const { baseUrl } = await config();
    const session = await read('session', SESSION_KEY);
    const signedIn = Boolean(baseUrl && session?.sessionToken && session?.base === baseUrl);
    return { configured: Boolean(baseUrl), baseUrl, signedIn, email: signedIn ? session.email || '' : '' };
  }

  /** @param {{ signal?: AbortSignal }} [options] */
  async function signIn(email, password, options = {}) {
    const { signal } = options;
    const { baseUrl } = await config();
    if (!baseUrl) throw new Error('Enter the directory address first.');
    const cleanEmail = String(email || '').trim();
    if (!cleanEmail || cleanEmail.length > 254 || !password || String(password).length > 256) {
      throw new Error('Enter your email and password.');
    }
    const { status: code, json } = await request(baseUrl, '/auth/sign-in', { method: 'POST', body: { email: cleanEmail, password: String(password) }, signal });
    if (code !== 200 || !json?.ok || !json.token || !json.sessionToken) throw new Error('Sign-in failed. Check your email and password.');
    const claims = tokenClaims(json.token);
    await storage.session.set({ [SESSION_KEY]: { base: baseUrl, sessionToken: json.sessionToken, token: json.token, expiresAt: claims.expiresAt, email: claims.email || cleanEmail } });
    return status();
  }

  async function signOut() {
    const { baseUrl } = await config();
    const session = await read('session', SESSION_KEY);
    await clearSession();
    if (baseUrl && session?.sessionToken && session.base === baseUrl) {
      // Best effort: the local session is already gone, so a network failure must not block signing out.
      await request(baseUrl, '/auth/sign-out', { method: 'POST', body: { sessionToken: session.sessionToken } }).catch(() => {});
    }
  }

  /** A fresh JWT, refreshing through the session token when it is close to expiry or `force` is set. */
  /** @param {{ force?: boolean, signal?: AbortSignal }} [options] */
  async function accessToken({ force = false, signal } = {}) {
    const { baseUrl } = await config();
    const session = await read('session', SESSION_KEY);
    if (!baseUrl || !session?.sessionToken || session.base !== baseUrl) throw new DirectoryAuthError('Sign in to use the participant directory.');
    if (!force && session.token && session.expiresAt - now() > REFRESH_MARGIN_MS) return { baseUrl, token: session.token };
    refreshing ||= (async () => {
      const { status: code, json } = await request(baseUrl, '/auth/token', { method: 'POST', body: { sessionToken: session.sessionToken }, signal });
      if (code === 401 || !json?.ok || !json.token) {
        await clearSession();
        throw new DirectoryAuthError();
      }
      const claims = tokenClaims(json.token);
      await storage.session.set({ [SESSION_KEY]: { ...session, token: json.token, expiresAt: claims.expiresAt } });
      return json.token;
    })().finally(() => { refreshing = null; });
    return { baseUrl, token: await refreshing };
  }

  /** An authenticated call: one refresh-and-retry on a 401, then a sign-in error. */
  /**
   * @param {string} path
   * @param {{ method?: string, body?: object, signal?: AbortSignal }} [options]
   */
  async function authed(path, options = {}) {
    let { baseUrl, token } = await accessToken({ signal: options.signal });
    let result = await request(baseUrl, path, { ...options, token });
    if (result.status === 401) {
      ({ baseUrl, token } = await accessToken({ force: true, signal: options.signal }));
      result = await request(baseUrl, path, { ...options, token });
      if (result.status === 401) {
        await clearSession();
        throw new DirectoryAuthError();
      }
    }
    if (result.status === 403) throw new Error('Your account does not have access to the participant directory.');
    return result;
  }

  /** The participant record for an ID, or null when there is none. */
  /** @param {{ signal?: AbortSignal }} [options] */
  async function findById(id, options = {}) {
    const { signal } = options;
    const clean = String(id || '').trim();
    if (!ID_PATTERN.test(clean)) throw new Error('Enter a participant ID using letters, numbers, dots, dashes or underscores.');
    const { status: code, json } = await authed(`/participants/${encodeURIComponent(clean)}`, { signal });
    if (code === 404) return null;
    if (code !== 200 || !json?.ok || !json.participant || typeof json.participant !== 'object' || Array.isArray(json.participant)) {
      throw new Error('The participant directory could not return that record.');
    }
    return json.participant;
  }

  /** Up to 20 matches: { recordId, firstName, lastName }. The name travels in the request body, never the URL. */
  /** @param {{ signal?: AbortSignal }} [options] */
  async function searchByName(name, options = {}) {
    const { signal } = options;
    const clean = String(name || '').trim();
    if (clean.length < 2 || clean.length > 80) throw new Error('Enter at least 2 characters of the participant’s name.');
    const { status: code, json } = await authed('/participants/search', { method: 'POST', body: { name: clean }, signal });
    if (code !== 200 || !json?.ok || !Array.isArray(json.matches)) throw new Error('The participant directory could not search right now.');
    return json.matches
      .filter((match) => match && ID_PATTERN.test(String(match.recordId)))
      .map((match) => ({ recordId: String(match.recordId), firstName: String(match.firstName ?? ''), lastName: String(match.lastName ?? '') }));
  }

  return { config, saveConfig, status, signIn, signOut, findById, searchByName };
}

export { create, normalizeBase, tokenClaims, DirectoryAuthError, CONFIG_KEY, SESSION_KEY };
