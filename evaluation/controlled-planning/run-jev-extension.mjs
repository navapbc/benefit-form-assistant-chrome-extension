// Real current extension planner + paired companion, with fictional frozen cases.
import { createRequire } from 'node:module';
import { mkdir, access, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cases } from './cases.mjs';
import { scorePlan } from './score.mjs';
const require = createRequire(import.meta.url);
const engine = require('../../shared/form-engine.js');
const planner = require('../../shared/agentic-planner.js');
const token = process.env.NAVA_MODEL_BRIDGE_TOKEN;
if (!token) {
  console.log(JSON.stringify({ status: 'not-run', reason: 'Missing local companion pairing token', measuredAttempts: 0 }));
  process.exitCode = 2;
} else {
  const index = process.argv.indexOf('--output-dir');
  const out = resolve(index >= 0 ? process.argv[index + 1] : new URL('../local-results/jev-extension/', import.meta.url).pathname);
  let exists = false; try { await access(resolve(out, 'results.json')); exists = true; } catch {}
  if (exists) throw new Error('Choose a fresh output directory; existing results are preserved.');
  await mkdir(out, { recursive: true });
  planner.configure({ kind: 'local-cli', provider: 'jev', endpoint: process.env.NAVA_MODEL_BRIDGE_URL || 'http://127.0.0.1:4174', token });
  const attempts = [];
  for (const c of cases) for (const repeat of [1, 2]) {
    const start = performance.now(), startedAt = new Date().toISOString();
    try {
      const plan = await planner.plan({ engine, page: { domain: c.site === 'WIC' ? 'www.ruhealth.org' : 'synthetic.test' }, rawFields: c.rawFields, participant: c.participant });
      const { fieldChecks, wrongMappingDetails, ...score } = scorePlan(c, plan);
      attempts.push({ caseId: c.id, site: c.site, repeat, status: 'completed', startedAt, wallSeconds: (performance.now() - start) / 1000, score, metadata: plan.metadata, rejected: plan.rejected, assistanceCount: 0, browserDomExecution: false, captchaAttempts: 0 });
    } catch (error) {
      attempts.push({ caseId: c.id, site: c.site, repeat, status: 'failed', startedAt, wallSeconds: (performance.now() - start) / 1000, error: String(error.message), assistanceCount: 0, browserDomExecution: false, captchaAttempts: 0 });
    }
    await writeFile(resolve(out, 'results.json'), JSON.stringify({ scope: 'Actual extension planner and authenticated companion; frozen inventories, no DOM execution', model: 'jev-1.13.0', reasoningEffort: null, confidenceThreshold: 0.9, attempts }, null, 2) + '\n');
    const row = attempts.at(-1);
    console.log(JSON.stringify({ caseId: c.id, repeat, status: row.status, planningPass: row.score?.planningPass ?? null, wallSeconds: row.wallSeconds }));
  }
}
