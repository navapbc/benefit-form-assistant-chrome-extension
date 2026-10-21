// Client-intake screens: the start screen, model-runtime notice and settings, record ID, client details (typed, sample or pasted), document upload and review, and the program picker.

/**
 * deps:
 * - state, appRoot, previewMode: panel state, the screen root, and simulated-preview flag.
 * - format: panel-format helpers.
 * - engine: the form engine (value normalization); agentPlanner: the model runtime; programCatalog: known sites.
 * - renderError(), clientSummary(), managedConnector(): shared panel helpers.
 * - directorySection(): the participant directory card; sampleClients: the sample clients offered on the details screen.
 * - connectorTitle(), connectorProvider(), connectorSourceId(): connector view helpers.
 */
function create(deps) {
  const {
    state,
    appRoot,
    previewMode,
    format,
    engine,
    agentPlanner,
    programCatalog,
    renderError,
    clientSummary,
    managedConnector,
    directorySection,
    sampleClients = [],
    connectorTitle,
    connectorProvider,
    connectorSourceId,
  } = deps;
  const { escapeHtml, displayValue, formatTimestamp, hostLabel } = format;

  function sameValue(left, right) {
    return engine.normalize(left) === engine.normalize(right);
  }

  function renderAgentRuntime() {
    if (previewMode) {
      return '<p class="runtime-status">Fixture preview · model calls are simulated</p>';
    }
    const ready = state.agentRuntime.status === 'ready';
    const unavailable = state.agentRuntime.status === 'unavailable';
    const info = agentPlanner?.runtimeInfo?.() || { kind: 'chrome-local', title: 'Chrome on-device AI', detail: '' };
    const selectedProvider = state.agentProvider.kind === 'local-cli' ? state.agentProvider.provider : 'chrome-local';
    const companion = state.agentProvider.kind === 'local-cli';
    const title = ready ? (state.agentRuntime.shared ? 'Shared planner API configured' : `${info.title} ready`) : unavailable ? `${info.title} unavailable` : 'The AI assistant needs a one-time setup';
    const detail = ready
      ? (state.agentRuntime.shared
        ? `${state.agentRuntime.message} Saved API settings override Nano/Codex/Claude planning; Jev keeps its paired companion. Client values stay out of planning prompts.`
        : `${info.detail}${info.provider === 'jev' ? ' Confidence threshold: 0.90. No independent model reviewer.' : ' The field mapper, gap analyst, and independent reviewer remain separate model calls.'}`)
      : unavailable
        ? (state.agentRuntime.message || (companion
          ? 'Start the localhost companion and sign the selected CLI in with its subscription account.'
          : 'This device cannot start Chrome built-in AI. Use Chrome 138 or newer on a supported desktop and enable built-in AI.'))
        : `${companion ? 'Connect the paired localhost companion' : 'Start Chrome’s on-device model'} before a live form run. Client values are never included in model prompts.`;
    return `
      ${unavailable
        ? `<div class="notice error" role="alert"><span aria-hidden="true">!</span><span><strong>${escapeHtml(title)}.</strong> ${escapeHtml(detail)}</span></div>`
        : `<p class="runtime-status ${ready ? 'ready' : ''}" role="status"><span class="runtime-dot" aria-hidden="true"></span>${escapeHtml(title)}</p>`}
      ${ready ? '' : '<button class="secondary-button" style="margin-bottom:12px" type="button" data-action="enable-agent">Set up the AI assistant</button>'}
      <details class="model-runtime-settings settings-disclosure">
        <summary>Model runtime</summary>
        ${unavailable ? '' : `<p class="field-hint">${escapeHtml(detail)}</p>`}
        <form id="model-provider-form" class="form-stack compact-form">
          <label for="model-provider">Model provider
            <select id="model-provider" name="modelProvider">
              <option value="chrome-local" ${selectedProvider === 'chrome-local' ? 'selected' : ''}>Chrome on-device Gemini Nano</option>
              <option value="codex" ${selectedProvider === 'codex' ? 'selected' : ''}>Codex subscription via local CLI</option>
              <option value="claude" ${selectedProvider === 'claude' ? 'selected' : ''}>Claude subscription via local CLI</option>
              <option value="jev" ${selectedProvider === 'jev' ? 'selected' : ''}>Jev via local companion · experimental</option>
            </select>
          </label>
          <div id="model-companion-fields" class="form-stack compact-form" ${companion || ['codex', 'eve'].includes(state.agentProvider.captcha?.provider) ? '' : 'hidden'}>
            <label for="model-endpoint">Local companion
              <input id="model-endpoint" name="modelEndpoint" type="text" value="${escapeHtml(state.agentProvider.endpoint || 'http://127.0.0.1:4174')}" autocomplete="off" spellcheck="false">
            </label>
            <label for="model-token">Pairing token
              <input id="model-token" name="modelToken" type="password" value="${escapeHtml(state.agentProvider.token || '')}" autocomplete="off">
            </label>
            <p class="field-hint">Run <code>npm run model:jev</code> for Jev, or <code>npm run model:bridge</code> for a CLI. Paste the local pairing token here. Provider credentials stay in the companion.</p>
          </div>
          <details class="settings-disclosure"><summary>CAPTCHA images · experimental</summary>
            <label for="captcha-provider">Image model
              <select id="captcha-provider" name="captchaProvider">
                ${[['same', 'Use form runtime'], ['nano', 'Gemini Nano · on-device'], ['codex', 'Codex CLI companion'], ['eve', 'Eve companion · Sol Low']].map(([value, label]) => `<option value="${value}" ${value === (state.agentProvider.captcha?.provider || 'same') ? 'selected' : ''}>${label}</option>`).join('')}
              </select>
            </label>
            <label>Codex image model <input name="captchaModel" value="${escapeHtml(state.agentProvider.captcha?.model || 'gpt-6.1-sol')}" spellcheck="false"></label>
            <label>Image reasoning <select name="captchaReasoning"><option value="low">Low</option><option value="xhigh" ${state.agentProvider.captcha?.reasoning === 'xhigh' ? 'selected' : ''}>Extra High</option></select></label>
            <p class="field-hint">All runtimes share checkbox clicking. Jev and Claude have no image adapter here. Codex/Eve receive only the challenge crop; Eve uses Sol Low. Authorization happens once per attempt in the application card.</p>
          </details>
          <button class="small-button secondary" type="submit">Use this model runtime</button>
        </form>
      </details>`;
  }

  function renderChoice() {
    appRoot.innerHTML = `
      <section>
        <div class="intro">
          <p class="eyebrow">Start here</p>
          <h1>Find your client</h1>
          <p class="lede">Pull up a client’s information, then choose the application to complete. The assistant fills it in and you review every answer.</p>
        </div>
        ${renderError()}
        ${directorySection()}
        <h2 class="section-title">Other ways to start</h2>
        <div class="stack">
          <button class="choice-button" type="button" data-action="choose-details">
            <span class="choice-icon" aria-hidden="true">✎</span>
            <span class="choice-copy"><strong>Enter client details</strong><small>Type them in yourself, or try a sample client.</small></span>
            <span class="chevron" aria-hidden="true">›</span>
          </button>
          <button class="choice-button" type="button" data-action="choose-document">
            <span class="choice-icon" aria-hidden="true">DOC</span>
            <span class="choice-copy"><strong>Upload a document</strong><small>Read details from a PDF, photo or spreadsheet. You check them before they are used.</small></span>
            <span class="chevron" aria-hidden="true">›</span>
          </button>
        </div>
        <h2 class="section-title">Renewals</h2>
        <button class="choice-button" type="button" data-action="open-recertifications">
          <span class="choice-icon" aria-hidden="true">DUE</span>
          <span class="choice-copy"><strong>Renewals due</strong><small>See whose benefits are coming up for renewal and what is still needed.</small></span>
          <span class="chevron" aria-hidden="true">›</span>
        </button>
        <div class="assistant-setup">
          <h2 class="section-title">AI assistant</h2>
          ${renderAgentRuntime()}
        </div>
        <p><button class="link-button" type="button" data-action="show-welcome">How this works and what keeps you in control</button></p>
        <details class="settings-disclosure"><summary>Developer mode</summary>
          <p>Turns on experimental features that are still being tested.</p>
          <p class="runtime-status" role="status">Developer mode is ${state.developerMode ? 'on' : 'off'}.</p>
          <button class="secondary-button" type="button" data-action="toggle-developer-mode" aria-pressed="${state.developerMode ? 'true' : 'false'}">${escapeHtml(state.developerMode ? 'Turn off' : 'Turn on')}</button>
        </details>
      </section>`;
  }

  // The shared planner API settings are hidden for now: the start screen no longer shows them. The whole function is kept
  // below, commented out, so the form can be restored; its handlers ('save-planner', 'disconnect-planner', 'planner-form')
  // are still registered.
  /*
  function renderPlannerSettings() {
    if (previewMode) return '';
    const configured = Boolean(state.plannerBase);
    return `
      <details class="settings-disclosure"><summary>Shared planner API <span class="disclosure-meta">${configured ? 'Configured' : 'Optional'}</span></summary>
      <form id="planner-form" class="stack compact-form">
        <div class="field">
          <label for="nava-api-base">Shared planner API</label>
          <input id="nava-api-base" name="navaApiBase" type="url" inputmode="url" autocomplete="off" placeholder="https://api.example.com" value="${escapeHtml(state.plannerBase || '')}">
          <p class="field-hint">${configured ? 'A tenant key is saved on this device. Changing the API origin requires a new key.' : 'Enter an approved HTTPS API origin and tenant key. The key is saved on this device until disconnected.'}</p>
        </div>
        <div class="field">
          <label for="nava-api-token">Tenant API key</label>
          <input id="nava-api-token" name="navaApiToken" type="password" autocomplete="off" placeholder="${configured ? 'Saved' : 'nava_…'}">
        </div>
        <label class="field-hint"><input id="nava-api-loopback" type="checkbox" ${state.plannerAllowLoopbackHttp ? 'checked' : ''}> Allow HTTP on localhost for development</label>
        <button class="secondary-button" type="button" data-action="save-planner">Use the shared planner</button>
        ${configured ? '<button class="secondary-button" type="button" data-action="disconnect-planner">Disconnect and remove saved tenant key</button>' : ''}
      </form></details>`;
  }
  */

  function renderRecordId() {
    const provider = connectorProvider();
    appRoot.innerHTML = `
    <section>
      <button class="back-button" type="button" data-action="back-choice"><span aria-hidden="true">←</span> Back</button>
      <div class="intro">
        <p class="eyebrow">Client record</p>
        <h1>Let's find your client</h1>
        <p class="lede">Enter the client record ID. We'll pull the record through ${escapeHtml(connectorTitle())}.</p>
      </div>
      ${renderError()}
      <form id="record-form" class="stack">
        <div class="field">
          <label for="record-id">${managedConnector() ? escapeHtml(provider.recordLabel) : 'Fictional demo record ID'}</label>
          <input id="record-id" name="recordId" type="text" autocomplete="off" placeholder="Enter ID" required>
          <p class="field-hint">${managedConnector() ? `Read-only ${escapeHtml(provider.name)} connector · source ${escapeHtml(connectorSourceId())} · ${Object.keys(state.connector.mappings || {}).length} mapped fields` : 'Prototype demo IDs: 339619, 338618, and 339637.'}</p>
        </div>
        <div class="form-actions">
          <button class="primary-button" type="submit">Continue</button>
          <button class="secondary-button" type="button" data-action="choose-details">Enter client details instead</button>
          <button class="link-button" type="button" data-action="configure-connector">Manage data source</button>
        </div>
      </form>
    </section>`;
  }

  const DETAIL_FIELDS = [
    ['firstName', 'First name', 'text', 'given-name', true],
    ['lastName', 'Last name', 'text', 'family-name', true],
    ['dateOfBirth', 'Date of birth', 'date', 'off', false],
    ['phone', 'Phone', 'tel', 'off', false],
    ['email', 'Email', 'email', 'off', false],
    ['addressLine1', 'Street address', 'text', 'off', false],
    ['addressLine2', 'Apartment or unit', 'text', 'off', false],
    ['city', 'City', 'text', 'off', false],
    ['state', 'State', 'text', 'off', false],
    ['postalCode', 'ZIP code', 'text', 'off', false],
  ];

  function renderClientDetails() {
    appRoot.innerHTML = `
    <section>
      <button class="back-button" type="button" data-action="back-choice"><span aria-hidden="true">←</span> Back</button>
      <div class="intro">
        <p class="eyebrow">Client details</p>
        <h1>Enter client details</h1>
        <p class="lede">Type in what you know. Anything you leave blank, the assistant will ask you about. It never guesses.</p>
      </div>
      ${renderError()}
      <h2 class="section-title">Try a sample client</h2>
      <p class="field-hint">Fictional clients for trying things out. Each one shows a different situation.</p>
      <div class="stack">
        ${sampleClients.map((client) => `
        <button class="choice-button" type="button" data-action="use-sample-client" data-id="${encodeURIComponent(client.id)}">
          <span class="choice-icon" aria-hidden="true">${escapeHtml(String(client.label).charAt(0))}</span>
          <span class="choice-copy"><strong>${escapeHtml(client.label)}</strong><small>${escapeHtml(client.description)}</small></span>
          <span class="chevron" aria-hidden="true">›</span>
        </button>`).join('')}
      </div>
      <h2 class="section-title">Or type in a client</h2>
      <form id="details-form" class="stack compact-form">
        ${DETAIL_FIELDS.map(([name, label, type, autocomplete, required]) => `
        <div class="field">
          <label for="detail-${name}">${label}${required ? '' : ' <span class="field-hint">(optional)</span>'}</label>
          <input id="detail-${name}" name="${name}" type="${type}" autocomplete="${autocomplete}" ${required ? 'required' : ''}>
        </div>`).join('')}
        <div class="form-actions">
          <button class="primary-button" type="submit">Continue</button>
        </div>
      </form>
      <details class="settings-disclosure">
        <summary>Advanced: paste a full client record</summary>
        <form id="json-form" class="stack compact-form">
          <p class="field-hint">For a prepared record in JSON format, usually exported from another system.</p>
          <div class="field">
            <label for="client-json">Client record</label>
            <textarea id="client-json" name="clientJson" spellcheck="false" placeholder='{"firstName":"Maria","lastName":"Santos"}' required></textarea>
          </div>
          <button class="secondary-button" type="submit">Use this record</button>
        </form>
      </details>
    </section>`;
  }

  function renderDocumentUpload() {
    const backAction = state.participant ? 'back-programs' : 'back-choice';
    appRoot.innerHTML = `
      <section>
        <button class="back-button" type="button" data-action="${backAction}"><span aria-hidden="true">←</span> Back</button>
        <div class="intro">
          <p class="eyebrow">Document intake</p>
          <h1>Upload a client or business document</h1>
          <p class="lede">The assistant reads the file locally and proposes only clearly labeled fields. You choose what to add before anything is used.</p>
        </div>
        ${renderError()}
        <form id="document-form" class="stack">
          <label class="upload-zone" for="client-document">
            <span class="upload-icon" aria-hidden="true">↑</span>
            <strong>Choose a document</strong>
            <span>PDF, PNG, JPEG, WebP, DOCX, TXT, CSV, TSV, or JSON · up to 15 MB</span>
            <input id="client-document" name="clientDocument" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt,.csv,.tsv,.json,application/pdf,image/png,image/jpeg,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/csv,application/json" required>
          </label>
          <details class="help-disclosure"><summary>How document reading works</summary><p>The raw file stays on this device and is discarded after parsing. Image-only pages use bundled English OCR with page, pixel, attempt, and time limits. Review every proposed value before importing it.</p></details>
          <div class="form-actions">
            <button class="primary-button" type="submit">Read document</button>
            ${state.participant ? '' : '<button class="secondary-button" type="button" data-action="choose-details">Enter details instead</button>'}
          </div>
        </form>
      </section>`;
  }

  /** Page, region, and rotation evidence for a value read by on-device OCR; empty for other extraction methods. */
  function ocrProvenance(field) {
    if (field.source?.method !== 'ocr') return '';
    return `<span class="ocr-provenance">Page ${escapeHtml(field.source.pageNumber)}${field.source.region ? ` · region ${escapeHtml(Math.round(field.source.region.x0))},${escapeHtml(Math.round(field.source.region.y0))}–${escapeHtml(Math.round(field.source.region.x1))},${escapeHtml(Math.round(field.source.region.y1))}` : ''}${field.source.canvas?.rotation ? ` · corrected ${escapeHtml(field.source.canvas.rotation)}° rotation` : ''}</span>`;
  }

  function renderDocumentReview() {
    const result = state.documentResult;
    if (!result) {
      state.view = 'document';
      return renderDocumentUpload();
    }
    const current = clientSummary().values;
    const conflictCount = result.fields.filter((field) => {
      const existing = current[field.key];
      return existing !== undefined && existing !== null && existing !== '' && !sameValue(existing, field.value);
    }).length;
    const lowConfidenceCount = result.fields.filter((field) => field.confidence === 'low').length;
    const methodLabel = {
      ocr: 'On-device OCR',
      mixed: 'Embedded text + OCR',
      'embedded-text': 'Embedded PDF text',
      docx: 'Word document text',
      text: 'Plain text',
      'delimited-text': 'Delimited text',
      structured: 'Structured JSON',
    }[result.quality?.method] || 'Local extraction';
    appRoot.innerHTML = `
    <section>
      <button class="back-button" type="button" data-action="back-document"><span aria-hidden="true">←</span> Back</button>
      <div class="intro">
        <p class="eyebrow">Review extracted details</p>
        <h1>Choose what to add</h1>
        <p class="lede">Nothing is merged until you confirm it. Sensitive identifiers are masked here and on later review screens.</p>
      </div>
      ${renderError()}
      <div class="file-summary">
        <span class="file-badge" aria-hidden="true">DOC</span>
        <span><strong>${escapeHtml(result.file.name)}</strong><small>${escapeHtml(methodLabel)} · ${result.fields.length} proposed ${result.fields.length === 1 ? 'field' : 'fields'}${conflictCount ? ` · ${conflictCount} ${conflictCount === 1 ? 'conflict' : 'conflicts'}` : ''}${lowConfidenceCount ? ` · ${lowConfidenceCount} low confidence` : ''}</small></span>
      </div>
      ${result.warnings.map((warning) => `<div class="notice warning document-warning"><span aria-hidden="true">!</span><span>${escapeHtml(warning)}</span></div>`).join('')}
      ${result.fields.length ? `
        <form id="document-review-form">
          <div class="extraction-list">
            ${result.fields.map((field, index) => {
              const existing = current[field.key];
              const hasExisting = existing !== undefined && existing !== null && existing !== '';
              const conflict = hasExisting && !sameValue(existing, field.value);
              return `
                <label class="extraction-card ${conflict ? 'conflict' : ''} ${field.confidence === 'low' ? 'low-confidence' : ''}">
                  <input type="checkbox" name="fieldIndex" value="${index}" ${conflict || field.confidence === 'low' || field.reviewRequired ? '' : 'checked'}>
                  <span class="extraction-copy">
                    <span class="extraction-heading"><strong>${escapeHtml(field.label)}</strong><span class="confidence-chip ${escapeHtml(field.confidence)}">${escapeHtml(field.confidence)}</span></span>
                    <span class="extracted-value">${escapeHtml(field.displayValue)}</span>
                    <small>${escapeHtml(field.evidence)}</small>
                    ${ocrProvenance(field)}
                    ${field.reviewRequired ? '<span class="conflict-note"><strong>OCR review required:</strong> verify this value in the source before selecting it.</span>' : field.confidence === 'low' ? '<span class="conflict-note"><strong>Low confidence:</strong> verify this value in the source before selecting it.</span>' : ''}
                    ${conflict ? `<span class="conflict-note"><strong>Different from current:</strong> ${escapeHtml(displayValue(field.key, existing))}. Select to replace it.</span>` : ''}
                  </span>
                </label>`;
            }).join('')}
          </div>
          <div class="form-actions">
            <button class="primary-button" type="submit">Use selected details</button>
            <button class="secondary-button" type="button" data-action="back-document">Choose another file</button>
          </div>
        </form>` : `
        <div class="form-actions">
          <button class="primary-button" type="button" data-action="back-document">Choose another file</button>
          <button class="secondary-button" type="button" data-action="choose-details">Enter details instead</button>
        </div>`}
    </section>`;
  }

  function renderPrograms() {
    const client = clientSummary();
    const connectorMeta = state.participant?._connector;
    const tabUrl = state.activeTab?.url || '';
    const currentAllowed = /^https?:/i.test(tabUrl);
    appRoot.innerHTML = `
      <section>
        <button class="back-button" type="button" data-action="${state.apps.length ? 'back-dashboard' : 'change-client'}"><span aria-hidden="true">←</span> ${state.apps.length ? 'Back' : 'Change client'}</button>
        <div class="intro">
          <p class="eyebrow">Applications</p>
          <h1>What should I help with?</h1>
          <p class="lede">Choose this tab or open one of the known application sites. Each application stays in its own tab.</p>
        </div>
        ${renderError()}
        ${renderAgentRuntime()}
        <div class="client-chip">
          <div><strong>${escapeHtml(client.name)}</strong><span>${client.recordId ? `Record ${escapeHtml(client.recordId)}` : state.participant?._documentSources?.length ? 'Document import' : 'Pasted client record'}${connectorMeta ? ` · ${escapeHtml(connectorMeta.organizationName)}` : ''}</span>${connectorMeta ? `<span class="source-freshness ${connectorMeta.stale ? 'stale' : ''}">${connectorMeta.freshness === 'unknown' ? 'Source freshness unavailable' : connectorMeta.stale ? 'Source record may be stale' : `Retrieved ${escapeHtml(formatTimestamp(connectorMeta.retrievedAt))}`}</span>` : ''}</div>
          <div class="client-actions">
            <button class="link-button" type="button" data-action="choose-document">Add document</button>
            <button class="link-button" type="button" data-action="change-client">Change</button>
          </div>
        </div>
        <form id="program-form">
          <p class="section-label">This browser tab</p>
          <div class="program-list">
            <label class="program-option">
              <input type="checkbox" name="program" value="current" ${currentAllowed ? '' : 'disabled'}>
              <span><strong>Analyze this form</strong><small>${escapeHtml(currentAllowed ? hostLabel(tabUrl) : 'Open a website first')}</small></span>
            </label>
          </div>
          <p class="section-label">Known application sites</p>
          <div class="program-list">
            ${programCatalog.PROGRAMS.map((program) => `
              <label class="program-option">
                <input type="checkbox" name="program" value="${escapeHtml(program.id)}">
                <span><strong>${escapeHtml(program.name)}</strong><small>${escapeHtml(program.provider)}${program.workflowId === 'benefitscal' ? ' · combined BenefitsCal application' : ''}</small></span>
              </label>`).join('')}
          </div>
          <p class="field-hint">CalFresh, Medi-Cal, and CalWORKs use one combined BenefitsCal application.</p>
          <div class="form-actions">
            <button class="primary-button" type="submit">Continue</button>
          </div>
        </form>
      </section>`;
  }

  return {
    renderAgentRuntime,
    renderChoice,
    renderRecordId,
    renderClientDetails,
    renderDocumentUpload,
    renderDocumentReview,
    renderPrograms,
  };
}

export { create };
