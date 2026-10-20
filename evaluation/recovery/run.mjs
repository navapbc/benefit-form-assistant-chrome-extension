// Real Jev API via a protected companion. Simulated writes to frozen inventories, not live DOM.
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { cases } from './cases.mjs';
const require = createRequire(import.meta.url);
const current = { engine: require('../../shared/form-engine.js'), planner: require('../../shared/agentic-planner.mjs'), adapters: require('../../shared/site-adapters.js') };
const baseline = { engine: require('./source/v014-engine.cjs'), planner: require('./source/v014-planner.cjs'), adapters: require('./source/v014-adapters.cjs') };
const variants = [
  { id: 'v014-baseline', modules: baseline },
  { id: 'v015-retry-only', modules: current, options: { trustedHints: false } },
  { id: 'v015-default', modules: current },
];
const token = process.env.NAVA_MODEL_BRIDGE_TOKEN;
if (!token) throw new Error('Provide the protected companion pairing token through the process environment.');
const out = resolve(process.env.NAVA_RECOVERY_OUTPUT || 'evaluation/local-results/jev-recovery.json');
try { await access(out); throw new Error('Choose a new output file; previous attempts are immutable.'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
await mkdir(resolve(out, '..'), { recursive: true });
const sha = text => createHash('sha256').update(text).digest('hex');
const sourceHashes = {};
for (const path of ['shared/agentic-planner.mjs', 'shared/form-engine.js', 'shared/site-adapters.js', 'sidepanel/sidepanel.js', 'evaluation/recovery/cases.mjs', 'evaluation/recovery/run.mjs']) sourceHashes[path] = sha(await readFile(path));
function analysisFunction(text, engine) {
  const source = text.slice(text.indexOf('  function gapFromAgent('), text.indexOf('  async function scanTab('));
  const context = { engine }; vm.runInNewContext(`${source}\nresult = analysisFromAgentPlan;`, context); return context.result;
}
const analysisCurrent = analysisFunction(await readFile('sidepanel/sidepanel.js', 'utf8'), current.engine);
const analysisBaseline = analysisFunction(await readFile('evaluation/recovery/source/v014-sidepanel.js', 'utf8'), baseline.engine);
function applyInventory(fields, assignments) {
  for (const assignment of assignments) {
    const members = fields.filter(f => f.groupKey === assignment.fieldKey);
    const single = fields.find(f => f.fieldKey === assignment.fieldKey);
    if (members.length > 1) members.forEach(f => { f.checked = String(f.optionValue || f.optionLabel).toLowerCase() === String(assignment.value).toLowerCase(); });
    else if (single?.type === 'checkbox') single.checked = /^(yes|true|1|on)$/i.test(assignment.value);
    else if (single) single.value = assignment.value;
  }
}
function observedValue(fields, key) {
  const members = fields.filter(f => f.groupKey === key);
  if (members.length > 1) { const selected = members.find(f => f.checked); return selected?.optionValue || selected?.optionLabel || ''; }
  const f = fields.find(f => f.fieldKey === key);
  return f?.type === 'checkbox' ? (f.checked ? 'yes' : 'no') : (f?.value || '');
}
function quality(c, fields, analysis) {
  const checks = Object.entries(c.expectedValues).map(([fieldKey, expectedValue]) => ({ fieldKey, correct: String(observedValue(fields, fieldKey)).trim().toLowerCase() === expectedValue.trim().toLowerCase() }));
  const actualGaps = new Set(analysis.gaps.map(g => g.fieldKey));
  const expectedGaps = new Set(c.expectedGaps);
  const errors = [
    ...checks.filter(check => !check.correct).map(check => ({ code: 'incorrect-or-unfilled-answer', fieldKey: check.fieldKey })),
    ...[...actualGaps].filter(key => !expectedGaps.has(key)).map(fieldKey => ({ code: 'false-question', fieldKey })),
    ...c.expectedGaps.filter(key => !actualGaps.has(key)).map(fieldKey => ({ code: 'missing-question', fieldKey })),
    ...c.expectedBlank.filter(key => observedValue(fields, key) !== '').map(fieldKey => ({ code: 'inapplicable-or-final-filled', fieldKey })),
  ];
  return { correctAnswers: checks.filter(check => check.correct).length, expectedAnswers: checks.length,
    expectedGaps: c.expectedGaps, actualGaps: [...actualGaps], errors,
    safeCasePass: errors.length === 0, correctCompleteInventory: c.completeSource && errors.length === 0 && analysis.gaps.length === 0,
    completeSource: c.completeSource, wholeApplicationCompletion: null };
}
function usage(plans) {
  const rows = plans.map(p => p.metadata.usage || {});
  const sum = key => rows.every(row => Number.isFinite(row[key])) ? rows.reduce((total, row) => total + row[key], 0) : null;
  return { prompts: rows.reduce((total, row) => total + Number(row.prompts || 0), 0), inputTokens: sum('inputTokens'), outputTokens: sum('outputTokens'),
    modelDurationMs: sum('durationMs'), estimatedApiCostUsd: sum('estimatedApiCostUsd'), providerReportedCostUsd: sum('providerReportedCostUsd'), apiCostUsd: sum('apiCostUsd') };
}
const attempts = [];
const report = { schema: 'nava.jev-recovery.v1', scope: 'Real model calls; frozen field inventories with simulated writes and product analysis. No installed browser, CAPTCHA or application submission.',
  model: 'jev-1.13.0', reasoningEffort: null, confidenceThreshold: 0.9, baselineCommit: 'c902e39', sourceHashes,
  assistanceCount: 0, liveDomExecution: false, captchaAttempts: 0, attempts };
for (const c of cases) for (const repeat of [1, 2]) {
  // Counterbalance order: repeat two reverses variants. Every job gets a fresh document/cache.
  const order = repeat === 1 ? variants : [...variants].reverse();
  for (const variant of order) {
    const id = `${c.id}-${variant.id}-r${repeat}`, startedAt = new Date().toISOString(), start = performance.now();
    const { engine, planner, adapters } = variant.modules;
    planner.reset(); planner.configure({ kind: 'local-cli', provider: 'jev', endpoint: process.env.NAVA_MODEL_BRIDGE_URL || 'http://127.0.0.1:4174', token });
    const url = new URL(c.url);
    const fields = structuredClone(c.rawFields).map(f => ({ ...f, ...adapters.fieldPolicy(url.hostname, url.pathname, f) }));
    const page = { url: c.url, domain: url.hostname, documentId: id };
    const plans = []; let finalAnalysis;
    try {
      const analyze = variant.modules === baseline ? analysisBaseline : analysisCurrent;
      // Exactly two scans, matching the v0.14 live form protocol, with writes/readback represented in the inventory.
      for (const scan of [1, 2]) {
        const plan = await planner.plan({ engine, page, rawFields: fields, participant: c.participant, jevRecovery: variant.options });
        plans.push(plan);
        finalAnalysis = analyze({ fields }, c.participant, plan);
        if (scan === 1) applyInventory(fields, finalAnalysis.assignments);
      }
      const result = quality(c, fields, finalAnalysis);
      attempts.push({ id, caseId: c.id, site: c.site, variant: variant.id, repeat, startedAt, status: 'completed', wallSeconds: (performance.now() - start) / 1000,
        ...result, usage: usage(plans), scans: plans.map((p, i) => ({ scan: i + 1, metadata: p.metadata,
          approved: p.approved.map(a => ({ fieldKey: a.fieldKey, purpose: a.purpose, confidence: a.confidence ?? null, source: a.source || 'jev', originalSource: a.originalSource || null })),
          rejected: p.rejected, deferred: p.deferred || [], gaps: p.gaps.map(g => ({ fieldKey: g.fieldKey })) })),
        assistanceCount: 0, browserDomExecution: false, captchaCompleted: null });
    } catch (e) {
      attempts.push({ id, caseId: c.id, site: c.site, variant: variant.id, repeat, startedAt, status: 'failed', wallSeconds: (performance.now() - start) / 1000,
        safeCasePass: false, error: String(e.message), usage: usage(plans), remainingUsageUnknown: true, assistanceCount: 0, browserDomExecution: false, captchaCompleted: null });
    }
    await writeFile(out, JSON.stringify(report, null, 2) + '\n');
    const row = attempts.at(-1);
    console.log(JSON.stringify({ id, status: row.status, safeCasePass: row.safeCasePass, correctAnswers: row.correctAnswers, expectedAnswers: row.expectedAnswers,
      falseQuestions: row.errors?.filter(e => e.code === 'false-question').length, seconds: Number(row.wallSeconds.toFixed(3)), prompts: row.usage.prompts }));
  }
}
