import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const load = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const pricesText = await readFile(new URL('evaluation/controlled-planning/pricing.json', root), 'utf8');
const prices = JSON.parse(pricesText);
const jevPrice = (await load('evaluation/results/jev-summary.json')).pricing;
const actions = await load('evaluation/results/captcha-oct7-actions.json');
const images = await load('evaluation/results/captcha-oct7-images.json');
const summary = await load('evaluation/results/captcha-oct7-summary.json');
const fixture = await load('evaluation/results/captcha-native-fixture.json');
const adapters = await load('evaluation/results/captcha-native-adapter-models.json');
const validation = await load('evaluation/results/captcha-native-adapter-validation.json');
const known = (number) => typeof number === 'number' && Number.isFinite(number) && number >= 0;
function interval(start, end) {
  const elapsed = Date.parse(end) - Date.parse(start);
  return known(elapsed) ? elapsed : null;
}
function metrics(row) {
  const usage = row.usage || {};
  const rate = prices.models[row.requestedModel];
  const input = usage.inputTokens, output = usage.outputTokens, cached = usage.cachedInputTokens ?? usage.cacheReadTokens ?? 0;
  let estimate = null, upper = null, basis = 'Usage or compatible rate unavailable';
  let source = null, verifiedAt = null;
  if (row.provider === 'jev-api' && known(input)) {
    estimate = input * jevPrice.inputUsdPerMillionTokens / 1e6; upper = estimate;
    source = jevPrice.source; verifiedAt = jevPrice.checkedAt; basis = 'Published input-token estimate; invoice unverified';
  } else if (rate && known(input) && known(output) && known(cached) && cached <= input) {
    estimate = ((input - cached) * rate.inputPerMillion + cached * rate.cachedInputPerMillion + output * rate.outputPerMillion) / 1e6;
    upper = ((input - cached) * rate.cacheWritePerMillion + cached * rate.cachedInputPerMillion + output * rate.outputPerMillion) / 1e6;
    source = rate.source; verifiedAt = prices.verifiedAt; basis = 'Hypothetical API price scenario for subscription run; range is ordinary-input vs cache-write scenario, not confidence or invoice';
  }
  return { runtimeElapsedMs: known(row.durationMs) ? row.durationMs : null,
    pureInferenceMs: known(row.modelMs) ? row.modelMs : null,
    runtimeTimeBasis: 'Call wall time including runtime/session startup; pure inference isolated only where separately recorded',
    browserObservationIntervalMs: interval(row.browserExecution?.startedAt, row.browserExecution?.observedAt),
    browserTimeBasis: 'Recorded relay start to visible observation; includes orchestration/waiting, not isolated click latency',
    endToEndMs: null, endToEndTimeBasis: 'Phases were noncontiguous and not measured as one journey',
    inferenceCalls: row.modelCalls ?? row.inferenceCalls ?? null,
    directApiKeyChargeUsd: row.directApiKeyChargeUsd ?? null,
    apiPriceEstimateLowerUsd: estimate, apiPriceEstimateUpperUsd: upper, apiPriceBasis: basis, pricingSource: source, pricingVerifiedAt: verifiedAt,
    providerReportedCostUsd: null, billedCostUsd: row.billedCostUsd ?? null,
    unreportedCacheAssumedZeroForScenario: rate && known(input) ? !known(usage.cachedInputTokens ?? usage.cacheReadTokens) : false,
    totalOperatingCostUsd: null, subscriptionAllocationUsd: null, deviceCostUsd: null, reviewAndRelayCostUsd: null };
}
const rows = [
  ...actions.trials.map((row) => ({ id: row.id, layer: 'checkbox-action', provider: row.provider, model: row.requestedModel, reasoning: row.requestedReasoning,
    repeat: row.repeat, outcome: row.browserExecution.status, metrics: metrics(row) })),
  ...images.trials.map((row) => ({ id: row.trialId || row.id, layer: 'image-classification', provider: row.provider, model: row.requestedModel, reasoning: row.requestedReasoning,
    repeat: row.repeat, outcome: row.error ? 'error_or_missing_result' : row.siteAccepted === false ? 'live_rejected' : row.siteAccepted === true ? 'live_accepted' : row.exactSetCorrect === true ? 'exact_set_correct' : row.exactSetCorrect === false ? 'incorrect_set_or_refusal' : 'unscored', metrics: metrics(row) })),
  { id: 'historical-oct5-chat-checkbox', layer: 'historical-checkbox', provider: 'Codex chat browser control', model: 'gpt-6.1-sol', reasoning: 'xhigh', repeat: 1, outcome: 'accepted', metrics: metrics({}) },
  ...images.infrastructureFailures.map((batch) => ({ id: `infrastructure-${batch.batch}`, layer: 'infrastructure-failure', provider: 'codex-cli', model: null, reasoning: null,
    attempts: batch.attempts, outcome: batch.reason, metrics: { ...metrics({ modelCalls: batch.inferenceCalls, directApiKeyChargeUsd: 0 }), runtimeTimeBasis: 'Original startup failures have no preserved per-attempt elapsed-time measurements; do not infer zero' } })),
  ...fixture.trials.map((trial, index) => ({ id: trial.id, layer: 'native-fixture', provider: 'extension frame adapter', model: null, reasoning: null, repeat: index + 1,
    outcome: '4 mechanical checks passed; no real CAPTCHA', metrics: { ...metrics({ durationMs: trial.durationMs, modelCalls: 0, directApiKeyChargeUsd: 0 }),
      runtimeTimeBasis: fixture.scope } })),
  ...adapters.trials.map((row) => ({ id: row.id, layer: 'product-adapter-image', provider: row.provider, model: row.requestedModel, reasoning: row.requestedReasoning, repeat: row.repeat,
    outcome: row.exactSetCorrect === true ? 'exact_set_correct' : row.error ? 'error' : 'incorrect_set', metrics: metrics(row) })),
  ...validation.trials.map((row) => ({ id: `${row.id}-validation`, layer: 'product-adapter-validation', provider: row.provider, model: row.requestedModel, reasoning: row.requestedReasoning, repeat: row.repeat,
    outcome: 'MIME validation rejected before inference', metrics: { ...metrics(row), runtimeTimeBasis: 'Request-validation wall time; no model inference occurred' } })),
];
const ledger = { schema: 'captcha-run-metrics/v1', generatedFrom: ['captcha-oct7-actions.json', 'captcha-oct7-images.json', 'captcha-summary.json', 'captcha-native-fixture.json', 'captcha-native-adapter-models.json', 'captcha-native-adapter-validation.json'],
  priceSnapshotSha256: createHash('sha256').update(pricesText).digest('hex'), rows,
  limits: ['All missing speed/cost metrics are explicit nulls, not zeros.', 'API scenarios are not subscription or billed amounts.',
    'Failures and the historical untimed trial remain included.', 'Eight startup failures are preserved as one batch because individual timings were not retained.',
    'No complete benefit application, native-extension live CAPTCHA, or total operating cost was measured.'] };
