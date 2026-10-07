import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { codexCall } from '../controlled-planning/codex-call.mjs';
import { schema, instructions, validateObservation, scoreDecision } from './decision.mjs';

const option = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
const input = option('--observation'), output = option('--output-dir');
if (!input || !output) throw new Error('Use --observation <confirmed observation.json> --output-dir <fresh directory>.');
const observation = validateObservation(JSON.parse(await readFile(resolve(input), 'utf8')));
const out = resolve(output);
try { await access(out); throw new Error('Output directory already exists; preserve every batch.'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
await mkdir(out, { recursive: true });
const providers = (option('--providers') || 'codex,eve').split(',');
if (providers.some(p => !['codex', 'eve'].includes(p))) throw new Error('Use codex and/or eve.');
const repeats = Number(option('--repeats') || 2);
if (![1, 2].includes(repeats)) throw new Error('This pilot permits one or two repeats.');
const configs = providers.flatMap(provider => provider === 'eve'
  ? [{ provider, model: 'gpt-6.1-sol', reasoning: 'low' }]
  : ['gpt-6.1-sol', 'gpt-6-luna'].flatMap(model => ['low', 'xhigh'].map(reasoning => ({ provider, model, reasoning }))));
const request = { role: 'captcha_action_selector', systemPrompt: instructions, prompt: JSON.stringify(observation), responseSchema: schema };
const rows = [];
await writeFile(join(out, 'observation.json'), JSON.stringify(observation, null, 2) + '\n');
for (let repeat = 1; repeat <= repeats; repeat++) for (const config of repeat === 1 ? configs : [...configs].reverse()) {
  const id = `${config.provider}-${config.model}-${config.reasoning}-r${repeat}`;
  const result = config.provider === 'eve' ? await (await import('./eve/eve-call.mjs')).eveCall(request) : await codexCall(request, { ...config, timeoutMs: 90000 });
  let decision = null, error = result.error || null;
  if (!error) try { decision = JSON.parse(result.text); } catch { error = 'Invalid decision JSON'; }
  const r = result.receipt;
  // Publish bounded receipts, not full session events or private workspace metadata.
  const row = { id, repeat, provider: config.provider, requestedModel: config.model, requestedReasoning: config.reasoning,
    reportedModel: r.reportedModel ?? null, modelIdentityBasis: r.modelIdentityBasis ?? 'Requested configuration; provider identity unavailable',
    startedAt: r.startedAt, endedAt: r.endedAt, durationMs: r.durationMs,
    usage: result.usage ?? r.usage ?? r.usageRaw ?? null,
    modelCalls: 1, error, decision, score: decision ? scoreDecision(observation, decision) : null,
    browserExecution: { status: 'not_attempted', executor: 'Codex chat browser relay', applicationSubmitted: false },
    assistanceCount: 0, directApiKeyChargeUsd: 0, billedCostUsd: null,
    observationSha256: createHash('sha256').update(JSON.stringify(observation)).digest('hex'),
    scope: 'Minimized observed unchecked checkbox; text action selection only, no browser tools in the tested runtime',
  };
  rows.push(row);
  await writeFile(join(out, 'results.json'), JSON.stringify(rows, null, 2) + '\n');
  console.log(JSON.stringify({ id, seconds: +(row.durationMs / 1000).toFixed(3), decision, correct: row.score?.correct ?? null, error }));
}
