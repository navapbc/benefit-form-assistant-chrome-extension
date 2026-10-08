// Classification smoke test of the actual v0.14 image adapters. No browser actions.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { runCaptchaRequest } from '../../model-bridge/captcha.mjs';
const option = (key) => { const index = process.argv.indexOf(key); return index < 0 ? null : process.argv[index + 1]; };
if (!option('--image') || !option('--output-dir')) throw new Error('Supply a saved public challenge crop and a fresh output directory.');
const out = resolve(option('--output-dir')); await mkdir(out);
const bytes = await readFile(resolve(option('--image')));
const mime = bytes[0] === 0xff && bytes[1] === 0xd8 ? 'image/jpeg' : 'image/png';
const providers = String(option('--providers') || 'codex,eve').split(',');
if (providers.some((provider) => !['codex', 'eve'].includes(provider))) throw new Error('Supported image adapters: codex,eve.');
const rows = [];
for (const provider of providers) for (let repeat = 1; repeat <= 2; repeat++) {
  const start = performance.now(), startedAt = new Date().toISOString();
  let answer = null, error = null, result = null;
  try { result = await runCaptchaRequest({ provider, model: 'gpt-6.1-sol', reasoning: 'low', task: 'Select all images with traffic lights.', tileCount: 9, image: `data:${mime};base64,${bytes.toString('base64')}` }); answer = result.decision; }
  catch { error = 'Image adapter did not return a valid structured result'; }
  const row = { id: `v014-${provider}-gpt-6.1-sol-low-r${repeat}`, provider: provider === 'codex' ? 'codex-cli' : 'eve-0.71.2', repeat, requestedModel: 'gpt-6.1-sol', requestedReasoning: 'low',
    reportedModel: null, modelIdentityBasis: result?.modelIdentityBasis || 'Requested adapter configuration; resolved identity unavailable',
    startedAt, endedAt: new Date().toISOString(), durationMs: performance.now() - start, usage: result?.usage || null, modelCalls: answer ? 1 : null,
    answer, error, exactSetCorrect: answer ? answer.action === 'select' && JSON.stringify(answer.tiles) === '[1,8,9]' : null,
    imageSha256: createHash('sha256').update(bytes).digest('hex'), directApiKeyChargeUsd: 0, billedCostUsd: null,
    scope: 'v0.14 product image adapter classification on the previously adjudicated frozen grid; no installed extension, browser actuation or live verification', siteAccepted: null };
  rows.push(row); await writeFile(join(out, 'results.json'), JSON.stringify({ trials: rows }, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ id: row.id, elapsedMs: row.durationMs, exactSetCorrect: row.exactSetCorrect, error }) + '\n');
}