await writeFile(new URL('evaluation/results/captcha-run-metrics.json', root), JSON.stringify(ledger, null, 2) + '\n');
const seconds = (ms) => known(ms) ? `${(ms / 1000).toFixed(3)} s` : 'Unknown';
const money = (value) => known(value) ? `$${value.toFixed(6)}` : 'Unknown';
function estimate(row) { const m = row.metrics; return m.apiPriceEstimateLowerUsd === null ? 'Unknown' : `${money(m.apiPriceEstimateLowerUsd)}${m.apiPriceEstimateUpperUsd !== m.apiPriceEstimateLowerUsd ? `–${money(m.apiPriceEstimateUpperUsd)}` : ''}`; }
const markdown = [
  '# CAPTCHA speed and cost for every retained run', '',
  'The ledger covers all 14 October 7 action trials, all 21 image trials, the October 5 historical trial, the batch of eight CLI startup failures, four October 8 product-adapter image calls, four MIME-validation failures, and two native browser fixture attempts. Failures and missing results stay in the denominator. **Unknown means unmeasured, not zero.**', '',
  'Runtime elapsed time includes setup and the model request. Nano alone exposes a separate prompt-time measurement. Browser observation intervals include relay orchestration and waiting. End-to-end journey time was not measured, and these noncontiguous phases cannot be added into a complete application duration.', '',
  `Costs use the [October 6 price snapshot](../evaluation/controlled-planning/pricing.json) for hypothetical CLI/Eve API scenarios and the [October 7 Jev rate snapshot](../evaluation/results/jev-summary.json). Ranges reflect two cache-pricing scenarios, not statistical confidence. Actual billed amount, subscription allocation, device, relay, review and total operating cost remain unknown for every run. CLI/Eve/Nano used no directly billed API key; Jev used an API key, so its actual direct charge is unknown. Nano has no token-priced API estimate.`, '',
  'Where cache counters were not recorded, the API scenario assumes zero cached input; the ledger flags this assumption. It is not an attested cache charge. Failed requests without usage retain an unknown model-price estimate.', '',
  '[Machine-readable full ledger](../evaluation/results/captcha-run-metrics.json) · [Original actions](../evaluation/results/captcha-oct7-actions.json) · [Original image trials](../evaluation/results/captcha-oct7-images.json)', '',
];
for (const [layer, heading] of [['checkbox-action', 'Checkbox action selection and live relay outcome'], ['image-classification', 'Every October 7 image call, including timeouts and rejected answers'], ['product-adapter-image', 'October 8 product image adapters: classification only'], ['product-adapter-validation', 'October 8 MIME-validation failures before inference'], ['historical-checkbox', 'Earlier chat observation'], ['infrastructure-failure', 'Startup failures before inference']]) {
  markdown.push(`## ${heading}`, '', '| Trial | Outcome | Runtime elapsed | Pure inference | Browser observation interval | API-price estimate/scenario | Direct API-key charge | Billed cost |', '|---|---|---:|---:|---:|---:|---:|---:|');
  for (const row of rows.filter((item) => item.layer === layer)) markdown.push(`| ${row.id}${row.attempts ? ` (${row.attempts} attempts)` : ''} | ${row.outcome.replaceAll('_', ' ')} | ${seconds(row.metrics.runtimeElapsedMs)} | ${seconds(row.metrics.pureInferenceMs)} | ${seconds(row.metrics.browserObservationIntervalMs)} | ${estimate(row)} | ${money(row.metrics.directApiKeyChargeUsd)} | Unknown |`);
  markdown.push('');
}
markdown.push('## Native v0.14 actuator checks', '', 'Native adapter unit/integration tests and the deterministic browser fixture are separate from live CAPTCHA/model accuracy. Both browser-fixture repeats passed four checks in 5.4 / 6.4 ms with zero model calls and $0 direct API-key charge. The second repeat verified the final cancellation hardening. These exercise no real anti-bot service, screenshot/crop transport, or installed-extension application journey. Total operating cost is unknown. [Fixture receipts](../evaluation/results/captcha-native-fixture.json).', '');
await writeFile(new URL('docs/CAPTCHA_RUN_METRICS.md', root), markdown.join('\n'));
const esc = (text) => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="980" height="710" viewBox="0 0 980 710" role="img" aria-labelledby="title desc">',
  '<title id="title">CAPTCHA checkbox decision speed and cost</title><desc id="desc">Median runtime elapsed time for two checkbox decisions per configuration. Right-hand column shows token price estimates for those two calls; these are not billed costs. Browser relay time and image time are separate.</desc>',
  '<rect width="980" height="710" fill="#fff"/><g font-family="system-ui,sans-serif" fill="#163b4b">',
  '<text x="24" y="35" font-size="22" font-weight="700">Checkbox decisions: speed and cost</text>',
  '<text x="24" y="63" font-size="14">October 7 · two calls per configuration · initial text decision only</text>',
  '<text x="310" y="106" font-size="13">Median runtime elapsed (seconds)</text><text x="685" y="106" font-size="13">Two-call API estimate / scenario</text>'];
