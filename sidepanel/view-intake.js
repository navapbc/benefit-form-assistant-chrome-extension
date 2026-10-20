// Client-intake screens: the start choice, model-runtime notice and settings, record ID, JSON import, document upload and review, and the program picker.
(function installIntakeViews(root) {
  'use strict';

  /**
   * deps:
   * - state, appRoot, previewMode: panel state, the screen root, and simulated-preview flag.
   * - format: NavaPanelFormat helpers.
   * - engine: the form engine (value normalization); agentPlanner: the model runtime; programCatalog: known sites.
   * - renderError(), clientSummary(), managedConnector(): shared panel helpers.
   * - renderConnectorStatus(), connectorTitle(), connectorProvider(), connectorSourceId(): connector view helpers.
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
      renderConnectorStatus,
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
      const title = ready ? (state.agentRuntime.shared ? 'Shared planner API configured' : `${info.title} ready`) : unavailable ? `${info.title} unavailable` : 'Agentic AI required';
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
        ${ready ? '' : '<button class="secondary-button" style="margin-bottom:12px" type="button" data-action="enable-agent">Enable agentic AI</button>'}
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
            <p class="eyebrow">Start a form</p>
            <h1>Let's find your client</h1>
            <p class="lede">Start with a record, JSON, or a document.</p>
          </div>
          ${renderError()}
          ${renderAgentRuntime()}
          ${renderConnectorStatus()}
          <div class="stack">
            <button class="choice-button" type="button" data-action="choose-id">
              <span class="choice-icon" aria-hidden="true">ID</span>
              <span class="choice-copy"><strong>Find by record ID</strong><small>Look up a connected client record.</small></span>
              <span class="chevron" aria-hidden="true">›</span>
            </button>
            <button class="choice-button" type="button" data-action="choose-json">
              <span class="choice-icon" aria-hidden="true">{ }</span>
              <span class="choice-copy"><strong>Paste client JSON</strong><small>Use a prepared client record.</small></span>
              <span class="chevron" aria-hidden="true">›</span>
            </button>
            <button class="choice-button" type="button" data-action="choose-document">
              <span class="choice-icon" aria-hidden="true">DOC</span>
              <span class="choice-copy"><strong>Read a document</strong><small>Review extracted details before import.</small></span>
              <span class="chevron" aria-hidden="true">›</span>
            </button>
          </div>
          <button class="recertification-entry" type="button" data-action="open-recertifications">
            <span>Recertification status</span>
            <span class="chevron" aria-hidden="true">›</span>
          </button>
          ${renderPlannerSettings()}
          <details class="help-disclosure"><summary>Data and review safeguards</summary><p>Client values are held in this browser session and excluded from model planning prompts. Managed record lookup uses the configured organization service; provider credentials stay server-side. Sending questions to a client uses the shared API. You review the results and submit the application yourself.</p></details>
        </section>`;
    }

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
            <button class="secondary-button" type="button" data-action="choose-json">Paste client JSON instead</button>
            <button class="link-button" type="button" data-action="configure-connector">Manage data source</button>
          </div>
        </form>
      </section>`;
    }

    function renderJsonImport() {
      appRoot.innerHTML = `
      <section>
        <button class="back-button" type="button" data-action="back-choice"><span aria-hidden="true">←</span> Back</button>
        <div class="intro">
          <p class="eyebrow">Client data</p>
          <h1>Paste the client record</h1>
          <p class="lede">Use labeled JSON fields. The assistant will never guess a missing value.</p>
        </div>
        ${renderError()}
        <form id="json-form" class="stack">
          <div class="field">
            <label for="client-json">Client information</label>
            <textarea id="client-json" name="clientJson" spellcheck="false" placeholder='{"firstName":"Maria","lastName":"Santos"}' required></textarea>
          </div>
          <button class="link-button" type="button" data-action="use-sample">Use a fictional sample record</button>
          <div class="form-actions">
            <button class="primary-button" type="submit">Continue</button>
          </div>
        </form>
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
              ${state.participant ? '' : '<button class="secondary-button" type="button" data-action="choose-json">Paste JSON instead</button>'}
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
            <button class="secondary-button" type="button" data-action="choose-json">Paste JSON instead</button>
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
      renderJsonImport,
      renderDocumentUpload,
      renderDocumentReview,
      renderPrograms,
    };
  }

  const api = { create };

  root.NavaIntakeViews = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
