"""Render the source-backed October 9 comparison for the GitHub README/report surface."""
from pathlib import Path
import json
import statistics
from html import escape

ROOT = Path(__file__).resolve().parents[2]
P = ROOT / 'evaluation/results'
matrix = json.loads((P / 'captcha-three-crops-oct9.json').read_text())
native = json.loads((P / 'captcha-native-oct9.json').read_text())
metrics = {r['id']: r['metrics'] for r in json.loads((P / 'captcha-run-metrics.json').read_text())['rows']}
nano_times = [r['durationMs'] / 1000 for r in matrix['trials'] if r['provider'] == 'nano-prompt-api']
configs = [
    ('codex-cli', 'gpt-6.1-sol', 'low', 'Codex CLI · GPT-6.1 Sol Low'),
    ('codex-cli', 'gpt-6.1-sol', 'xhigh', 'Codex CLI · GPT-6.1 Sol Extra High'),
    ('codex-cli', 'gpt-6-luna', 'low', 'Codex CLI · GPT-6 Luna Low'),
    ('codex-cli', 'gpt-6-luna', 'xhigh', 'Codex CLI · GPT-6 Luna Extra High'),
    ('eve-0.71.2', 'gpt-6.1-sol', 'low', 'Eve 0.71.2 · GPT-6.1 Sol Low'),
    ('nano-prompt-api', 'Gemini Nano (Chrome managed)', None, 'Gemini Nano · version/effort managed'),
]


def money(value):
    return '$' + format(value, '.6f') if value is not None else 'Unknown'


def cost(rows):
    low = [metrics[r['id']]['apiPriceEstimateLowerUsd'] for r in rows]
    high = [metrics[r['id']]['apiPriceEstimateUpperUsd'] for r in rows]
    if any(v is None for v in low + high): return 'Unknown'
    lo, hi = sum(low), sum(high)
    return money(lo) + ('–' + money(hi) if lo != hi else '')


def record_link(file, record):
    text = (P / file).read_text()
    pos = text.index('"id": ' + json.dumps(record['id']))
    line = text[:pos].count('\n') + 1
    return f"[{record['id']}](../evaluation/results/{file}#L{line})"


parts = ['# Fresh CAPTCHA tests · October 9', '',
    '**36 fresh image classifications and three installed native attempts are retained.** The shared native executor visibly accepted two WIC checkboxes, in **2.494 s and 1.882 s**, with **zero image-model calls and $0 marginal API cost**. The initial offscreen attempt handed off in 0.031 s; both accepted attempts followed operator viewport preparation. Application Submit stayed untouched.', '',
    '**One post-CAPTCHA workflow reached final review; neither correctly completed the form.** The Codex-origin workflow reached `ready_for_review` 39.105 s after acceptance, but still had an incomplete home address and an unnecessary mailing fill. The Nano-origin page continued with the globally configured CLI default, then stopped at `navigation_unknown` 75.357 s after acceptance. This is not a Nano-only completion. Exact underlying CLI continuation model/effort were not recorded.', '',
    '[Every error with exact run/model provenance](BENCHMARK_ERRORS.md#exact-run-provenance) · [Every CAPTCHA run’s speed, tokens and cost](CAPTCHA_RUN_METRICS.md) · [36 image receipts](../evaluation/results/captcha-three-crops-oct9.json) · [Three native receipts and continuation events](../evaluation/results/captcha-native-oct9.json)', '',
    '## Image classification across three grids', '',
    'Each configuration made **six fresh calls: three unique saved 3×3 grids, two repeats each**. Expected tile sets were traffic lights `[1,8,9]`, bridges `[4,6,7,9]`, and bicycles `[1,3,6]`. A human reviewed the sets; prior live acceptance also supports the bridge/bicycle sets. These new image answers were not submitted to a live CAPTCHA. Exact-set correctness, model handoff, live acceptance and form completion are separate metrics.', '',
    '![Exact sets, wrong sets and handoffs across three grids](assets/captcha-three-grid-quality.svg)', '',
    '| Requested configuration | Traffic lights | Bridges | Bicycles | Exact / 6 | Wrong / handoff | Call seconds: min / median / max | API-price scenario for all 6 calls¹ |',
    '|---|---:|---:|---:|---:|---:|---:|---:|']
groups = []
for provider, model, effort, label in configs:
    rows = [r for r in matrix['trials'] if (r['provider'], r['requestedModel'], r['requestedReasoning']) == (provider, model, effort)]
    assert len(rows) == 6
    counts = {key: sum(r['outcome'] == key for r in rows) for key in ['exact_set', 'wrong_set', 'model_handoff', 'adapter_error']}
    assert sum(counts.values()) == 6
    times = [r['durationMs'] / 1000 for r in rows]
    grid = [f"{sum(r['exactSetCorrect'] is True for r in rows if r['fixtureId'] == key)}/2" for key in ['traffic-lights','bridges','bicycles']]
    parts.append('| ' + ' | '.join([label, *grid, str(counts['exact_set']), f"{counts['wrong_set']} / {counts['model_handoff']}", f'{min(times):.3f} / {statistics.median(times):.3f} / {max(times):.3f}', '**$0 API cost**' if provider == 'nano-prompt-api' else cost(rows)]) + ' |')
    groups.append((label, rows, counts, statistics.median(times)))
