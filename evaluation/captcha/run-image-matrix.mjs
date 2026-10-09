// Repeatable classification benchmark of the actual product adapters. No browser actions.
// Manifest images are local public challenge crops. Keep pixels and access credentials local.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { runCaptchaRequest } from '../../model-bridge/captcha.mjs';
const option = key => { const i = process.argv.indexOf(key); return i < 0 ? null : process.argv[i + 1]; };
if (!option('--manifest') || !option('--output-dir')) throw new Error('Use --manifest <local JSON> --output-dir <fresh directory>.');
const manifest = JSON.parse(await readFile(resolve(option('--manifest')), 'utf8'));
const out = resolve(option('--output-dir')); await mkdir(out);
const configs = [
  { provider: 'codex', model: 'gpt-6.1-sol', reasoning: 'low' },
  { provider: 'codex', model: 'gpt-6.1-sol', reasoning: 'xhigh' },
  { provider: 'codex', model: 'gpt-6-luna', reasoning: 'low' },
  { provider: 'codex', model: 'gpt-6-luna', reasoning: 'xhigh' },
  { provider: 'eve', model: 'gpt-6.1-sol', reasoning: 'low' },
];
const trials = [];
for (const fixture of manifest.fixtures) {
  const bytes = await readFile(resolve(fixture.path));
  const mime = bytes[0] === 0xff && bytes[1] === 0xd8 ? 'image/jpeg' : 'image/png';
  for (let repeat = 1; repeat <= 2; repeat++) for (const config of repeat === 1 ? configs : [...configs].reverse()) {
    const startedAt = new Date().toISOString(), start = performance.now();
    let result = null, error = null;
    try { result = await runCaptchaRequest({ ...config, task: fixture.task, tileCount: fixture.tileCount, image: `data:${mime};base64,${bytes.toString('base64')}` }); }
    catch (e) { error = e.message; }
    const answer = result?.decision || null;
    const selected = answer?.action === 'select';
    const expected = [...fixture.expectedTiles].sort((a, b) => a - b);
    const observed = selected ? [...answer.tiles].sort((a, b) => a - b) : null;
    const row = {
      id: `oct9-crops-${fixture.id}-${config.provider}-${config.model}-${config.reasoning}-r${repeat}`,
      batch: 'oct9-three-crop-product-adapters', provider: config.provider === 'codex' ? 'codex-cli' : 'eve-0.71.2',
      requestedModel: config.model, requestedReasoning: config.reasoning, reportedModel: null,
      modelIdentityBasis: result?.modelIdentityBasis || 'requested adapter flags; resolved identity unavailable',
      fixtureId: fixture.id, repeat, task: fixture.task, tileCount: fixture.tileCount,
      imageSha256: createHash('sha256').update(bytes).digest('hex'),
      sourceScreenshotSha256: fixture.sourceScreenshotSha256,
      cropBounds: fixture.cropBounds, adjudicatedTiles: expected, groundTruthBasis: fixture.groundTruthBasis,
      startedAt, endedAt: new Date().toISOString(), durationMs: performance.now() - start,
      answer, error, outcome: error ? 'adapter_error' : selected ? (JSON.stringify(observed) === JSON.stringify(expected) ? 'exact_set' : 'wrong_set') : 'model_handoff',
      exactSetCorrect: selected ? JSON.stringify(observed) === JSON.stringify(expected) : null,
      missedTiles: selected ? expected.filter(t => !observed.includes(t)) : null,
      extraTiles: selected ? observed.filter(t => !expected.includes(t)) : null,
      usage: result?.usage || null, modelCalls: result ? 1 : null,
      directApiKeyChargeUsd: 0, billedCostUsd: null, operatingCostUsd: null,
      scope: 'Fresh product-adapter inference on three saved public WIC crops; not live challenges, browser actuation, form completion or general CAPTCHA reliability',
      siteAccepted: null, applicationSubmitted: false,
    };
    trials.push(row);
    await writeFile(join(out, 'results.json'), JSON.stringify({ schema: 'nava.captcha-classification-matrix.v1', trials }, null, 2) + '\n');
    process.stdout.write(JSON.stringify({ id: row.id, seconds: +(row.durationMs / 1000).toFixed(3), outcome: row.outcome, missed: row.missedTiles, extra: row.extraTiles }) + '\n');
  }
}
