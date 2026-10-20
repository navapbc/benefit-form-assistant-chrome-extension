// Agentic planner: plans a page with the three model roles (mapper and gap analyst, then an independent reviewer) or the shared gateway, keeping only what the local policy validator accepts.
import { compactText, groupedInventory, planningInventory, redactSourceValues, sourceInventory } from './planner-inventory.mjs';
import {
  ROLE_NAMES, availability, configure, decisionPlan, onReset, prepare, promptRole, reset, runtimeInfo, setBridgeFetchForTests, setRuntimeForTests,
} from './planner-runtime.mjs';
import { siteAdapters } from './engines.mjs';

const root = globalThis;

const jevMemory = new Map();
const GATEWAY_STORAGE_KEYS = ['navaApiBase', 'navaApiToken', 'navaPlanModel', 'navaApiAllowLoopbackHttp'];
const pendingGatewayRequests = new Set();
const GATEWAY_TIMEOUT_MS = 30_000;

function normalizeGatewayBase(value, { allowLoopbackHttp = false } = {}) {
  let url;
  try { url = new URL(String(value || '').trim()); }
  catch { throw new Error('Enter a valid shared API origin, such as https://api.example.com.'); }
  if (url.username || url.password) throw new Error('Do not put credentials in the shared API address.');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(allowLoopbackHttp === true && loopback && url.protocol === 'http:')) {
    throw new Error('Use HTTPS for the shared API. HTTP is allowed only for an explicitly enabled loopback development server.');
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Enter only the shared API origin, without a path, query, or fragment.');
  }
  return url.origin;
}

function normalizeGatewayConfig(input) {
  let url;
  try { url = new URL(String(input?.endpoint || '')); }
  catch { throw new Error('The saved shared API address is invalid. Update or disconnect it.'); }
  if (url.pathname !== '/v1/plan' || url.search || url.hash || url.username || url.password) {
    throw new Error('The saved shared API address is invalid. Update or disconnect it.');
  }
  const base = normalizeGatewayBase(url.origin, input);
  const token = String(input.token || '').trim();
  if (!token || token.length > 4096 || /\s/.test(token)) throw new Error('Paste a valid tenant API key.');
  return { base, endpoint: `${base}/v1/plan`, token, model: input.model, allowLoopbackHttp: input.allowLoopbackHttp === true };
}

function cancelGatewayRequests() {
  pendingGatewayRequests.forEach((controller) => controller.abort());
}

/** @param {{ base?: string, token?: string, allowLoopbackHttp?: boolean }} [config] */
async function saveGatewayConfig({ base, token, allowLoopbackHttp = false } = {}) {
  const origin = normalizeGatewayBase(base, { allowLoopbackHttp });
  const storage = root.chrome?.storage?.local;
  if (!storage?.get || !storage?.set) throw new Error('Shared API settings are unavailable in this browser.');
  const current = await storage.get(GATEWAY_STORAGE_KEYS);
  // Never send an existing key to a newly entered service origin.
  const suppliedToken = String(token || '').trim();
  if (!suppliedToken && origin !== current.navaApiBase) throw new Error('Paste a tenant API key when changing the shared API address.');
  const config = normalizeGatewayConfig({ endpoint: `${origin}/v1/plan`, token: suppliedToken || current.navaApiToken, allowLoopbackHttp });
  cancelGatewayRequests();
  await storage.set({ navaApiBase: origin, navaApiToken: config.token, navaApiAllowLoopbackHttp: config.allowLoopbackHttp });
  return config;
}

async function clearGatewayConfig() {
  cancelGatewayRequests();
  const storage = root.chrome?.storage?.local;
  if (!storage?.remove) throw new Error('Shared API settings are unavailable in this browser.');
  await storage.remove(GATEWAY_STORAGE_KEYS);
}

/**
 * @param {any} input
 * @param {string} path
 * @param {any} body
 * @param {{ signal?: AbortSignal, timeoutMs?: number }} [options]
 */
