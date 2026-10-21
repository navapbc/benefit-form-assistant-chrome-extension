// The participant directory section of the start screen: a sign-in form, then a search box with results.
// Only this path needs a sign-in; typing details, sample clients and document upload do not.

/**
 * deps:
 * - state: panel state (state.directory holds the status, query and results; state.devTestAccount is the optional
 *   { email, password } shown as a development note with a fill-in button, null to show nothing).
 * - format: panel-format helpers.
 */
function create(deps) {
  const { state, format } = deps;
  const { escapeHtml } = format;

  function renderDevAccountNote() {
    const devTestAccount = state.devTestAccount;
    if (!devTestAccount) return '';
    return `
      <div class="notice" role="note" style="margin-bottom:16px">
        <span aria-hidden="true">i</span>
        <span><strong>Development test account.</strong> Email <code>${escapeHtml(devTestAccount.email)}</code> · Password <code>${escapeHtml(devTestAccount.password)}</code>. Fictional clients only.
        <button class="link-button" type="button" data-action="directory-use-test-account">Fill these in</button></span>
      </div>`;
  }

  function notConfiguredBlock() {
    return `
      <h2 id="directory-heading">The client directory is not set up</h2>
      <p class="field-hint">This copy of the assistant has no directory address. You can still enter client details, read a document, or use the sample client. To connect your organization's directory, see <code>participant-api/README.md</code>.</p>`;
  }

  function signInBlock() {
    return `
      <h2 id="directory-heading">Sign in to search for a client</h2>
      <p class="field-hint">Look clients up by name or ID. The assistant uses what it finds to fill in their applications.</p>
      ${renderDevAccountNote()}
      <form id="directory-signin-form" class="stack compact-form">
        <div class="field">
          <label for="directory-email">Work email</label>
          <input id="directory-email" name="directoryEmail" type="email" autocomplete="username" required>
        </div>
        <div class="field">
          <label for="directory-password">Password</label>
          <input id="directory-password" name="directoryPassword" type="password" autocomplete="current-password" required>
        </div>
        <button class="primary-button" type="submit">Sign in</button>
      </form>`;
  }

  function resultRow(match) {
    const name = [match.firstName, match.lastName].filter(Boolean).join(' ') || 'Unnamed client';
    return `
      <li>
        <button class="choice-button" type="button" data-action="directory-pick" data-id="${encodeURIComponent(match.recordId)}">
          <span class="choice-icon" aria-hidden="true">${escapeHtml(name.charAt(0).toUpperCase())}</span>
          <span class="choice-copy"><strong>${escapeHtml(name)}</strong><small>ID ${escapeHtml(match.recordId)} · Select to start</small></span>
          <span class="chevron" aria-hidden="true">›</span>
        </button>
      </li>`;
  }

  function resultsBlock(directory) {
    const results = directory.results;
    if (!Array.isArray(results)) return '';
    if (!results.length) {
      return `<p class="field-hint" role="status" style="margin-top:16px">No clients matched “${escapeHtml(directory.query || '')}”. Check the spelling, or try their ID.</p>`;
    }
    const count = results.length === 20
      ? 'Showing the first 20 matches. Add more of the name to narrow it down.'
      : `${results.length} ${results.length === 1 ? 'client' : 'clients'} found. Select one to start.`;
    return `<p class="field-hint" role="status" style="margin-top:16px">${count}</p><ul class="stack" style="list-style:none;padding:0;margin:0">${results.map(resultRow).join('')}</ul>`;
  }

  function findBlock(directory) {
    return `
      <h2 id="directory-heading">Search for a client</h2>
      <p class="field-hint">Signed in as ${escapeHtml(directory.email || 'your account')} · <button class="link-button" type="button" data-action="directory-sign-out">Sign out</button></p>
      <form id="directory-find-form" class="stack compact-form">
        <div class="field">
          <label for="directory-query">Client name or ID</label>
          <input id="directory-query" name="directoryQuery" type="search" autocomplete="off" spellcheck="false" placeholder="For example, Celeste Thomas or 339619" value="${escapeHtml(directory.query || '')}" required>
          <p class="field-hint">Part of a first or last name is enough.</p>
        </div>
        <button class="primary-button" type="submit">Search</button>
      </form>
      ${resultsBlock(directory)}`;
  }

  /** The directory card for the start screen: sign-in when signed out, search when signed in. */
  function directorySection() {
    const directory = state.directory || {};
    return `<section class="directory-card" aria-labelledby="directory-heading">${directory.signedIn ? findBlock(directory) : directory.configured ? signInBlock() : notConfiguredBlock()}</section>`;
  }

  return { directorySection };
}

export { create };
