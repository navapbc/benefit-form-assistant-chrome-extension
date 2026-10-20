// Host access: asks the person for per-site access when an origin falls outside the manifest's built-in host_permissions.
(function installHostAccess(root) {
  'use strict';

  function originPattern(value) {
    let url;
    try { url = new URL(String(value || '')); } catch { return ''; }
    return /^https?:$/.test(url.protocol) ? `${url.protocol}//${url.hostname}/*` : '';
  }

  /**
   * Resolves once the extension may read and write `value`'s origin. Granted origins resolve silently; others
   * prompt, which Chrome allows only inside a user gesture. Outside the extension (preview, tests) it is a no-op.
   */
  async function ensureHostAccess(value, chromeApi = root.chrome) {
    const permissions = chromeApi?.permissions;
    const pattern = originPattern(value);
    if (!permissions?.contains || !pattern) return;
    const request = { origins: [pattern] };
    if (await permissions.contains(request)) return;
    let granted = false;
    try { granted = await permissions.request(request); } catch { granted = false; }
    if (!granted) {
      throw new Error(`Allow access to ${pattern.replace('/*', '')} to use the assistant there. Choose the action again and accept the browser prompt. No form values were changed.`);
    }
  }

  const api = { originPattern, ensureHostAccess };

  root.NavaHostAccess = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
