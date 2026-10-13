(function installAgenticPlanner(root) {
  'use strict';

  const ROLE_NAMES = ['field_mapper', 'gap_analyst', 'form_reviewer'];
  const MODEL_OPTIONS = {
    expectedInputs: [{ type: 'text', languages: ['en'] }],
    expectedOutputs: [{ type: 'text', languages: ['en'] }],
  };

  const MAPPING_SCHEMA = {
    type: 'object',
    properties: {
      mappings: {
        type: 'array',
        maxItems: 120,
        items: {
          type: 'object',
          properties: {
            fieldKey: { type: 'string' },
            purpose: { type: 'string' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            reason: { type: 'string' },
          },
          required: ['fieldKey', 'purpose', 'confidence', 'reason'],
          additionalProperties: false,
        },
      },
    },
    required: ['mappings'],
    additionalProperties: false,
  };

  const GAP_SCHEMA = {
    type: 'object',
    properties: {
      gaps: {
        type: 'array',
        maxItems: 120,
        items: {
          type: 'object',
          properties: {
            fieldKey: { type: 'string' },
            question: { type: 'string' },
            reason: { type: 'string' },
          },
          required: ['fieldKey', 'question', 'reason'],
          additionalProperties: false,
        },
      },
    },
    required: ['gaps'],
    additionalProperties: false,
  };

  const REVIEW_SCHEMA = {
    type: 'object',
    properties: {
      approved: {
        type: 'array',
        maxItems: 120,
        items: {
          type: 'object',
          properties: {
            fieldKey: { type: 'string' },
            purpose: { type: 'string' },
            reason: { type: 'string' },
          },
          required: ['fieldKey', 'purpose', 'reason'],
          additionalProperties: false,
        },
      },
      rejected: {
        type: 'array',
        maxItems: 120,
        items: {
          type: 'object',
          properties: {
            fieldKey: { type: 'string' },
            purpose: { type: 'string' },
            reason: { type: 'string' },
          },
          required: ['fieldKey', 'purpose', 'reason'],
          additionalProperties: false,
        },
      },
      summary: { type: 'string' },
    },
    required: ['approved', 'rejected', 'summary'],
    additionalProperties: false,
  };

  const SYSTEM_PROMPTS = {
    field_mapper: `You are the field-mapping agent in Nava's form-completion system.
Map visible form controls to the supplied canonical source purposes. Work from labels,
questions, types, option text, and exact site hints. Never invent a source purpose.
Never use value shape to reinterpret an identifier. Keep different people and entities
separate. A case number is not a Social Security Number. When uncertain, omit the
mapping. Do not propose submit, signature, certification, CAPTCHA, login, payment, or
one-time-code actions. Return only schema-constrained data.`,
    gap_analyst: `You are the gap-analysis agent in Nava's form-completion system.
Identify visible required fields and decisions that have no safe source mapping. Ask for
the value in plain language. Do not guess eligibility, protected, identity, income,
household, immigration, housing, childcare, unemployment, contact-preference, SSN, or
EIN answers. Do not ask browser or selector questions. Return only schema-constrained
data.`,
    form_reviewer: `You are the independent form-review agent in Nava's form-completion
system. Review another agent's proposed field mappings against the visible field
inventory and the allowlisted source purposes. Approve only mappings supported by the
field's label, question, type, option text, or exact site hint. Reject ambiguity,
repeated-person leakage, identifier substitution, and any mapping to a source purpose
that is unavailable. Do not approve final actions or bot challenges. Return only
schema-constrained data.`,
  };

  let sessions = null;
  let preparingPromise = null;
  let roleChains = Object.fromEntries(ROLE_NAMES.map((role) => [role, Promise.resolve()]));
  let runtimeOverride = null;
  let bridgeFetchOverride = null;
  let providerConfig = { kind: 'chrome-local' };
  const jevMemory = new Map();

  function normalizeBridgeEndpoint(value) {
    let parsed;
    try {
      parsed = new URL(String(value || 'http://127.0.0.1:4174'));
    } catch {
      throw new Error('Enter a valid localhost model-companion address.');
    }
    if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(parsed.hostname) || parsed.username || parsed.password) {
      throw new Error('The subscription model companion must use http://127.0.0.1 or http://localhost.');
    }
    parsed.pathname = parsed.pathname.replace(/\/$/, '');
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  }

  function normalizeProviderConfig(input = {}) {
    const kind = String(input.kind || 'chrome-local');
    if (kind === 'chrome-local') return { kind };
    if (kind !== 'local-cli') throw new Error('Choose a supported model runtime.');
    const provider = String(input.provider || '');
    if (!['codex', 'claude', 'jev'].includes(provider)) throw new Error('Choose Codex, Claude or Jev for the local companion.');
    const token = String(input.token || '').trim();
    if (token.length < 24 || token.length > 512) throw new Error('Paste the pairing token printed by the local model companion.');
    return {
      kind,
      provider,
      endpoint: normalizeBridgeEndpoint(input.endpoint),
      token,
      model: provider === 'jev' ? 'jev-1.13.0' : provider === 'claude' ? compactText(input.model || 'sonnet', 80) : compactText(input.model || '', 120),
    };
  }

  function configure(input = {}) {
    const next = normalizeProviderConfig(input);
    const changed = JSON.stringify(next) !== JSON.stringify(providerConfig);
    if (changed) reset();
    providerConfig = next;
    return runtimeInfo();
  }

  function runtimeInfo() {
    if (providerConfig.kind === 'local-cli') {
      if (providerConfig.provider === 'jev') return {
        kind: 'local-cli', provider: 'jev', model: 'jev-1.13.0', endpoint: providerConfig.endpoint,
        title: 'Jev decision model', detail: 'Jev classifies field purposes through the local companion. Uncertain answers pause for confirmation. The provider key stays outside Chrome.',
      };
      const providerName = providerConfig.provider === 'codex' ? 'Codex CLI' : 'Claude Code';
      return {
        kind: providerConfig.kind,
        provider: providerConfig.provider,
        endpoint: providerConfig.endpoint,
        model: providerConfig.model,
        title: `${providerName} subscription`,
        detail: `${providerName} runs through the paired localhost companion and the signed-in subscription allowance.`,
      };
    }
    return {
      kind: 'chrome-local',
      title: 'Chrome on-device AI',
      detail: 'Three separate Gemini Nano sessions run locally in Chrome.',
    };
  }

  function languageModel() {
    return runtimeOverride || root.LanguageModel || null;
  }

  function bridgeFetch() {
    return bridgeFetchOverride || root.fetch?.bind(root) || null;
  }

  async function bridgeRequest(path, options = {}) {
    const fetcher = bridgeFetch();
    if (!fetcher) throw new Error('This browser cannot connect to the local model companion.');
    let response;
    try {
      response = await fetcher(`${providerConfig.endpoint}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${providerConfig.token}`,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {}),
        },
      });
    } catch {
      throw new Error('The local model companion is not reachable. Start `npm run model:bridge`, then use the pairing token it prints.');
    }
    let payload = {};
    try {
      payload = await response.json();
    } catch {
      // A structured error below is safer than exposing raw companion output.
    }
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || `The local model companion returned HTTP ${response.status}.`);
    }
    return payload;
  }

  function normalizedAvailability(value) {
    const status = String(value || '').toLowerCase();
    if (['available', 'readily'].includes(status)) return 'available';
    if (['downloadable', 'after-download'].includes(status)) return 'downloadable';
    if (status === 'downloading') return 'downloading';
    return 'unavailable';
  }

  async function availability() {
    if (providerConfig.kind === 'local-cli') {
      try {
        const result = await bridgeRequest('/health');
        const provider = result.providers?.[providerConfig.provider];
        return providerConfig.provider === 'jev' ? (provider?.configured ? 'available' : 'unavailable') : (provider?.installed && provider?.subscription ? 'available' : 'unavailable');
      } catch {
        return 'unavailable';
      }
    }
    const model = languageModel();
    if (!model?.availability || !model?.create) return 'unavailable';
    try {
      return normalizedAvailability(await model.availability(MODEL_OPTIONS));
    } catch {
      return 'unavailable';
    }
  }

  async function createSession(role, onProgress) {
    const model = languageModel();
    return model.create({
      ...MODEL_OPTIONS,
      initialPrompts: [{ role: 'system', content: SYSTEM_PROMPTS[role] }],
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', (event) => {
          onProgress?.({ role, phase: 'download', progress: Number(event.loaded || 0) });
        });
      },
    });
  }

  async function prepare({ onProgress } = {}) {
    if (sessions) return { status: 'ready', agents: providerConfig.provider === 'jev' ? ['decision_classifier'] : ROLE_NAMES };
    if (!preparingPromise) {
      preparingPromise = (async () => {
        const status = await availability();
        if (status === 'unavailable') {
          if (providerConfig.kind === 'local-cli') {
            if (providerConfig.provider === 'jev') throw new Error('Jev is unavailable. Start the paired local companion with a TypeSafe test credential and reconnect.');
            throw new Error(`The paired ${providerConfig.provider === 'codex' ? 'Codex CLI' : 'Claude Code'} companion is unavailable. Start \`npm run model:bridge\`, confirm the CLI is signed in with the intended subscription, and reconnect.`);
          }
          throw new Error('The on-device language model is unavailable. Use Chrome 138 or newer on a supported desktop and enable Chrome built-in AI before starting an agentic run.');
        }
        onProgress?.({
          phase: status === 'available' ? 'starting' : 'download',
          progress: 0,
          provider: providerConfig.kind === 'local-cli' ? providerConfig.provider : 'chrome-local',
        });
        if (providerConfig.kind === 'local-cli') {
          sessions = { bridge: true };
        } else {
          const created = await Promise.all(ROLE_NAMES.map(async (role) => [role, await createSession(role, onProgress)]));
          sessions = Object.fromEntries(created);
        }
        onProgress?.({ phase: 'ready', progress: 1 });
        return { status: 'ready', agents: providerConfig.provider === 'jev' ? ['decision_classifier'] : ROLE_NAMES };
      })().finally(() => {
        preparingPromise = null;
      });
    }
    return preparingPromise;
  }

  function promptRole(role, prompt, responseConstraint) {
    const run = roleChains[role]
      .catch(() => undefined)
      .then(async () => {
        if (providerConfig.kind === 'local-cli') {
          const startedAt = Date.now();
          const result = await bridgeRequest('/v1/role', {
            method: 'POST',
            body: JSON.stringify({
              provider: providerConfig.provider,
              model: providerConfig.model,
              role,
              systemPrompt: SYSTEM_PROMPTS[role],
              prompt,
              responseSchema: responseConstraint,
            }),
          });
          const inputTokens = result.usage?.inputTokens;
          const outputTokens = result.usage?.outputTokens;
          const providerReportedCostUsd = result.usage?.providerReportedCostUsd;
          return {
            text: result.text,
            usage: {
              role,
              prompts: 1,
              inputCharacters: prompt.length,
              outputCharacters: String(result.text || '').length,
              inputTokens: inputTokens === null || inputTokens === undefined || !Number.isFinite(Number(inputTokens))
                ? null
                : Number(inputTokens),
              outputTokens: outputTokens === null || outputTokens === undefined || !Number.isFinite(Number(outputTokens))
                ? null
                : Number(outputTokens),
              contextUsageUnits: null,
              contextWindow: null,
              durationMs: Number(result.usage?.durationMs || (Date.now() - startedAt)),
              apiCostUsd: 0,
              providerReportedCostUsd: providerReportedCostUsd !== null
                && providerReportedCostUsd !== undefined
                && Number.isFinite(Number(providerReportedCostUsd))
                ? Number(providerReportedCostUsd)
                : null,
            },
          };
        }
        const session = await sessions[role].clone();
        const startedAt = Date.now();
        const contextUsageBefore = Number.isFinite(Number(session.contextUsage))
          ? Number(session.contextUsage)
          : null;
        try {
          const text = await session.prompt(prompt, { responseConstraint });
          const contextUsageAfter = Number.isFinite(Number(session.contextUsage))
            ? Number(session.contextUsage)
            : null;
          return {
            text,
            usage: {
              role,
              prompts: 1,
              inputCharacters: prompt.length,
              outputCharacters: String(text || '').length,
              contextUsageUnits: contextUsageBefore === null || contextUsageAfter === null
                ? null
                : Math.max(0, contextUsageAfter - contextUsageBefore),
              contextWindow: Number.isFinite(Number(session.contextWindow)) ? Number(session.contextWindow) : null,
              durationMs: Date.now() - startedAt,
              inputTokens: null,
              outputTokens: null,
              apiCostUsd: 0,
              providerReportedCostUsd: null,
            },
          };
        } finally {
          session.destroy();
        }
      });
    roleChains[role] = run.catch(() => undefined);
    return run;
  }

  function compactText(value, limit = 240) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
  }

  function groupedInventory(rawFields) {
    const groups = new Map();
    const singles = [];
    const groupCounts = new Map();
    const idCounts = new Map();
    (rawFields || []).forEach((field) => {
      if (field.id) idCounts.set(field.id, (idCounts.get(field.id) || 0) + 1);
      if (!field.groupKey) return;
      groupCounts.set(field.groupKey, (groupCounts.get(field.groupKey) || 0) + 1);
    });
    (rawFields || []).forEach((field) => {
      const singletonGroup = field.groupKey && groupCounts.get(field.groupKey) === 1;
      const safe = {
        fieldKey: compactText(singletonGroup ? field.fieldKey : (field.groupKey || field.fieldKey), 180),
        identityKey: compactText(!singletonGroup && field.groupKey ? field.groupKey :
          Object.prototype.hasOwnProperty.call(field, 'identityKey') ? (field.identityKey || field.fieldKey) :
            field.id && idCounts.get(field.id) === 1 ? field.id : field.fieldKey, 180),
        type: compactText(field.type, 40),
        label: compactText(field.label),
        question: compactText(field.question),
        required: Boolean(field.required),
        alreadyFilled: Boolean(field.value || field.checked),
        purposeHint: compactText(field.purpose, 100),
        allowRepeatedPurpose: Boolean(field.allowRepeatedPurpose),
        options: [],
      };
      if (!field.groupKey || singletonGroup) {
        safe.options = (field.options || []).slice(0, 80).map((option) => compactText(option.label || option.value, 120));
        singles.push(safe);
        return;
      }
      const existing = groups.get(field.groupKey) || safe;
      existing.required = existing.required || safe.required;
      existing.alreadyFilled = existing.alreadyFilled || safe.alreadyFilled;
      existing.question = existing.question || safe.question;
      existing.purposeHint = existing.purposeHint || safe.purposeHint;
      existing.options.push(compactText(field.optionLabel || field.optionValue || field.label, 120));
      groups.set(field.groupKey, existing);
    });
    const inventory = [...singles, ...groups.values()]
      .slice(0, 80)
      .map((field) => ({ ...field, options: [...new Set(field.options)].filter(Boolean).slice(0, 30) }));
    while (JSON.stringify(inventory).length > 24_000) {
      const optionField = [...inventory]
        .filter((field) => field.options.length > 2)
        .sort((left, right) => right.options.length - left.options.length)[0];
      if (optionField) optionField.options.pop();
      else if (inventory.length > 1) inventory.pop();
      else break;
    }
    return inventory;
  }

  function sourceInventory(engine, participant) {
    const values = engine.canonicalizeParticipant(participant || {}).values;
    return Object.entries(values)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([purpose, value]) => ({
        purpose,
        label: engine.LABELS[purpose] || purpose,
        kind: Array.isArray(value) ? 'list' : typeof value,
        sensitive: /ssn|social security|ein/i.test(`${purpose} ${engine.LABELS[purpose] || ''}`),
      }));
  }

  function redactSourceValues(engine, participant, fields) {
    const values = engine.canonicalizeParticipant(participant || {}).values;
    const terms = Object.values(values)
      .flatMap((value) => Array.isArray(value) ? value : [value])
      .map((value) => String(value ?? '').trim())
      .filter((value) => value.length >= 4)
      .sort((left, right) => right.length - left.length);
    const redact = (text) => terms.reduce((result, term) =>
      result.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '[source value]'), String(text || ''));
    return fields.map((field) => ({
      ...field,
      label: redact(field.label),
      question: redact(field.question),
      options: field.options.map(redact),
    }));
  }

  function parseResult(text, label) {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`The ${label} agent returned an unreadable plan. No form values were changed.`);
    }
  }

  function mappingPrompt(page, fields, sources) {
    return JSON.stringify({
      task: 'Map each safely understood form field to one available source purpose. Omit uncertain mappings.',
      page: { domain: compactText(page?.domain, 160) },
      availableSources: sources,
      fields,
    });
  }

  function gapPrompt(page, fields, sources) {
    return JSON.stringify({
      task: 'Find required fields or explicit decisions that lack a safe available source. Ask plain-language questions only for those gaps.',
      page: { domain: compactText(page?.domain, 160) },
      availableSourcePurposes: sources.map((source) => source.purpose),
      fields,
    });
  }

  function reviewPrompt(page, fields, sources, mapping, gaps) {
    return JSON.stringify({
      task: 'Independently approve or reject every proposed mapping. Approved pairs must exactly reuse a proposed fieldKey and purpose.',
      page: { domain: compactText(page?.domain, 160) },
      availableSources: sources,
      fields,
      proposedMappings: mapping.mappings || [],
      proposedGaps: gaps.gaps || [],
    });
  }

  function validateReview(fields, sources, mapping, review, allowedPurposes) {
    const fieldKeys = new Set(fields.map((field) => field.fieldKey));
    const sourceKeys = new Set(sources.map((source) => source.purpose));
    const proposed = new Map((mapping.mappings || []).map((item) => [`${item.fieldKey}\u0000${item.purpose}`, item]));
    const purposeOverrides = {};
    const approved = [];
    const rejected = [...(review.rejected || [])];

    (review.approved || []).forEach((item) => {
      const fieldKey = String(item.fieldKey || '');
      const purpose = String(item.purpose || '');
      const pair = `${fieldKey}\u0000${purpose}`;
      const proposal = proposed.get(pair);
      if (!fieldKeys.has(fieldKey) || !sourceKeys.has(purpose) || !proposal || proposal.confidence === 'low' || purposeOverrides[fieldKey]) {
        rejected.push({ fieldKey, purpose, reason: 'The local policy validator rejected an unknown, unavailable, unproposed, low-confidence, or duplicate mapping.' });
        return;
      }
      purposeOverrides[fieldKey] = purpose;
      approved.push({ fieldKey, purpose, reason: compactText(item.reason, 280) });
    });
    let trustedHintMappings = 0;
    fields.forEach((field) => {
      const fieldKey = String(field.fieldKey || '');
      const purpose = String(field.purposeHint || '');
      if (!fieldKey || !purpose || purposeOverrides[fieldKey] || !allowedPurposes.has(purpose)) return;
      purposeOverrides[fieldKey] = purpose;
      trustedHintMappings += 1;
      approved.push({
        fieldKey,
        purpose,
        reason: sourceKeys.has(purpose)
          ? 'Approved by the versioned site adapter and limited to an available source purpose.'
          : 'Approved by the versioned site adapter so the missing source answer becomes an explicit gap.',
        source: 'site-adapter',
      });
    });
    return { purposeOverrides, approved, rejected, trustedHintMappings };
  }

  async function gatewayConfig() {
    if (root.NAVA_PLAN_GATEWAY?.endpoint && root.NAVA_PLAN_GATEWAY?.token) return root.NAVA_PLAN_GATEWAY;
    const storage = root.chrome?.storage?.local;
    if (!storage?.get) return null;
    const stored = await storage.get(['navaApiBase', 'navaApiToken', 'navaPlanModel']);
    const base = String(stored?.navaApiBase || '').replace(/\/$/, '');
    const token = String(stored?.navaApiToken || '');
    if (!base || !token) return null;
    return { endpoint: `${base}/v1/plan`, token, model: stored.navaPlanModel || undefined };
  }

  function clampGatewayPlan(plan, fields, sources, allowedPurposes) {
    const fieldKeys = new Set(fields.map((field) => field.fieldKey));
    const sourceKeys = new Set(sources.map((source) => source.purpose));
    const purposeOverrides = {};
    const approved = [];
    const rejected = [...(plan.rejected || [])];
    Object.entries(plan.purposeOverrides || {}).forEach(([fieldKey, purpose]) => {
      const fromAdapter = (plan.approved || []).some((item) => item.fieldKey === fieldKey && item.purpose === purpose && item.source === 'site-adapter');
      if (!fieldKeys.has(fieldKey) || !allowedPurposes.has(purpose) || (!sourceKeys.has(purpose) && !fromAdapter)) {
        rejected.push({
          fieldKey,
          purpose: String(purpose || ''),
          reason: 'The extension rejected a gateway mapping that was outside the inventory, the canonical purposes, or the sources on file.',
        });
        return;
      }
      purposeOverrides[fieldKey] = purpose;
      approved.push({ fieldKey, purpose, reason: 'Accepted from the shared planner after a local check.' });
    });
    const gaps = (plan.gaps || []).filter((gap) => fieldKeys.has(gap.fieldKey) && !purposeOverrides[gap.fieldKey]);
    return { ...plan, purposeOverrides, approved, rejected, gaps };
  }

  async function planThroughGateway(args, gateway) {
    const fields = redactSourceValues(args.engine, args.participant, groupedInventory(args.rawFields));
    const sources = sourceInventory(args.engine, args.participant);
    args.onProgress?.({ phase: 'planning', agents: ROLE_NAMES, runtime: 'nava-api' });
    const response = await fetch(gateway.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${gateway.token}`,
      },
      body: JSON.stringify({
        model: gateway.model,
        page: { domain: compactText(args.page?.domain, 160) },
        fields,
        sources,
      }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok || !body.plan) {
      throw new Error(body?.error || 'The shared planner did not return a plan. No form values were changed.');
    }
    const clamped = clampGatewayPlan(
      body.plan,
      fields,
      sources,
      new Set(Object.keys(args.engine.LABELS || {})),
    );
    return {
      ...clamped,
      metadata: {
        ...(body.plan.metadata || {}),
        runtime: body.plan.metadata?.runtime || 'nava-api',
        mode: 'shared-engine',
      },
    };
  }

  function trustedSiteInventory(page, rawFields) {
    const adapters = root.NavaSiteAdapters || (typeof require === 'function' ? require('./site-adapters.js') : null);
    let url;
    try { url = new URL(page?.url); } catch { return rawFields || []; }
    return (rawFields || []).map((field) => ({ ...field,
      ...adapters?.fieldPolicy?.(url.hostname, url.pathname, field) }));
  }

  async function fingerprint(value) {
    const subtle = root.crypto?.subtle || (typeof require === 'function' ? require('node:crypto').webcrypto.subtle : null);
    if (!subtle) return null;
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  function zeroJevUsage() {
    return { prompts: 0, inputTokens: 0, outputTokens: 0, contextUsageUnits: null, durationMs: 0,
      apiCostUsd: 0, providerReportedCostUsd: null, estimatedApiCostUsd: 0 };
  }

  function addJevUsage(before, after = {}) {
    const sumKnown = (key) => Number.isFinite(before[key]) && Number.isFinite(after[key]) ? before[key] + after[key] : null;
    return { ...before, prompts: before.prompts + Number(after.prompts || 0), durationMs: before.durationMs + Number(after.durationMs || 0),
      inputTokens: sumKnown('inputTokens'), outputTokens: sumKnown('outputTokens'), apiCostUsd: sumKnown('apiCostUsd'),
      providerReportedCostUsd: sumKnown('providerReportedCostUsd'), estimatedApiCostUsd: sumKnown('estimatedApiCostUsd') };
  }

  async function planWithJev({ engine, page, rawFields, participant, onProgress, jevRecovery = {} }) {
    const start = Date.now();
    const policyFields = trustedSiteInventory(page, rawFields);
    const fields = redactSourceValues(engine, participant, groupedInventory(policyFields));
    const sources = sourceInventory(engine, participant);
    const available = new Set(sources.map((source) => source.purpose));
    const finalField = (field) => /captcha|signature|submit|certif|affirm|one.time.code|password|login|payment/i.test(`${field.fieldKey} ${field.label} ${field.question}`);
    const scopedIdentifier = (field) => /other|another|household member|spouse|child|employer/i.test(`${field.label} ${field.question}`)
      && /ssn|social security/i.test(`${field.label} ${field.question}`);
    const rawFor = (key) => policyFields.find((field) => field.fieldKey === key || field.groupKey === key);
    const applicability = new Map(fields.map((field) => [field.fieldKey, engine.fieldApplicability?.(rawFor(field.fieldKey) || {}, participant) || { state: 'applicable' }]));
    const safe = { purposeOverrides: {}, approved: [], gaps: [], rejected: [], deferred: [], notApplicable: [] };
    const approve = (field, purpose, approval) => {
      safe.purposeOverrides[field.fieldKey] = purpose;
      safe.approved.push({ ...approval, fieldKey: field.fieldKey, purpose });
    };
    const scope = page?.url && page?.documentId && jevRecovery.retainVerified !== false
      ? await fingerprint([page.url, page.documentId, engine.canonicalizeParticipant(participant).values]) : null;
    const fieldHashes = new Map(await Promise.all(fields.map(async ({ alreadyFilled, fieldKey, ...field }) => [field.identityKey, await fingerprint([
      field, policyFields.filter(raw => raw.fieldKey === fieldKey || raw.groupKey === fieldKey).map(raw => ({
        type: raw.type, id: raw.id, name: raw.name, required: raw.required, maxLength: raw.maxLength, pattern: raw.pattern,
        purpose: raw.purpose, applicability: raw.applicability, addressFormat: raw.addressFormat,
        optionValue: ['radio', 'checkbox'].includes(raw.type) ? raw.optionValue : undefined, options: raw.options,
      })),
    ])])));
    const previous = scope ? jevMemory.get(scope) : null;
    let retained = 0, trusted = 0, initialApproved = 0, retryApproved = 0, retries = 0;
    if (previous && Date.now() - previous.at < 300_000) {
      const candidateOverrides = Object.fromEntries(fields.filter(field => previous.entries.has(field.identityKey))
        .map(field => [field.fieldKey, previous.entries.get(field.identityKey).purpose]));
      const matches = engine.buildAnalysis(policyFields, participant, { purposeOverrides: candidateOverrides, requirePurposeOverrides: true });
      const verified = new Set(matches.observed.filter((item) => item.matchesRecord === true).map((item) => item.fieldKey));
      fields.forEach((field) => {
        const approval = previous.entries.get(field.identityKey);
        if (verified.has(field.fieldKey) && approval && available.has(approval.purpose) && !scopedIdentifier(field)
          && !finalField(field) && applicability.get(field.fieldKey)?.state === 'applicable'
          && (!field.purposeHint || field.purposeHint === approval.purpose) && previous.fieldHashes.get(field.identityKey) === fieldHashes.get(field.identityKey)) {
          approve(field, approval.purpose, { ...approval, source: 'verified-cache', originalSource: approval.originalSource || approval.source });
          retained += 1;
        }
      });
    }
    const eligible = fields.filter((field) => {
      if (finalField(field)) return false;
      const status = applicability.get(field.fieldKey);
      if (status.state === 'inapplicable') { safe.notApplicable.push({ fieldKey: field.fieldKey, reason: status.reason, source: 'site-rule' }); return false; }
      return status.state === 'applicable' && !safe.purposeOverrides[field.fieldKey];
    });
    let usage = zeroJevUsage(), metadata = {};
    const retryable = new Set();
    const classify = async (pending, retry) => {
      if (!pending.length) return;
      onProgress?.({ phase: retry ? 'recovering' : 'planning', agents: ['decision_classifier'], runtime: 'jev' });
      const result = await bridgeRequest('/v1/decision-plan', { method: 'POST', body: JSON.stringify({ domain: compactText(page?.domain, 160), fields: pending, sources, threshold: 0.9 }) });
      if (!result.plan || result.plan.metadata?.reportedModel !== 'jev-1.13.0') throw new Error('The companion did not return the pinned Jev plan. No form values were changed.');
      metadata = result.plan.metadata;
      usage = addJevUsage(usage, metadata.usage);
      (result.plan.deferred || []).forEach((key) => { if (pending.some((field) => field.fieldKey === key)) retryable.add(key); });
      safe.rejected.push(...(result.plan.rejected || []).filter((item) => pending.some((field) => field.fieldKey === item.fieldKey)));
      pending.forEach((field) => {
        const purpose = result.plan.purposeOverrides?.[field.fieldKey];
        const approval = result.plan.approved?.find((item) => item.fieldKey === field.fieldKey && item.purpose === purpose);
        if (available.has(purpose) && approval && Number.isFinite(approval.confidence) && approval.confidence >= 0.9 && approval.confidence <= 1
          && !scopedIdentifier(field) && (!field.purposeHint || purpose === field.purposeHint)) {
          approve(field, purpose, { ...approval, source: retry ? 'jev-retry' : 'jev' });
          if (retry) retryApproved += 1; else initialApproved += 1;
        } else if (purpose) {
          retryable.add(field.fieldKey);
          safe.rejected.push({ fieldKey: field.fieldKey, reason: 'The extension rejected an unsupported, conflicting or low-confidence mapping.', pass: retry ? 'retry' : 'initial' });
        }
      });
    };
    if (eligible.length) { await prepare({ onProgress }); await classify(eligible, false); }
    // A versioned adapter is a deterministic playbook. Its recovery is never credited to Jev.
    if (jevRecovery.trustedHints !== false) {
      let url;
      try { url = new URL(page?.url); } catch {}
      const adapters = root.NavaSiteAdapters || (typeof require === 'function' ? require('./site-adapters.js') : null);
      eligible.forEach((field) => {
        const raw = rawFor(field.fieldKey);
        const policy = url && adapters?.fieldPolicy?.(url.hostname, url.pathname, raw || {});
        if (!safe.purposeOverrides[field.fieldKey] && policy?.purpose && policy.purpose === field.purposeHint
          && available.has(policy.purpose) && !scopedIdentifier(field)) {
          approve(field, policy.purpose, { source: 'site-rule', confidence: null, policy: 'site-adapter-v0.15', reason: 'Exact site adapter and an available source purpose; local deterministic recovery.' });
          trusted += 1;
        }
      });
    }
    const retryFields = eligible.filter((field) => !safe.purposeOverrides[field.fieldKey] && retryable.has(field.fieldKey) && !scopedIdentifier(field)
      && (!field.purposeHint || available.has(field.purposeHint)));
    // One smaller-inventory retry. Missing answers and entity-scope conflicts cannot be fixed by looping.
    if (retryFields.length && jevRecovery.retry !== false) { retries = 1; await classify(retryFields, true); }
    fields.forEach((field) => {
      if (finalField(field) || safe.purposeOverrides[field.fieldKey] || applicability.get(field.fieldKey)?.state === 'inapplicable') return;
      if (field.required || field.purposeHint || ['checkbox', 'radio', 'select-one'].includes(field.type) || applicability.get(field.fieldKey)?.state === 'unknown') {
        safe.gaps.push({ fieldKey: field.fieldKey, question: applicability.get(field.fieldKey)?.state === 'unknown'
          ? applicability.get(field.fieldKey).reason : (field.question || field.label || 'What answer belongs here?'), reason: 'No verified source mapping after bounded recovery.' });
        safe.deferred.push(field.fieldKey);
      }
    });
    if (scope) {
      const entries = new Map(safe.approved.map(approval => [fields.find(field => field.fieldKey === approval.fieldKey).identityKey, approval]));
      jevMemory.set(scope, { at: Date.now(), entries, fieldHashes });
      while (jevMemory.size > 16) jevMemory.delete(jevMemory.keys().next().value);
    }
    safe.metadata = { ...metadata, runtime: 'jev-typesafe-local-companion', provider: 'jev', requestedModel: 'jev-1.13.0',
      reportedModel: usage.prompts ? 'jev-1.13.0' : null, reasoningEffort: null, confidenceThreshold: 0.9,
      mode: 'cloud-decision-with-bounded-local-recovery', agents: usage.prompts ? ['decision_classifier'] : [], independentModelReview: false,
      approvedMappings: safe.approved.length, rejectedMappings: safe.rejected.length, deferredControls: safe.deferred.length,
      initialModelApprovedMappings: initialApproved, retryModelApprovedMappings: retryApproved, recoveryPasses: retries,
      trustedHintMappings: trusted, retainedVerifiedMappings: retained, inapplicableControls: safe.notApplicable.length,
      usage, planningWallMs: Date.now() - start, summary: 'Jev decisions, deterministic site recovery and verified DOM reuse are counted separately. Missing answers still pause.' };
    return safe;
  }

  async function plan({ engine, page, rawFields, participant, onProgress, jevRecovery } = {}) {
    if (!engine?.canonicalizeParticipant || !engine?.buildAnalysis) throw new Error('The form engine is unavailable.');
    if (providerConfig.kind === 'local-cli' && providerConfig.provider === 'jev') {
      return planWithJev({ engine, page, rawFields, participant, onProgress, jevRecovery });

    }
    const gateway = await gatewayConfig();
    if (gateway) return planThroughGateway({ engine, page, rawFields, participant, onProgress }, gateway);
    await prepare({ onProgress });
    const fields = redactSourceValues(engine, participant, groupedInventory(rawFields));
    const sources = sourceInventory(engine, participant);
    onProgress?.({ phase: 'planning', agents: ['field_mapper', 'gap_analyst'] });
    const [mappingResult, gapResult] = await Promise.all([
      promptRole('field_mapper', mappingPrompt(page, fields, sources), MAPPING_SCHEMA),
      promptRole('gap_analyst', gapPrompt(page, fields, sources), GAP_SCHEMA),
    ]);
    const mapping = parseResult(mappingResult.text, 'field-mapping');
    const gaps = parseResult(gapResult.text, 'gap-analysis');
    onProgress?.({ phase: 'reviewing', agents: ['form_reviewer'] });
    const reviewResult = await promptRole(
      'form_reviewer',
      reviewPrompt(page, fields, sources, mapping, gaps),
      REVIEW_SCHEMA,
    );
    const review = parseResult(reviewResult.text, 'form-review');
    const validated = validateReview(fields, sources, mapping, review, new Set(Object.keys(engine.LABELS || {})));
    const availablePurposes = new Set(sources.map((source) => source.purpose));
    const validatedGaps = (gaps.gaps || []).filter((gap) => {
      const field = fields.find((candidate) => candidate.fieldKey === gap.fieldKey);
      const mappedPurpose = validated.purposeOverrides[field?.fieldKey];
      return field
        && !field.alreadyFilled
        && !(mappedPurpose && availablePurposes.has(mappedPurpose))
        && (field.required || field.options.length > 0 || field.type === 'checkbox');
    }).map((gap) => ({
      fieldKey: String(gap.fieldKey),
      question: compactText(gap.question, 280),
      reason: compactText(gap.reason, 280),
    }));
    const usageEvents = [mappingResult.usage, gapResult.usage, reviewResult.usage];
    const usage = usageEvents.reduce((summary, item) => ({
      prompts: summary.prompts + Number(item.prompts || 0),
      inputCharacters: summary.inputCharacters + Number(item.inputCharacters || 0),
      outputCharacters: summary.outputCharacters + Number(item.outputCharacters || 0),
      contextUsageUnits: item.contextUsageUnits === null || summary.contextUsageUnits === null
        ? null
        : summary.contextUsageUnits + Number(item.contextUsageUnits || 0),
      durationMs: summary.durationMs + Number(item.durationMs || 0),
      inputTokens: item.inputTokens === null || summary.inputTokens === null
        ? null
        : summary.inputTokens + Number(item.inputTokens || 0),
      outputTokens: item.outputTokens === null || summary.outputTokens === null
        ? null
        : summary.outputTokens + Number(item.outputTokens || 0),
      apiCostUsd: 0,
      providerReportedCostUsd: item.providerReportedCostUsd === null || summary.providerReportedCostUsd === null
        ? null
        : summary.providerReportedCostUsd + Number(item.providerReportedCostUsd || 0),
    }), {
      prompts: 0,
      inputCharacters: 0,
      outputCharacters: 0,
      contextUsageUnits: 0,
      durationMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      apiCostUsd: 0,
      providerReportedCostUsd: 0,
    });
    const companion = providerConfig.kind === 'local-cli';
    return {
      ...validated,
      gaps: validatedGaps,
      metadata: {
        runtime: companion ? `${providerConfig.provider}-cli-subscription` : 'chrome-gemini-nano',
        mode: companion ? 'localhost-subscription-multi-agent' : 'on-device-multi-agent',
        provider: companion ? providerConfig.provider : 'chrome-local',
        agents: ROLE_NAMES,
        proposedMappings: (mapping.mappings || []).length,
        approvedMappings: validated.approved.length,
        rejectedMappings: validated.rejected.length,
        trustedHintMappings: validated.trustedHintMappings,
        usage,
        billing: companion ? 'subscription-allowance-no-direct-api-key' : 'on-device-no-token-charge',
        reviewedAt: new Date().toISOString(),
        summary: compactText(review.summary, 400),
      },
    };
  }

  function reset() {
    jevMemory.clear();
    if (sessions) Object.values(sessions).forEach((session) => session?.destroy?.());
    sessions = null;
    preparingPromise = null;
    roleChains = Object.fromEntries(ROLE_NAMES.map((role) => [role, Promise.resolve()]));
  }

  function setRuntimeForTests(runtime) {
    reset();
    providerConfig = { kind: 'chrome-local' };
    runtimeOverride = runtime;
  }

  function setBridgeFetchForTests(fetcher) {
    reset();
    bridgeFetchOverride = fetcher;
  }

  const api = {
    availability,
    configure,
    gatewayConfig,
    groupedInventory,
    plan,
    prepare,
    reset,
    runtimeInfo,
    setBridgeFetchForTests,
    setRuntimeForTests,
  };
  root.NavaAgenticPlanner = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
