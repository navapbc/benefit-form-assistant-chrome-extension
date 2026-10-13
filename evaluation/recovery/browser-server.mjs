// Local development fixture only: real product scanner/filler + real paired Jev planner.
// Provider credentials remain in the companion. This is not a production WIC site or installed-extension attestation.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { cases, wicUrl } from './cases.mjs';
const require = createRequire(import.meta.url);
const engine = require('../../shared/form-engine.js'), planner = require('../../shared/agentic-planner.js'), adapters = require('../../shared/site-adapters.js');
const root = resolve(new URL('../..', import.meta.url).pathname);
const panel = await readFile(resolve(root, 'sidepanel/sidepanel.js'), 'utf8');
const context = { engine };
vm.runInNewContext(`${panel.slice(panel.indexOf('  function gapFromAgent('), panel.indexOf('  async function scanTab('))}\nresult=analysisFromAgentPlan;`, context);
const analyze = context.result;
planner.configure({ kind: 'local-cli', provider: 'jev', endpoint: process.env.NAVA_MODEL_BRIDGE_URL, token: process.env.NAVA_MODEL_BRIDGE_TOKEN });
const plansByJob = new Map(), attempts = [];
const output = process.env.NAVA_BROWSER_RECOVERY_OUTPUT || resolve(root, 'evaluation/local-results/jev-recovery-browser.json');
await mkdir(resolve(output, '..'), { recursive: true });
const staticFiles = new Map([
  ['/fixture', ['evaluation/recovery/browser-fixture.html', 'text/html']],
  ['/fixture.js', ['evaluation/recovery/browser-fixture.js', 'application/javascript']],
  ['/engine.js', ['shared/form-engine.js', 'application/javascript']],
  ['/adapters.js', ['shared/site-adapters.js', 'application/javascript']],
  ['/agent.js', ['content/form-agent.js', 'application/javascript']],
]);
function reply(res, status, payload) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(payload)); }
function semanticValue(fields, key) {
  const members = fields.filter(f => f.groupKey === key);
  if (members.length > 1) { const member = members.find(f => f.checked); return member?.optionValue || ''; }
  const f = fields.find(f => f.id === key);
  return f?.type === 'checkbox' ? (f.checked ? 'yes' : 'no') : (f?.value || '');
}
const server = createServer(async (req, res) => {
  try {
    if (req.headers.origin && req.headers.origin !== 'http://127.0.0.1:4198') return reply(res, 403, { error: 'Only the local fixture origin is allowed.' });
    if (req.method === 'GET' && staticFiles.has(req.url)) {
      const [path, mime] = staticFiles.get(req.url);
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' }); res.end(await readFile(resolve(root, path))); return;
    }
    if (req.method === 'GET' && req.url === '/controls') return reply(res, 200, cases[0].rawFields);
    if (req.method !== 'POST' || !['/plan', '/receipt'].includes(req.url)) return reply(res, 404, { error: 'Unknown fixture route.' });
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 100_000) throw new Error('Fixture inventory is too large.'); chunks.push(chunk); }
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const c = cases.find(c => c.id === body.caseId && c.site === 'WIC');
    if (!c || !Array.isArray(body.fields) || body.fields.length > 80 || !/^[a-zA-Z0-9-]{8,100}$/.test(body.jobId)) throw new Error('Invalid fixture job.');
    const fields = body.fields.map(f => ({ ...f, ...adapters.fieldPolicy('www.ruhealth.org', '/appointments/apply-4-wic-form', f) }));
    if (req.url === '/plan') {
      const start = performance.now();
      const plan = await planner.plan({ engine, page: { url: wicUrl, domain: 'www.ruhealth.org', documentId: body.jobId }, rawFields: fields, participant: c.participant });
      const analysis = analyze({ fields }, c.participant, plan);
      analysis.gaps = analysis.gaps.map(gap => ({ ...gap, semanticFieldKey: fields.find(field => field.fieldKey === gap.fieldKey)?.id || gap.fieldKey }));
      const job = plansByJob.get(body.jobId) || [];
      job.push({ metadata: plan.metadata, approved: plan.approved.map(a => ({ fieldKey: a.fieldKey, purpose: a.purpose, source: a.source, confidence: a.confidence ?? null })), wallMs: performance.now() - start });
      plansByJob.set(body.jobId, job);
      return reply(res, 200, { analysis, metadata: plan.metadata });
    }
    const job = plansByJob.get(body.jobId); if (!job?.length) throw new Error('No plans recorded for this fixture job.');
    const gapKey = key => fields.find(f => f.fieldKey === key)?.id || key;
    const actualGaps = (body.gaps || []).map(g => g.semanticFieldKey || gapKey(g.fieldKey));
    const errors = Object.entries(c.expectedValues).filter(([key, value]) => String(semanticValue(fields, key)).trim().toLowerCase() !== value.trim().toLowerCase())
      .map(([fieldKey]) => ({ code: 'incorrect-or-unfilled-answer', fieldKey }));
    errors.push(...actualGaps.filter(k => !c.expectedGaps.includes(k)).map(fieldKey => ({ code: 'false-question', fieldKey })),
      ...c.expectedGaps.filter(k => !actualGaps.includes(k)).map(fieldKey => ({ code: 'missing-question', fieldKey })),
      ...c.expectedBlank.filter(k => semanticValue(fields, k) !== '').map(fieldKey => ({ code: 'inapplicable-or-final-filled', fieldKey })));
    const sum = key => job.every(p => Number.isFinite(p.metadata.usage?.[key])) ? job.reduce((t,p) => t + p.metadata.usage[key],0) : null;
    const receipt = { id: `browser-${body.caseId}-r${attempts.filter(a => a.caseId === c.id).length + 1}`, caseId: c.id,
      scope: 'Local real-DOM WIC fixture using current product scanner/filler and authenticated Jev planner; no installed extension, live site, CAPTCHA or Submit.',
      model: 'jev-1.13.0', reasoningEffort: null, confidenceThreshold: 0.9, at: new Date().toISOString(), wallSeconds: body.wallSeconds,
      correctAnswers: Object.keys(c.expectedValues).length - errors.filter(e => e.code === 'incorrect-or-unfilled-answer').length, expectedAnswers: Object.keys(c.expectedValues).length,
      actualGaps, expectedGaps: c.expectedGaps, errors, safeCasePass: errors.length === 0 && body.blockedCount === 0,
      completeSource: c.completeSource, blockedCount: body.blockedCount, verifiedWrites: body.verifiedWrites, wholeApplicationCompletion: null,
      captchaCompleted: null, captchaAttempts: 0, assistanceCount: 0,
      usage: { prompts: sum('prompts'), inputTokens: sum('inputTokens'), outputTokens: sum('outputTokens'), estimatedApiCostUsd: sum('estimatedApiCostUsd'), apiCostUsd: sum('apiCostUsd'), providerReportedCostUsd: sum('providerReportedCostUsd') },
      scans: job };
    attempts.push(receipt); await writeFile(output, JSON.stringify({ scope: receipt.scope, attempts }, null, 2) + '\n');
    return reply(res, 200, receipt);
  } catch (error) { reply(res, 400, { error: String(error.message) }); }
});
server.listen(4198, '127.0.0.1', () => console.log('Real-DOM recovery fixture ready: http://127.0.0.1:4198/fixture'));