const labels = { codex: 'Codex CLI', eve: 'Eve', 'jev-api': 'Jev', 'nano-prompt-api': 'Nano' };
for (let i = 0; i < summary.rows.length; i++) {
  const row = summary.rows[i], y = 143 + i * 61;
  const selected = rows.filter((r) => r.layer === 'checkbox-action' && r.provider === row.provider && r.model === row.model && (r.reasoning === row.reasoning || row.provider === 'jev-api' || row.provider === 'nano-prompt-api'));
  const lower = selected.every((r) => known(r.metrics.apiPriceEstimateLowerUsd)) ? selected.reduce((sum, r) => sum + r.metrics.apiPriceEstimateLowerUsd, 0) : null;
  const upper = selected.every((r) => known(r.metrics.apiPriceEstimateUpperUsd)) ? selected.reduce((sum, r) => sum + r.metrics.apiPriceEstimateUpperUsd, 0) : null;
  const label = `${labels[row.provider]} · ${row.model.includes('sol') ? 'Sol ' : row.model.includes('luna') ? 'Luna ' : ''}${row.provider === 'jev-api' ? '1.13.0' : row.provider === 'nano-prompt-api' ? 'Chrome managed' : row.reasoning === 'xhigh' ? 'Extra High' : 'Low'}`;
  svg.push(`<text x="24" y="${y + 18}" font-size="15">${esc(label)}</text><rect x="310" y="${y}" width="${(row.actionMedianSeconds / 8 * 300).toFixed(2)}" height="28" rx="3" fill="#167e98"/><text x="${320 + row.actionMedianSeconds / 8 * 300}" y="${y + 19}" font-size="14">${row.actionMedianSeconds.toFixed(3)} s</text><text x="685" y="${y + 18}" font-size="14">${lower === null ? row.provider === 'nano-prompt-api' ? '$0 API-key; device unknown' : 'Unknown' : `${money(lower)}${lower !== upper ? '–' + money(upper) : ''}`}</text>`);
}
for (const tick of [0, 2, 4, 6, 8]) svg.push(`<text x="${310 + tick / 8 * 300}" y="590" font-size="12">${tick}</text>`);
svg.push('<text x="24" y="625" font-size="14">CLI / Eve: hypothetical API scenarios; actual subscription allocation is unknown.</text>',
  '<text x="24" y="650" font-size="14">Jev: published input-token estimate. Billed and total operating costs are unknown for all.</text>',
  '<text x="24" y="677" font-size="14">Every image call, timeout and live relay interval appears in the linked per-run ledger.</text></g></svg>');