async function gatewayRequest(input, path, body, { signal, timeoutMs = GATEWAY_TIMEOUT_MS } = {}) {
  const gateway = normalizeGatewayConfig(input);
  if (!/^\/v1\/(?:plan|households|applications(?:\/[^/?#]+\/share)?)$/.test(path)) {
    throw new Error('Unsupported shared API operation.');
  }
  const controller = new AbortController();
  let timedOut = false;
  let timeout;
  const forwardAbort = () => controller.abort();
  const stopped = new Promise((_resolve, reject) => {
    controller.signal.addEventListener('abort', () => {
      reject(new Error(timedOut ? 'The shared API did not respond within the request time limit. Try again.' : 'The shared API request was cancelled.'));
    }, { once: true });
  });
  pendingGatewayRequests.add(controller);
  signal?.addEventListener('abort', forwardAbort, { once: true });
  if (signal?.aborted) controller.abort();
  timeout = setTimeout(() => { timedOut = true; controller.abort(); }, Math.max(1, Math.min(timeoutMs, GATEWAY_TIMEOUT_MS)));
  const request = async () => {
    if (controller.signal.aborted) return stopped;
    let response;
    try {
      response = await root.fetch(`${gateway.base}${path}`, {
        method: 'POST', redirect: 'error', credentials: 'omit', cache: 'no-store', signal: controller.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${gateway.token}` },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error('The shared API could not be reached. Check its address and connection, then try again.');
    }
    if (response.status === 401 || response.status === 403) throw new Error('The shared API rejected the saved tenant key. Update the key or disconnect the API.');
    if (response.status === 429) throw new Error('The shared API request limit was reached. Try again later.');
    if (!response.ok) throw new Error('The shared API could not complete this request. Try again or contact the service administrator.');
    let payload;
    try { payload = await response.json(); }
    catch { throw new Error('The shared API returned an invalid response.'); }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.ok === false) throw new Error('The shared API returned an invalid response.');
    if (controller.signal.aborted) return stopped;
    return payload;
  };
  try { return await Promise.race([stopped, request()]); }
  finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', forwardAbort);
    pendingGatewayRequests.delete(controller);
  }
}

onReset(() => { cancelGatewayRequests(); jevMemory.clear(); });

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

function canonicalPurposes(engine) {
  return new Set(Object.keys(engine.LABELS || {}));
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

// A proposed gap needs a caseworker only for a known, still-empty field that no approved mapping
// can answer from a source on file, and only when it is required, a choice, or a checkbox.
function gapNeedsAnswer(field, purposeOverrides, availablePurposes) {
  if (!field || field.alreadyFilled) return false;
  const mappedPurpose = purposeOverrides[field.fieldKey];
  if (mappedPurpose && availablePurposes.has(mappedPurpose)) return false;
  return field.required || field.options.length > 0 || field.type === 'checkbox';
}

function validateGaps(gaps, fields, sources, purposeOverrides) {
  const availablePurposes = new Set(sources.map((source) => source.purpose));
  const fieldFor = (gap) => fields.find((candidate) => candidate.fieldKey === gap.fieldKey);
  return (gaps.gaps || [])
    .filter((gap) => gapNeedsAnswer(fieldFor(gap), purposeOverrides, availablePurposes))
    .map((gap) => ({
      fieldKey: String(gap.fieldKey),
      question: compactText(gap.question, 280),
      reason: compactText(gap.reason, 280),
    }));
}

async function gatewayConfig() {
  if (root.NAVA_PLAN_GATEWAY?.endpoint && root.NAVA_PLAN_GATEWAY?.token) return normalizeGatewayConfig(root.NAVA_PLAN_GATEWAY);
  const storage = root.chrome?.storage?.local;
  if (!storage?.get) return null;
  const stored = await storage.get(GATEWAY_STORAGE_KEYS);
  const base = String(stored?.navaApiBase || '');
  const token = String(stored?.navaApiToken || '');
  if (!base || !token) return null;
  const origin = normalizeGatewayBase(base, { allowLoopbackHttp: stored.navaApiAllowLoopbackHttp === true });
  return normalizeGatewayConfig({ endpoint: `${origin}/v1/plan`, token, model: stored.navaPlanModel || undefined, allowLoopbackHttp: stored.navaApiAllowLoopbackHttp === true });
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
  const { fields, sources } = planningInventory(args.engine, args.participant, args.rawFields);
  args.onProgress?.({ phase: 'planning', agents: ROLE_NAMES, runtime: 'nava-api' });
  const body = await gatewayRequest(gateway, '/v1/plan', {
    model: gateway.model,
    page: { domain: compactText(args.page?.domain, 160) },
    fields,
    sources,
  }, { signal: args.signal });
  if (!body.ok || !body.plan) throw new Error('The shared planner did not return a plan. No form values were changed.');
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

function trustedSiteInventory(page, rawFields, adapters) {
  let url;
  try { url = new URL(page?.url); } catch { return rawFields || []; }
  return (rawFields || []).map((field) => ({ ...field,
    ...adapters?.fieldPolicy?.(url.hostname, url.pathname, field) }));
}

async function fingerprint(value) {
  const subtle = root.crypto?.subtle;
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

/** @param {{ engine: any, page: any, rawFields: any, participant: any, onProgress?: (update: object) => void, jevRecovery?: any, adapters?: any }} args */
async function planWithJev({ engine, page, rawFields, participant, onProgress, jevRecovery = {}, adapters }) {
  const start = Date.now();
  const policyFields = trustedSiteInventory(page, rawFields, adapters);
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
    const result = await decisionPlan({ domain: compactText(page?.domain, 160), fields: pending, sources, threshold: 0.9 });
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

// A total stays unknown (null) once any role could not report that figure.
function sumKnown(total, value) {
  return total === null || value === null ? null : total + Number(value || 0);
}

function addRoleUsage(summary, item) {
  return {
    prompts: summary.prompts + Number(item.prompts || 0),
    inputCharacters: summary.inputCharacters + Number(item.inputCharacters || 0),
    outputCharacters: summary.outputCharacters + Number(item.outputCharacters || 0),
    contextUsageUnits: sumKnown(summary.contextUsageUnits, item.contextUsageUnits),
    durationMs: summary.durationMs + Number(item.durationMs || 0),
    inputTokens: sumKnown(summary.inputTokens, item.inputTokens),
    outputTokens: sumKnown(summary.outputTokens, item.outputTokens),
    apiCostUsd: 0,
    providerReportedCostUsd: sumKnown(summary.providerReportedCostUsd, item.providerReportedCostUsd),
  };
}

function summarizeUsage(usageEvents) {
  return usageEvents.reduce(addRoleUsage, {
    prompts: 0, inputCharacters: 0, outputCharacters: 0, contextUsageUnits: 0, durationMs: 0,
    inputTokens: 0, outputTokens: 0, apiCostUsd: 0, providerReportedCostUsd: 0,
  });
}

function localPlanMetadata({ mapping, review, validated, usage }) {
  const selected = runtimeInfo();
  const companion = selected.kind === 'local-cli';
  return {
    runtime: companion ? `${selected.provider}-cli-subscription` : 'chrome-gemini-nano',
    mode: companion ? 'localhost-subscription-multi-agent' : 'on-device-multi-agent',
    provider: companion ? selected.provider : 'chrome-local',
    agents: ROLE_NAMES,
    proposedMappings: (mapping.mappings || []).length,
    approvedMappings: validated.approved.length,
    rejectedMappings: validated.rejected.length,
    trustedHintMappings: validated.trustedHintMappings,
    usage,
    billing: companion ? 'subscription-allowance-no-direct-api-key' : 'on-device-no-token-charge',
    reviewedAt: new Date().toISOString(),
    summary: compactText(review.summary, 400),
  };
}

// Roles 1 and 2: the mapper and gap analyst run concurrently, each on its own role queue,
// and neither sees the other's output.
async function proposePlan(page, fields, sources, onProgress) {
  onProgress?.({ phase: 'planning', agents: ['field_mapper', 'gap_analyst'] });
  const [mappingResult, gapResult] = await Promise.all([
    promptRole('field_mapper', mappingPrompt(page, fields, sources), MAPPING_SCHEMA),
    promptRole('gap_analyst', gapPrompt(page, fields, sources), GAP_SCHEMA),
  ]);
  return {
    mapping: parseResult(mappingResult.text, 'field-mapping'),
    gaps: parseResult(gapResult.text, 'gap-analysis'),
    usageEvents: [mappingResult.usage, gapResult.usage],
  };
}

// Role 3: an independent reviewer session judges the proposals after both are complete.
async function reviewProposals(page, fields, sources, proposal, onProgress) {
  onProgress?.({ phase: 'reviewing', agents: ['form_reviewer'] });
  const prompt = reviewPrompt(page, fields, sources, proposal.mapping, proposal.gaps);
  const reviewResult = await promptRole('form_reviewer', prompt, REVIEW_SCHEMA);
  return { review: parseResult(reviewResult.text, 'form-review'), usage: reviewResult.usage };
}

// Orchestration: resolve the runtime, redact the inventory, run the three roles, then keep only
// what the local policy validator accepts.
/** @param {{ engine?: any, page?: any, rawFields?: any[], participant?: any, onProgress?: (update: object) => void, jevRecovery?: any, signal?: AbortSignal, siteAdapters?: any }} [args] */
async function plan({ engine, page, rawFields, participant, onProgress, jevRecovery, signal, siteAdapters: adapters = siteAdapters } = {}) {
  if (!engine?.canonicalizeParticipant || !engine?.buildAnalysis) throw new Error('The form engine is unavailable.');
  if (runtimeInfo().provider === 'jev') return planWithJev({ engine, page, rawFields, participant, onProgress, jevRecovery, adapters });
  const gateway = await gatewayConfig();
  if (gateway) return planThroughGateway({ engine, page, rawFields, participant, onProgress, signal }, gateway);
  await prepare({ onProgress });
  const { fields, sources } = planningInventory(engine, participant, rawFields);
  const proposal = await proposePlan(page, fields, sources, onProgress);
  const { review, usage: reviewUsage } = await reviewProposals(page, fields, sources, proposal, onProgress);
  const validated = validateReview(fields, sources, proposal.mapping, review, canonicalPurposes(engine));
  const usage = summarizeUsage([...proposal.usageEvents, reviewUsage]);
  return {
    ...validated,
    gaps: validateGaps(proposal.gaps, fields, sources, validated.purposeOverrides),
    metadata: localPlanMetadata({ mapping: proposal.mapping, review, validated, usage }),
  };
}

export { availability, configure, gatewayConfig, gatewayRequest, normalizeGatewayBase, saveGatewayConfig, clearGatewayConfig, groupedInventory, plan, prepare, reset, runtimeInfo, setBridgeFetchForTests, setRuntimeForTests };