parts += ['', '¹ CLI/Eve used subscription transport: **$0 direct API-key charges**, with actual subscription allocation and billed cost unknown. The dollar ranges replay measured tokens at the [October 9 rates](../evaluation/installed-v014/pricing-2026-10-09.json), using ordinary-input vs cache-write scenarios. They are not invoices or confidence intervals. Eve did not retain cache counters, so scenarios assume zero cached input. Reasoning is already in output usage; do not add it twice. **Nano API cost is $0**, with no provider token billing; energy/device/operating cost is unmeasured.', '',
    'Sol Low and Extra High each matched 4/6 sets, but failed differently: Low added a bicycle tile twice; Extra High handed off both bicycle repeats. Eve matched 3/6, Luna Low 2/6, Luna Extra High 1/6 and Nano 0/6. This tiny set does not establish general CAPTCHA accuracy or a best overall model. A returned `handoff` is observable; the product schema does not preserve a motive, so it is not automatically called a refusal.', '',
    f'Nano’s first call took {nano_times[0]:.3f} s; its other calls took {min(nano_times[1:]):.3f}–{max(nano_times[1:]):.3f} s. Startup, session and inference time are combined in this product adapter; the cause of the first-call difference was not isolated. Faster later calls still produced wrong sets or handoff. These image-call times should not be compared directly with the 243.297-second, nine-prompt form workflow.', '',
    'Jev 1.13.0 has no image adapter on this text/JSON route. Its image accuracy is **not tested**, rather than 0%. Jev can share the native checkbox mechanism and delegate images to a separate classifier; no Jev-configured native attempt was executed in this follow-up. Extra High is a requested reasoning flag; provider-resolved CLI/Eve identity remains unavailable. Nano exposes neither exact version nor reasoning.', '',
    '## Installed native attempts and form continuation', '',
    '| Native attempt / configured image fallback | Native engine time | Live result | Image calls / API cost | Form continuation |', '|---|---:|---|---|---|']
for r in native['trials']:
    f = r.get('postAcceptanceFormContinuation')
    fallback = r['configuredImageModel'] + (' · ' + r['configuredReasoning'] if r['configuredReasoning'] else ' · effort managed')
    continuation = 'Not started' if not f else f"CLI default (model/effort unknown): {f['terminalCheckpoint']} after {f['acceptedToTerminalSeconds']:.3f} s; {f['modelCalls']} calls, {f['inputTokens']:,} input / {f['outputTokens']:,} output tokens. $0 direct API-key charge; model-price estimate unknown."
    parts.append(f"| {record_link('captcha-native-oct9.json',r)}<br>{fallback} **configured, not called** | {r['durationMs']/1000:.3f} s | {r['reason'].replace('_',' ')} | 0 / **$0** | {continuation} |")
parts += ['', 'The shared executor performed the checkbox clicks; no tested image model acted on these live checkboxes. Accepted-at-attempt is not indefinite readiness: later inspection showed an unchecked/recreated widget after the review delay. Expiry vs recreation was not isolated, and is not counted as an image-model error. One external batch confirmation covered these tests; the extension’s own per-attempt authorization was used. There was no locked-computer interruption in these three attempts.', '',
    'The final-review UI showed **50 VERIFIED** by repeating fields from prior readbacks. There are 19 visible controls and 17 applicable semantic answers, of which 16 matched the source. The badge is not a distinct-answer correctness score. No certification or application submission occurred.', '',
    '## Individual image errors, timing and usage', '',
    'Source links identify the exact run. Input/output/cached are provider tokens; Nano uses **context units**, not billable API tokens. Missing counters are explicitly unknown. Every handoff stays in the six-attempt denominator.']
for label, rows, counts, median in groups:
    parts += ['', '### ' + label, '', '| Run · grid/repeat | Expected → returned / outcome | Elapsed | Input / output / cached tokens; context units | API-price scenario¹ |', '|---|---|---:|---|---:|']
    for r in rows:
        m = metrics[r['id']]
        usage = ' / '.join(str(m[k]) if m[k] is not None else 'unknown' for k in ['inputTokens','outputTokens','cachedInputTokens'])
        if m['contextUsageUnits'] is not None: usage += '; ' + str(m['contextUsageUnits']) + ' context units'
        observed = r['answer']['tiles'] if r['answer'] else None
        result = f"{r['adjudicatedTiles']} → {observed}; **{r['outcome']}**"
        if r['missedTiles'] or r['extraTiles']: result += f"; missed {r['missedTiles']}, extra {r['extraTiles']}"
        parts.append(f"| {record_link('captcha-three-crops-oct9.json',r)} | {result} | {r['durationMs']/1000:.3f} s | {usage} | {'**$0 API cost**' if r['provider']=='nano-prompt-api' else cost([r])} |")
