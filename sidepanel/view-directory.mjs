// Participant directory screens: the sign-in form and the find-a-participant form with its result list.
// Only this path needs a sign-in; manual entry, test data and document upload do not.

/**
 * deps:
 * - state, appRoot: panel state (state.directory holds the status, query and results) and the screen root.
 * - format: panel-format helpers; renderError(): the shared error banner.
 * - devTestAccount: { email, password } shown as a development note with a fill-in button, or null to show nothing.
 */
function create(deps) {
  const { state, appRoot, format, renderError, devTestAccount = null } = deps;
  const { escapeHtml } = format;

  function renderDevAccountNote() {
    if (!devTestAccount) return '';
    return `
      <div class="notice" role="note" style="margin-bottom:16px">
        <span aria-hidden="true">i</span>
        <span><strong>Development test account.</strong> Email <code>${escapeHtml(devTestAccount.email)}</code> · Password <code>${escapeHtml(devTestAccount.password)}</code>. Fictional data only.
        <button class="link-button" type="button" data-action="directory-use-test-account">Fill these in</button></span>
      </div>`;
  }

  function renderDirectorySignIn() {
    appRoot.innerHTML = `
    <section>
      <button class="back-button" type="button" data-action="back-choice"><span aria-hidden="true">←</span> Back</button>
      <div class="intro">
        <p class="eyebrow">Participant directory</p>
        <h1>Sign in to find a participant</h1>
        <p class="lede">Only the directory needs a sign-in. Pasting JSON, test data and documents work without one.</p>
      </div>
      ${renderError()}
      ${renderDevAccountNote()}
      <form id="directory-signin-form" class="stack">
        <div class="field">
          <label for="directory-email">Email</label>
          <input id="directory-email" name="directoryEmail" type="email" autocomplete="username" required>
        </div>
        <div class="field">
          <label for="directory-password">Password</label>
          <input id="directory-password" name="directoryPassword" type="password" autocomplete="current-password" required>
          <p class="field-hint">Your password goes only to the directory service. It is not saved and never reaches an AI model.</p>
        </div>
        <div class="form-actions">
          <button class="primary-button" type="submit">Sign in</button>
          <button class="secondary-button" type="button" data-action="choose-json">Paste client JSON instead</button>
        </div>
      </form>
    </section>`;
  }

  function resultRow(match) {
    const name = [match.firstName, match.lastName].filter(Boolean).join(' ') || 'Unnamed participant';
    return `
      <li>
        <button class="choice-button" type="button" data-action="directory-pick" data-id="${encodeURIComponent(match.recordId)}">
          <span class="choice-icon" aria-hidden="true">ID</span>
          <span class="choice-copy"><strong>${escapeHtml(name)}</strong><small>ID ${escapeHtml(match.recordId)}</small></span>
          <span class="chevron" aria-hidden="true">›</span>
        </button>
      </li>`;
  }

  function renderDirectoryFind() {
    const directory = state.directory || {};
    const mode = directory.mode === 'id' ? 'id' : 'name';
    const results = directory.results;
    let resultBlock = '';
    if (Array.isArray(results)) {
      resultBlock = results.length
        ? `<p class="field-hint" role="status" style="margin-top:16px">${results.length === 20 ? 'Showing the first 20 matches. Narrow the name to see others.' : `${results.length} ${results.length === 1 ? 'match' : 'matches'}`}</p><ul class="stack" style="list-style:none;padding:0;margin:0">${results.map(resultRow).join('')}</ul>`
        : '<p class="field-hint" role="status" style="margin-top:16px">No participants matched. Check the spelling or try the ID.</p>';
    }
    appRoot.innerHTML = `
    <section>
      <button class="back-button" type="button" data-action="back-choice"><span aria-hidden="true">←</span> Back</button>
      <div class="intro">
        <p class="eyebrow">Participant directory</p>
        <h1>Find a participant</h1>
        <p class="lede">Signed in as ${escapeHtml(directory.email || 'your account')}. <button class="link-button" type="button" data-action="directory-sign-out">Sign out</button></p>
      </div>
      ${renderError()}
      <form id="directory-find-form" class="stack">
        <div class="field">
          <label for="directory-mode">Find by</label>
          <select id="directory-mode" name="directoryMode">
            <option value="name" ${mode === 'name' ? 'selected' : ''}>Name</option>
            <option value="id" ${mode === 'id' ? 'selected' : ''}>Participant ID</option>
          </select>
        </div>
        <div class="field">
          <label for="directory-query">${mode === 'id' ? 'Participant ID' : 'Name'}</label>
          <input id="directory-query" name="directoryQuery" type="text" autocomplete="off" spellcheck="false" value="${escapeHtml(directory.query || '')}" required>
          <p class="field-hint">Part of a first or last name is enough. The name is sent securely and is not kept in the page address.</p>
        </div>
        <div class="form-actions">
          <button class="primary-button" type="submit">Search</button>
        </div>
      </form>
      ${resultBlock}
    </section>`;
  }

  return { renderDirectorySignIn, renderDirectoryFind };
}

export { create };