await writeFile(new URL('docs/assets/captcha-speed-cost.svg', root), svg.join('\n') + '\n');
const adapterSvg = ['<svg xmlns="http://www.w3.org/2000/svg" width="980" height="420" viewBox="0 0 980 420" role="img" aria-labelledby="title desc">',
  '<title id="title">Corrected product image adapter speed and cost</title><desc id="desc">Two classification repeats per adapter on one frozen image. Both adapters requested GPT-6.1 Sol Low and returned the exact tile set twice. Bars show runtime elapsed time; dollar values are hypothetical API scenarios, not billed cost.</desc>',
  '<rect width="980" height="420" fill="#fff"/><g font-family="system-ui,sans-serif" fill="#163b4b"><text x="24" y="34" font-size="22" font-weight="700">Product image adapters: speed and cost</text>',
  '<text x="24" y="62" font-size="14">October 8 · one unique image · classification only · corrected MIME setup</text>',
  '<text x="260" y="94" font-size="13">Runtime elapsed, seconds</text><text x="645" y="94" font-size="13">API scenario per repeat, USD</text>'];
for (let i = 0; i < adapters.trials.length; i++) {
  const trial = adapters.trials[i], y = 121 + i * 46;
  const row = rows.find((r) => r.layer === 'product-adapter-image' && r.id === trial.id);
  const value = trial.durationMs / 1000;
  adapterSvg.push(`<text x="24" y="${y + 17}" font-size="15">${trial.provider === 'codex-cli' ? 'Codex CLI' : 'Eve'} · Sol Low · r${trial.repeat}</text><rect x="260" y="${y}" width="${(value / 12 * 270).toFixed(2)}" height="25" rx="3" fill="${trial.repeat === 1 ? '#167e98' : '#66aebf'}"/><text x="${270 + value / 12 * 270}" y="${y + 17}" font-size="14">${value.toFixed(3)} s</text><text x="645" y="${y + 17}" font-size="14">${esc(estimate(row))}</text>`);
}
adapterSvg.push('<text x="24" y="335" font-size="14">Both: 2/2 exact sets. $0 direct API-key charge; billed and total operating cost unknown.</text>',
  '<text x="24" y="361" font-size="14">Different framework envelopes and sequential order; no causal speed ranking.</text>',
  '<text x="24" y="387" font-size="14">Four pre-inference validation failures remain in the full ledger. Eve cache assumed zero.</text></g></svg>');
await writeFile(new URL('docs/assets/captcha-adapter-speed-cost.svg', root), adapterSvg.join('\n') + '\n');
process.stdout.write(`Recorded speed/cost fields for ${rows.length} retained rows, including one 8-attempt infrastructure batch.\n`);