parts += ['', '## Reproduce and interpret', '',
    'The current product adapters and fixed response schema were used. CLI/Eve calls ran sequentially with configuration order reversed on repeat 2, in traffic-light/bridge/bicycle order. Nano ran afterward on the same device/profile with fresh image sessions. These are product-system comparisons with different framework contexts and prompts, not an isolated causal model comparison. Exact crop hashes, bounds, source screenshot hashes, UTC timestamps and reviewed expected sets are retained in each receipt. Pixels, full screenshots, applicant records and access credentials remain local.', '',
    'To run the CLI/Eve matrix with your own authorized saved crops, create a local JSON manifest with `fixtures` containing `id`, `path`, `task`, `tileCount`, `expectedTiles`, `cropBounds`, `sourceScreenshotSha256` and `groundTruthBasis`; start the authenticated subscription CLI and optional Eve service, then run:', '',
    '```sh\nnode evaluation/captcha/run-image-matrix.mjs --manifest /absolute/local/manifest.json --output-dir /absolute/fresh-results\n```', '',
    'This performs classification only. The current public receipts do not include pixels for an exact visual replay. Native reproduction: stage an approved synthetic WIC workflow at CAPTCHA, retain an initial offscreen failure if it occurs, bring the widget into view, authorize the native attempt, then export the activity log and observe acceptance plus the continuation checkpoint. Keep form runtime and image runtime identities separate. Final Submit stays untouched.', '',
    'Next evidence should add independently reviewed images and fresh live native image challenges, more fictional records and site types, explicit form-model/effort controls, and bounded completion tests after address/gap fixes. The observed Jev speed advantage remains promising; it is not a demonstrated complete-application quality win. [Harness recovery proposal and current code evidence](INSTALLED_V014_BATCH.md#can-a-better-harness-keep-jev-moving) explain why a blind retry loop alone does not establish a fix.', '']
(ROOT / 'docs/CAPTCHA_OCT9.md').write_text('\n'.join(parts))

# GitHub Markdown is the requested delivery surface; reuse its existing SVG asset convention.
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="530" viewBox="0 0 1040 530" role="img" aria-labelledby="title desc">',
    '<title id="title">October 9 product image results across three saved grids</title>',
    '<desc id="desc">Six attempts per configuration on three unique grids, repeated twice. Bars show exact sets, wrong sets and handoffs; times are medians, not full CAPTCHA or application completion.</desc>',
    '<rect width="1040" height="530" fill="white"/><g font-family="system-ui,sans-serif" fill="#163b4b">',
    '<text x="24" y="34" font-size="23" font-weight="700">Image answers vary by task and runtime</text>',
    '<text x="24" y="62" font-size="15">October 9 · 3 saved grids × 2 repeats per configuration · no live image submissions</text>',
    '<rect x="24" y="81" width="15" height="15" fill="#176b78"/><text x="45" y="94" font-size="14">Exact set</text>',
    '<rect x="150" y="81" width="15" height="15" fill="#d98c00"/><text x="171" y="94" font-size="14">Wrong set</text>',
    '<rect x="288" y="81" width="15" height="15" fill="#b8c0c7"/><text x="309" y="94" font-size="14">Handoff</text>',
    '<text x="762" y="117" font-size="14">Median call time (seconds)</text>']
for i, (label, rows, counts, median) in enumerate(groups):
    y = 137 + 51*i
    short = label.replace('GPT-6.1 ', '').replace('GPT-6 ', '').replace('Extra High','XHigh').replace('0.71.2 ', '').replace('version/effort managed','Chrome managed')
    svg.append(f'<text x="24" y="{y+21}" font-size="15">{escape(short)}</text>')
    x = 310
    for key, color, text_color in [('exact_set','#176b78','white'),('wrong_set','#d98c00','#163b4b'),('model_handoff','#b8c0c7','#163b4b')]:
        count = counts[key]; width = count * 66
        if count:
            svg.append(f'<rect x="{x}" y="{y}" width="{width}" height="30" fill="{color}"/><text x="{x+width/2}" y="{y+21}" text-anchor="middle" font-size="16" fill="{text_color}">{count}</text>')
        x += width
    svg.append(f'<text x="762" y="{y+21}" font-size="17">{median:.3f} s</text>')
svg.append('<line x1="310" y1="442" x2="706" y2="442" stroke="#163b4b"/>')
for i in range(7): svg.append(f'<text x="{310+66*i}" y="464" text-anchor="middle" font-size="13">{i}</text>')
svg += ['<text x="310" y="485" font-size="14">Attempts (each bar totals 6)</text>',
    '<text x="24" y="513" font-size="14">Three unique images are exploratory evidence. Jev has no image adapter; accuracy not tested.</text>', '</g></svg>']
(ROOT / 'docs/assets/captcha-three-grid-quality.svg').write_text('\n'.join(svg)+'\n')
print('Built the 36-run comparison, three native receipts, exact error table and chart.')
